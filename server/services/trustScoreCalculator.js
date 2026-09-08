const supabase = require("../config/supabaseClient");

async function recalculateTrustScore(memberId, committeeId) {
  const { data: payments, error: payErr } = await supabase
    .from("payment_records")
    .select("id, status, month, is_late, days_late, created_at")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .order("created_at", { ascending: true });

  if (payErr) {
    console.error("[TRUST] Error fetching payments:", payErr.message);
    return null;
  }

  const { data: committee } = await supabase
    .from("committees")
    .select("duration_months, start_date")
    .eq("id", committeeId)
    .single();

  const durationMonths = committee?.duration_months || 12;
  const startDate = committee?.start_date ? new Date(committee.start_date) : new Date();
  const now = new Date();
  const monthsElapsed = Math.max(1, Math.min(
    durationMonths,
    (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()) + 1
  ));

  // Deduplicate: keep the best-status record per month
  const statusPriority = { confirmed: 3, pending: 2, rejected: 1 };
  const monthMap = {};
  for (const p of payments || []) {
    const current = monthMap[p.month];
    const currentPriority = current ? (statusPriority[current.status] || 0) : -1;
    const newPriority = statusPriority[p.status] || 0;
    if (!current || newPriority > currentPriority || (newPriority === currentPriority && new Date(p.created_at) > new Date(current.created_at))) {
      monthMap[p.month] = p;
    }
  }
  const uniquePayments = Object.values(monthMap);

  const confirmedOnTime = uniquePayments.filter((p) => p.status === "confirmed" && !p.is_late);
  const confirmedLate = uniquePayments.filter((p) => p.status === "confirmed" && p.is_late);
  const rejected = uniquePayments.filter((p) => p.status === "rejected");
  const monthsWithNoPayment = Math.max(0, monthsElapsed - uniquePayments.length);

  let score = 100;

  // On-time confirmed payments: full credit, diminishing after 5
  confirmedOnTime.forEach((_, i) => { score += i < 5 ? 4 : 2; });

  // Late confirmed payments: reduced credit — they still paid, but reliability is lower
  confirmedLate.forEach((p) => {
    const penalty = Math.min(3, Math.ceil((p.days_late || 1) / 5)); // more days late = smaller bonus
    score += Math.max(1, 3 - penalty);
  });

  // Rejected and missing months
  score -= rejected.length * 15;
  score -= monthsWithNoPayment * 8;

  // Streak bonus — only ON-TIME confirmed payments count, in consecutive months
  const sortedOnTime = [...confirmedOnTime].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  let streak = 0, maxRecentStreak = 0;
  for (let i = 0; i < sortedOnTime.length; i++) {
    if (i === 0) { streak = 1; }
    else {
      const diff = Math.abs(
        new Date(sortedOnTime[i - 1].created_at).getMonth() - new Date(sortedOnTime[i].created_at).getMonth()
      );
      streak = diff <= 1 ? streak + 1 : 1;
    }
    maxRecentStreak = Math.max(maxRecentStreak, streak);
  }
  score += Math.min(10, maxRecentStreak);

  score = Math.max(0, Math.min(100, Math.round(score)));

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

  console.log(`[TRUST] Member ${memberId}: score=${score} (onTime=${confirmedOnTime.length}, late=${confirmedLate.length}, rejected=${rejected.length}, noPayment=${monthsWithNoPayment}, streak=${maxRecentStreak})`);
  return score;
}

module.exports = { recalculateTrustScore };