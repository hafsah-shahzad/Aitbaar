const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");

// ─────────────────────────────────────────────────────────
// GET /api/scam/alerts/:committeeId
// Get all scam alerts for a committee.
// ─────────────────────────────────────────────────────────

router.get("/alerts/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;
    const { status, limit } = req.query;

    let query = supabase
      .from("scam_alerts")
      .select("*")
      .eq("committee_id", committeeId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    } else {
      query = query.limit(50);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    res.json({ success: true, alerts: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/scam/stats/:committeeId
// Get scam statistics for a committee.
// ─────────────────────────────────────────────────────────

router.get("/stats/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;

    const { data: all } = await supabase
      .from("scam_alerts")
      .select("id, is_scam, risk_score, scam_type, status, created_at")
      .eq("committee_id", committeeId);

    const alerts = all || [];
    const totalScanned = alerts.length;
    const totalFlagged = alerts.filter((a) => a.is_scam).length;
    const activeAlerts = alerts.filter((a) => a.status === "active").length;
    const confirmedScams = alerts.filter((a) => a.status === "confirmed_scam").length;
    const avgRiskScore = totalScanned > 0
      ? Math.round(alerts.reduce((sum, a) => sum + a.risk_score, 0) / totalScanned)
      : 0;

    // Scam type breakdown
    const byType = {};
    for (const a of alerts.filter((a) => a.is_scam)) {
      byType[a.scam_type] = (byType[a.scam_type] || 0) + 1;
    }

    // Last 7 days trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentAlerts = alerts.filter(
      (a) => new Date(a.created_at) >= sevenDaysAgo
    );

    res.json({
      success: true,
      stats: {
        totalScanned,
        totalFlagged,
        activeAlerts,
        confirmedScams,
        avgRiskScore,
        byType,
        recentCount: recentAlerts.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/scam/alert/:alertId/dismiss
// Mark an alert as dismissed (false positive).
// ─────────────────────────────────────────────────────────

router.patch("/alert/:alertId/dismiss", async (req, res) => {
  try {
    const { alertId } = req.params;
    const { organizerId } = req.body;

    const { data, error } = await supabase
      .from("scam_alerts")
      .update({
        status: "dismissed",
        reviewed_by: organizerId || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", alertId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json({ success: true, alert: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/scam/alert/:alertId/confirm
// Mark an alert as a confirmed scam.
// ─────────────────────────────────────────────────────────

router.patch("/alert/:alertId/confirm", async (req, res) => {
  try {
    const { alertId } = req.params;
    const { organizerId } = req.body;

    const { data, error } = await supabase
      .from("scam_alerts")
      .update({
        status: "confirmed_scam",
        reviewed_by: organizerId || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", alertId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json({ success: true, alert: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
