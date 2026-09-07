import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginOrganizer } from "../api/Committeeapi.js";
import "./Login.css";

const API_BASE = "http://localhost:5000";

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(""); // clear error on new input
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginOrganizer(formData);
      localStorage.setItem("aitbaar_token", data.session.access_token);
      localStorage.setItem("aitbaar_organizer", JSON.stringify(data.organizer));
      navigate("/dashboard");
    } catch (err) {
      // If rate limited, show friendly message without waiting
      if (err.message?.toLowerCase().includes("too many")) {
        setError("Too many attempts from this device. Please try from a different browser or wait 15 minutes.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMsg("");

    try {
      const res = await fetch(`${API_BASE}/api/organizer/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      setForgotMsg(data.message || "Reset link sent if email exists.");
    } catch {
      setForgotMsg("Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <p className="login-logo font-display">Aitbaar</p>
        <p className="login-subtitle">Log in to your organizer dashboard</p>

        {!showForgot ? (
          <>
            <form onSubmit={handleSubmit} className="login-form">
              <input
                required
                name="email"
                type="email"
                placeholder="Email address"
                className="login-input"
                value={formData.email}
                onChange={handleChange}
              />
              <input
                required
                name="password"
                type="password"
                placeholder="Password"
                className="login-input"
                value={formData.password}
                onChange={handleChange}
              />

              {error && <p className="login-error">{error}</p>}

              <button type="submit" disabled={loading} className="login-submit">
                {loading ? "Logging in..." : "Log in"}
              </button>
            </form>

            <button
              onClick={() => setShowForgot(true)}
              className="login-footer-link block text-center mt-3 text-sm"
            >
              Forgot password?
            </button>

            <p className="login-footer-text">
              Don't have a committee yet?{" "}
              <Link to="/" className="login-footer-link">Go to home</Link>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-[#5C6270] mb-4">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleForgotPassword} className="login-form">
              <input
                required
                type="email"
                placeholder="Your email address"
                className="login-input"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />

              {forgotMsg && (
                <p className="text-xs text-[#1E3A5F] pt-1">{forgotMsg}</p>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                className="login-submit"
              >
                {forgotLoading ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <button
              onClick={() => { setShowForgot(false); setForgotMsg(""); }}
              className="login-footer-link block text-center mt-3 text-sm"
            >
              &larr; Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}