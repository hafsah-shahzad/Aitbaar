// Dependency-free signed session tokens for the platform admin (env-based auth).
// Token format: <base64url(payload)>.<hmac-sha256(payload, secret)>
// No JWT library needed — crypto is built into Node.
const crypto = require("crypto");

const DEFAULT_TTL_SECONDS = 12 * 60 * 60; // 12-hour admin sessions

function getSecret() {
  // Prefer a dedicated secret; fall back to a stable hash of existing config
  // so sessions stay valid across server restarts without extra config.
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  return crypto
    .createHash("sha256")
    .update(`${process.env.ADMIN_PASSWORD || ""}|${process.env.SUPABASE_URL || ""}|aitbaar-admin`)
    .digest("hex");
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function sign(payloadB64, secret) {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function createAdminToken(admin, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const payload = {
    sub: admin.email,
    name: admin.name,
    role: admin.role || "super_admin",
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64, getSecret())}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== "string") return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64, getSecret());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { createAdminToken, verifyAdminToken };
