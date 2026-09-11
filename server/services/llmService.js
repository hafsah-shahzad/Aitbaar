const { chatCompletion, MODELS } = require("./llmProvider");
const supabase = require("../config/supabaseClient");
const { getDueDateForNow } = require("./paymentService");

const SYSTEM_PROMPT = `Tum Aitbaar naam ka ek AI assistant ho jo WhatsApp ke zariye committee (bisi/kameti) members ki madad karta hai.

TONE: Friendly, respectful, calm, trustworthy, natural — WhatsApp conversation jaisa.
LANGUAGE: User jis language mein baat kare (Roman Urdu, Urdu script, English, ya mixed), usi mein jawab do.
STYLE: 2-4 sentences se zyada nahi. Simple words. Emojis sirf naturally suitable hon to.

HARD RULES:
- Koi bhi number, date, ya status kabhi guess mat karo — hamesha available tool call karke real data lo.
- Agar tool se data nahi milta, honestly batao ke abhi available nahi hai.
- Tum khud payment receive nahi kar sakte. Agar koi pooche "kya main aapko payment bhej sakta hoon", clearly batao ke payment hamesha committee ke organizer ko hi jani chahiye — tum sirf claim record karte ho jo organizer verify karta hai.
- Kabhi bhi kisi doosre member ki personal information (naam, phone, payment history) share mat karo — sirf poochne wale ki apni information do. Privacy protect karna zaroori hai.
- Agar koi apna payout position badalna chahta hai, unhe batao ke wajah (reason) voice note ya text mein bhejein — system unko automatically is process mein le jayega.
- Reminders automatic hain — jab payment due date qareeb ho ya late ho jaye, system khud message bhejta hai. Member ko manually kuch karne ki zaroorat nahi.
- Suspicious payment request ya number change nazar aaye to organizer se verify karne ko kaho.
- Message unclear ho to ek short clarification sawal pucho.

Sirf final answer likho. JSON mat do. Internal reasoning mat do.`;

const FEW_SHOT = [
  { role: "user", content: "Aitbaar kya hai?" },
  { role: "assistant", content: "Aitbaar ek AI-powered committee assistant hai jo committie payments, payouts aur trust ko manage karne mein help karta hai." },
  { role: "user", content: "kya main aapko payment bhej sakta hoon?" },
  { role: "assistant", content: "Nahi, payment hamesha committee ke organizer ko hi bhejein. Main sirf aapki claim record karta hoon jo organizer verify karta hai." },
  { role: "user", content: "kya aap mujhe kisi aur member ka number bata sakte hain?" },
  { role: "assistant", content: "Maazrat, main doosre members ki personal information share nahi kar sakta — sirf aapki apni information de sakta hoon." },
];

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

const tools = [
  {
    type: "function",
    function: {
      name: "get_trust_score",
      description: "Fetch a member's current trust score for a committee",
      parameters: { type: "object", properties: { member_id: { type: "string" }, committee_id: { type: "string" } }, required: ["member_id", "committee_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payment_records",
      description: "Fetch a member's recent payment records (amount, month, status, is_late)",
      parameters: { type: "object", properties: { member_id: { type: "string" }, committee_id: { type: "string" }, limit: { type: "number" } }, required: ["member_id", "committee_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_next_payment_date",
      description: "Get the due date of the member's next unpaid monthly payment for this committee",
      parameters: { type: "object", properties: { committee_id: { type: "string" }, member_id: { type: "string" } }, required: ["committee_id", "member_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_committee_info",
      description: "Fetch committee details: name, code, organizer name, creation date, duration, monthly amount, months remaining",
      parameters: { type: "object", properties: { committee_id: { type: "string" } }, required: ["committee_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_member_info",
      description: "Fetch the requesting member's own name, phone, and when they joined",
      parameters: { type: "object", properties: { member_id: { type: "string" } }, required: ["member_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payout_schedule",
      description: "Fetch the member's payout position/order in the committee and total members",
      parameters: { type: "object", properties: { member_id: { type: "string" }, committee_id: { type: "string" } }, required: ["member_id", "committee_id"] },
    },
  },
];

async function executeTool(name, args) {
  try {
    if (name === "get_trust_score") {
      const { data } = await supabase.from("trust_scores").select("score, updated_at").eq("member_id", args.member_id).eq("committee_id", args.committee_id).maybeSingle();
      return data ? { found: true, ...data } : { found: false };
    }

    if (name === "get_payment_records") {
      const { data } = await supabase.from("payment_records").select("amount, month, status, is_late, days_late, created_at").eq("member_id", args.member_id).eq("committee_id", args.committee_id).order("created_at", { ascending: false }).limit(args.limit || 5);
      return { found: !!(data && data.length), records: data || [] };
    }

    if (name === "get_next_payment_date") {
      const { data: committee } = await supabase.from("committees").select("name, start_date, monthly_amount").eq("id", args.committee_id).maybeSingle();
      if (!committee || !committee.start_date) return { found: false };

      const now = new Date();
      const currentDue = getDueDateForNow(committee.start_date, now);
      const monthLabel = now.toLocaleString("en-PK", { month: "long", year: "numeric" });

      const { data: existingPayment } = await supabase.from("payment_records").select("id, status").eq("member_id", args.member_id).eq("committee_id", args.committee_id).eq("month", monthLabel).in("status", ["pending", "confirmed"]).maybeSingle();

      const dueDate = existingPayment ? getDueDateForNow(committee.start_date, addMonths(now, 1)) : currentDue;
      const daysUntil = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));

      return {
        found: true,
        committee_name: committee.name,
        monthly_amount: committee.monthly_amount,
        current_month_already_logged: !!existingPayment,
        due_date: dueDate.toISOString().slice(0, 10),
        days_until_due: daysUntil,
        is_overdue: daysUntil < 0,
      };
    }

    if (name === "get_committee_info") {
      const { data: committee } = await supabase.from("committees").select("name, code, start_date, duration_months, monthly_amount, total_members, created_at, organizer_id").eq("id", args.committee_id).maybeSingle();
      if (!committee) return { found: false };

      const { data: organizer } = await supabase.from("organizers").select("name").eq("id", committee.organizer_id).maybeSingle();

      const now = new Date();
      const start = new Date(committee.start_date);
      const monthsElapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
      const monthsRemaining = Math.max(0, (committee.duration_months || 0) - monthsElapsed);

      return {
        found: true,
        name: committee.name,
        code: committee.code,
        organizer_name: organizer?.name || "Unknown",
        start_date: committee.start_date,
        duration_months: committee.duration_months,
        months_elapsed: monthsElapsed,
        months_remaining: monthsRemaining,
        monthly_amount: committee.monthly_amount,
        total_members: committee.total_members,
      };
    }

    if (name === "get_member_info") {
      const { data } = await supabase.from("members").select("name, phone, joined_at").eq("id", args.member_id).maybeSingle();
      return data ? { found: true, ...data } : { found: false };
    }

    if (name === "get_payout_schedule") {
      const { data: order } = await supabase.from("payout_orders").select("id").eq("committee_id", args.committee_id).in("status", ["draft", "pending_approval", "approved", "finalized"]).order("version", { ascending: false }).limit(1).maybeSingle();
      if (!order) return { found: false };

      const { data: position } = await supabase.from("payout_positions").select("position, status").eq("payout_order_id", order.id).eq("member_id", args.member_id).maybeSingle();
      const { count: totalPositions } = await supabase.from("payout_positions").select("id", { count: "exact", head: true }).eq("payout_order_id", order.id);

      return position ? { found: true, position: position.position, total_members: totalPositions || 0, status: position.status } : { found: false };
    }

    return { error: "Unknown tool: " + name };
  } catch (err) {
    console.error(`Tool execution failed (${name}):`, err.message);
    return { error: "Tool execution failed" };
  }
}

async function getConversationContext(phone, memberId) {
  const [{ data: session }, { data: recentMessages }] = await Promise.all([
    supabase.from("member_sessions").select("*").eq("phone", phone).maybeSingle(),
    memberId ? supabase.from("messages").select("transcript, response, created_at").eq("member_id", memberId).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
  ]);

  return {
    lastState: session?.state || null,
    history: (recentMessages || []).reverse(),
  };
}

async function generateResponse(transcript, member, phone) {
  const context = member
    ? `Member "${member.name || "unknown"}" (member_id: ${member.id}), committee "${member.committees?.name || "unknown"}" (committee_id: ${member.committee_id}).`
    : "Yeh number abhi kisi committee mein register nahi hai.";

  const { lastState, history } = await getConversationContext(phone, member?.id);

  let historyBlock = "";
  if (history.length > 0) {
    historyBlock = "\n--- PREVIOUS CONVERSATION ---\n" + history.map((h) => `User: ${h.transcript}\nAitbaar: ${h.response}`).join("\n") + "\n--- END ---\n";
  }
  if (lastState) historyBlock += `\n(Last known flow state: "${lastState}")\n`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...FEW_SHOT,
    { role: "user", content: `CONTEXT: ${context}${historyBlock}\n\nUser ne kaha:\n"${transcript}"` },
  ];

  try {
    let message = await chatCompletion(messages, { model: MODELS.PLUS, tools, maxTokens: 350 });

    if (message.tool_calls?.length) {
      messages.push(message);
      for (const call of message.tool_calls) {
        const args = JSON.parse(call.function.arguments);
        console.log(`Calling tool: ${call.function.name}`, args);
        const result = await executeTool(call.function.name, args);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      message = await chatCompletion(messages, { model: MODELS.PLUS, maxTokens: 350 });
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