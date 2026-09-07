
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function detectIntent(transcript) {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash-lite",
  });

  const prompt = `
You are the intent detection system for Aitbaar, an AI assistant
for committee (bisi/kameti) members in Pakistan.

The user's message is:

"${transcript}"

Determine the user's intent.

Return ONLY valid JSON:

{
  "intent": "payment_confirmation" | "trust_score_query" | "trust_score_explanation" | "priority_request" | "general_query" | "other",
  "amount": null,
  "confidence": "high" | "low"
}

Payment confirmation examples:
"paisay de diye", "payment kar di", "bhej diye",
"transfer kar diya", "jama kar diya"

Trust score query (just the number):
"mera trust score kya hai?",
"mera score batao",
"meri rating kya hai?"

Trust score explanation (detailed breakdown + why):
"mera score kyun itna hai?",
"why is my score like this?",
"score kyun kam hai?",
"why is my trust score low?",
"mera score kaise barhay?",
"explain my score",
"mujhe samjhao score kyun hai"

Priority request examples (member wants early payout this month):
"mujhe is mahina paisay chahiye", "meri fee bharni hai",
"medical emergency hai", "mujhe jaldi payout chahiye",
"school fee ki deadline aa rahi hai", "rent dena hai",
"mujhe pehle milna chahiye", "urgent hai mera kaam"

If an amount is mentioned, return it as a number.

If no amount is mentioned:
"amount": null
`.trim();

  try {
    const result = await model.generateContent(prompt);

    const text = result.response
      .text()
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(text);

    console.log("Detected intent:", parsed);

    return parsed;
  } catch (err) {
    console.error(
      "Intent detection failed:",
      err.message
    );

    return {
      intent: "general_query",
      amount: null,
      confidence: "low",
    };
  }
}

module.exports = { detectIntent };