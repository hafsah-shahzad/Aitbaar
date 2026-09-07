const express = require("express");
const router = express.Router();
const { registerOrganizer, loginOrganizer } = require("../controllers/organizerController");
const { authLimiter } = require("../middleware/rateLimiter");
const supabase = require("../config/supabaseClient");

router.post("/register", authLimiter, registerOrganizer);
router.post("/login", authLimiter, loginOrganizer);

// POST /api/organizer/forgot-password
// Sends a password reset email via Supabase Auth
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: "Email is required." });

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password`,
    });

    if (error) return res.status(400).json({ success: false, error: error.message });

    // Always return success (don't reveal if email exists or not)
    res.json({ success: true, message: "If this email is registered, a reset link has been sent." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;