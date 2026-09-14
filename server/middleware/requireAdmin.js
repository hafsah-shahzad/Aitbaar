// Admin authentication middleware — env-based platform admin.
// The admin logs in with ADMIN_EMAIL/ADMIN_PASSWORD from the server .env.
// Sessions are HMAC-signed tokens (see utils/adminToken.js) — no DB tables needed.
const { verifyAdminToken } = require("../utils/adminToken");

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: "Admin authentication required." });
  }

  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Invalid or expired admin session. Please log in again." });
  }

  req.admin = { email: payload.sub, name: payload.name, role: payload.role };
  next();
}

module.exports = { requireAdmin };
