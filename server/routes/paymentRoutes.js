const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const { buildReceiptData, formatForWhatsApp, generateReceiptHtml } = require("../services/paymentReceiptService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

const { verifyPayment, rejectPayment } = require("../services/paymentService");
// ↑ add this near your other requires at the top of the file, alongside
// supabase, sendWhatsAppMessage, buildReceiptData, formatForWhatsApp, generateReceiptHtml

// PATCH /api/payment/:id/verify
router.patch("/:id/verify", async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  if (!["confirm", "reject"].includes(action)) {
    return res.status(400).json({ success: false, error: "action must be confirm or reject" });
  }

  try {
    const result = action === "confirm" ? await verifyPayment(id) : await rejectPayment(id);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const payment = result.payment;

    // On confirm: remove any OTHER pending claims for the same member/committee/month.
    // These are deleted, not marked "rejected" — they're duplicate self-reports of the
    // same payment, not fraud, so they should never count against the trust score.
    if (action === "confirm" && payment.member_id) {
      await supabase
        .from("payment_records")
        .delete()
        .eq("member_id", payment.member_id)
        .eq("committee_id", payment.committee_id)
        .eq("month", payment.month)
        .eq("status", "pending")
        .neq("id", id);
    }

    // ── Generate and send receipt after confirmation ──
    if (action === "confirm" && payment.member_id) {
      try {
        const { data: memberData } = await supabase.from("members").select("phone").eq("id", payment.member_id).single();
        const receipt = await buildReceiptData(id);
        const receiptMsg = formatForWhatsApp(receipt);

        if (memberData?.phone) {
          sendWhatsAppMessage(memberData.phone, receiptMsg).catch((err) => {
            console.error("Failed to send receipt to member:", err.message);
          });
        }

        return res.json({ success: true, payment, newScore: result.newScore, receipt });
      } catch (receiptErr) {
        console.error("Receipt generation error (non-blocking):", receiptErr.message);
        return res.json({ success: true, payment, newScore: result.newScore });
      }
    }

    res.json({ success: true, payment, newScore: result.newScore });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payment/committee/:committeeId/pending
// Returns ONE pending payment per member per month (deduplicated)
router.get("/committee/:committeeId/pending", async (req, res) => {
  const { committeeId } = req.params;

  try {
    const { data, error } = await supabase
      .from("payment_records")
      .select("*, members(name, phone)")
      .eq("committee_id", committeeId)
      .eq("status", "pending")   // ← was "self-declared", never matched real records
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });

    const seen = new Set();
    const deduplicated = (data || []).filter((p) => {
      const key = `${p.member_id}-${p.month}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json({ success: true, payments: deduplicated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payment/:id/receipt
router.get("/:id/receipt", async (req, res) => {
  const { id } = req.params;
  try {
    const receipt = await buildReceiptData(id);
    const html = generateReceiptHtml(receipt);
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${receipt.receiptId}.html"`);
    res.send(html);
  } catch (err) {
    console.error("Receipt download error:", err.message);
    res.status(404).json({ success: false, error: "Receipt not found" });
  }
});

// GET /api/payment/:id/receipt/json
router.get("/:id/receipt/json", async (req, res) => {
  const { id } = req.params;
  try {
    const receipt = await buildReceiptData(id);
    const whatsappText = formatForWhatsApp(receipt);
    const html = generateReceiptHtml(receipt);
    res.json({ success: true, receipt, whatsappText, html });
  } catch (err) {
    console.error("Receipt JSON error:", err.message);
    res.status(404).json({ success: false, error: "Receipt not found" });
  }
});

module.exports = router;