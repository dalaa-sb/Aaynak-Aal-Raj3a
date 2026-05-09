# AAR — عينك عالرجعة

AI-powered airport security monitoring system for Beirut–Rafic Hariri International Airport.
University senior capstone project, four-person team.

## Stack

- **Frontend:** React 18 + Vite, React Router, Recharts, Lucide icons, Inter + IBM Plex Sans Arabic
- **Backend:** FastAPI, async Python, Motor (async MongoDB)
- **Database:** MongoDB Atlas (or local MongoDB)
- **AI / CV:** YOLOv8 person detection + centroid tracking (prototype)
- **Real-time:** WebSockets for live alerts and lifecycle updates
- **PDF:** ReportLab for downloadable analytical reports

## Features

- Secure auth (bcrypt + JWT), email verification, ID image upload with magic-byte + Pillow validation
- RBAC (admin / security) enforced server-side via JWT role claim
- Real-time alerts via WebSocket with simplified incident lifecycle (NEW → ACKNOWLEDGED → RESOLVED / DISMISSED)
- **Multi-language UI** — English, Arabic (RTL), French. Language preference stored on the user profile and applied at login
- **Operational Dashboard** focused on high-level KPIs, zone status, live queue chart, and passenger satisfaction (no alert feed, no interactive map — alerts have their own page)
- **Cameras page with live + demo video feeds** — CAM-01 uses the laptop webcam (with denied-permission fallback), CAM-02..CAM-06 play looping MP4 clips. Click any tile for a detail modal with per-camera passenger satisfaction
- Suspicious activity reporting with Arabic operational labels (intentional — these are standardized labels used by airport security)
- AI Report Assistant — deterministic statistical analysis with PDF export
- Settings page combining personal info, language preference, and admin-only system thresholds
- Audit log for every privileged action
- System health page with config validation (no secrets exposed)
- Rate limiting, account lockout, NoSQL injection guards, XSS stripping, host header attack protection

## Quick start

### 1. Configure environment

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env  # optional - only if you need custom URLs
```

Edit the new `.env`:
- `MONGO_URL` → your MongoDB Atlas connection string
- `MONGO_DB_NAME` → e.g. `aarvision`
- `JWT_SECRET` → generate with `python -c "import secrets; print(secrets.token_hex(32))"`
- `CORS_ORIGINS` → leave default for local dev
- `ALLOWED_HOSTS` → `localhost,127.0.0.1` for dev; production domain(s) for prod

> **Never commit `.env`.** It is listed in `.gitignore`. Only the `.env.example`
> templates are tracked.
>
> **A MongoDB Atlas password was leaked in an early project zip and must be
> rotated** in the Atlas dashboard before any real deployment.

### 2. Install dependencies

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
cd ..
```

### 3. Drop in camera demo videos (optional but recommended)

For the cleanest defense demo, place 5 short looping MP4s in
`frontend/public/demo-videos/` — see `frontend/public/demo-videos/README.md`
for the exact filenames and content suggestions.

### 4. Run

```bash
# Terminal 1 — backend
python server.py

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open `http://localhost:3000`.

### 5. Sign up

- Open `/signup`
- Fill in name, username, email, password (8+ chars with letters and digits), pick "Admin" role for the first account
- Upload any JPEG/PNG/WebP image (max 5 MB). The backend rejects:
  - all non-image MIMEs (including SVG/XML — these are blocked to prevent XXE)
  - dangerous extensions (`.exe`, `.php`, `.svg`, `.zip`, etc.)
  - polyglot files (Pillow decode validation catches malformed images)
  - path-traversal attempts in the original filename
- Submit

### 6. Verify the email (dev shortcut)

The 6-digit verification code is printed to the backend console. Either:
- Read the code from the server terminal and enter it on `/verify-email`, **or**
- Run the dev helper to skip verification: `python verify_user.py <your_username>`

### 7. Seed demo data

```bash
python scripts/seed_demo_data.py --reset
```

Inserts ~80 alerts with realistic lifecycle distribution, ~672 queue snapshots over 7 days, ~18 suspicious reports. All seeded docs carry `demo: True` for surgical cleanup. To remove just the demo data: `python scripts/clear_demo_data.py`.

### 8. Log in and explore

- **Dashboard** — KPI strip (passengers, active alerts, critical zones, avg wait), zone status table, live queue chart, and passenger satisfaction widget. The interactive airport map and the alert feed are no longer on the dashboard
- **Cameras** — 6 cameras: CAM-01 webcam, others demo videos. Click any tile for a modal with full video, queue/wait/satisfaction, and recent alerts for that zone
- **Alerts** — simplified lifecycle (Acknowledge → Resolve / Dismiss). Status filter chips: All / Acknowledged / Resolved / Dismissed. Severity filter unchanged. Admins also get bulk **Dismiss filtered** and **Delete filtered** buttons with confirmation dialogs
- **Reports** — generate daily / weekly / monthly AI-assisted reports and download as PDF
- **Settings** — edit your profile, switch language (English / Arabic / French), and (admin) configure system thresholds. Profile and Settings are merged into one page; there is no separate Profile route
- **Audit Log** (admin) — every privileged action is recorded, including bulk alert dismissals and deletions
- **System Health** (admin) — live infrastructure status with config validation

## How language preference works

Resolution order (top wins):

1. **Active in-session selection** — `setLang()` updates state immediately and writes to localStorage
2. **Server-stored profile preference** (returned in the login response) — applied at login if non-null
3. **localStorage** — key `aar.lang`, persists across browser restarts
4. **Browser language** — `navigator.language.slice(0, 2)` if it's `en/ar/fr`
5. **Hard fallback** — English

Persistence:
- `PATCH /api/auth/me` writes `language` to MongoDB user doc
- localStorage updated synchronously on every switch
- Login response includes user's stored language → applied automatically without re-fetch
- Arabic switches the entire UI to RTL via `<html dir="rtl">`

There is **no forced default**. If a user hasn't explicitly chosen a language, the frontend respects localStorage / browser-language fallback. Backend never returns a fake `"en"` for users who never set one.

## Why suspicious activity types remain Arabic

The dropdown values in the Suspicious Activity report (`سلوك مريب`, `حقيبة متروكة بدون مالك`, etc.) are **intentionally Arabic**. These are the official operational labels used by the General Security force at the airport — translating them would make the data harder to cross-reference with their existing reports. The surrounding form labels and helper text are translated in all three languages.

## Documentation

| Document | Purpose |
|---|---|
| [`docs/SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md) | Diagrams, data flow, lifecycle state machine |
| [`docs/SECURITY_OVERVIEW.md`](docs/SECURITY_OVERVIEW.md) | Every protection consolidated in one place |
| [`docs/DEMO_FLOW.md`](docs/DEMO_FLOW.md) | 10-minute defense demo script |
| [`docs/LIMITATIONS_AND_FUTURE_WORK.md`](docs/LIMITATIONS_AND_FUTURE_WORK.md) | Honest scope and gap disclosure |

## Alert workflow

Simplified lifecycle (v14):

```
NEW ─▶ ACKNOWLEDGED ─▶ RESOLVED  (terminal)
   │                ╲▶ DISMISSED (terminal)
   ╲▶ DISMISSED (terminal)
```

User actions per alert: **Acknowledge**, **Resolve**, **Dismiss**. The legacy "Investigate" action has been removed. Older alerts that exist in the DB with status `investigating` are still readable — they appear under the "Acknowledged" filter for display purposes and can be transitioned to Resolved or Dismissed.

### Bulk actions (admin only)

The Alerts page exposes two bulk operations to admins:

- **Dismiss filtered** — sets every alert matching the current status/severity filter to `dismissed`. Idempotent: alerts already in `resolved` or `dismissed` are skipped, never "unresolved"
- **Delete filtered** — permanently deletes every alert matching the filter. There is no soft-delete; the audit log is the only record after this runs

Both buttons require a confirmation dialog and show the affected count once the operation completes. Security-role users do not see these buttons; if they craft the request manually the backend returns 403.

Backend endpoints:
- `PATCH /api/alerts/bulk-dismiss` (admin) — body `{status, severity}` defaults to `"all"`/`"all"`
- `DELETE /api/alerts/bulk-delete` (admin) — same body shape

Both endpoints validate filter values against a whitelist, run atomic `update_many` / `delete_many`, write an audit log entry, and return `{"affected": N}`.

## Security

See `docs/SECURITY_OVERVIEW.md` for the full list. Highlights:

- **Authentication.** bcrypt rounds=12, JWT HS256 with role claim, 60-min session, 15-min reset tokens, single-use jti tracking, account lockout (5 fails / 15 min), constant-time password comparison even on missing user, "always success" responses on `/forgot-password` to prevent enumeration
- **File uploads.** Multi-layer defense: MIME allowlist + extension allowlist + explicit denylist (SVG/XML/EXE/PHP/etc.) + magic-byte check + Pillow decode validation + filename safety check (rejects path traversal) + script-content marker detection
- **CSRF.** Bearer-token-in-header design eliminates CSRF risk for the standard threat model — browsers do not automatically attach `Authorization` headers across origins. No state-changing endpoint accepts auth from cookies.
- **Host header attacks.** `TrustedHostMiddleware` configured via `ALLOWED_HOSTS` env var
- **XXE.** No XML parsing anywhere; XML/SVG MIMEs are explicitly denied at upload
- **OS command injection.** Zero `subprocess`, `os.system`, `eval`, `exec`, or `shell=True` usage anywhere in the backend
- **Race conditions.** Unique indexes on `users.username` and `users.email`, atomic `findOneAndUpdate` with `ReturnDocument.AFTER` for failed-login counter, single-use reset tokens cleared atomically, frontend double-submit prevention via disabled buttons
- **Access control.** Backend `require_admin` / `get_current_session` dependencies on every protected endpoint. JWT carries the role claim — frontend `sessionStorage` is hint-only

## License

University coursework — Lebanese University capstone project.
