const supabase = require("../config/supabaseClient");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────────────────────
// FAIRNESS RULES (predefined)
// These are evaluated alongside the AI suggestion.
// The AI provides a recommendation; the organizer makes
// the final decision.
// ─────────────────────────────────────────────────────────

const URGENCY_CATEGORIES = {
  financial_hardship: { weight: 3, label: "مالی مشکل" },
  medical_emergency: { weight: 4, label: "طبیzagEmergency" },
  family_obligation: { weight: 3, label: "خاندانی ضرورت" },
  work_schedule: { weight: 2, label: "کام کا شیڈول" },
  relocation: { weight: 2, label: "منتقلی" },
  preference: { weight: 1, label: "ترجیح" },
  other: { weight: 1, label: "دیگر" },
};

// ─────────────────────────────────────────────────────────
// AI CATEGORIZATION
// Sends the reason to Gemini to classify into a category,
// determine urgency, and suggest a fair new position.
// ─────────────────────────────────────────────────────────

async function analyzeChangeReason({
  reason,
  currentPosition,
  totalMembers,
  allPositions,
}) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

  const positionContext = allPositions
    .map((p) => `Position ${p.position}: ${p.members?.name || "Unknown"} (${p.status})`)
    .join("\n");

  const prompt = `
You are an AI fairness assistant for a savings committee (kameti/bisi) in Pakistan.

A member has requested to change their payout position. Analyze their reason and
suggest a fair revised position based on the rules below.

CURRENT SITUATION:
- Member's current position: ${currentPosition} out of ${totalMembers}
- Total members: ${totalMembers}
- Current payout order:
${positionContext}

MEMBER'S REASON:
"${reason}"

RULES FOR FAIRNESS:
1. Medical emergencies and financial hardships get higher priority.
2. A member who has already received their payout (position < current month) should not be moved to an earlier position.
3. Members with high trust scores (80+) should be considered for favorable positions.
4. Swapping should minimize disruption — suggest the nearest fair position.
5. A member cannot take another member's position without justification.
6. The organizer must approve any change — you only recommend.

Return ONLY valid JSON in this exact format:
{
  "category": "financial_hardship" | "medical_emergency" | "family_obligation" | "work_schedule" | "relocation" | "preference" | "other",
  "urgency": "low" | "medium" | "high",
  "suggested_position": <number between 1 and ${totalMembers}>,
  "reasoning": "<short explanation in Urdu/Roman Urdu, 2-3 sentences>"
}

Do NOT add markdown, headings, or any text outside the JSON.
`.trim();

  try {
    const result = await model.generateContent(prompt);
    const text = result.response
      .text()
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(text);

    // Validate category
    if (!URGENCY_CATEGORIES[parsed.category]) {
      parsed.category = "other";
    }

    // Clamp suggested position
    parsed.suggested_position = Math.max(
      1,
      Math.min(totalMembers, parseInt(parsed.suggested_position) || currentPosition)
    );

    console.log("AI change analysis:", parsed);
    return parsed;
  } catch (err) {
    console.error("AI change analysis failed:", err.message);

    // Fallback: suggest current position (no change)
    return {
      category: "other",
      urgency: "low",
      suggested_position: currentPosition,
      reasoning: "AI analysis unavailable. Organizer review needed.",
    };
  }
}

// ─────────────────────────────────────────────────────────
// CREATE CHANGE REQUEST
// Processes a member's change reason through AI and stores
// the request for organizer review.
// ─────────────────────────────────────────────────────────

async function createChangeRequest({
  payoutPositionId,
  memberId,
  reason,
  currentPosition,
  totalMembers,
  allPositions,
}) {
  // 1. AI analysis
  const analysis = await analyzeChangeReason({
    reason,
    currentPosition,
    totalMembers,
    allPositions,
  });

  // 2. Store the change request
  const { data, error } = await supabase
    .from("payout_change_requests")
    .insert([{
      payout_position_id: payoutPositionId,
      member_id: memberId,
      reason,
      ai_category: analysis.category,
      ai_urgency: analysis.urgency,
      ai_suggested_position: analysis.suggested_position,
      ai_reasoning: analysis.reasoning,
      status: "pending",
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ─────────────────────────────────────────────────────────
// APPROVE / REJECT CHANGE REQUEST
// Called by the organizer. On approval, the swap is executed.
// ─────────────────────────────────────────────────────────

async function approveChangeRequest(requestId, organizerId) {
  const { data: request, error: fetchError } = await supabase
    .from("payout_change_requests")
    .select("*, payout_positions!inner ( payout_order_id, member_id, position )")
    .eq("id", requestId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const { data, error } = await supabase
    .from("payout_change_requests")
    .update({
      status: "approved",
      reviewed_by: organizerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return { request: data, position: request.payout_positions };
}

async function rejectChangeRequest(requestId, organizerId) {
  const { data, error } = await supabase
    .from("payout_change_requests")
    .update({
      status: "rejected",
      reviewed_by: organizerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ─────────────────────────────────────────────────────────
// RETRIEVE CHANGE REQUESTS
// ─────────────────────────────────────────────────────────

async function getChangeRequestsForOrder(orderId) {
  const { data, error } = await supabase
    .from("payout_change_requests")
    .select(`
      *,
      payout_positions!inner ( payout_order_id, position, member_id ),
      members ( id, name, phone )
    `)
    .eq("payout_positions.payout_order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

async function getPendingChangeRequests(orderId) {
  const { data, error } = await supabase
    .from("payout_change_requests")
    .select(`
      *,
      payout_positions!inner ( payout_order_id, position, member_id ),
      members ( id, name, phone )
    `)
    .eq("payout_positions.payout_order_id", orderId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

module.exports = {
  analyzeChangeReason,
  createChangeRequest,
  approveChangeRequest,
  rejectChangeRequest,
  getChangeRequestsForOrder,
  getPendingChangeRequests,
};
