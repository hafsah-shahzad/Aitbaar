const express = require("express");
const router = express.Router();
const { getDashboardData } = require("../controllers/dashboardController");
const supabase = require("../config/supabaseClient");
const { getFullExplanation } = require("../services/trustScoreExplainerService");
const { predictPaymentRisk } = require("../services/predictiveService"); // ← see note below

router.get("/:committeeId", getDashboardData);

router.delete("/member/:memberId", async (req, res) => {
  const { memberId } = req.params;
  try {
    await supabase.from("trust_scores").delete().eq("member_id", memberId);
    await supabase.from("payment_records").delete().eq("member_id", memberId);
    await supabase.from("messages").delete().eq("member_id", memberId);
    const { data: memberData } = await supabase.from("members").select("phone").eq("id", memberId).single();
    if (memberData?.phone) {
      await supabase.from("member_sessions").delete().eq("phone", memberData.phone);
    }
    const { error } = await supabase.from("members").delete().eq("id", memberId);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: "Member deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/member/:memberId/trust-explanation", async (req, res) => {
  try {
    const { memberId } = req.params;
    const { committeeId } = req.query;
    if (!committeeId) {
      return res.status(400).json({ success: false, error: "committeeId query param is required." });
    }
    const explanation = await getFullExplanation(memberId, committeeId);
    res.json({ success: true, explanation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/:committeeId/predictions", async (req, res) => {
  const { committeeId } = req.params;
  try {
    const riskMembers = await predictPaymentRisk(committeeId);
    res.json({ success: true, totalAtRisk: riskMembers.length, members: riskMembers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;