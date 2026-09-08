const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

const MODELS = {
  PLUS: "qwen-plus",
  FLASH: "qwen-flash", // faster/cheaper — used for intent classification
};

async function chatCompletion(messages, options = {}) {
  const response = await client.chat.completions.create({
    model: options.model || MODELS.PLUS,
    messages,
    max_tokens: options.maxTokens || 300,
    temperature: options.temperature,
    tools: options.tools,
    tool_choice: options.tools ? "auto" : undefined,
    response_format: options.jsonMode
      ? { type: "json_object" }
      : undefined,
  });

  return response.choices[0].message;
}

module.exports = {
  chatCompletion,
  MODELS,
};