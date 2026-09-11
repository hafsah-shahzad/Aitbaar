<<<<<<< HEAD
// This file's job: generate payout schedules for committees.
// Two modes: AI-generated (locked after creation) or manual (always editable).

=======
>>>>>>> 0c9fc72660758813ea8c85ee2cb84adb4d0c4954
const supabase = require("../config/supabaseClient");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Check if a payout schedule already exists for this committee
async function getPayoutSchedule(committeeId) {
  const { data, error } = await supabase
    .from("payout_schedule")
    .select("*, members(name, phone)")
    .eq("committee_id", committeeId)
    .order("payout_order", { ascending: true });

  if (error) return null;
  return data;
}

// AI Auto-Generate payout order (LOCKED after creation)
async function generateAutoPayoutSchedule(committeeId) {
  // Check if already generated
  const existing = await getPayoutSchedule(committeeId);
  if (existing && existing.length > 0 && existing[0].type === "auto") {
    return { success: false, error: "Auto payout schedule already exists and is locked." };
  }

  // Fetch members with trust scores and payment history
  const { data: members } = await supabase
    .from("members")
    .select("*, trust_scores(*)")
    .eq("committee_id", committeeId);

  if (!members || members.length === 0) {
    return { success: false, error: "No members found in this committee." };
  }

  const { data: payments } = await supabase
    .from("payment_records")
    .select("*")
    .eq("committee_id", committeeId);

  // Prepare member summary for Gemini
  const memberSummary = members.map((m) => ({
    id: m.id,
    name: m.name || m.phone,
    trustScore: m.trust_scores?.[0]?.score ?? 100,
    confirmedPayments: (payments || []).filter(
      (p) => p.member_id === m.id && p.status === "confirmed"
    ).length,
    joinedAt: m.joined_at,
  }));

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are a fair committee payout advisor. Based on the following member data,
suggest a fair payout order (1 = gets paid first, last number = gets paid last).

Consider:
- Higher trust score → more reliable → can wait longer OR deserves early reward
- More confirmed payments → loyal member → consider early payout
- Joined earlier → been waiting longer → consider early payout
- Balance fairness across all members

Member data:
${JSON.stringify(memberSummary, null, 2)}

Return ONLY a JSON array ordered from first payout to last, with reasoning:
[
  {
    "memberId": "uuid",
    "payoutOrder": 1,
    "reasoning": "one sentence why this member gets this position"
  }
]
No extra text, only JSON.
    `.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    const schedule = JSON.parse(text);

    // Save to database (locked — type: "auto")
    const inserts = schedule.map((item) => ({
      committee_id: committeeId,
      member_id: item.memberId,
      payout_order: item.payoutOrder,
      type: "auto",
      ai_reasoning: item.reasoning,
    }));

    // Delete any existing manual schedule first
    await supabase.from("payout_schedule").delete().eq("committee_id", committeeId);

    const { data, error } = await supabase
      .from("payout_schedule")
      .insert(inserts)
      .select("*, members(name, phone)");

    if (error) return { success: false, error: error.message };

    return { success: true, schedule: data, type: "auto" };
  } catch (err) {
    console.error("AI payout generation failed:", err.message);
    return { success: false, error: "AI generation failed: " + err.message };
  }
}

// Manual payout schedule — save/update organizer's custom order
async function saveManualPayoutSchedule(committeeId, memberOrders) {
  // memberOrders = [{ memberId, payoutOrder }, ...]

  // Validate no duplicate orders
  const orders = memberOrders.map((m) => m.payoutOrder);
  const uniqueOrders = new Set(orders);
  if (uniqueOrders.size !== orders.length) {
    return { success: false, error: "Duplicate payout orders found. Each member must have a unique position." };
  }

  // Check if auto schedule exists (cannot overwrite)
  const existing = await getPayoutSchedule(committeeId);
  if (existing && existing.length > 0 && existing[0].type === "auto") {
    return { success: false, error: "Auto-generated schedule is locked and cannot be changed." };
  }

  // Delete existing manual schedule and re-insert
  await supabase.from("payout_schedule").delete().eq("committee_id", committeeId);

  const inserts = memberOrders.map((m) => ({
    committee_id: committeeId,
    member_id: m.memberId,
    payout_order: m.payoutOrder,
    type: "manual",
    ai_reasoning: null,
  }));

  const { data, error } = await supabase
    .from("payout_schedule")
    .insert(inserts)
    .select("*, members(name, phone)");

  if (error) return { success: false, error: error.message };

  return { success: true, schedule: data, type: "manual" };
}

module.exports = { getPayoutSchedule, generateAutoPayoutSchedule, saveManualPayoutSchedule };