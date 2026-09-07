import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Wallet, ShieldCheck, AlertTriangle, LayoutGrid,
  Settings, LogOut, Bell, ChevronLeft, ChevronRight,
  Plus, Menu, X, Clock, Trash2, TrendingUp, Calendar,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  getOrganizerCommittees, getDashboardData,
  getPendingPayments, verifyPayment, deleteMember,
} from "../api/Committeeapi";
import RegistrationModal from "../components/RegistrationModal";
import "./Dashboard.css";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "members", label: "Members", icon: Users },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "anomalies", label: "Anomalies", icon: AlertTriangle },
  { key: "settings", label: "Settings", icon: Settings },
];

function scoreColors(score) {
  if (score >= 80) return { bg: "#E8EEF4", text: "#1E3A5F" };
  if (score >= 50) return { bg: "#FBF0DE", text: "#5A3A0E" };
  return { bg: "#FCEBEB", text: "#791F1F" };
}

function PendingTable({ pendingPayments, activeCommittee, verifyingId, onVerify }) {
  return (
    <div className="overflow-x-auto">
      <table className="dash-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Month</th>
            <th>Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {pendingPayments.map((p) => (
            <tr key={p.id}>
              <td>{p.members?.name || p.members?.phone}</td>
              <td className="text-[#5C6270]">{p.month}</td>
              <td className="text-[#5C6270]">
                Rs {(p.amount || activeCommittee?.monthly_amount || 0).toLocaleString()}
              </td>
              <td>
                <div className="flex gap-2">
                  <button
                    onClick={() => onVerify(p.id, "confirm")}
                    disabled={verifyingId === p.id}
                    className="dash-confirm-btn disabled:opacity-50"
                  >
                    {verifyingId === p.id ? "..." : "✓ Confirm"}
                  </button>
                  <button
                    onClick={() => onVerify(p.id, "reject")}
                    disabled={verifyingId === p.id}
                    className="dash-reject-btn disabled:opacity-50"
                  >
                    ✕ Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MembersTable({ members, showDelete, onDelete, deletingId }) {
  return (
    <div className="dash-table-card">
      <p className="dash-table-title">Members ({members.length})</p>
      {members.length === 0 && (
        <p className="text-xs text-[#5C6270] px-5 py-3">
          No members yet. Share your committee code.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Score</th>
              <th>Payments</th>
              <th>This month</th>
              {showDelete && <th></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const colors = scoreColors(m.trust_score);
              return (
                <tr key={m.id}>
                  <td className="font-medium">{m.name || "—"}</td>
                  <td className="text-[#5C6270] text-xs">{m.phone}</td>
                  <td>
                    <span
                      className="dash-score-badge"
                      style={{ background: colors.bg, color: colors.text }}
                    >
                      {m.trust_score}
                    </span>
                  </td>
                  <td className="text-xs text-[#5C6270]">
                    {m.total_payments_made || 0} confirmed
                  </td>
                  <td className="text-xs">
                    {m.paid_this_month ? "✅ Paid" : "⏳ Pending"}
                  </td>
                  {showDelete && (
                    <td>
                      <button
                        onClick={() => onDelete(m.id, m.name || m.phone)}
                        disabled={deletingId === m.id}
                        className="p-1.5 rounded-lg text-[#DC2626] hover:bg-red-50 transition disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  // const [organizer, setOrganizer] = useState(null);
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

  // Load organizer + committees once on mount
const [organizer] = useState(() => {
  try {
    const stored = localStorage.getItem("aitbaar_organizer");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
});
useEffect(() => {
  if (!organizer) {
    navigate("/login");
    return;
  }

  let cancelled = false;

  async function loadCommittees() {
    try {
      const result = await getOrganizerCommittees(organizer.id);

      if (!cancelled) {
        setCommittees(result || []);
      }
    } catch {
      if (!cancelled) {
        setCommittees([]);
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  loadCommittees();

  return () => {
    cancelled = true;
  };
}, [organizer, navigate]);

  // Stable refresh function using useCallback
const refreshData = useCallback(async (committeeId) => {
  if (!committeeId) return;

  setDataLoading(true);
  setError("");

  try {
    const [dash, pending] = await Promise.all([
      getDashboardData(committeeId),
      getPendingPayments(committeeId),
    ]);

    setDashData(dash);
    setPendingPayments(pending || []);
  } catch (e) {
    setError(e.message || "Failed to load dashboard data");
  } finally {
    setDataLoading(false);
  }
}, []);

  // Load dashboard data when active committee changes
useEffect(() => {
  const committeeId = committees[activeIndex]?.id;
  if (!committeeId) return;

  let cancelled = false;

  async function fetchData() {
    setDataLoading(true);
    setError("");
    try {
      const [dash, pending] = await Promise.all([
        getDashboardData(committeeId),
        getPendingPayments(committeeId),
      ]);
      if (!cancelled) {
        setDashData(dash);
        setPendingPayments(pending || []);
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
    if (verifyingId) return; // prevent double-click
    setVerifyingId(paymentId);
    try {
      await verifyPayment(paymentId, action);
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

  // ── Derived values ────────────────────────────────
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
        { name: "High (80+)", value: trustDist.high, color: "#1E3A5F" },
        { name: "Medium (50-79)", value: trustDist.medium, color: "#B8792B" },
        { name: "Low (<50)", value: trustDist.low, color: "#DC2626" },
      ]
    : [];

  if (loading) return null;

  return (
    <div className="dash-page">
      {sidebarOpen && (
        <div className="dash-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`dash-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div>
          <div className="flex items-center justify-between mb-8 px-2">
            <p className="dash-logo">Aitbaar</p>
            <button
              className="md:hidden text-white/60 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <nav className="dash-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => { setActiveNav(item.key); setSidebarOpen(false); }}
                className={activeNav === item.key ? "dash-nav-item-active" : "dash-nav-item"}
              >
                <item.icon size={16} />
                {item.label}
                {item.key === "payments" && pendingPayments.length > 0 && (
                  <span className="ml-auto bg-[#B8792B] text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {pendingPayments.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <button onClick={handleLogout} className="dash-logout">
          <LogOut size={16} /> Log out
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="dash-main">
        {/* Topbar */}
        <div className="dash-topbar">
          <div className="flex items-center gap-3">
            <button className="dash-hamburger" onClick={() => setSidebarOpen(true)}>
              <Menu size={18} />
            </button>
            <div>
              <p className="dash-greeting">
                Good to see you, {organizer?.name?.split(" ")[0]}
              </p>
              <p className="dash-greeting-sub">
                Here's what's happening with your committees today.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Bell size={18} className="text-[#5C6270]" />
            {activeCommittee && (
              <div className="dash-committee-switcher">
                <button
                  onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                  disabled={activeIndex === 0}
                  className="dash-switcher-btn"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="dash-committee-badge">{activeCommittee.code}</span>
                <button
                  onClick={() => setActiveIndex((i) => Math.min(committees.length - 1, i + 1))}
                  disabled={activeIndex === committees.length - 1}
                  className="dash-switcher-btn"
                >
                  <ChevronRight size={14} />
                </button>
                <span className="dash-switcher-count">
                  {activeIndex + 1} / {committees.length}
                </span>
              </div>
            )}
            {canAddCommittee && (
              <button
                onClick={() => setShowAddCommittee(true)}
                className="dash-add-committee-btn"
              >
                <Plus size={13} /> New committee
              </button>
            )}
          </div>
        </div>

        {/* Loading / Error */}
        {dataLoading && (
          <p className="text-sm text-[#5C6270] mb-4">Loading...</p>
        )}
        {error && (
          <div className="dash-anomaly mb-4">
            <AlertTriangle size={18} className="text-[#B8792B]" />
            <p className="dash-anomaly-text">{error}</p>
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {dashData && activeNav === "overview" && (
          <>
            {/* KPI cards */}
            <div className="dash-kpi-grid">
              {[
                { icon: Users, label: "Total members", value: kpis.totalMembers },
                { icon: Wallet, label: "Collected this month", value: `Rs ${(kpis.thisMonthCollected || 0).toLocaleString()}` },
                { icon: ShieldCheck, label: "Avg trust score", value: kpis.avgTrustScore },
                { icon: AlertTriangle, label: "Pending flags", value: kpis.activeFlags },
              ].map((k) => (
                <div key={k.label} className="dash-kpi-card">
                  <k.icon size={18} className="mb-3 text-[#1E3A5F]" />
                  <p className="dash-kpi-label">{k.label}</p>
                  <p className="dash-kpi-value">{k.value}</p>
                </div>
              ))}
            </div>

            {/* Health Score */}
            {dashData.health && (
              <div
                className="rounded-xl border p-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                style={{
                  background: dashData.health.status.bg,
                  borderColor: dashData.health.status.color + "30",
                }}
              >
                <div className="flex items-center gap-4 shrink-0">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
                    style={{ background: dashData.health.status.color }}
                  >
                    {dashData.health.score}
                  </div>
                  <div>
                    <p className="text-xs text-[#5C6270] mb-0.5">Committee Health Score</p>
                    <p className="font-semibold text-lg" style={{ color: dashData.health.status.color }}>
                      {dashData.health.status.emoji} {dashData.health.status.label}
                    </p>
                  </div>
                </div>
                {dashData.health.summary && (
                  <p className="text-sm text-[#5C6270] leading-relaxed border-l border-[#22262E]/10 pl-4">
                    {dashData.health.summary}
                  </p>
                )}
              </div>
            )}

            {/* Extra stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="dash-kpi-card">
                <TrendingUp size={16} className="mb-2 text-[#1E3A5F]" />
                <p className="dash-kpi-label">Collection rate</p>
                <p className="text-lg font-semibold">{kpis.collectionRate}%</p>
                <div className="mt-2 h-1.5 bg-[#E8EEF4] rounded-full overflow-hidden">
                  <div className="h-full bg-[#1E3A5F] rounded-full" style={{ width: `${kpis.collectionRate}%` }} />
                </div>
              </div>
              <div className="dash-kpi-card">
                <Calendar size={16} className="mb-2 text-[#B8792B]" />
                <p className="dash-kpi-label">Committee progress</p>
                <p className="text-lg font-semibold">
                  {kpis.monthsElapsed}/{activeCommittee?.duration_months} months
                </p>
                <div className="mt-2 h-1.5 bg-[#FBF0DE] rounded-full overflow-hidden">
                  <div className="h-full bg-[#B8792B] rounded-full" style={{ width: `${kpis.progressPercent}%` }} />
                </div>
              </div>
              <div className="dash-kpi-card">
                <Wallet size={16} className="mb-2 text-[#1E3A5F]" />
                <p className="dash-kpi-label">Total collected</p>
                <p className="text-lg font-semibold">
                  Rs {(kpis.totalCollected || 0).toLocaleString()}
                </p>
              </div>
              <div className="dash-kpi-card">
                <Users size={16} className="mb-2 text-[#B8792B]" />
                <p className="dash-kpi-label">Next payout</p>
                <p className="text-lg font-semibold truncate">
                  {nextPayout?.name || nextPayout?.phone || "—"}
                </p>
              </div>
            </div>

            {/* Pending verifications */}
            {pendingPayments.length > 0 && (
              <div className="dash-pending-card mb-5">
                <p className="dash-pending-title">
                  <Clock size={15} className="text-[#B8792B]" />
                  Pending Payment Verifications
                  <span className="dash-pending-badge">{pendingPayments.length}</span>
                </p>
                <PendingTable pendingPayments={pendingPayments} activeCommittee={activeCommittee} verifyingId={verifyingId} onVerify={handleVerify} />
              </div>
            )}

            {/* Charts */}
            <div className="dash-chart-grid">
              <div className="dash-card">
                <p className="dash-card-title">Payment status (last 4 months)</p>
                {paymentTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={paymentTrend}>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#5C6270" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#5C6270" }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="paid" stackId="a" fill="#1E3A5F" radius={[4, 4, 0, 0]} name="Paid" />
                      <Bar dataKey="pending" stackId="a" fill="#B8792B" radius={[4, 4, 0, 0]} name="Pending" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-[#5C6270] mt-4">No payment data yet.</p>
                )}
              </div>

              <div className="dash-card">
                <p className="dash-card-title">Trust score distribution</p>
                {trustDistribution.some((d) => d.value > 0) ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={trustDistribution} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65}>
                          {trustDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
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
                  <p className="text-xs text-[#5C6270] mt-4">No members yet.</p>
                )}
              </div>
            </div>

            {/* Anomalies */}
            {anomalies.map((a) => (
              <div key={a.id} className="dash-anomaly mb-3">
                <AlertTriangle size={18} className="text-[#B8792B]" />
                <p className="dash-anomaly-text">{a.reason}</p>
              </div>
            ))}

            {/* Members overview (no delete) */}
            <MembersTable
              members={members}
              showDelete={false}
              onDelete={handleDeleteMember}
              deletingId={deletingId}
            />
          </>
        )}

        {/* ── MEMBERS TAB ── */}
        {activeNav === "members" && (
          <MembersTable
            members={members}
            showDelete={true}
            onDelete={handleDeleteMember}
            deletingId={deletingId}
          />
        )}

        {/* ── PAYMENTS TAB ── */}
        {activeNav === "payments" && (
          <div className="dash-pending-card">
            <p className="dash-pending-title">
              <Clock size={15} className="text-[#B8792B]" />
              Pending Verifications
              <span className="dash-pending-badge">{pendingPayments.length}</span>
            </p>
            {pendingPayments.length === 0 ? (
              <p className="text-xs text-[#5C6270] px-5 py-4">No pending payments.</p>
            ) : (
              <PendingTable pendingPayments={pendingPayments} activeCommittee={activeCommittee} verifyingId={verifyingId} onVerify={handleVerify} />
            )}
          </div>
        )}

        {/* ── ANOMALIES TAB ── */}
        {activeNav === "anomalies" && (
          <div className="dash-table-card">
            <p className="dash-table-title">Anomaly Flags</p>
            {anomalies.length === 0 && (
              <p className="text-xs text-[#5C6270] px-5 py-4">No anomalies detected.</p>
            )}
            {anomalies.map((a) => (
              <div key={a.id} className="dash-anomaly m-4">
                <AlertTriangle size={18} className="text-[#B8792B]" />
                <div>
                  <p className="dash-anomaly-text">{a.reason}</p>
                  <p className="text-xs text-[#B8792B] mt-1">Severity: {a.severity}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeNav === "settings" && (
          <div className="dash-card">
            <p className="dash-card-title">Account Settings</p>
            <p className="text-sm text-[#5C6270]">Name: {organizer?.name}</p>
            <p className="text-sm text-[#5C6270] mt-1">Email: {organizer?.email}</p>
            <p className="text-sm text-[#5C6270] mt-1">Phone: {organizer?.phone}</p>
          </div>
        )}
      </main>

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
