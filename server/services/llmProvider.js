
const OpenAI = require("openai");

// Primary: Alibaba Cloud Model Studio (Qwen)
const qwenClient = process.env.DASHSCOPE_API_KEY
  ? new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    })
  : null;

// Fallback: Groq (gpt-oss)
const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const QWEN_MODELS = { PLUS: "qwen-plus", FLASH: "qwen-flash" };
const GROQ_MODELS = { PLUS: "openai/gpt-oss-120b", FLASH: "openai/gpt-oss-20b" };

// Callers use MODELS.PLUS / MODELS.FLASH as tiers; mapping happens per provider
const MODELS = { PLUS: "PLUS", FLASH: "FLASH" };

function buildRequest(provider, messages, options) {
  const tier = options.model === MODELS.FLASH ? "FLASH" : "PLUS";
  const maxTokens = options.maxTokens || 300;
  const req = {
    messages,
    temperature: options.temperature ?? 0.7,
    tools: options.tools,
    tool_choice: options.tools ? (options.tool_choice || "auto") : undefined,
    response_format: options.jsonMode ? { type: "json_object" } : undefined,
  };

  if (provider === "qwen") {
    req.model = QWEN_MODELS[tier];
    req.max_tokens = maxTokens;
  } else {
    req.model = GROQ_MODELS[tier];
    req.reasoning_effort = "low";        // gpt-oss: kam sochay, jaldi jawab de
    req.max_tokens = maxTokens + 300;    // reasoning tokens ke liye headroom
  }
  return req;
}

async function chatCompletion(messages, options = {}) {
  if (qwenClient) {
    try {
      const res = await qwenClient.chat.completions.create(
        buildRequest("qwen", messages, options)
      );
      return res.choices[0].message;
    } catch (err) {
      console.warn("[LLM] Qwen failed, falling back to Groq:", err.message);
    }
  }
  const res = await groqClient.chat.completions.create(
    buildRequest("groq", messages, options)
  );
  return res.choices[0].message;
}

async function generateWithSystem(systemPrompt, userPrompt, options = {}) {
  const message = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    options
  );
  return message.content || "";
}

module.exports = { chatCompletion, generateWithSystem, MODELS };
