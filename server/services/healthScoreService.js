// This file's job: calculate a single "Committee Health Score" (0-100)
// that summarises how well a committee is running overall.
// Think of it like a credit score -- but for a whole committee group.

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function calculateHealthScore({
  avgTrustScore,
  collectionRate,
  anomalyCount,
  totalMembers,
  confirmedPaymentsTotal,
  rejectedPaymentsTotal,
  monthsElapsed,
  durationMonths,
}) {
  // ── Component 1: Average trust score (30%) ──
  const trustComponent = (avgTrustScore / 100) * 30;

  // ── Component 2: Collection rate (30%) ──
  const collectionComponent = (collectionRate / 100) * 30;

  // ── Component 3: Anomaly penalty (20%) ──
  // 0 anomalies = full 20 points, each anomaly costs 5 points
  const anomalyPenalty = Math.min(anomalyCount * 5, 20);
  const anomalyComponent = 20 - anomalyPenalty;

  // ── Component 4: Payment consistency (20%) ──
  // Ratio of confirmed vs total payments expected so far
  const expectedPaymentsSoFar = totalMembers * Math.max(monthsElapsed, 1);
  const consistencyRate = expectedPaymentsSoFar > 0
    ? Math.min(confirmedPaymentsTotal / expectedPaymentsSoFar, 1)
    : 1;
  const consistencyComponent = consistencyRate * 20;

  // Rejection penalty (subtract from final)
  const rejectionPenalty = Math.min(rejectedPaymentsTotal * 2, 10);

  const rawScore =
    trustComponent + collectionComponent + anomalyComponent + consistencyComponent - rejectionPenalty;

  return Math.round(Math.max(0, Math.min(100, rawScore)));
}

function getHealthStatus(score) {
  if (score >= 75) return { label: "Healthy", color: "#1E3A5F", bg: "#E8EEF4", emoji: "🟢" };
  if (score >= 50) return { label: "At Risk", color: "#B8792B", bg: "#FBF0DE", emoji: "🟡" };
  return { label: "Critical", color: "#DC2626", bg: "#FCEBEB", emoji: "🔴" };
}

async function generateHealthSummary(score, status, data) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

    const prompt = `
Aap ek committee health advisor hain. Yeh committee ka health score ${score}100 mein se itna hain (${status.label}).

Data:
- Average trust score: ${data.avgTrustScore}100
- Collection rate: ${data.collectionRate}%
- Anomalies found: ${data.anomalyCount}
- Total members: ${data.totalMembers}
- Committee progress: ${data.monthsElapsed}/${data.durationMonths} months

2 sentences mein, simple Urdu/Hinglish mein, organizer ko batao:
1. Committee ki current situation kya hai
2. Ek practical suggestion kya karein

Sirf 2 sentences, kuch aur nahi.
    `.trim();

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.log("Health summary generation skipped:", err.message);
    return null;
  }
}

module.exports = { calculateHealthScore, getHealthStatus, generateHealthSummary };