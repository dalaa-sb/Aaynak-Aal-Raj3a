# AAR — Limitations and Future Work

Honest disclosure of what's built, what's a prototype, and what's deferred.
This is intentionally written for the defense to anticipate examiner questions.

## What is production-quality

- Authentication and RBAC (bcrypt, JWT, rate limiting, lockout, audit log)
- Input validation (Pydantic strict typing, NoSQL operator rejection, XSS stripping)
- Secret handling (.env-based, never in source, strength classification)
- ID image upload validation (magic bytes, Pillow decode, type/size whitelist)
- Audit log architecture (redacting writer, never blocks, indexed)
- Incident lifecycle state machine with backend transition validation
- Reports generation with deterministic statistical analysis and ReportLab PDF output
- WebSocket real-time updates with polled fallback

## What is a prototype (and we admit it)

### YOLOv8 queue detection
- We use the pre-trained YOLOv8n weights (`yolov8n.pt`) for person detection
- **Not trained on airport-specific footage**
- Performance under occlusion, bad lighting, or unusual camera angles is degraded
- We have not run a labeled-ground-truth evaluation across many scenes
- For production deployment: collect 1,000–10,000 labeled airport frames, fine-tune the model, evaluate mAP, set per-zone confidence thresholds

### Centroid tracking
- Simple ID-assignment-by-distance tracker (no deep appearance features)
- Works for sparse scenes; degrades quickly when 10+ people occlude each other
- Production would use SORT/DeepSORT or BYTETrack

### "AI Report Assistant"
- This is **not** a generative LLM. It's a **deterministic statistical assistant** with templated natural-language summaries.
- We deliberately frame this as a strength: privacy-friendly, deterministic, offline-capable, no per-call API cost, no risk of hallucinated security advice
- For a security-sensitive system this is the correct trade-off — but we should describe it accurately, not as "AI generates the report"

### Demo data
- The `seed_demo_data.py` script generates plausible synthetic data for demo presentation
- All seeded documents carry `demo: True` tag for safe cleanup
- Real deployment would replace this with actual camera feeds and operator workflow

## What is deferred to future work

### Email / SMTP integration
- Email verification codes and password reset tokens are currently:
  - Email verification: printed to server console in dev mode (`DEV_PRINT_VERIFICATION_CODES=true`)
  - Password reset: admin generates and delivers token out-of-band
- Production needs SMTP integration (SendGrid / SES / Postmark) with rate-limited retry and DKIM signing

### Multi-language support (English / Arabic / French)
- Backend already stores activity types as **stable codes** (`abandoned_bag` etc.) with Arabic display labels
- The frontend currently hardcodes English UI strings outside the suspicious activity dropdown
- To add: i18n library (react-i18next), three locale files (`en.json`, `ar.json`, `fr.json`), language switcher in sidebar, RTL handling for Arabic
- This was scoped out of the current milestone in favor of finishing the security and lifecycle work — but the data model is ready

### Annotated camera snapshots
- Currently the AI module does not push frame images
- To add: AI module periodically saves a JPEG with bounding boxes drawn (using OpenCV); backend exposes `GET /api/cameras/{id}/snapshot/latest` with the latest frame; frontend displays it in a card with a "live / 30s ago / demo" indicator
- This is a high-value visual demo improvement for future iterations

### MFA
- Username + password is the only auth factor today
- TOTP would be a small addition: extend signup flow with QR enrollment, store TOTP secret encrypted, require code at login

### Stateful session revocation
- JWT is stateless; "logout" only discards the client-side token
- For full revocation: maintain a Redis blacklist of revoked `jti` values, check on each request
- Acceptable for school project scope; required for production

### Telegram / WhatsApp critical alert push
- Brainstormed in earlier project notes
- Webhook-based: critical alerts forwarded to a Telegram group bot
- Not implemented; would require bot token management and rate limiting

### Real prediction model
- The "queue prediction" chart currently extrapolates from recent history
- Production would use ARIMA, Prophet, or a small neural net trained on weekly seasonality

### Docker compose
- Currently the dev workflow is `python server.py` + `npm run dev`
- A `docker-compose.yml` with backend + frontend + MongoDB would simplify cross-machine demos

### Automated tests
- We have manual security primitive tests (14 passed) and ad-hoc API verification
- Pytest suite for routes, RBAC enforcement, lifecycle transitions, audit log writes — all listed in the requirements but not yet implemented

## Known security caveats (be honest if asked)

- **Old Atlas password leaked.** A MongoDB Atlas connection string with the live database password (`aarvision: <REDACTED>@cluster0.hs8sv1u.mongodb.net`) was committed in an early project deliverable zip. This password **must be rotated** in the Atlas dashboard before any real deployment. The current `.env.example` ships only placeholders, but the leak is part of project history.
- **No HTTPS / TLS termination** in the dev setup. Production needs a reverse proxy (nginx/Caddy) with valid cert.
- **WebSocket has no auth.** The `/ws` endpoint accepts any connection. For production: send the JWT in the connection query or first message, validate, drop unauthenticated connections.
- **AI module endpoint (`POST /api/alerts/`) is open** to allow the AI process to push alerts. For production: add an internal API key in a `X-Internal-Auth` header.

## What we would do if we had another month

In priority order:

1. **i18n** (1 week): three locale files, switcher, RTL CSS for Arabic
2. **Annotated snapshots** (3 days): bounding box rendering in the AI module + new endpoint + UI card
3. **AI evaluation script** (2 days): take a folder of test images, run detection, compare to labels, output JSON with precision/recall metrics
4. **Pytest suite** (4 days): cover all RBAC paths, lifecycle transitions, audit log writes, health endpoints
5. **MFA via TOTP** (3 days): pyotp-based flow with QR enrollment
6. **Docker Compose** (1 day): three-service compose for fast onboarding

That said — this version is already substantially more polished than typical capstone deliverables in the same scope. The strategic call to ship lifecycle + audit + health + demo seed data first was correct.
