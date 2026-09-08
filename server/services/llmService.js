const { chatCompletion, MODELS } = require("./llmProvider");
const supabase = require("../config/supabaseClient");

const SYSTEM_PROMPT = `Tum Aitbaar naam ka ek AI assistant ho jo WhatsApp ke zariye committee (bisi/kameti) members ki madad karta hai.

TONE: Friendly, respectful, calm, trustworthy, natural — WhatsApp conversation jaisa.
LANGUAGE: User jis language mein baat kare (Roman Urdu, Urdu script, English, ya mixed), usi mein jawab do. Language unnecessarily mat badlo.
STYLE: 2-3 sentences se zyada nahi. Simple words. Emojis sirf naturally suitable hon to. User ko blame ya shame mat karo.

HARD RULES:
- Trust score, payment amount, status, ya payout position kabhi guess mat karo — hamesha available tool call karke real data lo.
- Agar tool se data nahi milta, honestly batao ke abhi available nahi hai.
- Suspicious payment request ya number change nazar aaye to organizer se verify karne ko kaho.
- Message unclear ho to ek short clarification sawal pucho.

Sirf final answer likho. JSON mat do. Internal reasoning mat do.`;

const FEW_SHOT = [
  { role: "user", content: "Aitbaar kya hai?" },
  { role: "assistant", content: "Aitbaar ek AI-powered committee assistant hai jo payments, payouts aur trust ko manage karne mein help karta hai." },
  { role: "user", content: "hi" },
  { role: "assistant", content: "Assalam o Alaikum! 👋 Main Aitbaar hoon. Bataiye, main aapki kya help kar sakta hoon?" },
  { role: "user", content: "unknown number se payment request ayi hai" },
  { role: "assistant", content: "Payment karne se pehle request ko verify karein. Unknown number ko payment na karein aur organizer ke verified number se confirm karein." },
];

// ── TOOLS: real Supabase lookups, not guesses ──
const tools = [
  {
    type: "function",
    function: {
      name: "get_trust_score",
      description: "Fetch a member's current trust score for a committee",
      parameters: {
        type: "object",
        properties: { member_id: { type: "string" }, committee_id: { type: "string" } },
        required: ["member_id", "committee_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payment_records",
      description: "Fetch a member's recent payment records (amount, month, status)",
      parameters: {
        type: "object",
        properties: {
          member_id: { type: "string" },
          committee_id: { type: "string" },
          limit: { type: "number" },
        },
        required: ["member_id", "committee_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payout_info",
      description: "Fetch a member's payout order/position in their committee",
      parameters: {
        type: "object",
        properties: { member_id: { type: "string" }, committee_id: { type: "string" } },
        required: ["member_id", "committee_id"],
      },
    },
  },
];

async function executeTool(name, args) {
  try {
    if (name === "get_trust_score") {
      const { data } = await supabase
        .from("trust_scores")
        .select("score, updated_at")
        .eq("member_id", args.member_id)
        .eq("committee_id", args.committee_id)
        .maybeSingle();
      return data ? { found: true, ...data } : { found: false };
    }

    if (name === "get_payment_records") {
      const { data } = await supabase
        .from("payment_records")
        .select("amount, month, status, created_at")
        .eq("member_id", args.member_id)
        .eq("committee_id", args.committee_id)
        .order("created_at", { ascending: false })
        .limit(args.limit || 5);
      return { found: !!(data && data.length), records: data || [] };
    }

    if (name === "get_payout_info") {
      const { data } = await supabase
        .from("payout_schedule")
        .select("payout_order, type")
        .eq("member_id", args.member_id)
        .eq("committee_id", args.committee_id)
        .maybeSingle();
      return data ? { found: true, ...data } : { found: false };
    }

    return { error: "Unknown tool: " + name };
  } catch (err) {
    console.error(`Tool execution failed (${name}):`, err.message);
    return { error: "Tool execution failed" };
  }
}

// ── SESSION CONTINUITY: pull last state + recent messages so the bot remembers where it left off ──
async function getConversationContext(phone, memberId) {
  const [{ data: session }, { data: recentMessages }] = await Promise.all([
    supabase.from("member_sessions").select("*").eq("phone", phone).maybeSingle(),
    memberId
      ? supabase
          .from("messages")
          .select("transcript, response, created_at")
          .eq("member_id", memberId)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    lastState: session?.state || null,
    lastActiveAt: session?.updated_at || null,
    history: (recentMessages || []).reverse(), // oldest first
  };
}

// ── MAIN ENTRY POINT ──
async function generateResponse(transcript, member, phone) {
  const context = member
    ? `Member "${member.name || "unknown"}" (member_id: ${member.id}), committee "${member.committees?.name || "unknown"}" (committee_id: ${member.committee_id}).`
    : "Yeh number abhi kisi committee mein register nahi hai.";

  const { lastState, history } = await getConversationContext(phone, member?.id);

  let historyBlock = "";
  if (history.length > 0) {
    historyBlock =
      "\n--- PREVIOUS CONVERSATION (continue naturally from here) ---\n" +
      history.map((h) => `User: ${h.transcript}\nAitbaar: ${h.response}`).join("\n") +
      "\n--- END PREVIOUS CONVERSATION ---\n";
  }
  if (lastState) {
    historyBlock += `\n(Note: user's last known flow state was "${lastState}" — they may be continuing that.)\n`;
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...FEW_SHOT,
    { role: "user", content: `CONTEXT: ${context}${historyBlock}\n\nUser ne kaha:\n"${transcript}"` },
  ];

  try {
    let message = await chatCompletion(messages, { model: MODELS.PLUS, tools, maxTokens: 300 });

    if (message.tool_calls?.length) {
      messages.push(message);
      for (const call of message.tool_calls) {
        const args = JSON.parse(call.function.arguments);
        console.log(`Calling tool: ${call.function.name}`, args);
        const result = await executeTool(call.function.name, args);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      message = await chatCompletion(messages, { model: MODELS.PLUS, maxTokens: 300 });
    }

    const responseText = message.content.trim();
    console.log("Aitbaar Qwen response:", responseText);
    return responseText;
  } catch (err) {
    console.error("Qwen response generation failed:", err.message);
    throw err;
  }
}

module.exports = { generateResponse };