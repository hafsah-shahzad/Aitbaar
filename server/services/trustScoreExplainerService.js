const supabase = require("../config/supabaseClient");
const { generateWithSystem, MODELS } = require("./llmProvider");
const { getDueDateForCycle } = require("./paymentService");

// ─────────────────────────────────────────────────────────
// BUILD DETAILED TRUST SCORE BREAKDOWN
// Walks the same due-date cycles as trustScoreCalculator.js,
// so every number here matches the actual stored score exactly.
// ─────────────────────────────────────────────────────────

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

  const { data: payments } = await supabase
    .from("payment_records")
    .select("id, month, amount, status, is_late, days_late, created_at")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .order("created_at", { ascending: true });

  const allPayments = payments || [];

  // Best record per month (confirmed > pending > rejected) — same rule as the calculator
  const statusPriority = { confirmed: 3, pending: 2, rejected: 1 };
  const byMonth = {};
  for (const p of allPayments) {
    const current = byMonth[p.month];
    if (!current || (statusPriority[p.status] || 0) > (statusPriority[current.status] || 0)) {
      byMonth[p.month] = p;
    }
  }

  const today = new Date();
  const durationMonths = committee?.duration_months || 12;
  const startDate = committee?.start_date ? new Date(committee.start_date) : today;

  let onTimeCount = 0;
  let lateCount = 0;
  let missedCount = 0; // resolved cycle, no record at all
  let rejectedCount = 0;
  let pendingCount = 0;
  let resolvedCycles = 0;
  let totalLateDays = 0;
  const cycleResults = []; // in order, for streak calculation

  for (let i = 0; i < durationMonths; i++) {
    const dueDate = getDueDateForCycle(startDate, i);
    if (dueDate > today) break; // this cycle hasn't happened yet

    const monthLabel = dueDate.toLocaleString("en-PK", { month: "long", year: "numeric" });
    const record = byMonth[monthLabel];

    if (!record) {
      missedCount++;
      resolvedCycles++;
      cycleResults.push({ onTime: false });
    } else if (record.status === "pending") {
      pendingCount++;
      // not resolved yet — doesn't count toward streak or resolved cycles
    } else if (record.status === "rejected") {
      rejectedCount++;
      resolvedCycles++;
      cycleResults.push({ onTime: false });
    } else if (record.status === "confirmed") {
      resolvedCycles++;
      if (record.is_late) {
        lateCount++;
        totalLateDays += record.days_late || 0;
        cycleResults.push({ onTime: false });
      } else {
        onTimeCount++;
        cycleResults.push({ onTime: true });
      }
    }
  }

  const avgDaysLate = lateCount > 0 ? Math.round(totalLateDays / lateCount) : 0;

  // Current streak: consecutive on-time cycles, most recent first
  let currentOnTimeStreak = 0;
  for (let i = cycleResults.length - 1; i >= 0; i--) {
    if (cycleResults[i].onTime) currentOnTimeStreak++;
    else break;
  }

  const confirmedPayments = onTimeCount + lateCount;
  const totalConfirmedAmount = allPayments
    .filter((p) => p.status === "confirmed")
    .reduce((sum, p) => sum + (p.amount || committee?.monthly_amount || 0), 0);

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
    resolvedCycles,          // cycles whose due date has passed and are counted
    confirmedPayments,
    onTimePayments: onTimeCount,
    latePayments: lateCount,
    avgDaysLate,
    missedMonths: missedCount,
    rejectedPayments: rejectedCount,
    pendingPayments: pendingCount,
    currentOnTimeStreak,
    totalConfirmedAmount,
    monthlyAmount: committee?.monthly_amount || 0,
    priorityRequestsUsed: priorityRequestsUsed || 0,
    anomalyFlags: anomalyCount || 0,
    lastUpdated: trustData?.updated_at || null,
  };
}

// ─────────────────────────────────────────────────────────
// AI EXPLANATION (Qwen, via Alibaba Cloud Model Studio)
// ─────────────────────────────────────────────────────────

async function generateExplanation(memberName, breakdown) {
  const systemPrompt = `You are a trust score explainer for Aitbaar, a committee (kameti/bisi) app in Pakistan. Explain scores in a friendly, clear, natural mix of Urdu and Roman Urdu. Under 5 sentences. No markdown, no JSON.`;

  const userPrompt = `
MEMBER: ${memberName}

TRUST SCORE DATA:
- Current Score: ${breakdown.currentScore}/100
- Resolved payment cycles so far: ${breakdown.resolvedCycles}
- On-Time Payments: ${breakdown.onTimePayments}
- Late Payments: ${breakdown.latePayments}${breakdown.latePayments > 0 ? ` (average ${breakdown.avgDaysLate} days late)` : ""}
- Missed Months (no payment at all): ${breakdown.missedMonths}
- Rejected Payments: ${breakdown.rejectedPayments}
- Pending Payments (awaiting organizer verification): ${breakdown.pendingPayments}
- Current On-Time Streak: ${breakdown.currentOnTimeStreak} cycles
- Priority Requests Used: ${breakdown.priorityRequestsUsed}
- Anomaly Flags: ${breakdown.anomalyFlags}

RULES:
1. Friendly greeting using the member's name.
2. If resolvedCycles is 0, explain the score is neutral because no payment cycle has come due yet — do not imply anything good or bad.
3. Otherwise explain the score in 2-3 sentences with specific numbers (e.g. "X out of Y payments on time").
4. Mention late/missed payments clearly if any.
5. If score >80, congratulate. If <60, be encouraging but honest — never blame or shame.
6. End with 1-2 specific improvement tips.
`.trim();

  try {
    return (await generateWithSystem(systemPrompt, userPrompt, { model: MODELS.FLASH, temperature: 0.6, maxTokens: 250 })).trim();
  } catch (err) {
    console.error("AI explanation generation failed:", err.message);

    if (breakdown.resolvedCycles === 0) {
      return `${memberName}, abhi tak koi payment cycle due nahi hua, is liye trust score neutral hai. Pehli payment waqt pe karke apna score banana shuru karein.`;
    }
    if (breakdown.currentScore >= 80) {
      return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai. Aapne ${breakdown.resolvedCycles} mein se ${breakdown.onTimePayments} payments waqt pe ki hain. Bohat acha! Isay barqarar rakhein.`;
    }
    if (breakdown.currentScore >= 50) {
      return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai. ${breakdown.latePayments > 0 ? `${breakdown.latePayments} payment der se hui.` : ""} Score barane ke liye har cycle waqt pe payment karein.`;
    }
    return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai. ${breakdown.missedMonths > 0 ? `${breakdown.missedMonths} payment cycle miss hua.` : ""} Regular, waqt pe payment karke score behtar karein.`;
  }
}

// ─────────────────────────────────────────────────────────
// IMPROVEMENT TIPS
// ─────────────────────────────────────────────────────────

function generateTips(breakdown) {
  const tips = [];

  if (breakdown.missedMonths > 0) {
    tips.push({ icon: "📅", text: `${breakdown.missedMonths} payment cycle bilkul miss hui. Har month regular payment karein.` });
  }
  if (breakdown.latePayments > 0) {
    tips.push({ icon: "⏰", text: `${breakdown.latePayments} payment${breakdown.latePayments > 1 ? "s" : ""} der se hui (average ${breakdown.avgDaysLate} din). Deadline se pehle payment karein.` });
  }
  if (breakdown.pendingPayments > 0) {
    tips.push({ icon: "⏳", text: `${breakdown.pendingPayments} payment abhi organizer ke pending hai. Follow up karein.` });
  }
  if (breakdown.rejectedPayments > 0) {
    tips.push({ icon: "❌", text: `${breakdown.rejectedPayments} payment reject hui. Sahih amount ke saath dobara submit karein.` });
  }
  if (breakdown.currentOnTimeStreak >= 3) {
    tips.push({ icon: "🔥", text: `Shandar! ${breakdown.currentOnTimeStreak} cycles ki on-time streak chal rahi hai.` });
  } else if (breakdown.resolvedCycles > 0 && breakdown.currentScore < 80) {
    tips.push({ icon: "📈", text: `3 consecutive on-time payments se score behtar ho sakta hai.` });
  }

  return tips.slice(0, 4);
}

// ─────────────────────────────────────────────────────────
// FULL EXPLANATION
// ─────────────────────────────────────────────────────────

async function getFullExplanation(memberId, committeeId) {
  const { data: member } = await supabase.from("members").select("name, phone").eq("id", memberId).single();
  const breakdown = await buildBreakdown(memberId, committeeId);
  const explanation = await generateExplanation(member?.name || "Member", breakdown);
  const tips = generateTips(breakdown);

  let scoreLabel;
  if (breakdown.resolvedCycles === 0) scoreLabel = { text: "نیا رکن", emoji: "🆕" };
  else if (breakdown.currentScore >= 80) scoreLabel = { text: "بہترین", emoji: "🌟" };
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

// ─────────────────────────────────────────────────────────
// FORMAT FOR WHATSAPP
// ─────────────────────────────────────────────────────────

function formatForWhatsApp(fullExplanation) {
  const { score, scoreLabel, breakdown, explanation, tips } = fullExplanation;

  let msg = `${scoreLabel.emoji} *Trust Score: ${score}/100 — ${scoreLabel.text}*\n\n`;
  msg += `📊 *Payment Breakdown (${breakdown.resolvedCycles} cycles so far):*\n`;
  msg += `✅ On-Time: ${breakdown.onTimePayments}\n`;
  msg += `🐢 Late: ${breakdown.latePayments}\n`;
  msg += `📅 Missed: ${breakdown.missedMonths}\n`;
  msg += `❌ Rejected: ${breakdown.rejectedPayments}\n`;
  msg += `⏳ Pending: ${breakdown.pendingPayments}\n\n`;
  msg += `🔥 Current Streak: ${breakdown.currentOnTimeStreak} cycles\n\n`;
  msg += `🤖 *AI Explanation:*\n${explanation}\n\n`;

  if (tips.length > 0) {
    msg += `💡 *Tips to Improve:*\n`;
    tips.forEach((t) => { msg += `${t.icon} ${t.text}\n`; });
  }

  return msg;
}

module.exports = { buildBreakdown, generateExplanation, generateTips, getFullExplanation, formatForWhatsApp };