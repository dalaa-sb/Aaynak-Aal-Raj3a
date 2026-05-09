# AAR — System Architecture

## High-level data flow

```
┌─────────────────────────┐
│  Camera / Demo Images   │  YOLOv8 person detection
└────────────┬────────────┘  + centroid tracking (run_ai.py)
             │
             ▼
┌─────────────────────────┐
│   AI Module (Python)    │  Queue counts, area-stay events
│   - detector.py         │  Posts via HTTP to backend
│   - tracker.py          │
└────────────┬────────────┘
             │ POST /api/queue/ingest
             │ POST /api/tracking/ingest
             │ POST /api/alerts/  (alerts on threshold breach)
             ▼
┌─────────────────────────────────────────────────────────────┐
│               FastAPI Backend (port 8000)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │
│  │  Auth    │ │  Alerts  │ │ Reports  │ │  Audit / Health │ │
│  │  Module  │ │  + LCM   │ │  + PDF   │ │  + WebSockets   │ │
│  └──────────┘ └──────────┘ └──────────┘ └─────────────────┘ │
│       │            │            │             │              │
└───────┼────────────┼────────────┼─────────────┼──────────────┘
        │            │            │             │
        ▼            ▼            ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                  MongoDB Atlas                               │
│  users · alerts · queue_snapshots · suspicious_reports       │
│  tracking_events · zone_status · reports · audit_logs        │
└─────────────────────────────────────────────────────────────┘
        ▲
        │ (read)
        │
┌─────────────────────────────────────────────────────────────┐
│  React Dashboard (port 3000) — Inter + IBM Plex Sans Arabic  │
│  Login · Dashboard · Cameras · Alerts (lifecycle) · Reports  │
│  Users · Audit Log · System Health · Settings                │
└─────────────────────────────────────────────────────────────┘
        ▲
        │ (live updates)
        │
   WebSocket /ws — alert created, status changed, queue update
```

## Authentication flow

```
Signup (with ID image upload)
  → backend validates magic bytes + Pillow decode
  → bcrypt-hash password (rounds=12)
  → create user in MongoDB
  → generate 6-digit verification code (15 min TTL)

Login
  → constant-time bcrypt verify (even on missing user — timing safety)
  → check email verified; check not locked out (5 fails / 15 min)
  → issue JWT (HS256, 60 min, role claim)
  → return Bearer token

Authenticated request
  → frontend stores token in sessionStorage
  → sends `Authorization: Bearer <jwt>`
  → backend HTTPBearer dependency verifies signature + expiration
  → `require_admin` / `require_role` enforces RBAC server-side
```

## Incident lifecycle

```
   ┌────┐   ack   ┌──────────────┐  invest.   ┌──────────────┐
   │NEW │────────►│ ACKNOWLEDGED │───────────►│ INVESTIGATING│
   └─┬──┘         └──────┬───────┘            └──────┬───────┘
     │                   │                           │
     │                   ▼                           ▼
     │            resolve / dismiss        resolve / dismiss
     │                   │                           │
     ▼                   ▼                           ▼
  resolve         ┌──────────────┐            ┌──────────────┐
  /dismiss        │   RESOLVED   │            │  DISMISSED   │
                  └──────────────┘            └──────────────┘
                       (terminal)                  (terminal)
```

Backend validates transitions in `INCIDENT_TRANSITIONS` dict. Bad transitions return HTTP 409. Each transition appends to `status_history` array and writes an audit log entry.

## Components

### AI / Computer Vision (`ai/`)
- **YOLOv8** for person detection per video frame
- **Centroid tracker** with first-seen / last-seen for area-stay events
- Posts derived signals (counts, durations, zone events) to backend HTTP endpoints
- Runs as a separate process (`run_ai.py`) — backend doesn't depend on it being live

### Backend (`backend/`)
- **FastAPI** with async route handlers
- **Pydantic v2** for strict input validation (rejects NoSQL operator injection at the schema layer)
- **Motor** async MongoDB driver
- **slowapi** rate limiting per IP
- **bcrypt** password hashing (rounds=12)
- **PyJWT** for session and reset tokens
- **bleach** for HTML stripping on user input
- **ReportLab** for PDF generation
- **Pillow** for ID-image content verification

### Frontend (`frontend/`)
- **React 18 + Vite** for fast HMR development
- **React Router v6** with `ProtectedRoute` for role enforcement at the UI layer
- **Recharts** for the live queue chart and analytics
- **Lucide React** for icons
- **WebSocket** for real-time alert and lifecycle updates
- Typography: Inter (Latin) + IBM Plex Sans Arabic (RTL)

### Database (MongoDB Atlas)
- Indexes on `users.username`, `users.email`, `audit_logs.created_at`, `audit_logs.action`
- Collections tagged with `demo: True` when seeded by `seed_demo_data.py` for safe cleanup

## Deployment topology (intended)

```
[Camera streams] ──► [AI box(es) running run_ai.py] ──► [Backend behind reverse proxy + TLS] ──► [MongoDB Atlas]
                                                              │
                                                              └── [Static frontend on CDN]
```

For the school demo: all three components run on a single laptop; MongoDB Atlas is reached over the internet.
