import { API_BASE } from "./config";

const JSON_HEADERS = { "Content-Type": "application/json" };

// ─── Auth helpers ─────────────────────────────────────────
function getToken() {
  try { const u = JSON.parse(sessionStorage.getItem("aar_user") || "null"); return u?.token || null; }
  catch { return null; }
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function readError(res) {
  try {
    const d = await res.json();
    if (typeof d.detail === "string") return d.detail;
    if (Array.isArray(d.detail)) return d.detail.map((x) => x.msg || x).join(", ");
    return JSON.stringify(d.detail || d);
  } catch { return `HTTP ${res.status}`; }
}

// ─── AUTH ─────────────────────────────────────────────────
export async function login(username, password) {
  const r = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST", headers: JSON_HEADERS,
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function signup({ username, password, full_name, email, role, language, idImage }) {
  // Multipart for file upload
  const fd = new FormData();
  fd.append("username", username);
  fd.append("password", password);
  fd.append("full_name", full_name);
  fd.append("email", email);
  fd.append("role", role);
  if (language) fd.append("language", language);
  if (idImage) fd.append("id_image", idImage);

  const r = await fetch(`${API_BASE}/api/auth/signup`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function verifyEmail(username, code) {
  const r = await fetch(`${API_BASE}/api/auth/verify-email`, {
    method: "POST", headers: JSON_HEADERS,
    body: JSON.stringify({ username, code }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function resendVerification(username) {
  const r = await fetch(`${API_BASE}/api/auth/resend-verification`, {
    method: "POST", headers: JSON_HEADERS,
    body: JSON.stringify({ username }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function forgotPassword(identifier) {
  const r = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: "POST", headers: JSON_HEADERS,
    body: JSON.stringify({ identifier }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function adminIssueReset(targetUsername) {
  const r = await fetch(`${API_BASE}/api/auth/admin-reset`, {
    method: "POST", headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify({ target_username: targetUsername }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function confirmReset(resetToken, newPassword) {
  const r = await fetch(`${API_BASE}/api/auth/confirm-reset`, {
    method: "POST", headers: JSON_HEADERS,
    body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function fetchUsers() {
  const r = await fetch(`${API_BASE}/api/auth/users`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function deleteUser(username) {
  const r = await fetch(`${API_BASE}/api/auth/users/${encodeURIComponent(username)}`, {
    method: "DELETE", headers: authHeaders(),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function adminVerifyId(username) {
  const r = await fetch(`${API_BASE}/api/auth/users/${encodeURIComponent(username)}/verify-id`, {
    method: "POST", headers: authHeaders(),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export function getIdImageUrl(username) {
  // Returns the URL — caller still needs Bearer token, so render as <img> only after fetching as blob
  return `${API_BASE}/api/auth/users/${encodeURIComponent(username)}/id-image`;
}

export async function logout() {
  try { await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", headers: authHeaders() }); } catch {}
}

// ─── DASHBOARD / ALERTS / ETC. ────────────────────────────
export async function fetchDashboardSummary() {
  const r = await fetch(`${API_BASE}/api/dashboard/summary`);
  if (!r.ok) throw new Error("Failed to fetch summary");
  return r.json();
}

export async function fetchAlerts(limit = 50) {
  const r = await fetch(`${API_BASE}/api/alerts/?limit=${limit}`);
  if (!r.ok) throw new Error("Failed to fetch alerts");
  return r.json();
}

export async function acknowledgeAlert(id) {
  const r = await fetch(`${API_BASE}/api/alerts/${id}/acknowledge`, { method: "PATCH" });
  if (!r.ok) throw new Error("Failed to acknowledge");
  return r.json();
}

export async function createAlert(data) {
  const r = await fetch(`${API_BASE}/api/alerts/`, {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to create alert");
  return r.json();
}

export async function fetchQueueCurrent() {
  const r = await fetch(`${API_BASE}/api/queue/current`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export async function fetchQueueHistory(zone, hours = 1) {
  const p = new URLSearchParams({ hours });
  if (zone) p.set("zone", zone);
  const r = await fetch(`${API_BASE}/api/queue/?${p}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export async function fetchTrackingEvents(limit = 100) {
  const r = await fetch(`${API_BASE}/api/tracking/?limit=${limit}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

// ─── REPORTS ──────────────────────────────────────────────
export async function fetchActivityTypes() {
  const r = await fetch(`${API_BASE}/api/reports/activity-types`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function submitSuspiciousReport(payload) {
  const r = await fetch(`${API_BASE}/api/reports/suspicious`, {
    method: "POST", headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function fetchSuspiciousReports() {
  const r = await fetch(`${API_BASE}/api/reports/suspicious`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function generateReport(report_type = "daily", period_hours = null) {
  const r = await fetch(`${API_BASE}/api/reports/generate`, {
    method: "POST", headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify({ report_type, period_hours }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function fetchReports() {
  const r = await fetch(`${API_BASE}/api/reports/`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function getReport(id) {
  const r = await fetch(`${API_BASE}/api/reports/${id}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function deleteReport(id) {
  const r = await fetch(`${API_BASE}/api/reports/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

// Returns the URL for the PDF (caller must add Authorization header via fetch+blob to download)
export function reportPdfUrl(id) {
  return `${API_BASE}/api/reports/${id}/pdf`;
}

export async function downloadReportPdf(id, filename) {
  const r = await fetch(reportPdfUrl(id), { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `report-${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── INCIDENT LIFECYCLE ─────────────────────────────────
export async function updateAlertStatus(id, status, notes = null) {
  const r = await fetch(`${API_BASE}/api/alerts/${id}/status`, {
    method: "PATCH",
    headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify({ status, notes }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function fetchStatusCodes() {
  const r = await fetch(`${API_BASE}/api/alerts/statuses`);
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

// ─── BULK ALERT ACTIONS (admin only) ────────────────────
// Both helpers accept optional { status, severity } filters that scope which
// alerts get hit. Defaults are "all"/"all" — every alert in the DB.
// Backend enforces: admin role required, status/severity values whitelisted,
// terminal states excluded from bulk-dismiss.

export async function bulkDismissAlerts({ status = "all", severity = "all" } = {}) {
  const r = await fetch(`${API_BASE}/api/alerts/bulk-dismiss`, {
    method: "PATCH",
    headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify({ status, severity }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();   // { affected: N }
}

export async function bulkDeleteAlerts({ status = "all", severity = "all" } = {}) {
  const r = await fetch(`${API_BASE}/api/alerts/bulk-delete`, {
    method: "DELETE",
    headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify({ status, severity }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();   // { affected: N }
}

// ─── AUDIT LOG (admin) ─────────────────────────────────
export async function fetchAuditLogs(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  }
  const r = await fetch(`${API_BASE}/api/audit/?${q}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function fetchAuditActions() {
  const r = await fetch(`${API_BASE}/api/audit/actions`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

// ─── HEALTH ────────────────────────────────────────────
export async function fetchHealthSummary() {
  const r = await fetch(`${API_BASE}/api/health/`);
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function fetchHealthDetails() {
  const r = await fetch(`${API_BASE}/api/health/details`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

// ─── PROFILE (self) ────────────────────────────────────
export async function fetchMe() {
  const r = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function updateMe(payload) {
  const r = await fetch(`${API_BASE}/api/auth/me`, {
    method: "PATCH",
    headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

// ─── SETTINGS ──────────────────────────────────────────
export async function fetchSettings() {
  const r = await fetch(`${API_BASE}/api/settings/`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export async function saveThresholds(thresholds) {
  const r = await fetch(`${API_BASE}/api/settings/thresholds`, {
    method: "PATCH",
    headers: { ...JSON_HEADERS, ...authHeaders() },
    body: JSON.stringify(thresholds),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

// ─── MAP ───────────────────────────────────────────────
export async function fetchMapZones() {
  const r = await fetch(`${API_BASE}/api/map/zones`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}
