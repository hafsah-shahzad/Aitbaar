const supabase = require("../config/supabaseClient");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function predictPaymentRisk(committeeId) {
  try {
    // Fetch all members
    const { data: members } = await supabase
      .from("members")
      .select("*, trust_scores(*)")
      .eq("committee_id", committeeId);

    if (!members || members.length === 0) return [];

    // Fetch all payment history
    const { data: allPayments } = await supabase
      .from("payment_records")
      .select("*")
      .eq("committee_id", committeeId)
      .order("created_at", { ascending: true });

    // Current month check
    const currentMonth = new Date().toLocaleString("en-PK", {
      month: "long", year: "numeric",
    });

    const riskMembers = [];

    for (const member of members) {
      const memberPayments = (allPayments || []).filter(
        (p) => p.member_id === member.id
      );

      const confirmedPayments = memberPayments.filter(
        (p) => p.status === "confirmed"
      );

      const rejectedPayments = memberPayments.filter(
        (p) => p.status === "rejected"
      );

      const hasPaidThisMonth = memberPayments.some(
        (p) => p.month === currentMonth && p.status !== "rejected"
      );

      // Skip if already paid this month
      if (hasPaidThisMonth) continue;

      const trustScore = member.trust_scores?.[0]?.score ?? 100;

      // Calculate risk score (0-100, higher = more risk)
      let riskScore = 0;

      // Factor 1: Low trust score
      if (trustScore < 50) riskScore += 40;
      else if (trustScore < 70) riskScore += 20;
      else if (trustScore < 85) riskScore += 10;

      // Factor 2: Rejected payments history
      riskScore += Math.min(rejectedPayments.length * 15, 30);

      // Factor 3: Confirmed payment ratio
      const joinedDate = new Date(member.joined_at);
      const monthsInCommittee = Math.max(1,
        (new Date().getFullYear() - joinedDate.getFullYear()) * 12 +
        (new Date().getMonth() - joinedDate.getMonth())
      );

      const paymentRatio = confirmedPayments.length / monthsInCommittee;
      if (paymentRatio < 0.5) riskScore += 30;
      else if (paymentRatio < 0.75) riskScore += 15;

      // Classify risk
      let riskLevel;
      if (riskScore >= 60) riskLevel = "high";
      else if (riskScore >= 30) riskLevel = "medium";
      else riskLevel = "low";

      if (riskScore >= 30) {
        riskMembers.push({
          member,
          riskScore,
          riskLevel,
          trustScore,
          confirmedCount: confirmedPayments.length,
          rejectedCount: rejectedPayments.length,
          monthsInCommittee,
        });
      }
    }

    // Sort by risk score descending
    riskMembers.sort((a, b) => b.riskScore - a.riskScore);

    // Use Gemini to generate personalized reminder messages
    for (const risk of riskMembers) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
Tum Aitbaar committee assistant ho. Is member ko ek gentle payment reminder
bhejni hai WhatsApp pe:

Member: ${risk.member.name || risk.member.phone}
Trust score: ${risk.trustScore}/100
Is mahinay payment status: Abhi tak nahi ki
Risk level: ${risk.riskLevel}

2 sentences mein, friendly aur polite Urdu mein reminder likho.
Dhamki wali language bilkul nahi — sirf yaad dilana hai.
Sirf message text, kuch aur nahi.
        `.trim();

        const result = await model.generateContent(prompt);
        risk.reminderMessage = result.response.text().trim();
      } catch (err) {
        risk.reminderMessage = `Assalam-o-Alaikum! Is mahinay committee payment abhi tak receive nahi hui. Kripya jald payment confirm karein.`;
      }
    }

    return riskMembers;
  } catch (err) {
    console.error("Predictive risk analysis failed:", err.message);
    return [];
  }
}

async function sendPaymentReminders(committeeId) {
  const { sendWhatsAppMessage } = require("./whatsappService");

  const riskMembers = await predictPaymentRisk(committeeId);

  if (riskMembers.length === 0) {
    console.log("No at-risk members found for committee", committeeId);
    return { sent: 0, riskMembers: [] };
  }

  let sent = 0;

  for (const risk of riskMembers) {
    try {
      await sendWhatsAppMessage(risk.member.phone, risk.reminderMessage);
      console.log(`Reminder sent to ${risk.member.phone} (risk: ${risk.riskLevel})`);
      sent++;
    } catch (err) {
      console.log(`Could not send reminder to ${risk.member.phone}:`, err.message);
    }
  }

  return { sent, riskMembers };
}

module.exports = { predictPaymentRisk, sendPaymentReminders };