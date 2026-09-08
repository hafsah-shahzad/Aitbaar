const supabase = require("../config/supabaseClient");
const { generateWithSystem, MODELS } = require("./llmProvider");

async function buildBreakdown(memberId, committeeId) {
  const { data: trustData } = await supabase
    .from("trust_scores")
    .select("score, updated_at")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .maybeSingle();

  const currentScore = trustData?.score ?? 100;

  const { data: payments } = await supabase
    .from("payment_records")
    .select("id, month, amount, status, is_late, days_late, created_at")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .order("created_at", { ascending: true });

  const allPayments = payments || [];
  const confirmed = allPayments.filter((p) => p.status === "confirmed");
  const rejected = allPayments.filter((p) => p.status === "rejected");
  const pending = allPayments.filter((p) => p.status === "pending");

  const onTime = confirmed.filter((p) => !p.is_late);
  const late = confirmed.filter((p) => p.is_late);
  const avgDaysLate = late.length > 0 ? Math.round(late.reduce((s, p) => s + (p.days_late || 0), 0) / late.length) : 0;

  const { data: committee } = await supabase
    .from("committees")
    .select("start_date, duration_months, monthly_amount")
    .eq("id", committeeId)
    .single();

  const startDate = committee?.start_date ? new Date(committee.start_date) : new Date();
  const now = new Date();
  const monthsElapsed = Math.max(1, Math.min(
    committee?.duration_months || 12,
    (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()) + 1
  ));

  // Current streak of consecutive on-time months, most recent first
  let currentOnTimeStreak = 0;
  const reversedConfirmed = [...confirmed].reverse();
  for (const p of reversedConfirmed) {
    if (!p.is_late) currentOnTimeStreak++;
    else break;
  }

  const totalConfirmedAmount = confirmed.reduce((sum, p) => sum + (p.amount || committee?.monthly_amount || 0), 0);
  const missedMonths = Math.max(0, monthsElapsed - confirmed.length - pending.length);

  const { count: priorityRequestsUsed } = await supabase
    .from("priority_requests")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .eq("status", "approved");

  const { count: anomalyCount } = await supabase
    .from("anomaly_flags")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("committee_id", committeeId);

  return {
    currentScore,
    totalPayments: allPayments.length,
    confirmedPayments: confirmed.length,
    rejectedPayments: rejected.length,
    pendingPayments: pending.length,
    onTimePayments: onTime.length,
    latePayments: late.length,
    avgDaysLate,
    missedMonths,
    monthsElapsed,
    currentOnTimeStreak,
    totalConfirmedAmount,
    monthlyAmount: committee?.monthly_amount || 0,
    priorityRequestsUsed: priorityRequestsUsed || 0,
    anomalyFlags: anomalyCount || 0,
    lastUpdated: trustData?.updated_at || null,
  };
}

async function generateExplanation(memberName, breakdown) {
  const systemPrompt = `You are a trust score explainer for Aitbaar, a committee (kameti/bisi) app in Pakistan. Explain scores in a friendly, clear, natural mix of Urdu and Roman Urdu. Under 5 sentences. No markdown, no JSON.`;

  const userPrompt = `
MEMBER: ${memberName}

TRUST SCORE DATA:
- Current Score: ${breakdown.currentScore}/100
- Confirmed Payments: ${breakdown.confirmedPayments} out of ${breakdown.monthsElapsed} months
- On-Time Payments: ${breakdown.onTimePayments}
- Late Payments: ${breakdown.latePayments}${breakdown.latePayments > 0 ? ` (average ${breakdown.avgDaysLate} days late)` : ""}
- Missed Months: ${breakdown.missedMonths}
- Rejected Payments: ${breakdown.rejectedPayments}
- Pending Payments: ${breakdown.pendingPayments}
- Current On-Time Streak: ${breakdown.currentOnTimeStreak} months
- Priority Requests Used: ${breakdown.priorityRequestsUsed}
- Anomaly Flags: ${breakdown.anomalyFlags}

RULES:
1. Friendly greeting using the member's name.
2. Explain the score in 2-3 sentences with specific numbers.
3. Mention late/missed payments clearly if any.
4. If score >80, congratulate. If <60, be encouraging but honest.
5. End with 1-2 specific improvement tips.
`.trim();

  try {
    return (await generateWithSystem(systemPrompt, userPrompt, { model: MODELS.FLASH, temperature: 0.6, maxTokens: 250 })).trim();
  } catch (err) {
    console.error("AI explanation generation failed:", err.message);
    if (breakdown.currentScore >= 80) {
      return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai. Aapne ${breakdown.confirmedPayments} mein se ${breakdown.onTimePayments} payments waqt pe ki hain. Bohat acha! Isay barqarar rakhein.`;
    }
    if (breakdown.currentScore >= 50) {
      return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai. ${breakdown.latePayments > 0 ? `${breakdown.latePayments} payment der se hui.` : ""} Score barane ke liye har month waqt pe payment karein.`;
    }
    return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai. ${breakdown.missedMonths > 0 ? `${breakdown.missedMonths} month miss hua.` : ""} Regular, waqt pe payment karke score behtar karein.`;
  }
}

function generateTips(breakdown) {
  const tips = [];
  if (breakdown.latePayments > 0) {
    tips.push({ icon: "⏰", text: `${breakdown.latePayments} payment${breakdown.latePayments > 1 ? "s" : ""} der se hui (average ${breakdown.avgDaysLate} din). Deadline se pehle payment karein.` });
  }
  if (breakdown.missedMonths > 0) {
    tips.push({ icon: "📅", text: `${breakdown.missedMonths} month ki payment miss hui. Har month regular payment karein.` });
  }
  if (breakdown.pendingPayments > 0) {
    tips.push({ icon: "⏳", text: `${breakdown.pendingPayments} payment pending hai. Organizer se confirm karwayein.` });
  }
  if (breakdown.rejectedPayments > 0) {
    tips.push({ icon: "❌", text: `${breakdown.rejectedPayments} payment reject hui. Sahih amount ke saath dobara submit karein.` });
  }
  if (breakdown.currentOnTimeStreak >= 3) {
    tips.push({ icon: "🔥", text: `Shandar! ${breakdown.currentOnTimeStreak} month ki on-time streak chal rahi hai.` });
  } else if (breakdown.currentScore < 80) {
    tips.push({ icon: "📈", text: `3 consecutive on-time payments se score behtar ho sakta hai.` });
  }
  return tips.slice(0, 4);
}

async function getFullExplanation(memberId, committeeId) {
  const { data: member } = await supabase.from("members").select("name, phone").eq("id", memberId).single();
  const breakdown = await buildBreakdown(memberId, committeeId);
  const explanation = await generateExplanation(member?.name || "Member", breakdown);
  const tips = generateTips(breakdown);

  let scoreLabel;
  if (breakdown.currentScore >= 80) scoreLabel = { text: "بہترین", emoji: "🌟" };
  else if (breakdown.currentScore >= 60) scoreLabel = { text: "اچھا", emoji: "👍" };
  else if (breakdown.currentScore >= 40) scoreLabel = { text: "اوسط", emoji: "⚠️" };
  else scoreLabel = { text: "کمزور", emoji: "📉" };

  return {
    member: { id: memberId, name: member?.name || "Unknown", phone: member?.phone },
    score: breakdown.currentScore,
    scoreLabel,
    breakdown,
    explanation,
    tips,
    lastUpdated: breakdown.lastUpdated,
  };
}

function formatForWhatsApp(fullExplanation) {
  const { score, scoreLabel, breakdown, explanation, tips } = fullExplanation;
  let msg = `${scoreLabel.emoji} *Trust Score: ${score}/100 — ${scoreLabel.text}*\n\n`;
  msg += `📊 *Payment Breakdown:*\n`;
  msg += `✅ Confirmed: ${breakdown.confirmedPayments}/${breakdown.monthsElapsed} months\n`;
  msg += `⏰ On-Time: ${breakdown.onTimePayments}\n`;
  msg += `🐢 Late: ${breakdown.latePayments}\n`;
  msg += `❌ Rejected: ${breakdown.rejectedPayments}\n`;
  msg += `⏳ Pending: ${breakdown.pendingPayments}\n`;
  msg += `📅 Missed: ${breakdown.missedMonths}\n\n`;
  msg += `🔥 Current Streak: ${breakdown.currentOnTimeStreak} months\n\n`;
  msg += `🤖 *AI Explanation:*\n${explanation}\n\n`;
  if (tips.length > 0) {
    msg += `💡 *Tips to Improve:*\n`;
    tips.forEach((t) => { msg += `${t.icon} ${t.text}\n`; });
  }
  return msg;
}

module.exports = { buildBreakdown, generateExplanation, generateTips, getFullExplanation, formatForWhatsApp };