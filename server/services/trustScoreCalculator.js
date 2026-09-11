const supabase = require("../config/supabaseClient");
const { getDueDateForCycle } = require("./paymentService");

function pointsForCycle(record) {
  if (!record) return { points: 0, max: 4, resolved: true }; // missed entirely
  if (record.status === "rejected") return { points: 0, max: 4, resolved: true };
  if (record.status === "pending") return { points: 0, max: 0, resolved: false }; // not counted yet
  if (record.status === "confirmed") {
    if (!record.is_late) return { points: 4, max: 4, resolved: true };
    const daysLate = record.days_late || 1;
    const points = daysLate <= 2 ? 3 : daysLate <= 5 ? 2 : 1;
    return { points, max: 4, resolved: true };
  }
  return { points: 0, max: 4, resolved: true };
}

async function recalculateTrustScore(memberId, committeeId) {
  const { data: committee } = await supabase
    .from("committees")
    .select("duration_months, start_date")
    .eq("id", committeeId)
    .single();

  if (!committee || !committee.start_date) return null;

  const durationMonths = committee.duration_months || 12;
  const today = new Date();

  const { data: payments } = await supabase
    .from("payment_records")
    .select("month, status, is_late, days_late, created_at")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId);

  // Best record per month (confirmed > pending > rejected)
  const statusPriority = { confirmed: 3, pending: 2, rejected: 1 };
  const byMonth = {};
  for (const p of payments || []) {
    const current = byMonth[p.month];
    if (!current || (statusPriority[p.status] || 0) > (statusPriority[current.status] || 0)) {
      byMonth[p.month] = p;
    }
  }

  let pointsEarned = 0;
  let pointsPossible = 0;
  const resolvedCycles = []; // for streak calculation, in order

  for (let i = 0; i < durationMonths; i++) {
    const dueDate = getDueDateForCycle(committee.start_date, i);
    if (dueDate > today) break; // cycle hasn't happened yet — stop counting

    const monthLabel = dueDate.toLocaleString("en-PK", { month: "long", year: "numeric" });
    const record = byMonth[monthLabel];
    const { points, max, resolved } = pointsForCycle(record);

    if (!resolved) continue; // pending — don't count against or for them yet

    pointsEarned += points;
    pointsPossible += max;
    resolvedCycles.push({ onTime: points === 4 });
  }

  let score;
  if (pointsPossible === 0) {
    score = 100; // no resolved cycles yet — neutral, nothing to judge
  } else {
    score = Math.round((pointsEarned / pointsPossible) * 100);
  }

  // Streak bonus: consecutive on-time cycles, most recent first
  let streak = 0;
  for (let i = resolvedCycles.length - 1; i >= 0; i--) {
    if (resolvedCycles[i].onTime) streak++;
    else break;
  }
  score = Math.min(100, score + Math.min(10, streak));
  score = Math.max(0, score);

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

  console.log(`[TRUST] Member ${memberId}: score=${score} (earned=${pointsEarned}/${pointsPossible}, streak=${streak})`);
  return score;
}

module.exports = { recalculateTrustScore };