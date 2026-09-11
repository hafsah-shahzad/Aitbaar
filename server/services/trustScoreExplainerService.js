const supabase = require("../config/supabaseClient");
const { generateWithSystem, MODELS } = require("./llmProvider");
const { getDueDateForCycle } = require("./paymentService");

async function buildBreakdown(memberId, committeeId) {
  const { data: trustData } = await supabase
    .from("trust_scores")
    .select("score, updated_at")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .maybeSingle();

  const currentScore = trustData?.score ?? 100;

  const { data: committee } = await supabase
    .from("committees")
    .select("start_date, duration_months, monthly_amount")
    .eq("id", committeeId)
    .single();

  const durationMonths = committee?.duration_months || 12;
  const monthlyValue = Math.round((100 / durationMonths) * 10) / 10;
  const today = new Date();
  const startDate = committee?.start_date ? new Date(committee.start_date) : today;
  const firstDue = getDueDateForCycle(startDate, 0);
  const hasStarted = firstDue <= today;

  const { data: payments } = await supabase
    .from("payment_records")
    .select("id, month, amount, status, is_late, days_late, created_at")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .order("created_at", { ascending: true });

  const allPayments = payments || [];
  const statusPriority = { confirmed: 3, pending: 2, rejected: 1 };
  const byMonth = {};
  for (const p of allPayments) {
    const current = byMonth[p.month];
    if (!current || (statusPriority[p.status] || 0) > (statusPriority[current.status] || 0)) {
      byMonth[p.month] = p;
    }
  }

  let onTimeCount = 0, lateCount = 0, missedCount = 0, rejectedCount = 0, pendingCount = 0;
  let totalLateDays = 0;
  let resolvedCycles = 0;
  const cycleResults = [];

  if (hasStarted) {
    for (let i = 0; i < durationMonths; i++) {
      const dueDate = getDueDateForCycle(startDate, i);
      if (dueDate > today) break;

      const monthLabel = dueDate.toLocaleString("en-PK", { month: "long", year: "numeric" });
      const record = byMonth[monthLabel];

      if (!record) { missedCount++; resolvedCycles++; cycleResults.push({ onTime: false }); }
      else if (record.status === "pending") { pendingCount++; }
      else if (record.status === "rejected") { rejectedCount++; resolvedCycles++; cycleResults.push({ onTime: false }); }
      else if (record.status === "confirmed") {
        resolvedCycles++;
        if (record.is_late) { lateCount++; totalLateDays += record.days_late || 0; cycleResults.push({ onTime: false }); }
        else { onTimeCount++; cycleResults.push({ onTime: true }); }
      }
    }
  }

  const avgDaysLate = lateCount > 0 ? Math.round(totalLateDays / lateCount) : 0;
  let currentOnTimeStreak = 0;
  for (let i = cycleResults.length - 1; i >= 0; i--) {
    if (cycleResults[i].onTime) currentOnTimeStreak++;
    else break;
  }

  const totalConfirmedAmount = allPayments
    .filter((p) => p.status === "confirmed")
    .reduce((sum, p) => sum + (p.amount || committee?.monthly_amount || 0), 0);

  const { count: priorityRequestsUsed } = await supabase
    .from("priority_requests").select("id", { count: "exact", head: true })
    .eq("member_id", memberId).eq("committee_id", committeeId).eq("status", "approved");

  const { count: anomalyCount } = await supabase
    .from("anomaly_flags").select("id", { count: "exact", head: true })
    .eq("member_id", memberId).eq("committee_id", committeeId);

  return {
    currentScore, hasStarted, durationMonths, monthlyValue, resolvedCycles,
    onTimePayments: onTimeCount, latePayments: lateCount, avgDaysLate,
    missedMonths: missedCount, rejectedPayments: rejectedCount, pendingPayments: pendingCount,
    currentOnTimeStreak, totalConfirmedAmount, monthlyAmount: committee?.monthly_amount || 0,
    priorityRequestsUsed: priorityRequestsUsed || 0, anomalyFlags: anomalyCount || 0,
    lastUpdated: trustData?.updated_at || null,
  };
}

async function generateExplanation(memberName, breakdown) {
  if (!breakdown.hasStarted) {
    return `${memberName}, aapki pehli payment cycle abhi due nahi hui, is liye trust score neutral 100/100 hai. Jaise hi cycles guzrengi, score aapki payment history ke mutabiq update hoga.`;
  }

  const systemPrompt = `You are a trust score explainer for Aitbaar, a committee (kameti/bisi) app in Pakistan. The score is cumulative out of 100, split across the whole committee duration — it is NOT a percentage of recent behavior, so a low score early in a long committee is normal, not alarming. Be accurate to the numbers given — never call a score "bohat acha" if on-time payments are 0 or the score is low. Friendly, clear, natural mix of Urdu and Roman Urdu. Under 5 sentences. No markdown, no JSON.`;

  const userPrompt = `
MEMBER: ${memberName}
Committee duration: ${breakdown.durationMonths} months (each on-time month = ${breakdown.monthlyValue} points out of 100)
Current Score: ${breakdown.currentScore}/100
Resolved cycles so far: ${breakdown.resolvedCycles}
On-Time: ${breakdown.onTimePayments}
Late: ${breakdown.latePayments}${breakdown.latePayments > 0 ? ` (avg ${breakdown.avgDaysLate} days late)` : ""}
Missed entirely: ${breakdown.missedMonths}
Rejected: ${breakdown.rejectedPayments}
Pending (awaiting organizer): ${breakdown.pendingPayments}
Current on-time streak: ${breakdown.currentOnTimeStreak} cycles

RULES:
1. Greet by name.
2. State the score and explain it comes from ${breakdown.resolvedCycles} resolved month(s) out of ${breakdown.durationMonths} total.
3. Be specific and honest about missed/late payments — do not congratulate if the record is poor.
4. If score is genuinely strong (all resolved cycles on time), congratulate.
5. End with 1-2 concrete tips.
`.trim();

  try {
    return (await generateWithSystem(systemPrompt, userPrompt, { model: MODELS.FLASH, temperature: 0.5, maxTokens: 250 })).trim();
  } catch (err) {
    console.error("AI explanation generation failed:", err.message);
    if (breakdown.missedMonths > 0 && breakdown.onTimePayments === 0) {
      return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai kyunke ab tak ${breakdown.missedMonths} payment cycle miss hui hai. Har month waqt pe payment karke score barhayein.`;
    }
    if (breakdown.latePayments > 0 && breakdown.onTimePayments === 0) {
      return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai. Aapki payment ${breakdown.avgDaysLate} din late hui thi, is liye poore points nahi mile. Agli baar waqt pe payment karein.`;
    }
    return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai — ${breakdown.onTimePayments} out of ${breakdown.resolvedCycles} resolved cycles waqt pe. Consistent rahein, score ${breakdown.durationMonths}-month duration ke saath barhta jayega.`;
  }
}

function generateTips(breakdown) {
  const tips = [];
  if (!breakdown.hasStarted) return tips;
  if (breakdown.missedMonths > 0) tips.push({ icon: "📅", text: `${breakdown.missedMonths} cycle bilkul miss hui. Har month regular payment karein.` });
  if (breakdown.latePayments > 0) tips.push({ icon: "⏰", text: `${breakdown.latePayments} payment der se hui (avg ${breakdown.avgDaysLate} din). Deadline se pehle payment karein.` });
  if (breakdown.pendingPayments > 0) tips.push({ icon: "⏳", text: `${breakdown.pendingPayments} payment organizer ke pending hai — follow up karein.` });
  if (breakdown.rejectedPayments > 0) tips.push({ icon: "❌", text: `${breakdown.rejectedPayments} payment reject hui. Sahih amount ke saath dobara submit karein.` });
  if (breakdown.currentOnTimeStreak >= 3) tips.push({ icon: "🔥", text: `Shandar! ${breakdown.currentOnTimeStreak} cycles ki on-time streak chal rahi hai.` });
  return tips.slice(0, 4);
}

async function getFullExplanation(memberId, committeeId) {
  const { data: member } = await supabase.from("members").select("name, phone").eq("id", memberId).single();
  const breakdown = await buildBreakdown(memberId, committeeId);
  const explanation = await generateExplanation(member?.name || "Member", breakdown);
  const tips = generateTips(breakdown);

  let scoreLabel;
  if (!breakdown.hasStarted) scoreLabel = { text: "نیا رکن", emoji: "🆕" };
  else if (breakdown.currentScore >= 80) scoreLabel = { text: "بہترین", emoji: "🌟" };
  else if (breakdown.currentScore >= 60) scoreLabel = { text: "اچھا", emoji: "👍" };
  else if (breakdown.currentScore >= 40) scoreLabel = { text: "اوسط", emoji: "⚠️" };
  else scoreLabel = { text: "کمزور", emoji: "📉" };

  return { member: { id: memberId, name: member?.name || "Unknown", phone: member?.phone }, score: breakdown.currentScore, scoreLabel, breakdown, explanation, tips, lastUpdated: breakdown.lastUpdated };
}

function formatForWhatsApp(fullExplanation) {
  const { score, scoreLabel, breakdown, explanation, tips } = fullExplanation;
  let msg = `${scoreLabel.emoji} *Trust Score: ${score}/100 — ${scoreLabel.text}*\n`;
  msg += `_(${breakdown.durationMonths}-month committee, ${breakdown.monthlyValue} pts/month)_\n\n`;
  msg += `📊 *Breakdown (${breakdown.resolvedCycles} cycles resolved):*\n`;
  msg += `✅ On-Time: ${breakdown.onTimePayments}\n🐢 Late: ${breakdown.latePayments}\n📅 Missed: ${breakdown.missedMonths}\n❌ Rejected: ${breakdown.rejectedPayments}\n⏳ Pending: ${breakdown.pendingPayments}\n\n`;
  msg += `🔥 Current Streak: ${breakdown.currentOnTimeStreak} cycles\n\n`;
  msg += `🤖 *AI Explanation:*\n${explanation}\n\n`;
  if (tips.length > 0) { msg += `💡 *Tips to Improve:*\n`; tips.forEach((t) => { msg += `${t.icon} ${t.text}\n`; }); }
  return msg;
}

module.exports = { buildBreakdown, generateExplanation, generateTips, getFullExplanation, formatForWhatsApp };