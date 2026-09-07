// // This file's job: analyze each member's past payment behaviour and
// // predict who is likely to miss or delay payment this month.
// // This runs at the start of each month, before payments are due.

// const supabase = require("../config/supabaseClient");
// const { GoogleGenerativeAI } = require("@google/generative-ai");
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// async function predictPaymentRisks(committeeId) {
//   try {
//     // Get all members
//     const { data: members } = await supabase
//       .from("members")
//       .select("*, trust_scores(*)")
//       .eq("committee_id", committeeId);

//     if (!members || members.length === 0) return [];

//     // Get last 3 months of payments
//     const threeMonthsAgo = new Date();
//     threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

//     const { data: payments } = await supabase
//       .from("payment_records")
//       .select("*")
//       .eq("committee_id", committeeId)
//       .gte("created_at", threeMonthsAgo.toISOString())
//       .order("created_at", { ascending: true });

//     const currentMonth = new Date().toLocaleString("en-PK", {
//       month: "long", year: "numeric",
//     });

//     const riskMembers = [];

//     for (const member of members) {
//       const memberPayments = (payments || []).filter(
//         (p) => p.member_id === member.id
//       );

//       const trustScore = member.trust_scores?.[0]?.score ?? 100;

//       // Already paid this month — no risk
//       const paidThisMonth = memberPayments.some(
//         (p) => p.month === currentMonth && p.status !== "rejected"
//       );
//       if (paidThisMonth) continue;

//       // Calculate risk factors
//       const confirmedCount = memberPayments.filter(
//         (p) => p.status === "confirmed"
//       ).length;

//       const rejectedCount = memberPayments.filter(
//         (p) => p.status === "rejected"
//       ).length;

//       const selfDeclaredUnconfirmed = memberPayments.filter(
//         (p) => p.status === "self-declared"
//       ).length;

//       // Risk score (0-100, higher = more at risk)
//       let riskScore = 0;

//       if (trustScore < 60) riskScore += 40;
//       else if (trustScore < 80) riskScore += 20;

//       if (rejectedCount >= 2) riskScore += 30;
//       else if (rejectedCount === 1) riskScore += 15;

//       if (selfDeclaredUnconfirmed >= 2) riskScore += 20;

//       if (confirmedCount === 0) riskScore += 10;

//       riskScore = Math.min(100, riskScore);

//       if (riskScore >= 30) {
//         riskMembers.push({
//           member,
//           riskScore,
//           riskLevel: riskScore >= 70 ? "high" : riskScore >= 40 ? "medium" : "low",
//           confirmedCount,
//           rejectedCount,
//           trustScore,
//         });
//       }
//     }

//     // Sort by risk score (highest first)
//     riskMembers.sort((a, b) => b.riskScore - a.riskScore);

//     // If we have at least 2 members with data, also ask Gemini
//     if (members.length >= 2 && riskMembers.length > 0) {
//       try {
//         const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

//         const memberSummary = riskMembers.map((r) => ({
//           name: r.member.name || r.member.phone,
//           trustScore: r.trustScore,
//           confirmedPayments: r.confirmedCount,
//           rejectedPayments: r.rejectedCount,
//           riskScore: r.riskScore,
//         }));

//         const prompt = `
// Yeh committee members hain jo is mahinay payment miss kar sakte hain:
// ${JSON.stringify(memberSummary, null, 2)}

// Organizer ke liye ek chhota Urdu mein message banao (2-3 sentences) jo:
// 1. Sabse zyada risk wale member ka naam le
// 2. Organizer ko suggest kare kya kare (jaise: call karna, reminder bhejna)

// Sirf message text, kuch aur nahi.
//         `.trim();

//         const result = await model.generateContent(prompt);
//         const aiMessage = result.response.text().trim();

//         return { riskMembers, aiMessage };
//       } catch (err) {
//         console.log("Gemini prediction skipped:", err.message);
//       }
//     }

//     return { riskMembers, aiMessage: null };
//   } catch (err) {
//     console.error("Prediction service error:", err.message);
//     return { riskMembers: [], aiMessage: null };
//   }
// }

// module.exports = { predictPaymentRisks };

