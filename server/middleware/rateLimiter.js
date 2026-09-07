const rateLimit = require("express-rate-limit");

// Strict limiter for login/register -- these are the routes most at risk of
// abuse (spam account creation, password-guessing attacks). Allows 10
// attempts per 15 minutes per IP address, then blocks with a clear message.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    error: "Too many attempts. Please wait 15 minutes before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Looser limiter for general API routes -- generous enough for normal use,
// but still stops a runaway script from hammering the server.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    error: "Too many requests. Please slow down and try again shortly.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, generalLimiter };