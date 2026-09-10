const express = require("express");
const router = express.Router();
const { sendMemberRulesToWhatsApp } = require("../services/memberRulesService");

// POST /api/member-rules/send
// body: { phone: "923001234567", lang: "english" | "urdu" | "roman_urdu" }
router.post("/send", async (req, res) => {
  try {
    const { phone, lang = "english" } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: "phone is required" });
    }

    const result = await sendMemberRulesToWhatsApp(phone, lang);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Error sending member rules:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;