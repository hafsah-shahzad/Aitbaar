const express = require("express");
const router = express.Router();
const { getDashboardData } = require("../controllers/dashboardController");
const supabase = require("../config/supabaseClient");

// GET /api/dashboard/:committeeId/predictions
// Returns members who are at risk of missing payment this month

// GET /api/dashboard/:committeeId
router.get("/:committeeId", getDashboardData);

// DELETE /api/dashboard/member/:memberId
// Organizer removes a member from their committee
router.delete("/member/:memberId", async (req, res) => {
  const { memberId } = req.params;

  try {
    // Delete related records first (trust scores, payment records, messages)
    await supabase.from("trust_scores").delete().eq("member_id", memberId);
    await supabase.from("payment_records").delete().eq("member_id", memberId);
    await supabase.from("messages").delete().eq("member_id", memberId);
    await supabase.from("member_sessions").delete().eq("phone",
      (await supabase.from("members").select("phone").eq("id", memberId).single()).data?.phone
    );

    // Finally delete the member
    const { error } = await supabase.from("members").delete().eq("id", memberId);

    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, message: "Member deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dashboard/member/:memberId/trust-explanation
// Returns detailed trust score breakdown with AI explanation
router.get("/member/:memberId/trust-explanation", async (req, res) => {
  try {
    const { memberId } = req.params;
    const { committeeId } = req.query;

    if (!committeeId) {
      return res.status(400).json({ success: false, error: "committeeId query param is required." });
    }

    const { getFullExplanation } = require("../services/trustScoreExplainerService");
    const explanation = await getFullExplanation(memberId, committeeId);
    res.json({ success: true, explanation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

// GET /api/dashboard/:committeeId/predictions
// Returns members who are at risk of missing payment this month
const { predictPaymentRisks } = require("../services/predictionService");

router.get("/:committeeId/predictions", async (req, res) => {
  const { committeeId } = req.params;
  try {
    const result = await predictPaymentRisks(committeeId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});