const supabase = require("../config/supabaseClient");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────────────────────
// AI ANALYSIS
// Analyzes the member's voice-note transcript to extract:
//   category, urgency, deadline, fairness_score, suggested
// The AI never makes the final decision — only recommends.
// ─────────────────────────────────────────────────────────

async function analyzePriorityRequest({
  transcript,
  memberName,
  trustScore,
  totalConfirmedPayments,
  totalMonths,
  timesReceivedPriority,
  currentPayoutPosition,
  totalMembers,
}) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

  const prompt = `
You are a fairness assistant for a savings committee (kameti/bisi) in Pakistan.

A member has requested EARLY PAYOUT this month via a voice note. Analyse their
request and provide a fairness-based recommendation. You do NOT make the final
decision — the committee votes.

MEMBER PROFILE:
- Name: ${memberName}
- Trust score: ${trustScore}/100
- Confirmed payments made: ${totalConfirmedPayments} out of ${totalMonths} months
- Times they have received priority before: ${timesReceivedPriority}
- Current payout position: ${currentPayoutPosition} out of ${totalMembers} members

VOICE NOTE TRANSCRIPT:
"${transcript}"

ANALYSIS RULES:
1. medical_emergency and financial_hardship are highest urgency.
2. School-fee deadlines, utility cutoffs, and rent deadlines are high urgency.
3. Preferences ("I'd like it early") are low urgency.
4. A member who has already received priority 2+ times gets a lower fairness score.
5. A member with high trust (80+) and good payment history gets a higher fairness score.
6. Extract any specific deadline mentioned (e.g. "7 days", "by 15th").

Return ONLY valid JSON:
{
  "category": "medical_emergency" | "financial_hardship" | "education_fees" | "utility_bill" | "rent" | "family_obligation" | "preference" | "other",
  "urgency": "low" | "medium" | "high" | "critical",
  "deadline": "<natural language deadline or null>",
  "fairness_score": <number 0-100>,
  "suggested": <true if fairness_score >= 60, false otherwise>,
  "suggested_position": <1-based position number to swap the requester to, or 0 if no swap recommended>,
  "swap_with_member_id": "<member_id of the person whose position they should take, or null>",
  "reasoning": "<2-3 sentences in Urdu/Roman Urdu explaining the analysis>"
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

    // Validate and clamp
    parsed.fairness_score = Math.max(0, Math.min(100, Number(parsed.fairness_score) || 0));
    parsed.suggested = parsed.fairness_score >= 60;
    if (!["low", "medium", "high", "critical"].includes(parsed.urgency)) {
      parsed.urgency = "low";
    }

    console.log("AI priority analysis:", parsed);
    return parsed;
  } catch (err) {
    console.error("AI priority analysis failed:", err.message);
    return {
      category: "other",
      urgency: "low",
      deadline: null,
      fairness_score: 30,
      suggested: false,
      reasoning: "AI analysis unavailable. Manual review required.",
    };
  }
}

// ─────────────────────────────────────────────────────────
// CREATE PRIORITY REQUEST
// Full pipeline: gather member context → AI analysis → store
// ─────────────────────────────────────────────────────────

async function createPriorityRequest({ memberId, committeeId, transcript }) {
  // 1. Fetch member details
  const { data: member } = await supabase
    .from("members")
    .select("id, name, phone")
    .eq("id", memberId)
    .single();

  // 2. Fetch trust score
  const { data: trustData } = await supabase
    .from("trust_scores")
    .select("score")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .maybeSingle();

  const trustScore = trustData?.score ?? 100;

  // 3. Count confirmed payments
  const { count: totalConfirmedPayments } = await supabase
    .from("payment_records")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .eq("status", "confirmed");

  // 4. Count months elapsed (from committee start_date)
  const { data: committee } = await supabase
    .from("committees")
    .select("start_date, duration_months, total_members")
    .eq("id", committeeId)
    .single();

  const startDate = committee?.start_date ? new Date(committee.start_date) : new Date();
  const now = new Date();
  const totalMonths = Math.max(1, Math.min(
    committee?.duration_months || 12,
    (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth())
  ));

  // 5. Count prior priority requests approved
  const { count: timesReceivedPriority } = await supabase
    .from("priority_requests")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .eq("status", "approved");

  // 6. Get current payout position from active order
  const { data: activeOrder } = await supabase
    .from("payout_orders")
    .select(`
      id,
      payout_positions ( position, member_id )
    `)
    .eq("committee_id", committeeId)
    .in("status", ["draft", "pending_approval"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let currentPayoutPosition = 0;
  if (activeOrder?.payout_positions) {
    const myPos = activeOrder.payout_positions.find((p) => p.member_id === memberId);
    currentPayoutPosition = myPos?.position || 0;
  }

  const totalMembers = committee?.total_members || activeOrder?.payout_positions?.length || 1;

  // 7. AI analysis
  const analysis = await analyzePriorityRequest({
    transcript,
    memberName: member?.name || "Unknown",
    trustScore,
    totalConfirmedPayments: totalConfirmedPayments || 0,
    totalMonths,
    timesReceivedPriority: timesReceivedPriority || 0,
    currentPayoutPosition,
    totalMembers,
  });

  // 8. Count eligible voters (all members in committee except requester)
  const { count: eligibleVoters } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("committee_id", committeeId)
    .neq("id", memberId);

  // 9. Store the request (including suggested position for swaps)
  const { data, error } = await supabase
    .from("priority_requests")
    .insert([{
      committee_id: committeeId,
      member_id: memberId,
      transcript,
      ai_category: analysis.category,
      ai_urgency: analysis.urgency,
      ai_deadline: analysis.deadline,
      ai_fairness_score: analysis.fairness_score,
      ai_suggested: analysis.suggested,
      ai_suggested_position: analysis.suggested_position || 0,
      ai_swap_with_member_id: analysis.swap_with_member_id || null,
      ai_reasoning: analysis.reasoning,
      status: "pending",
      votes_for: 0,
      votes_against: 0,
      total_eligible_voters: eligibleVoters || 0,
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 10. Audit log
  await logAudit({
    committeeId,
    action: "priority_requested",
    actorMemberId: memberId,
    details: {
      request_id: data.id,
      category: analysis.category,
      urgency: analysis.urgency,
      fairness_score: analysis.fairness_score,
      transcript,
    },
  });

  return data;
}

// ─────────────────────────────────────────────────────────
// VOTING
// ─────────────────────────────────────────────────────────

async function castVote({ priorityRequestId, voterMemberId, vote, reason }) {
  if (!["for", "against"].includes(vote)) {
    throw new Error("Vote must be 'for' or 'against'.");
  }

  // 1. Check the request exists and is pending
  const { data: request } = await supabase
    .from("priority_requests")
    .select("*, members!inner(name)")
    .eq("id", priorityRequestId)
    .eq("status", "pending")
    .single();

  if (!request) {
    throw new Error("Priority request not found or already decided.");
  }

  // 2. Check voter is in the same committee
  const { data: voterMembership } = await supabase
    .from("members")
    .select("id, committee_id")
    .eq("id", voterMemberId)
    .eq("committee_id", request.committee_id)
    .maybeSingle();

  if (!voterMembership) {
    throw new Error("Voter is not a member of this committee.");
  }

  // 3. Check voter is not the requester
  if (voterMemberId === request.member_id) {
    throw new Error("You cannot vote on your own request.");
  }

  // 4. Insert vote (unique constraint prevents double-voting)
  const { error } = await supabase
    .from("priority_votes")
    .insert([{
      priority_request_id: priorityRequestId,
      voter_member_id: voterMemberId,
      vote,
      reason: reason || null,
    }]);

  if (error) {
    if (error.code === "23505") {
      throw new Error("You have already voted on this request.");
    }
    throw new Error(error.message);
  }

  // 5. Update vote tallies
  const { data: allVotes } = await supabase
    .from("priority_votes")
    .select("vote")
    .eq("priority_request_id", priorityRequestId);

  const votesFor = (allVotes || []).filter((v) => v.vote === "for").length;
  const votesAgainst = (allVotes || []).filter((v) => v.vote === "against").length;
  const majorityThreshold = Math.ceil((request.total_eligible_voters || 1) / 2);
  const majorityReached = votesFor >= majorityThreshold;

  const updateData = {
    votes_for: votesFor,
    votes_against: votesAgainst,
    majority_reached: majorityReached,
  };

  if (majorityReached) {
    updateData.status = "approved";
    updateData.decided_by = "vote";
  }

  const { error: updateError } = await supabase
    .from("priority_requests")
    .update(updateData)
    .eq("id", priorityRequestId);

  if (updateError) throw new Error(updateError.message);

  // 6. Audit log
  await logAudit({
    committeeId: request.committee_id,
    action: "vote_cast",
    actorMemberId: voterMemberId,
    details: {
      request_id: priorityRequestId,
      vote,
      votes_for: votesFor,
      votes_against: votesAgainst,
      majority_reached: majorityReached,
    },
  });

  // 7. If majority reached — execute swap and notify
  if (majorityReached) {
    // Auto-swap positions in the payout order
    await executePositionSwap(request);

    await logAudit({
      committeeId: request.committee_id,
      action: "priority_approved",
      details: {
        request_id: priorityRequestId,
        member_name: request.members?.name,
        decided_by: "vote",
        votes_for: votesFor,
        votes_against: votesAgainst,
      },
    });
  }

  return {
    votes_for: votesFor,
    votes_against: votesAgainst,
    majority_reached: majorityReached,
    total_eligible_voters: request.total_eligible_voters,
    status: updateData.status || "pending",
  };
}

// ─────────────────────────────────────────────────────────
// ORGANIZER MANUAL DECISION
// ─────────────────────────────────────────────────────────

async function organizerDecide({ priorityRequestId, organizerId, decision }) {
  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("Decision must be 'approved' or 'rejected'.");
  }

  const { data: request } = await supabase
    .from("priority_requests")
    .select("*, members!inner(name)")
    .eq("id", priorityRequestId)
    .single();

  if (!request) {
    throw new Error("Priority request not found.");
  }

  const { data, error } = await supabase
    .from("priority_requests")
    .update({
      status: decision,
      decided_by: "organizer",
      reviewed_by: organizerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", priorityRequestId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await logAudit({
    committeeId: request.committee_id,
    action: decision === "approved" ? "priority_approved" : "priority_rejected",
    actorOrganizerId: organizerId,
    details: {
      request_id: priorityRequestId,
      member_name: request.members?.name,
      decided_by: "organizer",
      ai_suggested: request.ai_suggested,
      fairness_score: request.ai_fairness_score,
    },
  });

  // Auto-swap positions if approved
  if (decision === "approved") {
    await executePositionSwap(request);
  }

  return data;
}

// ─────────────────────────────────────────────────────────
// AUTO-SWAP POSITIONS
// When a priority request is approved, swap the requester's
// position with the suggested target in the active payout order.
// ─────────────────────────────────────────────────────────

async function executePositionSwap(request) {
  try {
    // Only swap if AI suggested a specific position
    if (!request.ai_suggested_position || request.ai_suggested_position <= 0) {
      console.log("No specific swap position suggested — skipping auto-swap.");
      return;
    }

    // Find the active payout order for this committee
    const { data: activeOrder } = await supabase
      .from("payout_orders")
      .select("id")
      .eq("committee_id", request.committee_id)
      .in("status", ["draft", "pending_approval"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeOrder) {
      console.log("No active payout order found — skipping swap.");
      return;
    }

    // Find requester's current position
    const { data: requesterPos } = await supabase
      .from("payout_positions")
      .select("id, position")
      .eq("payout_order_id", activeOrder.id)
      .eq("member_id", request.member_id)
      .maybeSingle();

    if (!requesterPos) {
      console.log("Requester has no position in the active order.");
      return;
    }

    // Find who currently holds the suggested position
    const { data: targetPos } = await supabase
      .from("payout_positions")
      .select("id, position, member_id")
      .eq("payout_order_id", activeOrder.id)
      .eq("position", request.ai_suggested_position)
      .maybeSingle();

    if (!targetPos || targetPos.member_id === request.member_id) {
      console.log("Target position not found or same member — skipping.");
      return;
    }

    // Execute the swap
    const { swapPositions } = require("./payoutAssignmentService");
    await swapPositions(activeOrder.id, requesterPos.id, targetPos.id);

    console.log(`Position swapped: ${request.member_id} → position ${request.ai_suggested_position}`);

    // Audit log the swap
    await logAudit({
      committeeId: request.committee_id,
      action: "position_swapped",
      details: {
        request_id: request.id,
        member_id: request.member_id,
        from_position: requesterPos.position,
        to_position: request.ai_suggested_position,
        swapped_with: targetPos.member_id,
        decided_by: "vote",
      },
    });
  } catch (err) {
    console.error("Auto-swap failed (non-blocking):", err.message);
  }
}

// ─────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────

async function getActiveRequests(committeeId) {
  const { data, error } = await supabase
    .from("priority_requests")
    .select(`
      *,
      members ( id, name, phone ),
      priority_votes ( id, vote, voter_member_id, reason, created_at )
    `)
    .eq("committee_id", committeeId)
    .eq("status", "pending")
    .order("ai_fairness_score", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

async function getAllRequests(committeeId) {
  const { data, error } = await supabase
    .from("priority_requests")
    .select(`
      *,
      members ( id, name, phone ),
      priority_votes ( id, vote, voter_member_id, created_at )
    `)
    .eq("committee_id", committeeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

async function getRequestById(requestId) {
  const { data, error } = await supabase
    .from("priority_requests")
    .select(`
      *,
      members ( id, name, phone ),
      priority_votes ( id, vote, voter_member_id, reason, created_at, members ( name, phone ) )
    `)
    .eq("id", requestId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ─────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────

async function logAudit({ committeeId, action, actorMemberId, actorOrganizerId, details }) {
  const { error } = await supabase
    .from("payout_audit_log")
    .insert([{
      committee_id: committeeId,
      action,
      actor_member_id: actorMemberId || null,
      actor_organizer_id: actorOrganizerId || null,
      details: details || {},
    }]);

  if (error) console.error("Audit log error:", error.message);
}

async function getAuditLog(committeeId, limit = 50) {
  const { data, error } = await supabase
    .from("payout_audit_log")
    .select(`
      *,
      members ( name, phone ),
      organizers ( name, email )
    `)
    .eq("committee_id", committeeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

module.exports = {
  analyzePriorityRequest,
  createPriorityRequest,
  castVote,
  organizerDecide,
  getActiveRequests,
  getAllRequests,
  getRequestById,
  logAudit,
  getAuditLog,
};
