# AAR — Security Overview

A consolidated reference of every security control implemented in the system.
This document is intended for the senior-project defense; everything below is
backed by code in the repository.

## 1. Authentication

### Password hashing
- **bcrypt** with cost factor 12 (`backend/security/passwords.py`)
- Direct `bcrypt` library (avoids passlib version-skew issues with newer bcrypt)
- 72-byte input truncation handled explicitly (bcrypt's hard limit)
- `needs_rehash()` upgrades stored hashes if the cost factor is increased later

### JWT tokens
- HS256 signed with `JWT_SECRET` (must be 64+ hex chars from env)
- Session tokens: 60 min expiration
- Reset tokens: 15 min expiration, single-use (jti tracked in DB)
- `expected_type` claim prevents using a reset token as a session token (and vice versa)
- Tokens travel in `Authorization: Bearer <jwt>` header — never query strings (avoids leaking via webserver logs, browser history, referer)
- Startup warning if `JWT_SECRET` is missing, default, or weak

### Account lockout
- 5 failed login attempts → 15 minute lock (`failed_login_count`, `locked_until`)
- Reset on successful login

### Timing attack mitigations
- Login runs bcrypt verify **even on missing user** (constant time vs found user)
- Verification code comparison uses `hmac.compare_digest` (constant time)
- "Always success" responses on `/forgot-password` and `/resend-verification` (no user enumeration)

### Email verification
- 6-digit numeric code, 15 min expiration
- Single-use (cleared after match)
- Login refuses unverified accounts

### ID image upload
- **Required** at signup
- Type whitelist: JPEG / PNG / WebP only
- Size cap: 5 MB
- Magic byte verification (`\xff\xd8\xff`, `\x89PNG`, `RIFF…WEBP`)
- Pillow decode validation (catches polyglot/malformed images)
- UUID-based filenames (no original name preserved)
- Path traversal guard via `Path.resolve()` containment check
- Admin-only viewing via Bearer token

## 2. Authorization (RBAC)

- Roles defined as `Literal["admin", "security"]` in Pydantic schemas (whitelist)
- Backend dependency `require_admin` / `require_role(["admin", ...])` enforced on every protected endpoint
- JWT carries the role claim — frontend sessionStorage is **hint-only**
- Frontend `ProtectedRoute` component is UX, not security authority — backend re-validates on every request
- Role re-checked from token on each call (cannot be modified client-side)

## 3. Input validation

- **Pydantic v2 strict typing** rejects non-string input on string fields → blocks NoSQL injection at the validation layer (`{"username": {"$ne": null}}` is rejected before reaching MongoDB)
- Username regex: `^[a-zA-Z0-9_.\-]{3,32}$`
- Password complexity: 8+ chars, at least one letter and one digit
- Email validation via `EmailStr` (Pydantic + `email-validator`)
- 6-digit code regex: `^[0-9]{6}$`
- Activity types validated against the predefined Arabic list (or accept "أخرى" + custom text up to 80 chars)
- Incident status validated against `Literal["new","acknowledged","investigating","resolved","dismissed"]`

## 4. Defense-in-depth: NoSQL injection

Three independent layers prevent operator injection:

1. **Pydantic** rejects dict input on string-typed fields at parse time
2. `reject_operators()` recursively walks dicts and rejects `$`-prefixed keys before any DB call
3. `isinstance(username, str)` check immediately before each `find_one` / `update_one`

Even if one layer is bypassed, the other two still catch the attack.

## 5. XSS prevention

- `bleach.clean(tags=[], strip=True)` on every user-submitted text field before storage
- Control chars (null bytes, etc.) stripped via regex
- React's default JSX escaping in all UI rendering
- `dangerouslySetInnerHTML` is **not used anywhere** in the codebase

## 6. Rate limiting

Via `slowapi`, per IP:

| Endpoint            | Limit      |
|---------------------|------------|
| Login               | 5 / min    |
| Signup              | 5 / min    |
| Forgot password     | 3 / min    |
| Confirm reset       | 5 / min    |
| Admin reset         | 10 / min   |
| Resend verification | 3 / min    |
| Suspicious report   | 20 / min   |
| Generate report     | 10 / min   |

429 responses include the limit in the body.

## 7. CORS

- **Explicit allowlist** from `CORS_ORIGINS` env var (comma-separated)
- No `*` wildcard with credentials
- Specific allowed methods: GET, POST, PATCH, DELETE, OPTIONS
- Specific allowed headers: Authorization, Content-Type

## 8. Audit logging

Every privileged action is recorded to `audit_logs` collection:

| Action category                | Examples                                    |
|--------------------------------|---------------------------------------------|
| `user.login.*`                 | success, failure (with reason: bad_password / user_not_found) |
| `user.signup`                  | New account creation                        |
| `user.email_verify`, `id_verify` | Verification events                       |
| `user.deleted`                 | Admin removed an account                    |
| `user.password_reset_*`        | issued, used                                |
| `alert.created`, `status_changed` | Lifecycle transitions                    |
| `suspicious_report.filed`      | Field officer submissions                   |
| `report.generated`, `downloaded`, `deleted` | Report operations              |

### Audit safety
- Writer (`audit_service.log_action`) **never raises** — audit failure does not block the action being audited
- `_redact()` strips sensitive keys (`password`, `new_password`, `password_hash`, `reset_token`, `verification_code`, `token`, `authorization`, `bearer`) from metadata before persistence
- Long string values truncated at 500 chars
- IP address: respects `X-Forwarded-For` if behind a proxy
- User agent: truncated at 300 chars
- Indexed on `(created_at desc)`, `(action, created_at)`, `(actor_username, created_at)` for fast filtering

## 9. Secret management

- `.env.example` template with placeholder values only
- **Real Atlas password leaked in an earlier project zip** — must be rotated in Atlas dashboard before deployment (documented in `LIMITATIONS_AND_FUTURE_WORK.md`)
- `JWT_SECRET` strength classified at runtime: `missing_or_default` / `weak` / `ok` / `strong`
- Health endpoint exposes the **classification**, not the value
- `.env` is in `.gitignore` (verify before any push)

## 10. Defense-friendly observable infrastructure

- `/api/health/` — public lightweight summary (no secrets)
- `/api/health/details` — admin-only, includes config validation (mongo configured, JWT strength, CORS configured), but never reveals values
- WebSocket connection status visible in the sidebar
- System Health admin page polls every 30 seconds
- All audit events queryable from the Audit Log admin page

## 11. Out of scope (honest disclosure)

The following are **intentionally not** in this version:
- SMTP integration for password reset emails (replaced with admin-issued out-of-band tokens)
- Field-level encryption at rest (relies on MongoDB Atlas at-rest encryption)
- Multi-factor authentication
- Hardware security key support
- Key rotation automation for `JWT_SECRET`
- Session revocation (JWT is stateless; logout discards client-side; for full revocation a blacklist would be added)

These are documented in `LIMITATIONS_AND_FUTURE_WORK.md` along with how each would be added.
