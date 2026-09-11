const supabase = require("../config/supabaseClient");
const { getDueDateForCycle } = require("./paymentService");

function pointsForCycle(record, monthlyValue) {
  if (!record) return 0; // missed entirely
  if (record.status === "rejected") return 0;
  if (record.status === "pending") return null; // not resolved yet — skip
  if (record.status === "confirmed") {
    if (!record.is_late) return monthlyValue;
    const daysLate = record.days_late || 1;
    const reduction = Math.min(monthlyValue - 1, Math.ceil(daysLate / 3));
    return Math.max(0, Math.round((monthlyValue - reduction) * 10) / 10);
  }
  return 0;
}

async function recalculateTrustScore(memberId, committeeId) {
  const { data: committee } = await supabase
    .from("committees")
    .select("duration_months, start_date")
    .eq("id", committeeId)
    .single();

  if (!committee || !committee.start_date) return null;

  const durationMonths = committee.duration_months || 12;
  const monthlyValue = 100 / durationMonths;
  const today = new Date();

  // If the member's very first due date hasn't arrived yet, there's
  // nothing to score — stay at a neutral default rather than 0.
  const firstDue = getDueDateForCycle(committee.start_date, 0);
  if (firstDue > today) {
    await upsertScore(memberId, committeeId, 100);
    return 100;
  }

  const { data: payments } = await supabase
    .from("payment_records")
    .select("month, status, is_late, days_late")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId);

  const statusPriority = { confirmed: 3, pending: 2, rejected: 1 };
  const byMonth = {};
  for (const p of payments || []) {
    const current = byMonth[p.month];
    if (!current || (statusPriority[p.status] || 0) > (statusPriority[current.status] || 0)) {
      byMonth[p.month] = p;
    }
  }

  let score = 0;
  let streak = 0;
  const cycleResults = [];

  for (let i = 0; i < durationMonths; i++) {
    const dueDate = getDueDateForCycle(committee.start_date, i);
    if (dueDate > today) break;

    const monthLabel = dueDate.toLocaleString("en-PK", { month: "long", year: "numeric" });
    const points = pointsForCycle(byMonth[monthLabel], monthlyValue);

    if (points === null) continue; // pending — doesn't add or subtract yet
    score += points;
    cycleResults.push({ onTime: points >= monthlyValue - 0.05 });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  for (let i = cycleResults.length - 1; i >= 0; i--) {
    if (cycleResults[i].onTime) streak++;
    else break;
  }

  await upsertScore(memberId, committeeId, score);
  console.log(`[TRUST] Member ${memberId}: score=${score}/100 (monthlyValue=${monthlyValue.toFixed(1)}, cycles=${cycleResults.length}, streak=${streak})`);
  return score;
}

async function upsertScore(memberId, committeeId, score) {
  const { data: existing } = await supabase
    .from("trust_scores")
    .select("id")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .maybeSingle();

  if (existing) {
    await supabase.from("trust_scores").update({ score, updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    await supabase.from("trust_scores").insert([{ member_id: memberId, committee_id: committeeId, score }]);
  }
}

module.exports = { recalculateTrustScore };