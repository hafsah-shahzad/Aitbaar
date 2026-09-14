const express = require("express");
const router = express.Router();
const { authLimiter } = require("../middleware/rateLimiter");
const { requireAdmin } = require("../middleware/requireAdmin");
const { createAdminToken } = require("../utils/adminToken");
const {
  getPlatformStats,
  getOrganizers,
  setOrganizerStatus,
  getCommittees,
  getAnomalies,
  reviewAnomaly,
  getSystemHealth,
} = require("../controllers/adminController");

// ── Auth ────────────────────────────────────────────────────
// POST /api/admin/login — credentials checked against ADMIN_EMAIL/ADMIN_PASSWORD in .env
router.post("/login", authLimiter, (req, res) => {
  const { email, password } = req.body || {};

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    return res.status(500).json({
      success: false,
      error: "Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in the server .env file.",
    });
  }

  const emailOk = (email || "").trim().toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase();
  const passOk = typeof password === "string" && password === process.env.ADMIN_PASSWORD;

  if (!emailOk || !passOk) {
    return res.status(401).json({ success: false, error: "Incorrect admin email or password." });
  }

  const admin = {
    email: process.env.ADMIN_EMAIL.trim(),
    name: process.env.ADMIN_NAME || "Platform Admin",
    role: "super_admin",
  };

  res.json({
    success: true,
    message: "Admin login successful",
    session: { access_token: createAdminToken(admin), expires_at: Math.floor(Date.now() / 1000) + 12 * 60 * 60 },
    admin,
  });
});

// ── Protected: everything below requires a valid admin token ─
router.use(requireAdmin);

router.get("/stats", getPlatformStats);
router.get("/organizers", getOrganizers);
router.patch("/organizers/:id/status", setOrganizerStatus);
router.get("/committees", getCommittees);
router.get("/anomalies", getAnomalies);
router.patch("/anomalies/:id", reviewAnomaly);
router.get("/system", getSystemHealth);

module.exports = router;
