const supabase = require("../config/supabaseClient");
const { generateWithSystem, MODELS } = require("./llmProvider");
const { getDueDateForCycle } = require("./paymentService");
const { deductionFraction } = require("./trustScoreCalculator");

// ─────────────────────────────────────────────────────────
// BUILD DETAILED TRUST SCORE BREAKDOWN
// Walks the same due-date cycles and grace-period logic as
// trustScoreCalculator.js, so every number here matches the
// actual stored score exactly.
// ─────────────────────────────────────────────────────────

async function buildBreakdown(memberId, committeeId) {
  const { data: trustData } = await supabase
    .from("trust_scores")
    .select("score, updated_at")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .maybeSingle();

  const currentScore = trustData?.score ?? 0;

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
  let pointsEarned = 0;
  const cycleResults = [];

  if (hasStarted) {
    for (let i = 0; i < durationMonths; i++) {
      const dueDate = getDueDateForCycle(startDate, i);
      if (dueDate > today) break; // this cycle hasn't come due yet

      const monthLabel = dueDate.toLocaleString("en-PK", { month: "long", year: "numeric" });
      const record = byMonth[monthLabel];

      if (!record) {
        missedCount++;
        resolvedCycles++;
        cycleResults.push({ onTime: false, points: 0 });
      } else if (record.status === "pending") {
        pendingCount++; // not resolved yet — doesn't count either way
      } else if (record.status === "rejected") {
        rejectedCount++;
        resolvedCycles++;
        cycleResults.push({ onTime: false, points: 0 });
      } else if (record.status === "confirmed") {
        resolvedCycles++;
        const daysLate = record.is_late ? (record.days_late || 0) : 0;
        const fraction = deductionFraction(daysLate);
        const points = Math.round(monthlyValue * (1 - fraction) * 10) / 10;
        pointsEarned += points;

        // A payment inside the 7-day grace period earned full points —
        // it must be reported as on-time, not late, to match the score.
        if (fraction === 0) {
          onTimeCount++;
          cycleResults.push({ onTime: true, points });
        } else {
          lateCount++;
          totalLateDays += daysLate;
          cycleResults.push({ onTime: false, points });
        }
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
    hasStarted,
    durationMonths,
    monthlyValue,
    resolvedCycles,
    pointsEarned,
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
  if (!breakdown.hasStarted) {
    return `${memberName}, aapki pehli payment cycle abhi due nahi hui, is liye trust score 0/100 se shuru hai. Jaise hi aap waqt pe payment karengi, score barhna shuru ho jayega.`;
  }

  const systemPrompt = `You are a trust score explainer for Aitbaar, a committee (kameti/bisi) app in Pakistan. The score is cumulative out of 100, split evenly across the whole committee duration — it is NOT a percentage of recent behavior, so a low raw score early in a long committee is completely normal and does not by itself mean poor performance. Payments within a 7-day grace period after the due date still earn full credit and must never be described as "late". Judge the member's actual performance by their reliability among resolved cycles, not by the raw score alone. Be accurate to the numbers given. Friendly, clear, natural mix of Urdu and Roman Urdu.when asked in english give answer in english Professional tone, no emojis. Under 5 sentences. No markdown, no JSON.`;

  const userPrompt = `
MEMBER: ${memberName}
Committee duration: ${breakdown.durationMonths} months (each on-time month = ${breakdown.monthlyValue} points out of 100)
Current Score: ${breakdown.currentScore}/100 — this is cumulative and naturally low early in a long committee; do not treat a low raw score alone as bad performance.
Resolved cycles so far: ${breakdown.resolvedCycles}
On-Time (including grace period): ${breakdown.onTimePayments}
Late (beyond grace period): ${breakdown.latePayments}${breakdown.latePayments > 0 ? ` (avg ${breakdown.avgDaysLate} days late)` : ""}
Missed entirely: ${breakdown.missedMonths}
Rejected: ${breakdown.rejectedPayments}
Pending (awaiting organizer): ${breakdown.pendingPayments}
Current on-time streak: ${breakdown.currentOnTimeStreak} cycles

RULES:
1. Greet by name.
2. State the score and explain it comes from ${breakdown.resolvedCycles} resolved month(s) out of ${breakdown.durationMonths} total.
3. Judge performance by on-time vs late/missed among resolved cycles, not by the raw score's size.
4. Be specific and honest about missed/late payments — do not praise if the record is poor.
5. If all resolved cycles were on time, acknowledge it professionally.
6. End with 1-2 concrete tips.
`.trim();

  try {
    return (await generateWithSystem(systemPrompt, userPrompt, { model: MODELS.FLASH, temperature: 0.5, maxTokens: 250 })).trim();
  } catch (err) {
    console.error("AI explanation generation failed:", err.message);
    if (breakdown.missedMonths > 0 && breakdown.onTimePayments === 0) {
      return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai kyunke ab tak ${breakdown.missedMonths} payment cycle miss hui hai. Har month waqt pe payment karke score barhayein.`;
    }
    if (breakdown.latePayments > 0 && breakdown.onTimePayments === 0) {
      return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai. Aapki payment ${breakdown.avgDaysLate} din late hui thi, is liye poore points nahi mile. Agli baar 7 din ke andar payment karein.`;
    }
    return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai — ${breakdown.onTimePayments} out of ${breakdown.resolvedCycles} resolved cycles waqt pe. Consistent rahein, score ${breakdown.durationMonths}-month duration ke saath barhta jayega.`;
  }
}

// ─────────────────────────────────────────────────────────
// IMPROVEMENT TIPS
// ─────────────────────────────────────────────────────────

function generateTips(breakdown) {
  const tips = [];

  if (breakdown.missedMonths > 0) {
    tips.push({ text: `${breakdown.missedMonths} cycle bilkul miss hui. Har month regular payment karein.` });
  }
  if (breakdown.latePayments > 0) {
    tips.push({ text: `${breakdown.latePayments} payment grace period ke baad hui (avg ${breakdown.avgDaysLate} din). 7 din ke andar payment karein taake poore points milein.` });
  }
  if (breakdown.pendingPayments > 0) {
    tips.push({ text: `${breakdown.pendingPayments} payment organizer ke pending hai — follow up karein.` });
  }
  if (breakdown.rejectedPayments > 0) {
    tips.push({ text: `${breakdown.rejectedPayments} payment reject hui. Sahih amount ke saath dobara submit karein.` });
  }
  if (breakdown.currentOnTimeStreak >= 3) {
    tips.push({ text: `${breakdown.currentOnTimeStreak} cycles ki on-time streak chal rahi hai — isay barqarar rakhein.` });
  }

  return tips.slice(0, 4);
}

// ─────────────────────────────────────────────────────────
// FULL EXPLANATION
// Computes a reliability rating separately from the raw
// cumulative score, so early-committee members aren't
// mislabeled just because the raw number is naturally small.
// ─────────────────────────────────────────────────────────

async function getFullExplanation(memberId, committeeId) {
  const { data: member } = await supabase.from("members").select("name, phone").eq("id", memberId).single();
  const breakdown = await buildBreakdown(memberId, committeeId);
  const explanation = await generateExplanation(member?.name || "Member", breakdown);
  const tips = generateTips(breakdown);

  const pointsPossible = breakdown.resolvedCycles * breakdown.monthlyValue;
  const reliabilityPercent = pointsPossible > 0
    ? Math.round((breakdown.pointsEarned / pointsPossible) * 100)
    : null;

  let scoreLabel;
  if (!breakdown.hasStarted || reliabilityPercent === null) {
    scoreLabel = { text: "New Member" };
  } else if (reliabilityPercent >= 80) {
    scoreLabel = { text: "Excellent" };
  } else if (reliabilityPercent >= 60) {
    scoreLabel = { text: "Good" };
  } else if (reliabilityPercent >= 40) {
    scoreLabel = { text: "Average" };
  } else {
    scoreLabel = { text: "Needs Improvement" };
  }

  return {
    member: { id: memberId, name: member?.name || "Unknown", phone: member?.phone },
    score: breakdown.currentScore,
    reliabilityPercent,
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
  const { score, reliabilityPercent, scoreLabel, breakdown, explanation, tips } = fullExplanation;

  let msg = `Trust Score: ${score}/100`;
  msg += reliabilityPercent !== null
    ? ` — Reliability: ${reliabilityPercent}% (${scoreLabel.text})`
    : ` — ${scoreLabel.text}`;
  msg += `\n(${breakdown.durationMonths}-month committee, ${breakdown.monthlyValue} pts/month — score grows as the committee progresses)\n\n`;

  msg += `Payment Breakdown (${breakdown.resolvedCycles} cycles resolved):\n`;
  msg += `On-Time: ${breakdown.onTimePayments}\n`;
  msg += `Late: ${breakdown.latePayments}\n`;
  msg += `Missed: ${breakdown.missedMonths}\n`;
  msg += `Rejected: ${breakdown.rejectedPayments}\n`;
  msg += `Pending: ${breakdown.pendingPayments}\n\n`;

  msg += `Current Streak: ${breakdown.currentOnTimeStreak} cycles\n\n`;
  msg += `Explanation:\n${explanation}\n`;

  if (tips.length > 0) {
    msg += `\nTips to Improve:\n`;
    tips.forEach((t) => { msg += `- ${t.text}\n`; });
  }

  return msg;
}

module.exports = { buildBreakdown, generateExplanation, generateTips, getFullExplanation, formatForWhatsApp };