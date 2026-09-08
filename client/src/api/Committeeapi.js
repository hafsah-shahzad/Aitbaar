const API_BASE = "http://localhost:5000";

export async function registerOrganizer({ name, email, phone, password }) {
  const res = await fetch(`${API_BASE}/api/organizer/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, phone, password }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Registration failed");
  return data;
}

export async function loginOrganizer({ email, password }) {
  const res = await fetch(`${API_BASE}/api/organizer/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Login failed");
  return data;
}

export async function createCommittee({
  organizerId, name, monthlyAmount, totalMembers, durationMonths, startDate,
}) {
  const res = await fetch(`${API_BASE}/api/committee/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizer_id: organizerId,
      name,
      monthly_amount: Number(monthlyAmount),
      total_members: Number(totalMembers),
      duration_months: Number(durationMonths),
      start_date: startDate,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Committee creation failed");
  return data;
}

export async function getOrganizerCommittees(organizerId) {
  const res = await fetch(`${API_BASE}/api/committee/organizer/${organizerId}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Could not load committees");
  return data.committees;
}

export async function getDashboardData(committeeId) {
  const res = await fetch(`${API_BASE}/api/dashboard/${committeeId}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Could not load dashboard data");
  return data;
}

export async function getPendingPayments(committeeId) {
  const res = await fetch(`${API_BASE}/api/payment/committee/${committeeId}/pending`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Could not load payments");
  return data.payments;
}

export async function verifyPayment(paymentId, action) {
  const res = await fetch(`${API_BASE}/api/payment/${paymentId}/verify`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Could not verify payment");
  return data;
}


export async function deleteMember(memberId) {
  const res = await fetch(`${API_BASE}/api/dashboard/member/${memberId}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Could not delete member");
  return data;
}

export async function getAIPayoutStatus(committeeId) {
  const res = await fetch(`${API_BASE}/api/payout/${committeeId}/ai-status`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Could not load AI status");
  return data;
}

export async function getTrustExplanation(memberId, committeeId) {
  const res = await fetch(`${API_BASE}/api/dashboard/member/${memberId}/trust-explanation?committeeId=${committeeId}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Could not load explanation");
  return data.explanation;
}