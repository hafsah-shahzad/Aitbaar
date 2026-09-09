const express = require("express");
const router = express.Router();

const {
  getActiveRequests,
  getAllRequests,
  getRequestById,
  castVote,
  organizerDecide,
  getAuditLog,
} = require("../services/priorityRequestService");

const { sendWhatsAppMessage } = require("../services/whatsappService");
const supabase = require("../config/supabaseClient");

// ─────────────────────────────────────────────────────────
// GET /api/priority/active/:committeeId
// Get all pending (voting open) priority requests.
// ─────────────────────────────────────────────────────────

router.get("/active/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;
    const requests = await getActiveRequests(committeeId);
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/priority/all/:committeeId
// Get all priority requests (pending, approved, rejected).
// ─────────────────────────────────────────────────────────

router.get("/all/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;
    const requests = await getAllRequests(committeeId);
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/priority/request/:requestId
// Get a single priority request with all votes.
// ─────────────────────────────────────────────────────────

router.get("/request/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await getRequestById(requestId);
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/priority/vote
// A committee member votes on a priority request.
// Body: { priorityRequestId, voterMemberId, vote, reason? }
// ─────────────────────────────────────────────────────────

router.post("/vote", async (req, res) => {
  try {
    const { priorityRequestId, voterMemberId, vote, reason } = req.body;

    if (!priorityRequestId || !voterMemberId || !vote) {
      return res.status(400).json({
        success: false,
        error: "priorityRequestId, voterMemberId, and vote are required.",
      });
    }

    const result = await castVote({ priorityRequestId, voterMemberId, vote, reason });

    // Notify all committee members about the vote update
    const { data: request } = await supabase
      .from("priority_requests")
      .select("committee_id, member_id, members!inner(name, phone)")
      .eq("id", priorityRequestId)
      .single();

    if (request?.members?.phone) {
      const statusMsg = result.majority_reached
        ? `! Majority reached — request APPROVED`
        : ` — Votes: ${result.votes_for} for, ${result.votes_against} against`;

      sendWhatsAppMessage(
        request.members.phone,
        `آپ کی ا_pngی پرائیورٹی درخواست پر ووٹ آئے ہیں${statusMsg}\n\n— اعتبار ٹیم`
      ).catch(() => {});
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/priority/decide/:requestId
// Organizer manually approves or rejects.
// Body: { organizerId, decision: 'approved' | 'rejected' }
// ─────────────────────────────────────────────────────────

router.post("/decide/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    const { organizerId, decision } = req.body;

    if (!organizerId || !decision) {
      return res.status(400).json({
        success: false,
        error: "organizerId and decision are required.",
      });
    }

    const request = await organizerDecide({ priorityRequestId: requestId, organizerId, decision });

    // Notify the requester
    const { data: member } = await supabase
      .from("members")
      .select("phone, name")
      .eq("id", request.member_id)
      .single();

    if (member?.phone) {
      const msg = decision === "approved"
        ? `مبارک ہو ${member.name || "صاحب"}! آپ کی پرائیورٹی درخواست منظور ہو گئی ہے۔\nآپ کو اس ماہ ادائیگی ملے گی۔\n\n— اعتبار ٹیم`
        : `آپ کی پرائیورٹی درخواست مسترد کر دی گئی ہے۔\nآپ کا موجودہ نمبر برقرار ہے۔\n\n— اعتبار ٹیم`;

      sendWhatsAppMessage(member.phone, msg).catch(() => {});
    }

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/priority/audit/:committeeId
// Get the full audit log for a committee.
// ─────────────────────────────────────────────────────────

router.get("/audit/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const log = await getAuditLog(committeeId, limit);
    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;