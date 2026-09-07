const supabase = require("../config/supabaseClient");

// ─────────────────────────────────────────────────────────
// RANDOM ASSIGNMENT
// Shuffles all committee members and assigns payout positions.
// Returns the created payout order with positions.
// ─────────────────────────────────────────────────────────

async function createRandomPayoutOrder(committeeId) {
  // 1. Fetch all members for this committee
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id, name, phone")
    .eq("committee_id", committeeId)
    .order("joined_at", { ascending: true });

  if (membersError) throw new Error(membersError.message);
  if (!members || members.length === 0) {
    throw new Error("No members found in this committee.");
  }

  // 2. Determine next version number
  const { data: existingOrders } = await supabase
    .from("payout_orders")
    .select("version")
    .eq("committee_id", committeeId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = existingOrders && existingOrders.length > 0
    ? existingOrders[0].version + 1
    : 1;

  // 3. Create payout order
  const { data: order, error: orderError } = await supabase
    .from("payout_orders")
    .insert([{
      committee_id: committeeId,
      version: nextVersion,
      status: "draft",
    }])
    .select()
    .single();

  if (orderError) throw new Error(orderError.message);

  // 4. Shuffle members (Fisher-Yates)
  const shuffled = [...members];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 5. Insert positions
  const positions = shuffled.map((member, index) => ({
    payout_order_id: order.id,
    member_id: member.id,
    position: index + 1,
    status: "assigned",
  }));

  const { error: posError } = await supabase
    .from("payout_positions")
    .insert(positions);

  if (posError) throw new Error(posError.message);

  // 6. Return the full order with positions and member details
  return getOrderWithPositions(order.id);
}

// ─────────────────────────────────────────────────────────
// RETRIEVE ORDER WITH POSITIONS + MEMBER DETAILS
// ─────────────────────────────────────────────────────────

async function getOrderWithPositions(orderId) {
  const { data: order, error } = await supabase
    .from("payout_orders")
    .select(`
      *,
      payout_positions (
        *,
        members ( id, name, phone )
      )
    `)
    .eq("id", orderId)
    .single();

  if (error) throw new Error(error.message);
  return order;
}

async function getActiveOrder(committeeId) {
  const { data, error } = await supabase
    .from("payout_orders")
    .select(`
      *,
      payout_positions (
        *,
        members ( id, name, phone )
      )
    `)
    .eq("committee_id", committeeId)
    .in("status", ["draft", "pending_approval"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function getFinalizedOrder(committeeId) {
  const { data, error } = await supabase
    .from("payout_orders")
    .select(`
      *,
      payout_positions (
        *,
        members ( id, name, phone )
      )
    `)
    .eq("committee_id", committeeId)
    .eq("status", "finalized")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function getOrderHistory(committeeId) {
  const { data, error } = await supabase
    .from("payout_orders")
    .select(`
      *,
      payout_positions (
        *,
        members ( id, name, phone )
      )
    `)
    .eq("committee_id", committeeId)
    .order("version", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ─────────────────────────────────────────────────────────
// POSITION STATUS UPDATES
// ─────────────────────────────────────────────────────────

async function markPositionSatisfied(positionId) {
  const { data, error } = await supabase
    .from("payout_positions")
    .update({ status: "satisfied", updated_at: new Date().toISOString() })
    .eq("id", positionId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function markPositionChangeRequested(positionId) {
  const { data, error } = await supabase
    .from("payout_positions")
    .update({ status: "change_requested", updated_at: new Date().toISOString() })
    .eq("id", positionId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ─────────────────────────────────────────────────────────
// ORDER STATUS UPDATES
// ─────────────────────────────────────────────────────────

async function submitOrderForApproval(orderId) {
  const { data, error } = await supabase
    .from("payout_orders")
    .update({ status: "pending_approval", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function approveOrder(orderId, organizerId) {
  const { data, error } = await supabase
    .from("payout_orders")
    .update({
      status: "approved",
      approved_by: organizerId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function finalizeOrder(orderId) {
  const { data, error } = await supabase
    .from("payout_orders")
    .update({ status: "finalized", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ─────────────────────────────────────────────────────────
// SWAP POSITIONS (after a change request is approved)
// ─────────────────────────────────────────────────────────

async function swapPositions(orderId, posAId, posBId) {
  // Fetch both positions
  const { data: posA } = await supabase
    .from("payout_positions")
    .select("position")
    .eq("id", posAId)
    .single();

  const { data: posB } = await supabase
    .from("payout_positions")
    .select("position")
    .eq("id", posBId)
    .single();

  if (!posA || !posB) throw new Error("Position not found.");

  // Swap
  const { error } = await supabase
    .from("payout_positions")
    .upsert([
      { id: posAId, position: posB.position, payout_order_id: orderId, updated_at: new Date().toISOString() },
      { id: posBId, position: posA.position, payout_order_id: orderId, updated_at: new Date().toISOString() },
    ], { onConflict: "id" });

  if (error) throw new Error(error.message);
}

// ─────────────────────────────────────────────────────────
// FIND MEMBER'S POSITION IN AN ORDER
// ─────────────────────────────────────────────────────────

async function findMemberPosition(orderId, memberId) {
  const { data, error } = await supabase
    .from("payout_positions")
    .select(`
      *,
      members ( id, name, phone )
    `)
    .eq("payout_order_id", orderId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

// ─────────────────────────────────────────────────────────
// CHECK IF ALL MEMBERS ARE SATISFIED
// ─────────────────────────────────────────────────────────

async function areAllPositionsResolved(orderId) {
  const { data, error } = await supabase
    .from("payout_positions")
    .select("status")
    .eq("payout_order_id", orderId);

  if (error) throw new Error(error.message);
  return data.every((p) => p.status === "satisfied");
}

// ─────────────────────────────────────────────────────────
// MARK ALL POSITIONS AS SATISFIED (for re-roll)
// ─────────────────────────────────────────────────────────

async function resetAllPositionStatuses(orderId) {
  const { error } = await supabase
    .from("payout_positions")
    .update({ status: "assigned", updated_at: new Date().toISOString() })
    .eq("payout_order_id", orderId);

  if (error) throw new Error(error.message);
}

module.exports = {
  createRandomPayoutOrder,
  getOrderWithPositions,
  getActiveOrder,
  getFinalizedOrder,
  getOrderHistory,
  markPositionSatisfied,
  markPositionChangeRequested,
  submitOrderForApproval,
  approveOrder,
  finalizeOrder,
  swapPositions,
  findMemberPosition,
  areAllPositionsResolved,
  resetAllPositionStatuses,
};
