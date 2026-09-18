const API_BASE = "http://localhost:5000";

function authHeaders() {
  const token = localStorage.getItem("aitbaar_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({ success: false, error: "Invalid server response" }));
  if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function adminLogin({ email, password }) {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Admin login failed");
  return data;
}

export const getPlatformStats = () => request("/api/admin/stats");
export const getAdminOrganizers = () => request("/api/admin/organizers");
export const setOrganizerStatus = (id, status) =>
  request(`/api/admin/organizers/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
export const getAdminCommittees = () => request("/api/admin/committees");
export const getAdminAnomalies = () => request("/api/admin/anomalies");
export const getCommitteePayments = (id) => request(`/api/admin/committees/${id}/payments`);
export const getCommitteeOverview = (id) => request(`/api/admin/committees/${id}/overview`);
export const reviewAnomaly = (id, status) =>
  request(`/api/admin/anomalies/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
export const getSystemHealth = () => request("/api/admin/system");

export async function bootstrapAdmin({ email, name, phone }) {
  const res = await fetch(`${API_BASE}/api/admin/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, phone }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Bootstrap failed");
  return data;
}
