import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginOrganizer } from "../api/CommitteeApi";
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
    setError("");
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
      if (err.message?.toLowerCase().includes("too many")) {
        setError("Too many attempts. Please try again later.");
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
      const res = await fetch(API_BASE + "/api/organizer/forgot-password", {
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
      {/* Left Panel — Branding */}
      <div className="login-left">
        <div className="login-left-content">
          <Link to="/" className="login-brand">
            <span className="login-brand-urdu">اعتبار</span>
            <span className="login-brand-en">Aitbaar</span>
          </Link>

          <h1 className="login-headline">
            Manage your committee<br />
            <span className="login-headline-accent">with trust</span>
          </h1>
          <p className="login-tagline">
            AI-powered payment tracking, fraud detection, and trust scores all through WhatsApp.
          </p>

          <div className="login-trust-badges">
            <div className="login-badge">
              <span className="login-badge-icon"></span>
              <span>AI Fraud Shield</span>
            </div>
            <div className="login-badge">
              <span className="login-badge-icon"></span>
              <span>Trust Scores</span>
            </div>
            <div className="login-badge">
              <span className="login-badge-icon"></span>
              <span>WhatsApp Bot</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="login-right">
        <div className="login-form-container">
          <div className="login-form-header">
            <p className="login-welcome">Welcome back</p>
            <h2 className="login-title">Log in to your dashboard</h2>
          </div>

          {!showForgot ? (
            <>
              <form onSubmit={handleSubmit} className="login-form">
                <div className="login-field">
                  <label className="login-label">Email</label>
                  <input
                    required
                    name="email"
                    type="email"
                    placeholder="organizer@email.com"
                    className="login-input"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="login-field">
                  <label className="login-label">Password</label>
                  <input
                    required
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    className="login-input"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>

                <div className="login-options">
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="login-forgot-link"
                  >
                    Forgot password?
                  </button>
                </div>

                {error && <p className="login-error">{error}</p>}

                <button type="submit" disabled={loading} className="login-submit">
                  {loading ? (
                    <span className="login-loading">
                      <span className="login-spinner"></span>
                      Logging in...
                    </span>
                  ) : (
                    "Log in"
                  )}
                </button>
              </form>

              <div className="login-divider">
                <span>or</span>
              </div>

              <p className="login-footer-text">
                Don't have a committee yet?{" "}
                <Link to="/" className="login-footer-link">Back to home</Link>
              </p>
            </>
          ) : (
            <>
              <p className="login-forgot-desc">
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={handleForgotPassword} className="login-form">
                <div className="login-field">
                  <label className="login-label">Email</label>
                  <input
                    required
                    type="email"
                    placeholder="organizer@email.com"
                    className="login-input"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>

                {forgotMsg && <p className="login-success-msg">{forgotMsg}</p>}

                <button type="submit" disabled={forgotLoading} className="login-submit">
                  {forgotLoading ? "Sending..." : "Send reset link"}
                </button>
              </form>

              <button
                onClick={() => { setShowForgot(false); setForgotMsg(""); }}
                className="login-back-link"
              >
                ← Back to login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}