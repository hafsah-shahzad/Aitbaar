const { chatCompletion, MODELS } = require("./llmProvider");

const SYSTEM_PROMPT = `You are the intent classifier for Aitbaar, a WhatsApp assistant for Pakistani savings committee (bisi/kameti) members. Return ONLY a JSON object: {"intent": "payment_confirmation"|"trust_score_query"|"trust_score_explanation"|"priority_request"|"general_query"|"other", "amount": number|null, "confidence": "high"|"low"}. Extract amount as a number if mentioned, else null.`;

const FEW_SHOT = [
  { role: "user", content: "paisay de diye" },
  { role: "assistant", content: '{"intent":"payment_confirmation","amount":null,"confidence":"high"}' },
  { role: "user", content: "5000 transfer kar diya" },
  { role: "assistant", content: '{"intent":"payment_confirmation","amount":5000,"confidence":"high"}' },
  { role: "user", content: "mera trust score kya hai?" },
  { role: "assistant", content: '{"intent":"trust_score_query","amount":null,"confidence":"high"}' },
  { role: "user", content: "mera score kyun itna kam hai?" },
  { role: "assistant", content: '{"intent":"trust_score_explanation","amount":null,"confidence":"high"}' },
  { role: "user", content: "mujhe is mahina jaldi paisay chahiye, medical emergency hai" },
  { role: "assistant", content: '{"intent":"priority_request","amount":null,"confidence":"high"}' },
];

async function detectIntent(transcript) {
  try {
    const message = await chatCompletion(
      [{ role: "system", content: SYSTEM_PROMPT }, ...FEW_SHOT, { role: "user", content: transcript }],
      { model: MODELS.FLASH, temperature: 0.2, maxTokens: 100, jsonMode: true }
    );
    const parsed = JSON.parse(message.content.trim());
    console.log("Detected intent:", parsed);
    return parsed;
  } catch (err) {
    console.error("Intent detection failed (Qwen):", err.message);
    return { intent: "general_query", amount: null, confidence: "low" };
  }
}

module.exports = { detectIntent };