# AAR — Demo Flow

A 10-minute live demo script for the senior-project defense.

## Pre-demo checklist (do this 30 minutes before)

1. Backend is running: `python server.py` (port 8000)
2. Frontend is running: `cd frontend && npm run dev` (port 3000)
3. **Seed demo data:** `python scripts/seed_demo_data.py --reset`
   - Creates ~80 alerts, ~672 queue snapshots, ~18 suspicious reports across the last 7 days
4. Confirm at least one admin account exists (sign up via `/signup` if not)
5. Open `http://localhost:3000` in a browser, log in as admin
6. Open a second browser tab to `http://localhost:3000/health` (System Health) — leave it visible

## During the demo

### 1. Login (10 seconds)
- Show the login screen. Point out the typography (Inter + IBM Plex Sans Arabic), the Lebanese branding ("عينك عالرجعة"), the secure-login button.
- Log in.

### 2. Dashboard (1 minute)
- Live queue chart (preserved unchanged from v1).
- Zone cards showing current occupancy.
- Mention: "Each zone color reflects severity computed from threshold rules."
- Stat cards: total passengers, active alerts, critical zones, average wait.
- WebSocket indicator (top-right) shows the live data connection status.

### 3. Cameras (30 seconds)
- Show the camera grid.
- Note the demo zones: Passport Control, Security Checkpoint, Gate Area, Baggage Claim, VIP Entrance, Customs.

### 4. Alerts page — Incident Lifecycle (2 minutes) ⭐ KEY FEATURE
- Show the alert feed with mixed statuses (NEW, ACKNOWLEDGED, INVESTIGATING, RESOLVED, DISMISSED).
- Use the status filter chips at the top — switch between "Active" / "All" / "Resolved".
- Pick a NEW alert, click **ACKNOWLEDGE** → it transitions in real time.
- Click **INVESTIGATE** on the same alert → status pill updates.
- Click **RESOLVE** → modal asks for resolution notes → confirm.
- Click the **TRAIL** button to show the full status history with timestamps and actors.
- *Defensible quote:* "Each alert has a complete lifecycle audit trail. The backend validates allowed transitions — for example you can't go from `resolved` back to `new`."

### 5. File a Suspicious Activity Report (45 seconds)
- Use the right panel on the Alerts page.
- Pick a zone and camera.
- Open the Arabic dropdown — show the predefined types: "سلوك مريب", "حقيبة متروكة بدون مالك", etc.
- Pick "أخرى" — show that it reveals a manual text input.
- Submit. Confirmation banner appears.
- *Defensible quote:* "Activity types use stable codes in the backend with localized labels — supports English, Arabic, and French at the data layer."

### 6. Reports — AI Assistant (2 minutes) ⭐ KEY FEATURE
- Navigate to Reports → "Suspicious Activity" tab.
- Show the report you just filed appears in the archive.
- Switch to "Generated" tab.
- Click **Generate Daily** — the analytical assistant compiles statistics from the seeded data into a structured report (~2 seconds).
- Click **Preview** — show the executive summary, sections (Security Alerts Overview, Queue Analytics, Suspicious Activities, Recent Alert Sample).
- Click **Download as PDF** — a real PDF file downloads. Open it to show:
  - Cover header with title and period
  - Executive summary
  - Data tables for severity/zone/activity breakdowns
  - Page footer "AAR — عينك عالرجعة · Confidential" + page numbers
- *Defensible quote:* "This is an automated analytical report assistant — it runs deterministic statistical analysis with templated natural-language summaries. No external AI API, no privacy concerns, works offline. For a security-sensitive system, deterministic is a feature, not a limitation."

### 7. Audit Log (1 minute) ⭐ KEY FEATURE
- Navigate to Audit Log (admin sidebar).
- Show the rich filter bar: action, actor, target type, row limit.
- Filter by `report.generated` → shows the report you just created.
- Filter by `alert.status_changed` → shows the lifecycle transitions you performed.
- Click "+ META" on any row to expand the metadata.
- Note IP address column.
- *Defensible quote:* "Every privileged action is audited. The audit writer never crashes the app on failure, and it strips sensitive fields like passwords and tokens before persisting. Senior security professors will recognize this as defense-in-depth."

### 8. System Health (45 seconds) ⭐ KEY FEATURE
- Navigate to System Health (admin sidebar) — or switch to your second tab.
- Show the overall status banner.
- Component grid: API, MongoDB, Reports, WebSockets, AI Module — each with status pill.
- Configuration panel: MongoDB connection ✓, JWT strength: STRONG ✓, CORS configured ✓.
- *Defensible quote:* "The health endpoint surfaces config validation without leaking secrets. JWT secret strength is exposed as 'strong/ok/weak/missing' — never the value itself."

### 9. User Management — Admin Reset (45 seconds)
- Navigate to User Management.
- Show the user list with role badges, email/ID verification badges, last-login timestamps.
- Click the 🔑 key icon next to a user → modal pops up with:
  - The reset token (long JWT)
  - Copy button
  - Visible expiration time (15 minutes)
  - Single-use warning
- Open audit log in another tab → show the `user.password_reset_issued` event was just logged.
- *Defensible quote:* "Out-of-band token delivery instead of SMTP keeps the system simple and offline-capable. Production would replace this with email — the JWT mechanism is identical."

## Wrap-up talking points

- **What works:** every feature you just demoed is real, backed by MongoDB, with proper validation, RBAC, and audit logging.
- **What's honest:** the AI report assistant is statistical/deterministic — that's a deliberate engineering choice for a privacy-sensitive system, not a shortcut. The YOLOv8 queue detection is a prototype that demonstrates the integration pipeline; production deployment would need labeled training data from real airport footage.
- **What's deferred to future work:** SMTP email integration, multi-language frontend (data layer is ready), Telegram alerts, real-time annotated camera snapshot stream.

## If something fails on stage

- **MongoDB disconnects:** open System Health page → it will show MongoDB OFFLINE in red. Pivot to: "the system surfaces this immediately rather than silently failing — that's the value of observable infrastructure."
- **WebSocket disconnects:** the live queue chart freezes but the page still works (polled fetches every 10 seconds keep data fresh). Mention this is the fallback.
- **Reset token expired:** if you clicked the key icon multiple times, only the latest token works. Generate a fresh one.

## Reset between dry-runs

```bash
# Wipe seeded data (preserves real users)
python scripts/clear_demo_data.py

# Re-seed
python scripts/seed_demo_data.py
```
