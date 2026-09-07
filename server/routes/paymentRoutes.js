const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const { buildReceiptData, formatForWhatsApp, generateReceiptHtml } = require("../services/paymentReceiptService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

// PATCH /api/payment/:id/verify
router.patch("/:id/verify", async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  if (!["confirm", "reject"].includes(action)) {
    return res.status(400).json({ success: false, error: "action must be confirm or reject" });
  }

  try {
    const newStatus = action === "confirm" ? "confirmed" : "rejected";

    const { data: payment, error } = await supabase
      .from("payment_records")
      .update({ status: newStatus })
      .eq("id", id)
      .select("*, members(*)")
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    if (action === "confirm" && payment.member_id) {
      const { data: existing } = await supabase
        .from("trust_scores")
        .select("*")
        .eq("member_id", payment.member_id)
        .eq("committee_id", payment.committee_id)
        .maybeSingle();

      const newScore = Math.min(100, (existing?.score ?? 100) + 10);

      if (existing) {
        await supabase.from("trust_scores").update({ score: newScore, updated_at: new Date() }).eq("id", existing.id);
      } else {
        await supabase.from("trust_scores").insert([{ member_id: payment.member_id, committee_id: payment.committee_id, score: newScore }]);
      }

      // Also reject all OTHER pending payments for same member same month
      await supabase
        .from("payment_records")
        .update({ status: "rejected" })
        .eq("member_id", payment.member_id)
        .eq("committee_id", payment.committee_id)
        .eq("month", payment.month)
        .eq("status", "self-declared")
        .neq("id", id);
    }

    if (action === "reject" && payment.member_id) {
      const { data: existing } = await supabase
        .from("trust_scores")
        .select("*")
        .eq("member_id", payment.member_id)
        .eq("committee_id", payment.committee_id)
        .maybeSingle();

      const newScore = Math.max(0, (existing?.score ?? 100) - 15);
      if (existing) {
        await supabase.from("trust_scores").update({ score: newScore, updated_at: new Date() }).eq("id", existing.id);
      }
    }

    // ── Generate and send receipt after confirmation ──
    if (action === "confirm" && payment.member_id) {
      try {
        const receipt = await buildReceiptData(id);
        const receiptMsg = formatForWhatsApp(receipt);

        // Send receipt to member via WhatsApp
        if (payment.members?.phone) {
          sendWhatsAppMessage(payment.members.phone, receiptMsg).catch((err) => {
            console.error("Failed to send receipt to member:", err.message);
          });
        }

        // Attach receipt data to response
        res.json({ success: true, payment, receipt });
      } catch (receiptErr) {
        console.error("Receipt generation error (non-blocking):", receiptErr.message);
        res.json({ success: true, payment });
      }
    } else {
      res.json({ success: true, payment });
    }
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
      .eq("status", "self-declared")
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });

    // Deduplicate: keep only the latest payment per member per month
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
// Returns the payment receipt as HTML (for download/print)
router.get("/:id/receipt", async (req, res) => {
  const { id } = req.params;

  try {
    const receipt = await buildReceiptData(id);
    const html = generateReceiptHtml(receipt);

    res.setHeader("Content-Type", "text/html");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="receipt-${receipt.receiptId}.html"`
    );
    res.send(html);
  } catch (err) {
    console.error("Receipt download error:", err.message);
    res.status(404).json({ success: false, error: "Receipt not found" });
  }
});

// GET /api/payment/:id/receipt/json
// Returns the receipt data as JSON (for frontend rendering)
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