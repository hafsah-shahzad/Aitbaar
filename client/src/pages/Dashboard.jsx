import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Wallet, ShieldCheck, AlertTriangle, LayoutGrid,
  Settings, LogOut, Bell,
  Plus, Menu, X, Clock, Trash2, TrendingUp, Calendar,
  BarChart3, Activity, ChevronDown, Zap, CheckCircle2,
  XCircle, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip,
  RadialBarChart, RadialBar,
} from "recharts";
import {
  getOrganizerCommittees, getDashboardData,
  getPendingPayments, verifyPayment, deleteMember,
  getAIPayoutStatus,
} from "../api/Committeeapi";
import RegistrationModal from "../components/RegistrationModal";
import PayoutSchedule from "../components/payoutSchedule";
import "./Dashboard.css";

const API_BASE = "http://localhost:5001";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "members", label: "Members", icon: Users },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "payouts", label: "Payouts", icon: BarChart3 },
  { key: "anomalies", label: "Anomalies", icon: AlertTriangle },
  { key: "settings", label: "Settings", icon: Settings },
];

/* ── Helpers ─────────────────────────────────── */
function scoreColors(score) {
  if (score >= 80) return { bg: "#E8F5E9", text: "#1B5E20", dot: "#2E7D32" };
  if (score >= 50) return { bg: "#FFF8E1", text: "#E65100", dot: "#F9A825" };
  return { bg: "#FFEBEE", text: "#B71C1C", dot: "#E53935" };
}

function getInitials(name) {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  const colors = ["#1E3A5F", "#B8792B", "#1E6B4A", "#7C3AED", "#DC2626", "#0891B2"];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function paymentStatusBadge(status) {
  if (status === "confirmed") return <span className="dash-status-confirmed"><CheckCircle2 size={12} /> Confirmed</span>;
  if (status === "rejected") return <span className="dash-status-rejected"><XCircle size={12} /> Rejected</span>;
  return <span className="dash-status-pending-badge"><AlertCircle size={12} /> Pending</span>;
}

/* ── Pending Payment Row (Payments page) ──────── */
function PendingRow({ payment, activeCommittee, verifyingId, onVerify }) {
  return (
    <div className="dash-pay-row">
      <div className="dash-pay-avatar" style={{ background: getAvatarColor(payment.members?.name) }}>
        {getInitials(payment.members?.name)}
      </div>
      <div className="dash-pay-info">
        <p className="dash-pay-name">{payment.members?.name || payment.members?.phone}</p>
        <p className="dash-pay-month">{payment.month}</p>
      </div>
      <p className="dash-pay-amount">Rs {(payment.amount || activeCommittee?.monthly_amount || 0).toLocaleString()}</p>
      <div className="dash-pay-actions">
        <button
          onClick={() => onVerify(payment.id, "confirm")}
          disabled={verifyingId === payment.id}
          className="dash-pay-btn dash-pay-confirm"
        >
          {verifyingId === payment.id ? "..." : "✓ Confirm"}
        </button>
        <button
          onClick={() => onVerify(payment.id, "reject")}
          disabled={verifyingId === payment.id}
          className="dash-pay-btn dash-pay-reject"
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();

  const [committees, setCommittees] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dashData, setDashData] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeNav, setActiveNav] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddCommittee, setShowAddCommittee] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [showCommitteeDropdown, setShowCommitteeDropdown] = useState(false);

  // Trust Distribution member detail + month filter
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);

  // AI Payout status
  const [aiPayoutStatus, setAiPayoutStatus] = useState(null);

  const [organizer] = useState(() => {
    try {
      const stored = localStorage.getItem("aitbaar_organizer");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!organizer) { navigate("/login"); return; }
    let cancelled = false;
    async function loadCommittees() {
      try {
        const result = await getOrganizerCommittees(organizer.id);
        if (!cancelled) setCommittees(result || []);
      } catch {
        if (!cancelled) setCommittees([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCommittees();
    return () => { cancelled = true; };
  }, [organizer, navigate]);

  const refreshData = useCallback(async (committeeId) => {
    if (!committeeId) return;
    setDataLoading(true);
    setError("");
    try {
      const [dash, pending, aiStatus] = await Promise.all([
        getDashboardData(committeeId),
        getPendingPayments(committeeId),
        getAIPayoutStatus(committeeId).catch(() => null),
      ]);
      setDashData(dash);
      setPendingPayments(pending || []);
      setAiPayoutStatus(aiStatus);
    } catch (e) {
      setError(e.message || "Failed to load dashboard data");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    const committeeId = committees[activeIndex]?.id;
    if (!committeeId) return;
    let cancelled = false;
    async function fetchData() {
      setDataLoading(true);
      setError("");
      try {
        const [dash, pending, aiStatus] = await Promise.all([
          getDashboardData(committeeId),
          getPendingPayments(committeeId),
          getAIPayoutStatus(committeeId).catch(() => null),
        ]);
        if (!cancelled) {
          setDashData(dash);
          setPendingPayments(pending || []);
          setAiPayoutStatus(aiStatus);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load dashboard data");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [committees, activeIndex]);

  function handleLogout() {
    localStorage.removeItem("aitbaar_token");
    localStorage.removeItem("aitbaar_organizer");
    navigate("/login");
  }

  async function handleVerify(paymentId, action) {
    if (verifyingId) return;
    setVerifyingId(paymentId);
    try {
      const result = await verifyPayment(paymentId, action);
      if (action === "confirm" && result?.receipt) {
        // Open receipt in new tab for download
        window.open(`${API_BASE}/api/payment/${paymentId}/receipt`, "_blank");
      }
      await refreshData(committees[activeIndex]?.id);
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleDeleteMember(memberId, memberName) {
    if (!window.confirm(`"${memberName}" ko committee se remove karna chahte hain?`)) return;
    setDeletingId(memberId);
    try {
      await deleteMember(memberId);
      await refreshData(committees[activeIndex]?.id);
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setDeletingId(null);
    }
  }

  const activeCommittee = committees[activeIndex];
  const kpis = dashData?.kpis;
  const members = dashData?.members || [];
  const anomalies = dashData?.anomalies || [];
  const paymentTrend = dashData?.paymentTrend || [];
  const trustDist = dashData?.trustDistribution;
  const nextPayout = dashData?.nextPayoutMember;
  const canAddCommittee = committees.length < 3;

  const trustDistribution = trustDist
    ? [
        { name: "High (80+)", value: trustDist.high, color: "#2E7D32" },
        { name: "Medium (50-79)", value: trustDist.medium, color: "#F9A825" },
        { name: "Low (<50)", value: trustDist.low, color: "#E53935" },
      ]
    : [];

  if (loading) {
    return (
      <div className="dash-loading-screen">
        <div className="dash-loading-spinner" />
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dash-page">
      {sidebarOpen && <div className="dash-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`dash-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="dash-sidebar-inner">
          {/* Logo */}
          <div className="dash-sidebar-logo">
            <div className="dash-logo-mark"> اعتبار</div>
            <span className="dash-logo-text">Aitbaar</span>
            <button className="dash-sidebar-close" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>

          {/* Committee Info */}
          {activeCommittee && (
            <div className="dash-sidebar-committee">
              <p className="dash-sidebar-committee-name">{activeCommittee.name}</p>
              <p className="dash-sidebar-committee-code">{activeCommittee.code}</p>
            </div>
          )}

          {/* Nav */}
          <nav className="dash-nav">
            {NAV_ITEMS.map((item) => {
              const badge = item.key === "payments" ? pendingPayments.length :
                           item.key === "anomalies" ? anomalies.length : 0;
              return (
                <button
                  key={item.key}
                  onClick={() => { setActiveNav(item.key); setSidebarOpen(false); }}
                  className={`dash-nav-item ${activeNav === item.key ? "active" : ""}`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {badge > 0 && <span className="dash-nav-badge">{badge}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User */}
        <div className="dash-sidebar-user">
          <div className="dash-user-avatar" style={{ background: getAvatarColor(organizer?.name) }}>
            {getInitials(organizer?.name)}
          </div>
          <div className="dash-user-info">
            <p className="dash-user-name">{organizer?.name}</p>
            <p className="dash-user-role">Organizer</p>
          </div>
          <button onClick={handleLogout} className="dash-logout-btn" title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="dash-main">
        {/* Topbar */}
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            <button className="dash-hamburger" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div>
              <h1 className="dash-greeting">
                {activeNav === "overview" && "Dashboard"}
                {activeNav === "members" && "Members"}
                {activeNav === "payments" && "Payments"}
                {activeNav === "payouts" && "Members"}
                {activeNav === "anomalies" && "Anomalies"}
                {activeNav === "settings" && "Settings"}
              </h1>
              <p className="dash-greeting-sub">
                {activeNav === "overview"
                  ? `${organizer?.name?.split(" ")[0]}'s committee overview`
                  : `${activeCommittee?.name || ""} ${activeNav}`
                }
              </p>
            </div>
          </div>

          <div className="dash-topbar-right">
            <button className="dash-topbar-icon">
              <Bell size={18} />
              {pendingPayments.length > 0 && <span className="dash-topbar-dot" />}
            </button>

            {/* Committee Switcher */}
            {committees.length > 1 && (
              <div className="dash-switcher-wrapper">
                <button
                  className="dash-switcher-trigger"
                  onClick={() => setShowCommitteeDropdown(!showCommitteeDropdown)}
                >
                  <span>{activeCommittee?.code}</span>
                  <ChevronDown size={14} />
                </button>
                {showCommitteeDropdown && (
                  <div className="dash-switcher-dropdown">
                    {committees.map((c, i) => (
                      <button
                        key={c.id}
                        className={`dash-switcher-option ${i === activeIndex ? "active" : ""}`}
                        onClick={() => { setActiveIndex(i); setShowCommitteeDropdown(false); }}
                      >
                        <span className="dash-switcher-option-name">{c.name}</span>
                        <span className="dash-switcher-option-code">{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {canAddCommittee && (
              <button onClick={() => setShowAddCommittee(true)} className="dash-add-btn">
                <Plus size={15} />
                <span>New</span>
              </button>
            )}
          </div>
        </header>

        {/* Loading / Error */}
        {dataLoading && (
          <div className="dash-data-loading">
            <div className="dash-data-spinner" />
            <span>Refreshing data...</span>
          </div>
        )}
        {error && (
          <div className="dash-error-banner">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* ═══ OVERVIEW ═══ */}
        {dashData && activeNav === "overview" && (
          <div className="dash-content">
            {/* ── Health Score + KPIs Row ── */}
            <div className="dash-hero-row">
              {/* Health Score Card */}
              {dashData.health && (
                <div className="dash-health-hero" style={{ borderColor: dashData.health.status.color + "30" }}>
                  <div className="dash-health-hero-top">
                    <div className="dash-health-circle-lg" style={{ background: dashData.health.status.color }}>
                      <span className="dash-health-score-lg">{dashData.health.score}</span>
                    </div>
                    <div>
                      <p className="dash-health-label-lg">Committee Health</p>
                      <p className="dash-health-status-lg" style={{ color: dashData.health.status.color }}>
                        {dashData.health.status.emoji} {dashData.health.status.label}
                      </p>
                    </div>
                  </div>
                  {dashData.health.summary && (
                    <p className="dash-health-summary-lg">{dashData.health.summary}</p>
                  )}
                </div>
              )}

              {/* KPIs alongside — dynamic based on selected member */}
              <div className="dash-kpi-stack">
                {selectedMember ? (
                  <>
                    <div className="dash-kpi-mini">
                      <div className="dash-kpi-mini-icon" style={{ background: scoreColors(selectedMember.trust_score).bg, color: scoreColors(selectedMember.trust_score).text }}>
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <p className="dash-kpi-mini-label">Trust Score</p>
                        <p className="dash-kpi-mini-value">{selectedMember.trust_score || 0}</p>
                      </div>
                    </div>
                    <div className="dash-kpi-mini">
                      <div className="dash-kpi-mini-icon" style={{ background: selectedMember.payment_status === "confirmed" ? "#E8F5E9" : "#FFF8E1", color: selectedMember.payment_status === "confirmed" ? "#2E7D32" : "#E65100" }}>
                        <Wallet size={18} />
                      </div>
                      <div>
                        <p className="dash-kpi-mini-label">Payment</p>
                        <p className="dash-kpi-mini-value" style={{ fontSize: 14, textTransform: "capitalize" }}>{selectedMember.payment_status || "pending"}</p>
                      </div>
                    </div>
                    <div className="dash-kpi-mini">
                      <div className="dash-kpi-mini-icon" style={{ background: "#F3E8FF", color: "#7C3AED" }}>
                        <Activity size={18} />
                      </div>
                      <div>
                        <p className="dash-kpi-mini-label">Confirmed</p>
                        <p className="dash-kpi-mini-value">{selectedMember.total_payments_made || 0}</p>
                      </div>
                    </div>
                    <div className="dash-kpi-mini">
                      <div className="dash-kpi-mini-icon" style={{ background: "#E8EEF4", color: "#1E3A5F" }}>
                        <Users size={18} />
                      </div>
                      <div>
                        <p className="dash-kpi-mini-label">Payout Slot</p>
                        <p className="dash-kpi-mini-value">{selectedMember.payout_slot ? `#${selectedMember.payout_slot}` : "—"}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="dash-kpi-mini">
                      <div className="dash-kpi-mini-icon" style={{ background: "#E3F2FD", color: "#1565C0" }}>
                        <Users size={18} />
                      </div>
                      <div>
                        <p className="dash-kpi-mini-label">Members</p>
                        <p className="dash-kpi-mini-value">{kpis.totalMembers}</p>
                      </div>
                    </div>
                    <div className="dash-kpi-mini">
                      <div className="dash-kpi-mini-icon" style={{ background: "#E8F5E9", color: "#2E7D32" }}>
                        <Wallet size={18} />
                      </div>
                      <div>
                        <p className="dash-kpi-mini-label">Collected</p>
                        <p className="dash-kpi-mini-value">Rs {(kpis.thisMonthCollected || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="dash-kpi-mini">
                      <div className="dash-kpi-mini-icon" style={{ background: "#FFF8E1", color: "#E65100" }}>
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <p className="dash-kpi-mini-label">Avg Trust</p>
                        <p className="dash-kpi-mini-value">{kpis.avgTrustScore}</p>
                      </div>
                    </div>
                    <div className="dash-kpi-mini">
                      <div className="dash-kpi-mini-icon" style={{ background: anomalies.length > 0 ? "#FFEBEE" : "#E8F5E9", color: anomalies.length > 0 ? "#C62828" : "#2E7D32" }}>
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <p className="dash-kpi-mini-label">Alerts</p>
                        <p className="dash-kpi-mini-value">{kpis.activeFlags}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="dash-stats-row">
              <div className="dash-stat-card">
                <div className="dash-stat-header">
                  <TrendingUp size={16} className="text-[#1565C0]" />
                  <span className="dash-stat-label">Collection Rate</span>
                </div>
                <p className="dash-stat-value">{kpis.collectionRate}%</p>
                <div className="dash-progress">
                  <div className="dash-progress-fill" style={{ width: `${kpis.collectionRate}%`, background: "#1565C0" }} />
                </div>
              </div>
              <div className="dash-stat-card">
                <div className="dash-stat-header">
                  <Calendar size={16} className="text-[#E65100]" />
                  <span className="dash-stat-label">Committee Progress</span>
                </div>
                <p className="dash-stat-value">{kpis.monthsElapsed} / {activeCommittee?.duration_months}</p>
                <div className="dash-progress">
                  <div className="dash-progress-fill" style={{ width: `${kpis.progressPercent}%`, background: "#E65100" }} />
                </div>
              </div>
              <div className="dash-stat-card">
                <div className="dash-stat-header">
                  <Wallet size={16} className="text-[#2E7D32]" />
                  <span className="dash-stat-label">Total Collected</span>
                </div>
                <p className="dash-stat-value">Rs {(kpis.totalCollected || 0).toLocaleString()}</p>
              </div>
              <div className="dash-stat-card">
                <div className="dash-stat-header">
                  <Zap size={16} className="text-[#7C3AED]" />
                  <span className="dash-stat-label">Next Payout</span>
                </div>
                <p className="dash-stat-value dash-stat-truncate">{nextPayout?.name || "—"}</p>
              </div>
            </div>

            {/* ── Charts ── */}
            <div className="dash-charts-row">
              {/* Payment Trend — clickable months */}
              <div className="dash-chart-card">
                <div className="dash-chart-title-row">
                  <h3 className="dash-chart-title">Payment Trend</h3>
                  {selectedMonth && (
                    <button
                      className="dash-month-clear-btn"
                      onClick={() => setSelectedMonth(null)}
                    >
                      {selectedMonth} ✕
                    </button>
                  )}
                </div>
                {paymentTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={paymentTrend}
                      barGap={2}
                    >
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: selectedMonth ? "#1E3A5F" : "#8E99A4" }} axisLine={false} tickLine={false} fontWeight={selectedMonth ? 700 : 400} />
                      <YAxis tick={{ fontSize: 11, fill: "#8E99A4" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid #E8ECF0", fontSize: 12 }}
                      />
                      <Bar dataKey="paid" stackId="a" fill="#2E7D32" radius={[3, 3, 0, 0]} name="Paid" cursor="pointer" onClick={(data) => {
                        if (data && data.month) {
                          setSelectedMonth((prev) => prev === data.month ? null : data.month);
                        }
                      }} />
                      <Bar dataKey="pending" stackId="a" fill="#F9A825" radius={[3, 3, 0, 0]} name="Pending" cursor="pointer" onClick={(data) => {
                        if (data && data.month) {
                          setSelectedMonth((prev) => prev === data.month ? null : data.month);
                        }
                      }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="dash-empty-text">No payment data yet.</p>
                )}
              </div>

              {/* Trust Score Distribution */}
              <div className="dash-chart-card">
                <div className="dash-chart-title-row">
                  <h3 className="dash-chart-title">Trust Distribution</h3>
                  {/* Member Dropdown */}
                  <div className="dash-member-select-wrapper">
                    <button
                      className="dash-member-select-trigger"
                      onClick={() => setMemberDropdownOpen(!memberDropdownOpen)}
                    >
                      <span>{selectedMember ? selectedMember.name : "Select Member"}</span>
                      <ChevronDown size={14} />
                    </button>
                    {memberDropdownOpen && (
                      <div className="dash-member-select-dropdown">
                        <button
                          className="dash-member-select-option"
                          onClick={() => { setSelectedMember(null); setMemberDropdownOpen(false); }}
                        >
                          <div className="dash-member-select-avatar" style={{ background: "#6B7280" }}>
                            <BarChart3 size={14} />
                          </div>
                          <div>
                            <p className="dash-member-select-name">All Members</p>
                            <p className="dash-member-select-score">View pie chart</p>
                          </div>
                        </button>
                        {members.map((m) => (
                          <button
                            key={m.id}
                            className="dash-member-select-option"
                            onClick={() => { setSelectedMember(m); setMemberDropdownOpen(false); }}
                          >
                            <div className="dash-member-select-avatar" style={{ background: getAvatarColor(m.name) }}>
                              {getInitials(m.name)}
                            </div>
                            <div>
                              <p className="dash-member-select-name">{m.name || "—"}</p>
                              <p className="dash-member-select-score">Score: {m.trust_score}</p>
                            </div>
                          </button>
                        ))}
                        {members.length === 0 && <p className="dash-empty-text">No members</p>}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Member Trust Score Graph (replaces pie chart when member selected) ── */}
                {selectedMember ? (
                  <div className="trust-member-graph">
                    {/* Radial gauge showing trust score */}
                    <div className="trust-gauge-row">
                      <div className="trust-gauge-chart">
                        <ResponsiveContainer width="100%" height={160}>
                          <RadialBarChart
                            innerRadius="60%"
                            outerRadius="100%"
                            data={[{ name: selectedMember.name, value: selectedMember.trust_score || 0, fill: scoreColors(selectedMember.trust_score).dot }]}
                            startAngle={180}
                            endAngle={0}
                          >
                            <RadialBar
                              background={{ fill: "#F0F1F3" }}
                              dataKey="value"
                              cornerRadius={10}
                            />
                          </RadialBarChart>
                        </ResponsiveContainer>
                        <div className="trust-gauge-center">
                          <span className="trust-gauge-value" style={{ color: scoreColors(selectedMember.trust_score).text }}>{selectedMember.trust_score || 0}</span>
                          <span className="trust-gauge-label">/ 100</span>
                        </div>
                      </div>
                      <div className="trust-gauge-side">
                        <p className="trust-gauge-member-name">{selectedMember.name || "—"}</p>
                        <p className="trust-gauge-phone">{selectedMember.phone}</p>
                        <div className="trust-gauge-pills">
                          <span className="trust-gauge-pill">Slot #{selectedMember.payout_slot || ""}</span>
                          <span className="trust-gauge-pill">{selectedMember.total_payments_made || 0} paid</span>
                          {selectedMonth && <span className="trust-gauge-pill trust-gauge-pill-active">{selectedMonth}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Pie Chart (default view) ── */
                  trustDistribution.some((d) => d.value > 0) ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={trustDistribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                            {trustDistribution.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: "1px solid #E8ECF0", fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="dash-legend">
                        {trustDistribution.map((d) => (
                          <span key={d.name} className="dash-legend-item">
                            <span className="dash-legend-dot" style={{ background: d.color }} />
                            {d.name}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="dash-empty-text">No members yet.</p>
                  )
                )}
              </div>
            </div>

            {/* ── Payout Schedule (read-only preview) ── */}
            <PayoutSchedule committeeId={activeCommittee?.id} members={members} showSwitchToManual={false} showActions={false} />


          </div>
        )}

        {/* ═══ MEMBERS TAB ═══ */}
        {activeNav === "members" && dashData && (
          <div className="dash-content">
            <div className="dash-section">
              <div className="dash-section-header">
                <div className="dash-section-title-row">
                  <Users size={16} className="text-[#1565C0]" />
                  <h3 className="dash-section-title">All Members ({members.length})</h3>
                </div>
              </div>
              <div className="dash-members-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Member Name</th>
                      <th>Payout Slot</th>
                      <th>Phone Number</th>
                      <th>Trust Score</th>
                      <th>Payment Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const colors = scoreColors(m.trust_score);
                      return (
                        <tr key={m.id}>
                          <td>
                            <div className="dash-table-member">
                              <div className="dash-table-avatar" style={{ background: getAvatarColor(m.name) }}>
                                {getInitials(m.name)}
                              </div>
                              <span className="font-medium">{m.name || "—"}</span>
                            </div>
                          </td>
                          <td>
                            {m.payout_slot ? (
                              <span className="dash-payout-slot-badge">#{m.payout_slot}</span>
                            ) : (
                              <span className="dash-table-secondary">—</span>
                            )}
                          </td>
                          <td className="dash-table-secondary">{m.phone}</td>
                          <td>
                            <span className="dash-score-pill" style={{ background: colors.bg, color: colors.text }}>
                              {m.trust_score}
                            </span>
                          </td>
                          <td>
                            {paymentStatusBadge(m.payment_status)}
                          </td>
                          <td>
                            <button
                              onClick={() => handleDeleteMember(m.id, m.name || m.phone)}
                              disabled={deletingId === m.id}
                              className="dash-delete-btn"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PAYMENTS TAB ═══ */}
        {activeNav === "payments" && dashData && (
          <div className="dash-content">
            <div className="dash-section">
              <div className="dash-section-header">
                <div className="dash-section-title-row">
                  <Clock size={16} className="text-[#E65100]" />
                  <h3 className="dash-section-title">Pending Verifications</h3>
                  <span className="dash-section-badge">{pendingPayments.length}</span>
                </div>
              </div>
              {pendingPayments.length === 0 ? (
                <div className="dash-empty-state">
                  <Wallet size={40} className="text-[#D1D5DB]" />
                  <p>No pending payments</p>
                </div>
              ) : (
                <div className="dash-pay-list">
                  {pendingPayments.map((p) => (
                    <PendingRow
                      key={p.id}
                      payment={p}
                      activeCommittee={activeCommittee}
                      verifyingId={verifyingId}
                      onVerify={handleVerify}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Recent confirmed/rejected payments */}
           {/* Recent confirmed/rejected payments */}
            <div className="dash-section" style={{ marginTop: 20 }}>
              <div className="dash-section-header">
                <div className="dash-section-title-row">
                  <CheckCircle2 size={16} className="text-[#2E7D32]" />
                  <h3 className="dash-section-title">All Members Payment Status</h3>
                </div>
              </div>
              <div className="dash-members-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Payout Slot</th>
                      <th>Trust Score</th>
                      <th>Payment Status</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                 {[...members].sort((a, b) => (a.payout_slot || 999) - (b.payout_slot || 999)).map((m) => {
                      const colors = scoreColors(m.trust_score);
                      return (
                        <tr key={m.id}>
                          <td>
                            <div className="dash-table-member">
                              <div className="dash-table-avatar" style={{ background: getAvatarColor(m.name) }}>
                                {getInitials(m.name)}
                              </div>
                              <span className="font-medium">{m.name || "—"}</span>
                            </div>
                          </td>
                          <td>
                            {m.payout_slot ? (
                              <span className="dash-payout-slot-badge">#{m.payout_slot}</span>
                            ) : "—"}
                          </td>
                          <td>
                            <span className="dash-score-pill" style={{ background: colors.bg, color: colors.text }}>
                              {m.trust_score}
                            </span>
                          </td>
                          <td>{paymentStatusBadge(m.payment_status)}</td>
                          <td>
                            {m.payment_status === "confirmed" && m.current_payment_id ? (
                              <a
                                href={`${API_BASE}/api/payment/${m.current_payment_id}/receipt/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="dash-receipt-btn"
                                title="Download PDF Receipt"
                              >
                                📄 PDF
                              </a>
                            ) : (
                              <span className="dash-status-inline" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Not Generated</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PAYOUTS TAB ═══ */}
        {activeNav === "payouts" && dashData && (
          <div className="dash-content">
            {/* AI Payout Status Banner */}
            <div className={`dash-ai-status-banner ${aiPayoutStatus?.aiLocked ? "locked" : aiPayoutStatus?.aiGenerationUsed ? "used" : "fresh"}`}>
              <div className="dash-ai-status-icon">
                {aiPayoutStatus?.aiLocked ? (
                  <><AlertCircle size={18} /><span className="dash-ai-status-text">AI Generation Locked Manual Update Available</span></>
                ) : aiPayoutStatus?.aiGenerationUsed ? (
                  <><Activity size={18} /><span className="dash-ai-status-text">AI Payout Generated Review Before Manual Update</span></>
                ) : (
                  <><Zap size={18} /><span className="dash-ai-status-text">AI Generation Available You Can Generate Once</span></>
                )}
              </div>
              {aiPayoutStatus?.aiLocked && (
                <p className="dash-ai-status-detail">You have manually updated the AI-generated payout order. AI generation is permanently disabled for this committee.</p>
              )}
              {aiPayoutStatus?.aiGenerationUsed && !aiPayoutStatus?.aiLocked && (
                <p className="dash-ai-status-detail">AI has generated the payout order. If you update manually, AI generation will be locked.</p>
              )}
            </div>

            <PayoutSchedule committeeId={activeCommittee?.id} members={members} showSwitchToManual={true} showActions={true} />
          </div>
        )}

        {/* ═══ ANOMALIES TAB ═══ */}
        {activeNav === "anomalies" && dashData && (
          <div className="dash-content">
            <div className="dash-section">
              <div className="dash-section-header">
                <div className="dash-section-title-row">
                  <AlertTriangle size={16} className="text-[#E65100]" />
                  <h3 className="dash-section-title">All Anomalies ({anomalies.length})</h3>
                </div>
              </div>
              {anomalies.length === 0 ? (
                <div className="dash-empty-state">
                  <ShieldCheck size={40} className="text-[#D1D5DB]" />
                  <p>No anomalies detected</p>
                </div>
              ) : (
                <div className="dash-anomaly-list">
                  {anomalies.map((a) => (
                    <div key={a.id} className="dash-anomaly-item">
                      <div className="dash-anomaly-dot" />
                      <div className="dash-anomaly-body">
                        <p className="dash-anomaly-text">{a.reason}</p>
                        <div className="dash-anomaly-meta-row">
                          <span className="dash-anomaly-meta">Severity: {a.severity}</span>
                          {a.members && (
                            <span className="dash-anomaly-member">
                              Member: {a.members.name || a.members.phone}
                            </span>
                          )}
                                  {a.reviewed_by_name && (
                            <span className="dash-anomaly-meta">
                              Reviewed by: {a.reviewed_by_name}
                            </span>
                          )}
                          {!a.reviewed_by_name && a.reviewed_by && (
                            <span className="dash-anomaly-meta">
                              Reviewed by: {a.reviewed_by}
                            </span>
                          )}
                          {!a.reviewed_by && (
                            <span className="dash-anomaly-meta" style={{ color: '#8E99A4', fontStyle: 'italic' }}>
                              Not yet reviewed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ SETTINGS TAB ═══ */}
        {activeNav === "settings" && (
          <div className="dash-content">
            <div className="dash-section">
              <div className="dash-section-header">
                <div className="dash-section-title-row">
                  <Settings size={16} className="text-[#5C6270]" />
                  <h3 className="dash-section-title">Account Settings</h3>
                </div>
              </div>
              <div className="dash-settings-grid">
                <div className="dash-settings-item">
                  <span className="dash-settings-label">Name</span>
                  <span className="dash-settings-value">{organizer?.name}</span>
                </div>
                <div className="dash-settings-item">
                  <span className="dash-settings-label">Email</span>
                  <span className="dash-settings-value">{organizer?.email}</span>
                </div>
                <div className="dash-settings-item">
                  <span className="dash-settings-label">Phone</span>
                  <span className="dash-settings-value">{organizer?.phone}</span>
                </div>
                {activeCommittee && (
                  <>
                    <div className="dash-settings-divider" />
                    <div className="dash-settings-item">
                      <span className="dash-settings-label">Committee Name</span>
                      <span className="dash-settings-value">{activeCommittee.name}</span>
                    </div>
                    <div className="dash-settings-item">
                      <span className="dash-settings-label">Committee Code</span>
                      <span className="dash-settings-value">{activeCommittee.code}</span>
                    </div>
                    <div className="dash-settings-item">
                      <span className="dash-settings-label">Monthly Amount</span>
                      <span className="dash-settings-value">Rs {(activeCommittee.monthly_amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="dash-settings-item">
                      <span className="dash-settings-label">Duration</span>
                      <span className="dash-settings-value">{activeCommittee.duration_months} months</span>
                    </div>
                    <div className="dash-settings-item">
                      <span className="dash-settings-label">Start Date</span>
                      <span className="dash-settings-value">{activeCommittee.start_date || "—"}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Registration Modal */}
      {showAddCommittee && (
        <RegistrationModal
          isOpen={showAddCommittee}
          onClose={() => setShowAddCommittee(false)}
          existingOrganizer={organizer}
          onCommitteeCreated={(newCommittee) => {
            setCommittees((prev) => {
              const next = [...prev, newCommittee];
              setActiveIndex(next.length - 1);
              return next;
            });
            setShowAddCommittee(false);
          }}
        />
      )}


    </div>
  );
}