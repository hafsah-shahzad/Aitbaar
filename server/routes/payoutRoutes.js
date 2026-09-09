const express = require("express");
const router = express.Router();

const {
  createRandomPayoutOrder,
  getActiveOrder,
  getOrderWithPositions,
  getOrderHistory,
  submitOrderForApproval,
  approveOrder,
  finalizeOrder,
  swapPositions,
} = require("../services/payoutAssignmentService");

// const {
//   createManualPayoutOrder,
// } = require("../services/payoutAssignmentService");

const {
  approveChangeRequest,
  rejectChangeRequest,
  getPendingChangeRequests,
  getChangeRequestsForOrder,
} = require("../services/payoutChangeService");

const { sendWhatsAppMessage } = require("../services/whatsappService");
const supabase = require("../config/supabaseClient");

// ─────────────────────────────────────────────────────────
// POST /api/payout/assign/:committeeId
// Trigger random payout assignment for a committee.
// Creates a new payout order with shuffled positions.
// ─────────────────────────────────────────────────────────

router.post("/assign/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;

    const order = await createRandomPayoutOrder(committeeId);
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/payout/active/:committeeId
// Get the current active (draft/pending_approval) payout order.
// ─────────────────────────────────────────────────────────

router.get("/active/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;
    const order = await getActiveOrder(committeeId);
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/payout/order/:orderId
// Get a specific payout order with all positions.
// ─────────────────────────────────────────────────────────

router.get("/order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await getOrderWithPositions(orderId);
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/payout/history/:committeeId
// Get all payout order versions for a committee.
// ─────────────────────────────────────────────────────────

router.get("/history/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;
    const orders = await getOrderHistory(committeeId);
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/payout/submit/:orderId
// Submit order for organizer approval (after all members satisfied).
// ─────────────────────────────────────────────────────────

router.post("/submit/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await submitOrderForApproval(orderId);
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/payout/approve/:orderId
// Organizer approves the payout order.
// ─────────────────────────────────────────────────────────

router.post("/approve/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { organizerId } = req.body;

    if (!organizerId) {
      return res.status(400).json({ success: false, error: "organizerId is required." });
    }

    const order = await approveOrder(orderId, organizerId);
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/payout/finalize/:orderId
// Finalize and send the payout order to all members.
// ─────────────────────────────────────────────────────────

router.post("/finalize/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await getOrderWithPositions(orderId);

    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found." });
    }

    // Send WhatsApp to each member with their final position
    const notifications = [];
    for (const pos of order.payout_positions) {
      const member = pos.members;
      if (member?.phone) {
        const message =
          `مبارک ہو ${member.name || "صاحب"}!\n\n` +
          `آپ کی کمیٹی "${order.committee_id}" کا فائنل پائے اوٹ آرڈر تیار ہو گیا ہے۔\n\n` +
          `آپ کا نمبر: ${pos.position} / ${order.payout_positions.length}\n\n` +
          `آپ کو ${ordinal(pos.position)} نمبر پر ادائیگی ملے گی۔\n\n` +
          `— اعتبار ٹیم`;

        notifications.push(
          sendWhatsAppMessage(member.phone, message).catch((err) =>
            console.error(`WhatsApp failed for ${member.phone}:`, err.message)
          )
        );
      }
    }

    await Promise.all(notifications);

    // Finalize in DB
    const finalized = await finalizeOrder(orderId);

    res.json({ success: true, order: finalized, notified: notifications.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/payout/requests/:orderId
// Get all change requests for an order.
// ─────────────────────────────────────────────────────────

router.get("/requests/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const requests = await getChangeRequestsForOrder(orderId);
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/payout/requests/pending/:orderId
// Get only pending change requests for an order.
// ─────────────────────────────────────────────────────────

router.get("/requests/pending/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const requests = await getPendingChangeRequests(orderId);
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/payout/request/approve/:requestId
// Organizer approves a change request (swaps positions).
// ─────────────────────────────────────────────────────────

router.post("/request/approve/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    const { organizerId, swapWithPositionId } = req.body;

    if (!organizerId) {
      return res.status(400).json({ success: false, error: "organizerId is required." });
    }

    const result = await approveChangeRequest(requestId, organizerId);

    // If swap target is provided, execute the swap
    if (swapWithPositionId && result.position) {
      await swapPositions(
        result.position.payout_order_id,
        result.position.member_id === result.request.payout_positions.member_id
          ? requestId // the position ID from the request
          : swapWithPositionId,
        result.position.member_id === result.request.payout_positions.member_id
          ? swapWithPositionId
          : requestId
      );
    }

    // Notify the member via WhatsApp
    const { data: member } = await supabase
      .from("members")
      .select("phone, name")
      .eq("id", result.request.member_id)
      .single();

    if (member?.phone) {
      sendWhatsAppMessage(
        member.phone,
        `آپ کی پوزیشن تبدیلی کی درخواست منظور ہو گئی ہے۔ نئی پوزیشن: ${result.request.ai_suggested_position}\n\n— اعتبار ٹیم`
      ).catch(() => {});
    }

    res.json({ success: true, request: result.request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/payout/request/reject/:requestId
// Organizer rejects a change request.
// ─────────────────────────────────────────────────────────

router.post("/request/reject/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    const { organizerId } = req.body;

    if (!organizerId) {
      return res.status(400).json({ success: false, error: "organizerId is required." });
    }

    const request = await rejectChangeRequest(requestId, organizerId);

    // Notify the member
    const { data: member } = await supabase
      .from("members")
      .select("phone, name")
      .eq("id", request.member_id)
      .single();

    if (member?.phone) {
      sendWhatsAppMessage(
        member.phone,
        `آپ کی پوزیشن تبدیلی کی درخواست مسترد کر دی گئی ہے۔ آپ کا موجودہ نمبر برقرار ہے۔\n\n— اعتبار ٹیم`
      ).catch(() => {});
    }

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═════════════════════════════════════════════════════════
// DASHBOARD PAYOUT SCHEDULE ROUTES
// Uses the user's payout_schedule table directly.
// Table: payout_schedule (id, committee_id, member_id,
//         payout_order, type, ai_reasoning, created_at, updated_at)
//
// AI ONE-TIME GENERATION RULE:
// - Organizer can generate AI payout ONCE per committee.
// - After AI generation, if organizer manually updates,
//   AI generation is permanently locked for that cycle.
// - The 'type' column tracks: 'auto' (AI) or 'manual'.
// - We check history to enforce the one-time rule.
// ═════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────
// GET /api/payout/:committeeId/ai-status
// Check if AI generation has been used and if it's locked.
// ─────────────────────────────────────────────────────────

router.get("/:committeeId/ai-status", async (req, res) => {
  try {
    const { committeeId } = req.params;

    // Check if any auto-generated schedule exists
    const { data: autoSchedules } = await supabase
      .from("payout_schedule")
      .select("id, type, created_at")
      .eq("committee_id", committeeId)
      .eq("type", "auto")
      .order("created_at", { ascending: false })
      .limit(1);

    const hasAutoGenerated = autoSchedules && autoSchedules.length > 0;

    // Check if any manual schedule was created AFTER the last auto schedule
    let aiLocked = false;
    if (hasAutoGenerated) {
      const lastAutoDate = autoSchedules[0].created_at;
      const { data: manualAfterAuto } = await supabase
        .from("payout_schedule")
        .select("id")
        .eq("committee_id", committeeId)
        .eq("type", "manual")
        .gt("created_at", lastAutoDate)
        .limit(1);

      aiLocked = manualAfterAuto && manualAfterAuto.length > 0;
    }

    res.json({
      success: true,
      aiGenerationUsed: hasAutoGenerated,
      aiLocked,
      currentType: hasAutoGenerated ? (aiLocked ? "manually_overridden" : "auto") : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// Helper: Fetch schedule with member data
// ─────────────────────────────────────────────────────────

async function getScheduleWithType(committeeId) {
  // 1. Fetch all schedule rows for this committee
  const { data: schedules, error } = await supabase
    .from("payout_schedule")
    .select("id, committee_id, member_id, payout_order, type, ai_reasoning, created_at")
    .eq("committee_id", committeeId)
    .order("payout_order", { ascending: true });

  if (error) throw new Error(error.message);

  if (!schedules || schedules.length === 0) {
    return { type: null, schedule: [] };
  }

  // 2. Fetch member details for each schedule row
  const memberIds = [...new Set(schedules.map((s) => s.member_id))];
  const { data: membersData } = await supabase
    .from("members")
    .select("id, name, phone")
    .in("id", memberIds);

  // 3. Fetch trust scores for each member
  const { data: trustScores } = await supabase
    .from("trust_scores")
    .select("member_id, score")
    .eq("committee_id", committeeId)
    .in("member_id", memberIds);

  // 4. Fetch current month payment status for each member
  const currentMonth = new Date().toLocaleString("en-PK", { month: "long", year: "numeric" });
  const { data: currentPayments } = await supabase
    .from("payment_records")
    .select("member_id, status, month")
    .eq("committee_id", committeeId)
    .eq("month", currentMonth)
    .in("member_id", memberIds);

  // Build lookup maps
  const memberMap = {};
  if (membersData) {
    membersData.forEach((m) => { memberMap[m.id] = m; });
  }

  const trustMap = {};
  if (trustScores) {
    trustScores.forEach((ts) => { trustMap[ts.member_id] = ts.score; });
  }

  const paymentMap = {};
  if (currentPayments) {
    // Take the latest payment per member
    currentPayments.forEach((p) => {
      if (!paymentMap[p.member_id]) {
        paymentMap[p.member_id] = { status: p.status, month: p.month };
      }
    });
  }

  // 5. Combine schedule rows with all member data
  const schedule = schedules.map((row) => ({
    id: row.id,
    member_id: row.member_id,
    payout_order: row.payout_order,
    type: row.type,
    ai_reasoning: row.ai_reasoning,
    trust_score: trustMap[row.member_id] ?? 100,
    payment_status: paymentMap[row.member_id]?.status || "pending",
    payment_month: paymentMap[row.member_id]?.month || currentMonth,
    members: memberMap[row.member_id] || { id: row.member_id, name: "—", phone: "—" },
  }));

  // Determine type from first row
  const type = schedules[0]?.type || null;

  return { type, schedule };
}

// ─────────────────────────────────────────────────────────
// GET /api/payout/:committeeId
// Fetch current payout schedule.
// ─────────────────────────────────────────────────────────

router.get("/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;
    const { type, schedule } = await getScheduleWithType(committeeId);
    res.json({ success: true, type, schedule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/payout/:committeeId/auto
// Auto-generate payout order using random shuffle.
// ─────────────────────────────────────────────────────────

router.post("/:committeeId/auto", async (req, res) => {
  try {
    const { committeeId } = req.params;

    // ── ENFORCE ONE-TIME AI RULE ──
    // Check if ANY schedule records exist for this committee.
    // If records exist, AI generation was already used (either auto or manual).
    // Organizer can only generate AI payout ONCE per committee.
    const { data: existingSchedule } = await supabase
      .from("payout_schedule")
      .select("id, type")
      .eq("committee_id", committeeId)
      .limit(1);

    if (existingSchedule && existingSchedule.length > 0) {
      const currentType = existingSchedule[0].type;
      if (currentType === "auto") {
        return res.status(400).json({
          success: false,
          error: "AI payout generation has already been used. You can only update manually now.",
        });
      }
      if (currentType === "manual") {
        return res.status(400).json({
          success: false,
          error: "AI payout generation is locked. You have manually updated the payout order.",
        });
      }
    }

    // 1. Fetch all members for this committee
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, name, phone")
      .eq("committee_id", committeeId)
      .order("joined_at", { ascending: true });

    if (membersError) throw new Error(membersError.message);
    if (!members || members.length === 0) {
      return res.status(400).json({ success: false, error: "No members found." });
    }

    // 2. Delete existing schedule for this committee
    await supabase
      .from("payout_schedule")
      .delete()
      .eq("committee_id", committeeId);

    // 3. Shuffle members (Fisher-Yates)
    const shuffled = [...members];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 4. Insert new schedule rows
    const rows = shuffled.map((member, index) => ({
      committee_id: committeeId,
      member_id: member.id,
      payout_order: index + 1,
      type: "auto",
      ai_reasoning: "AI randomly assigned based on fairness rules.",
    }));

    const { error: insertError } = await supabase
      .from("payout_schedule")
      .insert(rows);

    if (insertError) throw new Error(insertError.message);

    // 5. Return the schedule with member data
    const { type, schedule } = await getScheduleWithType(committeeId);
    res.json({ success: true, type, schedule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/payout/:committeeId/manual
// Save manually assigned payout positions.
// Body: { memberOrders: [{ memberId, payoutOrder }] }
// ─────────────────────────────────────────────────────────

router.post("/:committeeId/manual", async (req, res) => {
  try {
    const { committeeId } = req.params;
    const { memberOrders } = req.body;

    if (!memberOrders || !Array.isArray(memberOrders) || memberOrders.length === 0) {
      return res.status(400).json({ success: false, error: "memberOrders array is required." });
    }

    // 1. Validate unique positions
    const positions = memberOrders.map((mo) => mo.payoutOrder);
    const uniquePositions = new Set(positions);
    if (uniquePositions.size !== positions.length) {
      return res.status(400).json({ success: false, error: "Duplicate positions are not allowed." });
    }

    // 2. Delete existing schedule for this committee
    await supabase
      .from("payout_schedule")
      .delete()
      .eq("committee_id", committeeId);

    // 3. Insert new schedule rows
    const rows = memberOrders.map((mo) => ({
      committee_id: committeeId,
      member_id: mo.memberId,
      payout_order: mo.payoutOrder,
      type: "manual",
      ai_reasoning: null,
    }));

    const { error: insertError } = await supabase
      .from("payout_schedule")
      .insert(rows);

    if (insertError) throw new Error(insertError.message);

    // 4. Return the schedule with member data
    const { type, schedule } = await getScheduleWithType(committeeId);
    res.json({ success: true, type, schedule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// Helper: ordinal numbers for position labels
// ─────────────────────────────────────────────────────────

function ordinal(n) {
  const s = ["", "پہلا", "دوسرا", "تیسرا", "چوتھا", "پانچواں", "چھٹا", "ساتواں", "آٹھواں", "نوواں", "دسواں"];
  return s[n] || `${n}واں`;
}

module.exports = router;


