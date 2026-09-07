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

// ─────────────────────────────────────────────────────────
// Helper: ordinal numbers for position labels
// ─────────────────────────────────────────────────────────

function ordinal(n) {
  const s = ["", "پہلا", "دوسرا", "تیسرا", "چوتھا", "پانچواں", "چھٹا", "ساتواں", "آٹھواں", "نوواں", "دسواں"];
  return s[n] || `${n}واں`;
}

module.exports = router;
