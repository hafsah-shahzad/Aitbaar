const supabase = require("../config/supabaseClient");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────────────────────
// BUILD DETAILED TRUST SCORE BREAKDOWN
// Gathers all payment data and computes the breakdown stats
// that the AI uses to explain the score.
// ─────────────────────────────────────────────────────────

async function buildBreakdown(memberId, committeeId) {
  // 1. Trust score
  const { data: trustData } = await supabase
    .from("trust_scores")
    .select("score, updated_at")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .maybeSingle();

  const currentScore = trustData?.score ?? 100;

  // 2. All payment records for this member in this committee
  const { data: payments } = await supabase
    .from("payment_records")
    .select("id, month, amount, status, created_at")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .order("created_at", { ascending: true });

  const allPayments = payments || [];

  // 3. Category counts
  const confirmed = allPayments.filter((p) => p.status === "confirmed");
  const rejected = allPayments.filter((p) => p.status === "rejected");
  const pending = allPayments.filter((p) => p.status === "pending" || p.status === "self-declared");
  const verified = allPayments.filter((p) => p.status === "verified");

  // 4. Committee info (for months elapsed)
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

  // 5. On-time vs late analysis
  // Since we don't have explicit "due dates", we estimate:
  // - "confirmed" within the same month = on-time
  // - "confirmed" in a later month than the payment's month = late
  let onTimeCount = 0;
  let lateCount = 0;

  for (const payment of confirmed) {
    const paymentMonth = payment.month;
    const paymentDate = new Date(payment.created_at);
    const paymentMonthYear = paymentDate.toLocaleString("en-PK", { month: "long", year: "numeric" });

    // If the payment was confirmed in the same month it was for, it's on-time
    if (paymentMonthYear === paymentMonth) {
      onTimeCount++;
    } else {
      lateCount++;
    }
  }

  // 6. Payment consistency (consecutive on-time payments)
  let maxConsecutiveOnTime = 0;
  let currentStreak = 0;
  for (const payment of confirmed) {
    const paymentDate = new Date(payment.created_at);
    const paymentMonthYear = paymentDate.toLocaleString("en-PK", { month: "long", year: "numeric" });
    if (paymentMonthYear === payment.month) {
      currentStreak++;
      maxConsecutiveOnTime = Math.max(maxConsecutiveOnTime, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  // Current streak (from most recent)
  let currentOnTimeStreak = 0;
  const reversedConfirmed = [...confirmed].reverse();
  for (const payment of reversedConfirmed) {
    const paymentDate = new Date(payment.created_at);
    const paymentMonthYear = paymentDate.toLocaleString("en-PK", { month: "long", year: "numeric" });
    if (paymentMonthYear === payment.month) {
      currentOnTimeStreak++;
    } else {
      break;
    }
  }

  // 7. Total confirmed amount
  const totalConfirmedAmount = confirmed.reduce(
    (sum, p) => sum + (p.amount || committee?.monthly_amount || 0), 0
  );

  // 8. Missed months (months elapsed - confirmed payments)
  const missedMonths = Math.max(0, monthsElapsed - confirmed.length);

  // 9. Priority request history
  const { count: priorityRequestsUsed } = await supabase
    .from("priority_requests")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .eq("status", "approved");

  // 10. Anomaly flags
  const { count: anomalyCount } = await supabase
    .from("anomaly_flags")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("committee_id", committeeId);

  return {
    currentScore,
    totalPayments: confirmed.length + rejected.length + pending.length + verified.length,
    confirmedPayments: confirmed.length,
    rejectedPayments: rejected.length,
    pendingPayments: pending.length,
    onTimePayments: onTimeCount,
    latePayments: lateCount,
    missedMonths,
    monthsElapsed,
    maxConsecutiveOnTime,
    currentOnTimeStreak,
    totalConfirmedAmount,
    monthlyAmount: committee?.monthly_amount || 0,
    priorityRequestsUsed: priorityRequestsUsed || 0,
    anomalyFlags: anomalyCount || 0,
    lastUpdated: trustData?.updated_at || null,
  };
}

// ─────────────────────────────────────────────────────────
// AI EXPLANATION
// Takes the breakdown data and generates a natural language
// explanation in Urdu/Roman Urdu via Gemini.
// ─────────────────────────────────────────────────────────

async function generateExplanation(memberName, breakdown) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

  const prompt = `
You are a trust score explainer for Aitbaar, a committee (kameti/bisi) app in Pakistan.

A member wants to understand their trust score. Explain it in a friendly, clear way.

MEMBER: ${memberName}

TRUST SCORE DATA:
- Current Score: ${breakdown.currentScore}/100
- Confirmed Payments: ${breakdown.confirmedPayments} out of ${breakdown.monthsElapsed} months
- On-Time Payments: ${breakdown.onTimePayments}
- Late Payments: ${breakdown.latePayments}
- Missed Months: ${breakdown.missedMonths}
- Rejected Payments: ${breakdown.rejectedPayments}
- Pending Payments: ${breakdown.pendingPayments}
- Current On-Time Streak: ${breakdown.currentOnTimeStreak} months
- Best Streak: ${breakdown.maxConsecutiveOnTime} months
- Priority Requests Used: ${breakdown.priorityRequestsUsed}
- Anomaly Flags: ${breakdown.anomalyFlags}

RULES FOR EXPLANATION:
1. Start with a friendly greeting using the member's name.
2. Explain the score in 2-3 simple sentences.
3. Mention specific numbers (e.g., "You made 7 out of 8 payments on time").
4. If there are late or missed payments, mention them clearly.
5. If score is high (>80), congratulate them.
6. If score is low (<60), be encouraging but honest.
7. End with 1-2 specific tips to improve their score.
8. Use a mix of Urdu and Roman Urdu, natural and conversational.
9. Keep it under 5 sentences total.
10. Do NOT use markdown or formatting.

Write the explanation now:
`.trim();

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error("AI explanation generation failed:", err.message);

    // Fallback: build a simple text explanation
    if (breakdown.currentScore >= 80) {
      return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai. Aapne ${breakdown.confirmedPayments} mein se ${breakdown.onTimePayments} payments waqt pe ki hain. Bohat acha! Score barane ke liye baqi remaining months mein bhi waqt pe payment karein.`;
    }
    if (breakdown.currentScore >= 50) {
      return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai. Aapne ${breakdown.confirmedPayments} mein se ${breakdown.onTimePayments} payments waqt pe ki hain. ${breakdown.latePayments > 0 ? `${breakdown.latePayments} payment der se hui.` : ""} Score barane ke liye har month waqt pe payment karein.`;
    }
    return `${memberName}, aapka trust score ${breakdown.currentScore}/100 hai. Aapne ${breakdown.confirmedPayments} mein se ${breakdown.confirmedPayments} payments confirm ki hain. ${breakdown.missedMonths > 0 ? `${breakdown.missedMonths} month miss ho gaya.` : ""} Score barane ke liye regular payments karein.`;
  }
}

// ─────────────────────────────────────────────────────────
// GENERATE IMPROVEMENT TIPS
// Returns 3 specific, actionable tips based on the data.
// ─────────────────────────────────────────────────────────

function generateTips(breakdown) {
  const tips = [];

  if (breakdown.latePayments > 0) {
    tips.push({
      icon: "⏰",
      text: `${breakdown.latePayments} payment${breakdown.latePayments > 1 ? "s" : ""} der se hui${breakdown.latePayments > 1 ? "ں" : ""}۔ Agli dafa deadline se pehle payment karein.`,
    });
  }

  if (breakdown.missedMonths > 0) {
    tips.push({
      icon: "📅",
      text: `${breakdown.missedMonths} month ki payment miss hui। Har month regular payment karein.`,
    });
  }

  if (breakdown.pendingPayments > 0) {
    tips.push({
      icon: "⏳",
      text: `${breakdown.pendingPayments} payment${breakdown.pendingPayments > 1 ? "s" : ""} abhi pending hai। Organizer se confirm karwayein.`,
    });
  }

  if (breakdown.rejectedPayments > 0) {
    tips.push({
      icon: "❌",
      text: `${breakdown.rejectedPayments} payment${breakdown.rejectedPayments > 1 ? "s" : ""} reject hui${breakdown.rejectedPayments > 1 ? "ں" : ""}। Sahih amount aur proof ke saath dobara submit karein.`,
    });
  }

  if (breakdown.anomalyFlags > 0) {
    tips.push({
      icon: "🚩",
      text: `${breakdown.anomalyFlags} anomaly flag${breakdown.anomalyFlags > 1 ? "s" : ""} hain। Regular payments se flags hat jayenge.`,
    });
  }

  if (breakdown.priorityRequestsUsed >= 2) {
    tips.push({
      icon: "🔄",
      text: `Aapne ${breakdown.priorityRequestsUsed} dafa priority request use ki hai। Kam use karein — score behtar rahega.`,
    });
  }

  // Always add a positive/streak tip
  if (breakdown.currentOnTimeStreak >= 3) {
    tips.push({
      icon: "🔥",
      text: `Shandar! Aapki ${breakdown.currentOnTimeStreak} month ki streak chal rahi hai. Isay barqarar rakhein!`,
    });
  } else if (breakdown.currentScore < 80) {
    tips.push({
      icon: "📈",
      text: `Score barane ke liye: 3 consecutive months ki on-time payment karein — score ${Math.min(100, breakdown.currentScore + 15)} tak ja sakta hai.`,
    });
  }

  // Cap at 4 tips
  return tips.slice(0, 4);
}

// ─────────────────────────────────────────────────────────
// FULL EXPLANATION (combines breakdown + AI + tips)
// ─────────────────────────────────────────────────────────

async function getFullExplanation(memberId, committeeId) {
  // 1. Get member name
  const { data: member } = await supabase
    .from("members")
    .select("name, phone")
    .eq("id", memberId)
    .single();

  // 2. Build breakdown
  const breakdown = await buildBreakdown(memberId, committeeId);

  // 3. Generate AI explanation
  const explanation = await generateExplanation(member?.name || "Member", breakdown);

  // 4. Generate tips
  const tips = generateTips(breakdown);

  // 5. Score label
  let scoreLabel;
  if (breakdown.currentScore >= 80) {
    scoreLabel = { text: "بہترین", color: "green", emoji: "🌟" };
  } else if (breakdown.currentScore >= 60) {
    scoreLabel = { text: "اچھا", color: "blue", emoji: "👍" };
  } else if (breakdown.currentScore >= 40) {
    scoreLabel = { text: "اوسط", color: "yellow", emoji: "⚠️" };
  } else {
    scoreLabel = { text: "کمزور", color: "red", emoji: "📉" };
  }

  return {
    member: {
      id: memberId,
      name: member?.name || "Unknown",
      phone: member?.phone,
    },
    score: breakdown.currentScore,
    scoreLabel,
    breakdown: {
      confirmedPayments: breakdown.confirmedPayments,
      totalMonths: breakdown.monthsElapsed,
      onTimePayments: breakdown.onTimePayments,
      latePayments: breakdown.latePayments,
      rejectedPayments: breakdown.rejectedPayments,
      pendingPayments: breakdown.pendingPayments,
      missedMonths: breakdown.missedMonths,
      currentStreak: breakdown.currentOnTimeStreak,
      bestStreak: breakdown.maxConsecutiveOnTime,
      totalConfirmedAmount: breakdown.totalConfirmedAmount,
      monthlyAmount: breakdown.monthlyAmount,
      priorityRequestsUsed: breakdown.priorityRequestsUsed,
      anomalyFlags: breakdown.anomalyFlags,
    },
    explanation,
    tips,
    lastUpdated: breakdown.lastUpdated,
  };
}

// ─────────────────────────────────────────────────────────
// FORMAT FOR WHATSAPP
// Returns a text block suitable for WhatsApp message.
// ─────────────────────────────────────────────────────────

function formatForWhatsApp(fullExplanation) {
  const { member, score, scoreLabel, breakdown, explanation, tips } = fullExplanation;

  let msg = `${scoreLabel.emoji} *Trust Score: ${score}/100 — ${scoreLabel.text}*\n\n`;

  msg += `📊 *Payment Breakdown:*\n`;
  msg += `✅ Confirmed: ${breakdown.confirmedPayments}/${breakdown.totalMonths} months\n`;
  msg += `⏰ On-Time: ${breakdown.onTimePayments}\n`;
  msg += `🐢 Late: ${breakdown.latePayments}\n`;
  msg += `❌ Rejected: ${breakdown.rejectedPayments}\n`;
  msg += `⏳ Pending: ${breakdown.pendingPayments}\n`;
  msg += `📅 Missed: ${breakdown.missedMonths}\n\n`;

  msg += `🔥 Current Streak: ${breakdown.currentStreak} months\n`;
  msg += `🏆 Best Streak: ${breakdown.bestStreak} months\n\n`;

  msg += `🤖 *AI Explanation:*\n${explanation}\n\n`;

  if (tips.length > 0) {
    msg += `💡 *Tips to Improve:*\n`;
    for (const tip of tips) {
      msg += `${tip.icon} ${tip.text}\n`;
    }
  }

  return msg;
}

module.exports = {
  buildBreakdown,
  generateExplanation,
  generateTips,
  getFullExplanation,
  formatForWhatsApp,
};
