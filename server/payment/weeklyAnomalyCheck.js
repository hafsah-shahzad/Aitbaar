// This file's job: analyze payment and communication patterns for each
// committee and flag anything suspicious. Runs on a weekly schedule.

const supabase = require("../config/supabaseClient");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeCommitteePatterns(committeeId) {
  try {
    // Fetch all members with their trust scores
    const { data: members } = await supabase
      .from("members")
      .select("*, trust_scores(*)")
      .eq("committee_id", committeeId);

    if (!members || members.length === 0) return [];

    // Fetch last 3 months of payment records
    const { data: payments } = await supabase
      .from("payment_records")
      .select("*")
      .eq("committee_id", committeeId)
      .order("created_at", { ascending: false });

    // Fetch last 30 days of messages (to check communication patterns)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: messages } = await supabase
      .from("messages")
      .select("phone, created_at")
      .in("phone", members.map((m) => m.phone))
      .gte("created_at", thirtyDaysAgo.toISOString());

    const flags = [];

    for (const member of members) {
      const memberPayments = (payments || []).filter(
        (p) => p.member_id === member.id
      );

      const memberMessages = (messages || []).filter(
        (m) => m.phone === member.phone
      );

      const trustScore = member.trust_scores?.[0]?.score ?? 100;

      // ── FLAG 1: Low trust score ─────────────────
      if (trustScore < 50) {
        flags.push({
          memberId: member.id,
          committeeId,
          severity: "high",
          reason: `${member.name || member.phone} ka trust score ${trustScore} pe aa gaya hai — yeh bohat kam hai.`,
        });
      }

      // ── FLAG 2: Rejected payments ───────────────
      const rejectedPayments = memberPayments.filter(
        (p) => p.status === "rejected"
      );

      if (rejectedPayments.length >= 2) {
        flags.push({
          memberId: member.id,
          committeeId,
          severity: "high",
          reason: `${member.name || member.phone} ki ${rejectedPayments.length} payments organizer ne reject ki hain.`,
        });
      }

      // ── FLAG 3: Unconfirmed self-declared payments
      const unconfirmedPayments = memberPayments.filter(
        (p) => p.status === "self-declared"
      );

      if (unconfirmedPayments.length >= 2) {
        flags.push({
          memberId: member.id,
          committeeId,
          severity: "medium",
          reason: `${member.name || member.phone} ki ${unconfirmedPayments.length} payments abhi tak organizer ne verify nahi ki hain.`,
        });
      }

      // ── FLAG 4: No payments at all (joined 30+ days ago)
      const joinedDate = new Date(member.joined_at);
      const daysSinceJoined = Math.floor(
        (new Date() - joinedDate) / (1000 * 60 * 60 * 24)
      );

      const confirmedPayments = memberPayments.filter(
        (p) => p.status === "confirmed"
      );

      if (daysSinceJoined > 30 && confirmedPayments.length === 0) {
        flags.push({
          memberId: member.id,
          committeeId,
          severity: "medium",
          reason: `${member.name || member.phone} committee mein ${daysSinceJoined} din se hain lekin abhi tak koi payment confirm nahi hui.`,
        });
      }

      // ── FLAG 5: Sudden silence (was active, now quiet)
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const lastTwoWeeks = new Date();
      lastTwoWeeks.setDate(lastTwoWeeks.getDate() - 14);

      const recentMessages = memberMessages.filter(
        (m) => new Date(m.created_at) >= lastWeek
      );

      const olderMessages = memberMessages.filter(
        (m) =>
          new Date(m.created_at) >= lastTwoWeeks &&
          new Date(m.created_at) < lastWeek
      );

      if (olderMessages.length >= 3 && recentMessages.length === 0) {
        flags.push({
          memberId: member.id,
          committeeId,
          severity: "low",
          reason: `${member.name || member.phone} pichle hafte se bilkul silent hain, jabke pehle active the.`,
        });
      }
    }

    // ── GEMINI: Overall pattern analysis ─────────
    // Send the summary data to Gemini for additional pattern detection
    if (members.length > 1) {
      const summaryData = members.map((m) => ({
        name: m.name || m.phone,
        trustScore: m.trust_scores?.[0]?.score ?? 100,
        confirmedPayments: (payments || []).filter(
          (p) => p.member_id === m.id && p.status === "confirmed"
        ).length,
        rejectedPayments: (payments || []).filter(
          (p) => p.member_id === m.id && p.status === "rejected"
        ).length,
        messageCount: (messages || []).filter(
          (msg) => msg.phone === m.phone
        ).length,
      }));

      try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
        const prompt = `
Yeh ek committee ka data hai:
${JSON.stringify(summaryData, null, 2)}

Kya koi unusual pattern hai jo fraud ya problem indicate kare?
Sirf ek JSON array return karo jisme serious issues hon (agar koi na ho to empty array):
[{"severity": "low|medium|high", "reason": "Urdu mein wajah"}]
Sirf JSON, kuch aur nahi.
        `.trim();

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, "").trim();
        const geminiFlags = JSON.parse(text);

        if (Array.isArray(geminiFlags)) {
          for (const gf of geminiFlags) {
            flags.push({
              memberId: null, // committee-level flag
              committeeId,
              severity: gf.severity || "low",
              reason: `[AI Analysis] ${gf.reason}`,
            });
          }
        }
      } catch (err) {
        console.log("Gemini pattern analysis skipped:", err.message);
      }
    }

    return flags;
  } catch (err) {
    console.error("Error analyzing committee patterns:", err.message);
    return [];
  }
}

async function saveFlagsAndNotify(flags, organizerPhone) {
  if (flags.length === 0) return;

  for (const flag of flags) {
    // Check if same flag already exists (avoid duplicates)
    const { data: existing } = await supabase
      .from("anomaly_flags")
      .select("id")
      .eq("committee_id", flag.committeeId)
      .eq("reason", flag.reason)
      .maybeSingle();

    if (!existing) {
      await supabase.from("anomaly_flags").insert([{
        committee_id: flag.committeeId,
        member_id: flag.memberId || null,
        severity: flag.severity,
        reason: flag.reason,
      }]);
    }
  }

  // Send summary to organizer if there are high/medium flags
  const importantFlags = flags.filter(
    (f) => f.severity === "high" || f.severity === "medium"
  );

  if (importantFlags.length > 0 && organizerPhone) {
  const { sendWhatsAppMessage } = require("../services/whatsappService");

    const message =
      `[Aitbaar Alert] Aapki committee mein ${importantFlags.length} suspicious pattern mile hain:\n\n` +
      importantFlags.map((f) => `⚠️ ${f.reason}`).join("\n\n") +
      `\n\nDashboard pe check karein.`;

    sendWhatsAppMessage(organizerPhone, message).catch(() => {});
  }
}



// ─────────────────────────────────────────────
// Run anomaly check for all committees
// ─────────────────────────────────────────────
async function runManualCheck() {
  try {
    const { data: committees, error } = await supabase
      .from("committees")
      .select("id, organizer_id");

    if (error) {
      throw error;
    }

    if (!committees || committees.length === 0) {
      console.log("No committees found for anomaly check.");
      return;
    }

    console.log(`Running anomaly check for ${committees.length} committees...`);

    for (const committee of committees) {
      try {
        const flags = await analyzeCommitteePatterns(committee.id);

        // Get organizer phone
        let organizerPhone = null;

        if (committee.organizer_id) {
          const { data: organizer } = await supabase
            .from("organizers")
            .select("phone")
            .eq("id", committee.organizer_id)
            .maybeSingle();

          organizerPhone = organizer?.phone || null;
        }

        await saveFlagsAndNotify(flags, organizerPhone);

        console.log(
          `Committee ${committee.id}: ${flags.length} anomaly flag(s)`
        );
      } catch (err) {
        console.error(
          `Anomaly check failed for committee ${committee.id}:`,
          err.message
        );
      }
    }

    console.log("Anomaly check completed.");
  } catch (err) {
    console.error("Manual anomaly check failed:", err.message);
    throw err;
  }
}


// ─────────────────────────────────────────────
// Weekly scheduler
// ─────────────────────────────────────────────
function startWeeklyAnomalyCheck() {
  console.log("Weekly anomaly check scheduler started.");

  // Run once when server starts
  runManualCheck().catch((err) => {
    console.error("Initial anomaly check failed:", err.message);
  });

  // Run every 7 days
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  setInterval(() => {
    runManualCheck().catch((err) => {
      console.error("Weekly anomaly check failed:", err.message);
    });
  }, ONE_WEEK);
}


// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────
module.exports = {
  analyzeCommitteePatterns,
  saveFlagsAndNotify,
  runManualCheck,
  startWeeklyAnomalyCheck,
};
// module.exports = { analyzeCommitteePatterns, saveFlagsAndNotify };
