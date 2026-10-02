const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const MODELS = {
  PLUS: "openai/gpt-oss-120b",    // ← naya model (quality)
  FLASH: "openai/gpt-oss-20b",    // ← naya model (speed)
};

async function chatCompletion(messages, options = {}) {
  const response = await client.chat.completions.create({
    model: options.model || MODELS.PLUS,
    messages,
    max_tokens: options.maxTokens || 300,
    temperature: options.temperature ?? 0.7,
    tools: options.tools,
    tool_choice: options.tools ? (options.tool_choice || "auto") : undefined,
  });
  return response.choices[0].message;
}

module.exports = { chatCompletion, MODELS };
