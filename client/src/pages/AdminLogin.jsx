import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminLogin } from "../api/adminApi";
import "./AdminLogin.css";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await adminLogin(formData);
      localStorage.setItem("aitbaar_admin_token", data.session.access_token);
      localStorage.setItem("aitbaar_admin", JSON.stringify(data.admin));
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="adl-page">
      <div className="adl-card">
        <div className="adl-brand">
          <div className="adl-emblem">
            <span className="adl-emblem-urdu">اعتبار</span>
          </div>
          <div>
            <div className="adl-brand-row">
              <span className="adl-brand-name">Aitbaar</span>
              <span className="adl-brand-chip">FinOps Gov</span>
            </div>
            <div className="adl-brand-sub">
              <span className="adl-dot" /> ROOT-ADMIN · PLATFORM COMMAND
            </div>
          </div>
        </div>

        <h1 className="adl-title">Admin Console</h1>
        <p className="adl-sub">Restricted access — Aitbaar platform staff only.</p>

        <form onSubmit={handleSubmit} className="adl-form">
          <div className="adl-field">
            <label className="adl-label">Admin Email</label>
            <input
              required
              name="email"
              type="email"
              placeholder="admin@aitbaar.pk"
              className="adl-input"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          <div className="adl-field">
            <label className="adl-label">Password</label>
            <input
              required
              name="password"
              type="password"
              placeholder="••••••••"
              className="adl-input"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          {error && <p className="adl-error">{error}</p>}

          <button type="submit" disabled={loading} className="adl-submit">
            {loading ? "Authenticating…" : "Enter Console"}
          </button>
        </form>

        <Link to="/login" className="adl-back">
          ← Organizer login
        </Link>
      </div>
    </div>
  );
}
