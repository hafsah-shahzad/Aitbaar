const express = require("express");
const router = express.Router();
const {
  generateRules,
  saveRules,
  getRules,
  getRulesByRole,
  generatePdfHtml,
} = require("../services/committeeRulesService");

// ─────────────────────────────────────────────────────────
// POST /api/rules/generate — Generate + save rules
// ─────────────────────────────────────────────────────────
router.post("/generate", async (req, res) => {
  try {
    const { committeeId, committeeConfig } = req.body;

    if (!committeeId || !committeeConfig) {
      return res
        .status(400)
        .json({ error: "committeeId and committeeConfig are required" });
    }

    const rules = generateRules(committeeConfig);
    const saved = await saveRules(committeeId, rules);

    res.json({
      message: "Rules generated and saved",
      rules: saved,
    });
  } catch (err) {
    console.error("Error generating rules:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/rules/:committeeId — Get all rules (both roles)
// ─────────────────────────────────────────────────────────
router.get("/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;
    const rules = await getRules(committeeId);

    if (!rules) {
      return res.status(404).json({ error: "No rules found for this committee" });
    }

    res.json({ rules });
  } catch (err) {
    console.error("Error fetching rules:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/rules/:committeeId/:role — Get rules by role
//   role = "organizer" | "member"
// ─────────────────────────────────────────────────────────
router.get("/:committeeId/:role", async (req, res) => {
  try {
    const { committeeId, role } = req.params;

    if (!["organizer", "member"].includes(role)) {
      return res.status(400).json({ error: "Role must be 'organizer' or 'member'" });
    }

    const rules = await getRulesByRole(committeeId, role);

    if (!rules) {
      return res.status(404).json({ error: "No rules found for this committee" });
    }

    res.json({ rules, role });
  } catch (err) {
    console.error("Error fetching rules:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/rules/:committeeId/pdf — Download PDF (HTML)
// ─────────────────────────────────────────────────────────
router.get("/:committeeId/pdf", async (req, res) => {
  try {
    const { committeeId } = req.params;

    const rulesData = await getRules(committeeId);
    if (!rulesData) {
      return res.status(404).json({ error: "No rules found" });
    }

    // Build a full rules object for PDF generation
    const rules = {
      organizer: {
        english: rulesData.organizer_rules_english || rulesData.rules_english || [],
        urdu: rulesData.organizer_rules_urdu || rulesData.rules_urdu || [],
      },
      member: {
        english: rulesData.member_rules_english || rulesData.rules_english || [],
        urdu: rulesData.member_rules_urdu || rulesData.rules_urdu || [],
      },
    };

    // Committee config from query params or use defaults
    const committeeConfig = {
      committeeName: req.query.name || "Committee",
      monthlyAmount: parseInt(req.query.amount) || 0,
      totalMembers: parseInt(req.query.members) || 0,
      durationMonths: parseInt(req.query.duration) || 0,
      startDate: req.query.startDate || null,
    };

    const html = generatePdfHtml(rules, committeeConfig);

    res.setHeader("Content-Type", "text/html");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="committee-rules-${committeeId}.html"`
    );
    res.send(html);
  } catch (err) {
    console.error("Error generating PDF:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/rules/:committeeId/send-whatsapp — Send rules
// ─────────────────────────────────────────────────────────
router.post("/:committeeId/send-whatsapp", async (req, res) => {
  try {
    const { committeeId } = req.params;
    const { role } = req.query; // ?role=organizer or ?role=member

    const rules = await getRulesByRole(
      committeeId,
      role === "member" ? "member" : "organizer"
    );

    if (!rules) {
      return res.status(404).json({ error: "No rules found" });
    }

    // TODO: Integrate with WhatsApp service to send rules to members
    // For now, return the WhatsApp summary
    res.json({
      message: `Rules (for ${role || "organizer"}) ready to send via WhatsApp`,
      whatsappSummary: rules.whatsappSummary,
    });
  } catch (err) {
    console.error("Error sending rules:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
