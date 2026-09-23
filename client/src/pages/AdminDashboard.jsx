import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, Users, Wallet, ShieldAlert, ShieldCheck,
  LogOut, Menu, X, Search, Bell, CheckCircle2, XCircle, Ban,
  Activity, Database, Globe, RefreshCw, Lock, Loader2, ArrowLeft,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area,
  CartesianGrid,
} from "recharts";
import {
  getPlatformStats, getAdminOrganizers, getOrganizerMembers, setOrganizerStatus,
  getAdminCommittees, getCommitteeOverview, getAdminAnomalies, reviewAnomaly, getSystemHealth,
} from "../api/adminApi";
import "./AdminDashboard.css";

/* ══════════════════════════════════════════════════════════════
   Aitbaar Platform Admin Console — FinOps dark theme.
   Live data from /api/admin/* (Supabase, service-role server-side).
   ══════════════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { key: "overview", label: "Dashboard Overview", icon: LayoutDashboard },
  { key: "organizers", label: "Organizer/Member Registry", icon: Users },
  { key: "committees", label: "Committee Oversight", icon: Building2 },
  { key: "anomalies", label: "Fraud Radar", icon: ShieldAlert },
  { key: "system", label: "System Health", icon: Database },
];

/* ── Helpers ───────────────────────────────────────────────── */

function getInitials(name) {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  const colors = ["#6366F1", "#F59E0B", "#10B981", "#8B5CF6", "#F43F5E", "#06B6D4"];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function fmtRs(v) {
  if (v == null) return "—";
  if (v >= 1000000) return `₨ ${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `₨ ${(v / 1000).toFixed(1)}K`;
  return `₨ ${v}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── Small UI atoms ────────────────────────────────────────── */

function KpiCard({ icon: Icon, label, value, sub, tone, trend }) {
  return (
    <div className="ad-kpi">
      <div className="ad-kpi-top">
        <div className="ad-kpi-icon" style={{ background: tone.bg, color: tone.fg }}>
          <Icon size={18} />
        </div>
        {trend != null && (
          <span className={`ad-kpi-trend ${trend >= 0 ? "up" : "down"}`}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="ad-kpi-value">{value}</p>
      <p className="ad-kpi-label">{label}</p>
      {sub && <p className="ad-kpi-sub">{sub}</p>}
    </div>
  );
}

function TrustPill({ score }) {
  if (score == null) return <span className="ad-cell-dim">—</span>;
  const cls = score >= 80 ? "good" : score >= 50 ? "mid" : "bad";
  const tier = score >= 80 ? "AAA" : score >= 50 ? "BBB" : "CCC";
  return <span className={`ad-trust-pill ${cls}`}>{score.toFixed(1)} {tier}</span>;
}

function OrgStatusBadge({ status }) {
  if (status === "suspended") return <span className="ad-badge ad-badge-red">Suspended</span>;
  return <span className="ad-badge ad-badge-green">Active</span>;
}

function ComHealthBadge({ health }) {
  if (health >= 75) return <span className="ad-badge ad-badge-green">Healthy</span>;
  if (health >= 50) return <span className="ad-badge ad-badge-amber">Watch</span>;
  return <span className="ad-badge ad-badge-red">At Risk</span>;
}

function SevBadge({ severity }) {
  const map = {
    high: { cls: "ad-badge-red", label: "Critical" },
    medium: { cls: "ad-badge-amber", label: "Medium" },
    low: { cls: "ad-badge-gray", label: "Low" },
  };
  const s = map[severity] || map.low;
  return <span className={`ad-badge ${s.cls}`}>{s.label}</span>;
}

/* ═══ Main ══════════════════════════════════════════════════ */

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeNav, setActiveNav] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [showNotif, setShowNotif] = useState(false);

  const [stats, setStats] = useState(null);
  const [organizers, setOrganizers] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [system, setSystem] = useState(null);
  const [cityFilter, setCityFilter] = useState("all");

  // Organizer Members panel: click an organizer in the registry → this loads
  // every member across that organizer's committees (live from DB).
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgMembers, setOrgMembers] = useState(null);
  const [orgMembersLoading, setOrgMembersLoading] = useState(false);
  const [orgMembersError, setOrgMembersError] = useState("");

  // Committee focus: null = platform-wide overview, otherwise the WHOLE
  // Overview section (KPIs, charts, roster) renders this committee's data.
  const [focusCommittee, setFocusCommittee] = useState(null);
  const [focusData, setFocusData] = useState(null); // full committee-scoped overview payload
  const [focusLoading, setFocusLoading] = useState(false);
  const [focusError, setFocusError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(null);

  // Fraud Radar severity filter: "all" | "high" | "medium" | "low"
  const [sevFilter, setSevFilter] = useState("all");
  // System Health: which job's committee-status dropdown is open
  const [openJobDropdown, setOpenJobDropdown] = useState(null);

  const admin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("aitbaar_admin")) || null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!admin) navigate("/admin/login");
  }, [admin, navigate]);

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const [s, o, c, a, sys] = await Promise.all([
        getPlatformStats(),
        getAdminOrganizers(),
        getAdminCommittees(),
        getAdminAnomalies(),
        getSystemHealth().catch(() => null),
      ]);
      setStats(s.stats);
      setOrganizers(o.organizers || []);
      setCommittees(c.committees || []);
      setAnomalies(a.anomalies || []);
      setSystem(sys?.system || null);
    } catch (e) {
      const msg = e.message || "Failed to load admin data";
      if (msg.toLowerCase().includes("not a platform admin") || msg.toLowerCase().includes("authentication")) {
        localStorage.removeItem("aitbaar_admin_token");
        localStorage.removeItem("aitbaar_admin");
        navigate("/admin/login");
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    async function run() {
      await loadAll();
      if (cancelled) return;
    }
    run();
    return () => { cancelled = true; };
  }, [admin, loadAll]);

  function handleLogout() {
    localStorage.removeItem("aitbaar_admin_token");
    localStorage.removeItem("aitbaar_admin");
    navigate("/admin/login");
  }

  function handleCityFilter(e) {
    setCityFilter(e.target.value);
  }

  // Click an organizer row in the registry → load its members below
  async function handleSelectOrganizer(o) {
    if (selectedOrg?.id === o.id) return; // already selected
    setSelectedOrg({ id: o.id, name: o.name });
    setOrgMembers(null);
    setOrgMembersError("");
    setOrgMembersLoading(true);
    try {
      const data = await getOrganizerMembers(o.id);
      setOrgMembers(data);
    } catch (e) {
      setOrgMembersError(e.message || "Failed to load members");
    } finally {
      setOrgMembersLoading(false);
    }
  }

  function clearSelectedOrganizer() {
    setSelectedOrg(null);
    setOrgMembers(null);
    setOrgMembersError("");
  }

  // Click a committee anywhere → the entire Overview section shows its data
  async function handleFocusCommittee(c) {
    setActiveNav("overview");
    setFocusCommittee({ id: c.id, name: c.name, code: c.code });
    setFocusData(null);
    setFocusError("");
    setFocusLoading(true);
    try {
      const data = await getCommitteeOverview(c.id);
      setFocusData(data);
    } catch (e) {
      setFocusError(e.message || "Failed to load committee overview");
    } finally {
      setFocusLoading(false);
    }
  }

  function clearFocusCommittee() {
    setFocusCommittee(null);
    setFocusData(null);
    setFocusError("");
  }

  async function handleOrgStatus(org) {
    const target = org.status === "suspended" ? "active" : "suspended";
    const verb = target === "suspended" ? "suspend" : "reinstate";
    if (!window.confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} organizer "${org.name}"?`)) return;
    setActionBusy(`org-${org.id}`);
    try {
      await setOrganizerStatus(org.id, target);
      await loadAll();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleReview(anomaly, status) {
    setActionBusy(`anm-${anomaly.id}`);
    try {
      await reviewAnomaly(anomaly.id, status);
      await loadAll();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setActionBusy(null);
    }
  }

  /* ── Derived data ── */
  const allCities = useMemo(() => {
    const set = new Set();
    committees.forEach((c) => { if (c.city) set.add(c.city); });
    organizers.forEach((o) => { if (o.city) set.add(o.city); });
    return [...set].sort();
  }, [committees, organizers]);

  const filteredOrganizers = useMemo(() => {
    let list = organizers;
    if (orgFilter !== "all") list = list.filter((o) => (o.status || "active") === orgFilter);
    if (cityFilter !== "all") list = list.filter((o) => o.city === cityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) => o.name?.toLowerCase().includes(q) || o.email?.toLowerCase().includes(q) ||
               o.phone?.includes(q) || o.city?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [organizers, orgFilter, cityFilter, search]);

  const filteredCommittees = useMemo(() => {
    let list = committees;
    if (cityFilter !== "all") list = list.filter((c) => c.city === cityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q) ||
               c.organizer_name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [committees, cityFilter, search]);

  const openAnomalies = useMemo(
    () => anomalies.filter((a) => (a.status || "open") === "open"),
    [anomalies]
  );

  // Fraud Radar list: severity filter applied (no filter → all anomalies)
  const filteredAnomalies = useMemo(() => {
    if (sevFilter === "all") return anomalies;
    return anomalies.filter((a) => a.severity === sevFilter);
  }, [anomalies, sevFilter]);

  const growthTrendPct = useMemo(() => {
    if (!stats?.growth) return null;
    const g = stats.growth;
    const last = g[g.length - 1], prev = g[g.length - 2];
    if (!prev || prev.members === 0) return null;
    return Math.round(((last.members - prev.members) / prev.members) * 100);
  }, [stats]);

  // Shorthand: when a committee is focused, the whole Overview renders from v.
  // When null, scoped selectors fall through to platform-wide stats.
  const v = focusData;

  const scopedTrustDist = useMemo(() => {
    const t = v?.stats?.trustDistribution || stats?.trustDistribution || { high: 0, medium: 0, low: 0 };
    return [
      { name: "High Trust (80+)", value: t.high, color: "#10B981" },
      { name: "Watchlist (50–79)", value: t.medium, color: "#F59E0B" },
      { name: "Quarantine (<50)", value: t.low, color: "#F43F5E" },
    ];
  }, [v, stats]);

  /* ── States ── */
  if (!admin || loading) {
    return (
      <div className="ad-page ad-boot">
        <div className="ad-boot-spinner"><Loader2 size={26} className="ad-spin" /></div>
        <p>Initializing command console…</p>
      </div>
    );
  }

  return (
    <div className="ad-page">
      {sidebarOpen && <div className="ad-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`ad-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="ad-sidebar-inner">
          <div className="ad-sidebar-logo">
            <div className="ad-logo-mark">
              <span className="ad-logo-urdu">اعتبار</span>
            </div>
            <div>
              <span className="ad-logo-text">Aitbaar</span>
              <span className="ad-logo-sub">Root-Admin Console</span>
            </div>
            <button className="ad-sidebar-close" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <nav className="ad-nav">
            {NAV_ITEMS.map((item) => {
              const badge =
                item.key === "anomalies" ? openAnomalies.length :
                item.key === "organizers" ? organizers.filter((o) => o.status === "suspended").length : 0;
              return (
                <button
                  key={item.key}
                  onClick={() => { setActiveNav(item.key); setSidebarOpen(false); }}
                  className={`ad-nav-item ${activeNav === item.key ? "active" : ""}`}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                  {badge > 0 && <span className={`ad-nav-badge ${item.key === "anomalies" ? "red" : ""}`}>{badge}</span>}
                </button>
              );
            })}
          </nav>

          <div className="ad-nav-footer">
            <div className="ad-health-mini">
              <span className="ad-health-dot" />
              <span>{system?.database?.ok ? `DB online · ${system.database.latencyMs}ms` : "DB unreachable"}</span>
            </div>
          </div>
        </div>

        <div className="ad-sidebar-user">
          <div className="ad-user-avatar" style={{ background: getAvatarColor(admin?.name) }}>
            {getInitials(admin?.name)}
          </div>
          <div className="ad-user-info">
            <p className="ad-user-name">{admin?.name}</p>
            <p className="ad-user-role">{(admin?.role || "admin").replace("_", " ")}</p>
          </div>
          <button onClick={handleLogout} className="ad-logout-btn" title="Log out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="ad-main">
        <header className="ad-topbar">
          <div className="ad-topbar-left">
            <button className="ad-hamburger" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div>
              <h1 className="ad-title">
                {NAV_ITEMS.find((n) => n.key === activeNav)?.label}
              </h1>
              <p className="ad-title-sub">Aitbaar platform administration</p>
            </div>
          </div>

          <div className="ad-topbar-right">
            <div className="ad-search">
              <Search size={14} />
              <input
                placeholder="Search organizer, committee, code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="ad-search-clear" onClick={() => setSearch("") }><X size={12} /></button>
              )}
            </div>
            <select
              className="ad-city-select"
              value={cityFilter}
              onChange={handleCityFilter}
              title="Filter by city"
            >
              <option value="all">All Cities</option>
              {allCities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="ad-topbar-icon" onClick={() => loadAll()} title="Refresh data">
              <RefreshCw size={15} />
            </button>
            <div className="ad-notif-wrapper">
              <button className="ad-topbar-icon" onClick={() => setShowNotif(!showNotif)}>
                <Bell size={15} />
                {openAnomalies.length > 0 && <span className="ad-topbar-dot">{openAnomalies.length}</span>}
              </button>
              {showNotif && (
                <div className="ad-notif-pop">
                  <p className="ad-notif-title">Active Fraud Flags</p>
                  {openAnomalies.length === 0 && <p className="ad-notif-empty">No open anomalies.</p>}
                  {openAnomalies.slice(0, 4).map((a) => (
                    <div key={a.id} className="ad-notif-item">
                      <ShieldAlert size={13} className={`ad-notif-icon ${a.severity === "high" ? "crit" : "warn"}`} />
                      <div>
                        <p>{a.reason}</p>
                        <span>{a.committees?.code || "—"} · {timeAgo(a.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="ad-logout-pill" onClick={handleLogout}>
              <Lock size={12} /> Lock
            </button>
          </div>
        </header>

        {error && (
          <div className="ad-error-banner">
            <ShieldAlert size={15} />
            <span>{error}</span>
            <button onClick={loadAll}>Retry</button>
          </div>
        )}

        {/* ═══ OVERVIEW ═══ */}
        {activeNav === "overview" && stats && (
          <div className="ad-content">
            {focusCommittee && (
              <div className="ad-focus-banner">
                <div className="ad-focus-banner-left">
                  <div className="ad-avatar" style={{ background: getAvatarColor(focusCommittee.name) }}>
                    {getInitials(focusCommittee.name)}
                  </div>
                  <div>
                    <p className="ad-focus-banner-name">
                      {focusData?.committee?.name || focusCommittee.name}
                      {focusData?.committee?.city && <span className="ad-city-pill" style={{ marginLeft: 8 }}>{focusData.committee.city}</span>}
                    </p>
                    <p className="ad-focus-banner-sub">
                      {focusData
                        ? `${focusData.committee.code} · Organizer: ${focusData.committee.organizer_name} · ₨ ${focusData.committee.monthly_amount}/mo · ${focusData.committee.duration_months} months`
                        : "Loading committee…"}
                    </p>
                  </div>
                </div>
                <button className="ad-focus-banner-clear" onClick={clearFocusCommittee}>
                  <X size={13} /> Show all platform data
                </button>
              </div>
            )}
            {/* KPIs: committee-scoped when focused, platform-wide otherwise */}
            <div className="ad-kpi-row">
              {v ? (
                <>
                  <KpiCard icon={Users} label="Members" value={v.stats.totalMembers}
                    sub={`of ${v.committee.total_members ?? "—"} seats`} tone={{ bg: "rgba(99,102,241,.12)", fg: "#818CF8" }} />
                  <KpiCard icon={Activity} label="Avg Trust Score" value={v.stats.avgTrust ?? "—"}
                    sub="this committee" tone={{ bg: "rgba(139,92,246,.12)", fg: "#A78BFA" }} />
                  <KpiCard icon={Wallet} label="Collected" value={fmtRs(v.stats.collected)}
                    sub={`of ${fmtRs(v.stats.expectedTotal)} expected`} tone={{ bg: "rgba(245,158,11,.12)", fg: "#FBBF24" }} />
                  <KpiCard icon={Building2} label="Progress" value={`${v.stats.progressPct}%`}
                    sub={`month ${v.stats.monthsElapsed} of ${v.committee.duration_months}`} tone={{ bg: "rgba(16,185,129,.12)", fg: "#34D399" }} />
                </>
              ) : (
                <>
                  <KpiCard icon={Users} label="Organizers" value={stats.totalOrganizers}
                    sub={`${stats.suspendedOrganizers} suspended`} tone={{ bg: "rgba(99,102,241,.12)", fg: "#818CF8" }} />
                  <KpiCard icon={Building2} label="Active Committees" value={stats.activeCommittees}
                    sub="across platform" tone={{ bg: "rgba(16,185,129,.12)", fg: "#34D399" }} />
                  <KpiCard icon={Globe} label="Total Members" value={stats.totalMembers.toLocaleString()}
                    sub="in all committees" tone={{ bg: "rgba(139,92,246,.12)", fg: "#A78BFA" }}
                    trend={growthTrendPct} />
                  <KpiCard icon={Wallet} label="Volume Tracked" value={fmtRs(stats.totalVolume)}
                    sub="confirmed payments" tone={{ bg: "rgba(245,158,11,.12)", fg: "#FBBF24" }} />
                </>
              )}
            </div>

            <div className="ad-kpi-row ad-kpi-row-secondary">
              <KpiCard icon={ShieldCheck} label="Pending Verifications" value={v ? v.stats.pendingVerifications : stats.pendingVerifications}
                sub="this month" tone={{ bg: "rgba(6,182,212,.12)", fg: "#22D3EE" }} />
              <KpiCard icon={ShieldAlert} label="Open Anomalies" value={v ? v.stats.openAnomalies : stats.openAnomalies}
                sub={`${v ? v.stats.criticalAnomalies : stats.criticalAnomalies} critical`} tone={{ bg: "rgba(244,63,94,.12)", fg: "#FB7185" }} />
              <KpiCard icon={CheckCircle2} label="Confirmed Payments" value={(v ? v.stats.confirmedPayments : stats.confirmedPayments ?? 0).toLocaleString()}
                sub={`${v ? v.stats.rejectedPayments : stats.rejectedPayments ?? 0} rejected all-time`} tone={{ bg: "rgba(16,185,129,.12)", fg: "#34D399" }} />
              {v ? (
                <KpiCard icon={Globe} label="Monthly Amount" value={fmtRs(v.committee.monthly_amount)}
                  sub={`× ${v.committee.total_members ?? "—"} members`} tone={{ bg: "rgba(245,158,11,.12)", fg: "#FBBF24" }} />
              ) : (
                <KpiCard icon={Activity} label="Avg Trust Score" value={stats.avgTrust ?? "—"}
                  sub="across all members" tone={{ bg: "rgba(245,158,11,.12)", fg: "#FBBF24" }} />
              )}
            </div>

            <div className="ad-charts-row">
              <div className="ad-chart-card">
                <div className="ad-chart-head">
                  <h3>Member Growth</h3>
                  <span className="ad-chart-chip">Last 6 months{v ? ` · ${v.committee.name}` : ""}</span>
                </div>
                {(v ? v.stats.growth : stats.growth).some((g) => g.members > 0 || (!v && g.committees > 0)) ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={stats.growth}>
                      <defs>
                        <linearGradient id="adGradGold" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E2C47" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={adTooltipStyle} />
                      <Area type="monotone" dataKey="members" stroke="#F59E0B" strokeWidth={2.5} fill="url(#adGradGold)" name="New members" />
                      {!v && <Area type="monotone" dataKey="committees" stroke="#10B981" strokeWidth={2} fill="none" name="New committees" />}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="ad-empty-text">Not enough data yet — growth chart fills as members join.</p>
                )}
              </div>

              <div className="ad-chart-card">
                <div className="ad-chart-head">
                  <h3>Payment Flow</h3>
                  {focusCommittee ? (
                    <div className="ad-focus-chip">
                      <span className="ad-focus-dot" />
                      <span className="ad-focus-name" title={focusCommittee.code}>
                        {focusCommittee.name}
                      </span>
                      {focusData?.stats && (
                        <span className="ad-focus-total">{fmtRs(focusData.stats.collected)} collected</span>
                      )}
                      <button className="ad-focus-clear" onClick={clearFocusCommittee} title="Back to platform-wide">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="ad-legend">
                      <span><i style={{ background: "#10B981" }} />Confirmed</span>
                      <span><i style={{ background: "#F59E0B" }} />Pending</span>
                      <span><i style={{ background: "#F43F5E" }} />Rejected</span>
                    </div>
                  )}
                </div>
                {focusError ? (
                  <p className="ad-empty-text">⚠ {focusError}</p>
                ) : focusLoading ? (
                  <div className="ad-chart-loading"><Loader2 size={20} className="ad-spin" /> Loading committee data…</div>
                ) : v ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={v.stats.paymentTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E2C47" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={adTooltipStyle} />
                      <Bar dataKey="confirmed" stackId="a" fill="#10B981" radius={[3,3,0,0]} name="Confirmed" />
                      <Bar dataKey="pending" stackId="a" fill="#F59E0B" radius={[3,3,0,0]} name="Pending" />
                      <Bar dataKey="rejected" stackId="a" fill="#F43F5E" radius={[3,3,0,0]} name="Rejected" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : stats.paymentTrend.some((m) => m.confirmed + m.pending + m.rejected > 0) ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={stats.paymentTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E2C47" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={adTooltipStyle} />
                      <Bar dataKey="confirmed" stackId="a" fill="#10B981" radius={[3,3,0,0]} />
                      <Bar dataKey="pending" stackId="a" fill="#F59E0B" radius={[3,3,0,0]} />
                      <Bar dataKey="rejected" stackId="a" fill="#F43F5E" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="ad-empty-text">No payment records yet.</p>
                )}
                {focusCommittee == null && (
                  <p className="ad-chart-hint">Tip: click any committee in Oversight or Top Committees to focus the whole overview on it.</p>
                )}
              </div>
            </div>

            <div className="ad-bottom-row">
              <div className="ad-chart-card">
                <div className="ad-chart-head"><h3>Member Trust Distribution{v ? ` · ${v.committee.name}` : ""}</h3></div>
                {scopedTrustDist.some((d) => d.value > 0) ? (
                  <>
                    <ResponsiveContainer width="100%" height={185}>
                      <PieChart>
                        <Pie data={scopedTrustDist} dataKey="value" nameKey="name" innerRadius={46} outerRadius={70} paddingAngle={3} stroke="none">
                          {scopedTrustDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={adTooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="ad-legend ad-legend-center">
                      {scopedTrustDist.map((d) => (
                        <span key={d.name}><i style={{ background: d.color }} />{d.name} · {d.value.toLocaleString()}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="ad-empty-text">No members scored yet.</p>
                )}
              </div>

              <div className="ad-chart-card">
                <div className="ad-chart-head">
                  <h3>{v ? `${v.committee.name} (${v.members.length} Members)` : "Top Committees by Volume"}</h3>
                  {v ? (
              <div className="ad-roster-head-actions">
                      <span className="ad-chart-chip">Paid amounts · trust-sorted</span>
                      <button
                        className="ad-back-btn"
                        onClick={clearFocusCommittee}
                        title="Back to all committees"
                      >
                        <ArrowLeft size={13} /> Back
                      </button>
                    </div>
                  ) : (
                    <Activity size={14} className="ad-muted" />
                  )}
                </div>
                {v ? (
                  v.members.length === 0 ? (
                    <p className="ad-empty-text">No members joined yet.</p>
                  ) : (
                    <div className="ad-top-list">
                      {v.members.map((m) => (
                        <div key={m.id} className="ad-top-item">
                          <div className="ad-avatar ad-avatar-sm" style={{ background: getAvatarColor(m.name || m.phone || "?") }}>
                            {getInitials(m.name || m.phone || "?")}
                          </div>
                          <div className="ad-top-info">
                            <p>{m.name || "Unnamed member"}</p>
                            <span>{m.phone || "—"} · {m.paid_count} paid</span>
                          </div>
                          <span className={`ad-trust-pill ${(m.trust ?? 100) >= 80 ? "good" : (m.trust ?? 100) >= 50 ? "mid" : "bad"}`}>
                            {m.trust ?? "—"}
                          </span>
                          <span className="ad-top-value">{fmtRs(m.paid_amount)}</span>
                        </div>
                      ))}
                    </div>
                  )
                ) : committees.length === 0 ? (
                  <p className="ad-empty-text">No committees yet.</p>
                ) : (
                  <div className="ad-top-list">
                    {[...committees].sort((a, b) => (b.collected || 0) - (a.collected || 0)).slice(0, 6).map((c) => (
                      <div
                        key={c.id}
                        className={`ad-top-item ad-clickable ${focusCommittee?.id === c.id ? "selected" : ""}`}
                        onClick={() => handleFocusCommittee(c)}
                        title={`View payment flow for ${c.name}`}
                      >
                        <div className="ad-avatar ad-avatar-sm" style={{ background: getAvatarColor(c.name) }}>
                          {getInitials(c.name)}
                        </div>
                        <div className="ad-top-info">
                          <p>{c.name}</p>
                          <span>{c.code} · {c.organizer_name}</span>
                        </div>
                        <span className="ad-top-value">{fmtRs(c.collected)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ORGANIZERS ═══ */}
        {activeNav === "organizers" && (
          <div className="ad-content">
            <div className="ad-table-card">
              <div className="ad-table-head">
                <h3>Organizer/Member Registry ({filteredOrganizers.length})</h3>
                <div className="ad-filter-group">
                  {["all", "active", "suspended"].map((f) => (
                    <button
                      key={f}
                      className={`ad-filter-chip ${orgFilter === f ? "active" : ""}`}
                      onClick={() => setOrgFilter(f)}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {filteredOrganizers.length === 0 ? (
                <p className="ad-empty-text ad-empty-pad">No organizers match.</p>
              ) : (
                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Organizer</th><th>City</th><th>Committees</th><th>Members</th>
                        <th>Volume</th><th>Avg Trust</th><th>Status</th><th>Joined</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrganizers.map((o) => (
                        <tr
                          key={o.id}
                          className={`ad-row-clickable ${o.status === "suspended" ? "ad-row-flagged" : ""} ${selectedOrg?.id === o.id ? "ad-row-selected" : ""}`}
                          onClick={() => handleSelectOrganizer(o)}
                          title={`Show all members of ${o.name}`}
                        >
                          <td>
                            <div className="ad-cell-member">
                              <div className="ad-avatar" style={{ background: getAvatarColor(o.name) }}>
                                {getInitials(o.name)}
                              </div>
                              <div>
                                <p className="ad-cell-name">{o.name || "—"}</p>
                                <p className="ad-cell-sub">{o.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="ad-cell-dim">{o.city || "—"}</td>
                          <td className="ad-cell-strong">{o.committee_count} / 3</td>
                          <td>{o.member_count}</td>
                          <td className="ad-cell-strong">{fmtRs(o.volume)}</td>
                          <td><TrustPill score={o.avg_trust} /></td>
                          <td><OrgStatusBadge status={o.status} /></td>
                          <td className="ad-cell-dim">{timeAgo(o.created_at)}</td>
                          <td>
                            <div className="ad-row-actions">
                              <button
                                className={`ad-icon-btn ${o.status === "suspended" ? "approve" : "danger"}`}
                                title={o.status === "suspended" ? "Reinstate" : "Suspend"}
                                disabled={actionBusy === `org-${o.id}`}
                                onClick={() => handleOrgStatus(o)}
                              >
                                {o.status === "suspended" ? <RefreshCw size={13} /> : <Ban size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ═══ Members of the selected organizer (live from DB) ═══ */}
            <div className="ad-table-card">
              <div className="ad-table-head">
                <h3>
                  {selectedOrg
                    ? `${selectedOrg.name} — Members (${orgMembers?.members?.length ?? "…"})`
                    : "Organizer Members"}
                </h3>
                {selectedOrg && (
                  <button className="ad-focus-banner-clear" onClick={clearSelectedOrganizer}>
                    <X size={13} /> Clear selection
                  </button>
                )}
              </div>

              {!selectedOrg ? (
                <p className="ad-empty-text ad-empty-pad">
                  Select an organizer above to see all of their members here.
                </p>
              ) : orgMembersLoading ? (
                <div className="ad-chart-loading"><Loader2 size={20} className="ad-spin" /> Loading members…</div>
              ) : orgMembersError ? (
                <p className="ad-empty-text ad-empty-pad">⚠ {orgMembersError}</p>
              ) : orgMembers && orgMembers.members.length === 0 ? (
                <p className="ad-empty-text ad-empty-pad">
                  No members yet — this organizer has no members in any committee.
                </p>
              ) : orgMembers ? (
                <>
                  <div className="ad-org-member-stats">
                    <span><strong>{orgMembers.stats.committeeCount}</strong> committees</span>
                    <span><strong>{orgMembers.stats.memberCount}</strong> members</span>
                    <span>avg trust <strong>{orgMembers.stats.avgTrust ?? "—"}</strong></span>
                    <span>total paid <strong>{fmtRs(orgMembers.stats.totalPaid)}</strong></span>
                  </div>
                  <div className="ad-table-wrap">
                    <table className="ad-table">
                      <thead>
                        <tr>
                          <th>Member</th><th>Committee</th><th>Trust</th><th>Paid</th><th>Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgMembers.members.map((m) => (
                          <tr key={m.id}>
                            <td>
                              <div className="ad-cell-member">
                                <div className="ad-avatar ad-avatar-sm" style={{ background: getAvatarColor(m.name || m.phone || "?") }}>
                                  {getInitials(m.name || m.phone || "?")}
                                </div>
                                <div>
                                  <p className="ad-cell-name">{m.name || "Unnamed member"}</p>
                                  <p className="ad-cell-sub">{m.phone || "—"}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <p className="ad-cell-name">{m.committee_name}</p>
                              <p className="ad-cell-sub">{m.committee_code}</p>
                            </td>
                            <td>
                              <span className={`ad-trust-pill ${(m.trust ?? 100) >= 80 ? "good" : (m.trust ?? 100) >= 50 ? "mid" : "bad"}`}>
                                {m.trust ?? "—"}
                              </span>
                            </td>
                            <td className="ad-cell-strong">{fmtRs(m.paid_amount)} <span className="ad-cell-dim">· {m.paid_count} paid</span></td>
                            <td className="ad-cell-dim">{timeAgo(m.joined_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* ═══ COMMITTEES ═══ */}
        {activeNav === "committees" && (
          <div className="ad-content">
            <div className="ad-table-card">
              <div className="ad-table-head">
                <h3>Committee Oversight ({filteredCommittees.length})</h3>
                <span className="ad-chart-chip">Click a row → its Payment Flow chart on Executive Telemetry</span>
              </div>
              {filteredCommittees.length === 0 ? (
                <p className="ad-empty-text ad-empty-pad">No committees match.</p>
              ) : (
                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Committee</th><th>City</th><th>Organizer</th><th>Members</th><th>Monthly</th>
                        <th>Progress</th><th>Collected</th><th>Duration</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCommittees.map((c) => {
                        const progress = c.duration_months
                          ? Math.round(((c.months_elapsed || 0) / c.duration_months) * 100)
                          : 0;
                        const isFocused = focusCommittee?.id === c.id;
                        return (
                          <tr
                            key={c.id}
                            className={`ad-row-clickable ${isFocused ? "ad-row-selected" : ""}`}
                            onClick={() => handleFocusCommittee(c)}
                            title={`View payment flow for ${c.name}`}
                          >
                            <td>
                              <p className="ad-cell-name">{c.name}</p>
                              <p className="ad-cell-sub">{c.code}</p>
                            </td>
                            <td>
                              {c.city ? <span className="ad-city-pill">{c.city}</span> : <span className="ad-cell-dim">—</span>}
                            </td>
                            <td className="ad-cell-dim">{c.organizer_name}</td>
                            <td>{c.member_count} / {c.total_members || "—"}</td>
                            <td className="ad-cell-strong">{fmtRs(c.monthly_amount)}</td>
                            <td>
                              <div className="ad-progress-cell">
                                <div className="ad-progress"><div style={{ width: `${progress}%` }} /></div>
                                <span>M{c.months_elapsed || 0}/{c.duration_months}</span>
                              </div>
                            </td>
                            <td className="ad-cell-strong">{fmtRs(c.collected)}</td>
                            <td>
                              <span className="ad-duration-pill">{c.duration_months ? `${c.duration_months} mo` : "—"}</span>
                            </td>
                            <td><ComHealthBadge health={c.health || 0} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ANOMALIES ═══ */}
        {activeNav === "anomalies" && (
          <div className="ad-content">
            <div className="ad-sev-summary">
              <button className={`ad-sev-card crit ad-sev-clickable ${sevFilter === "high" ? "selected" : ""}`} onClick={() => setSevFilter(sevFilter === "high" ? "all" : "high")}>
                <p className="ad-sev-count">{openAnomalies.filter((a) => a.severity === "high").length}</p>
                <p className="ad-sev-label">Critical Open</p>
              </button>
              <button className={`ad-sev-card warn ad-sev-clickable ${sevFilter === "medium" ? "selected" : ""}`} onClick={() => setSevFilter(sevFilter === "medium" ? "all" : "medium")}>
                <p className="ad-sev-count">{openAnomalies.filter((a) => a.severity === "medium").length}</p>
                <p className="ad-sev-label">Medium Open</p>
              </button>
              <button className={`ad-sev-card low ad-sev-clickable ${sevFilter === "low" ? "selected" : ""}`} onClick={() => setSevFilter(sevFilter === "low" ? "all" : "low")}>
                <p className="ad-sev-count">{openAnomalies.filter((a) => a.severity === "low").length}</p>
                <p className="ad-sev-label">Low Open</p>
              </button>
              <button className={`ad-sev-card done ad-sev-clickable ${sevFilter === "all" ? "selected" : ""}`} onClick={() => setSevFilter("all")} title="Show all anomalies">
                <p className="ad-sev-count">{anomalies.filter((a) => (a.status || "open") !== "open").length}</p>
                <p className="ad-sev-label">Reviewed Total</p>
              </button>
            </div>

            <div className="ad-table-card">
              <div className="ad-table-head">
                <h3>All Anomalies ({filteredAnomalies.length})</h3>
                <span className="ad-chart-chip">Platform-wide feed · newest first</span>
              </div>
              {filteredAnomalies.length === 0 ? (
                <p className="ad-empty-text ad-empty-pad">No anomalies recorded.</p>
              ) : (
                <div className="ad-anomaly-list">
                  {filteredAnomalies.map((a) => {
                    const isOpen = (a.status || "open") === "open";
                    const busy = actionBusy === `anm-${a.id}`;
                    return (
                      <div key={a.id} className="ad-anomaly-row">
                        <SevBadge severity={a.severity} />
                        <div className="ad-anomaly-body">
                          <p className="ad-anomaly-text">{a.reason}</p>
                          <p className="ad-anomaly-meta">
                            {a.committees?.code || "—"} · {a.members?.name || a.members?.phone || "Committee-level"} · {timeAgo(a.created_at)}
                            {!isOpen && a.reviewed_by_admin_name && ` · Reviewed by ${a.reviewed_by_admin_name}`}
                          </p>
                        </div>
                        {isOpen ? (
                          <div className="ad-anomaly-actions">
                            <button className="ad-mini-btn approve" disabled={busy} onClick={() => handleReview(a, "resolved")}>
                              <CheckCircle2 size={12} /> Resolve
                            </button>
                            <button className="ad-mini-btn danger" disabled={busy} onClick={() => handleReview(a, "dismissed")}>
                              <XCircle size={12} /> Dismiss
                            </button>
                          </div>
                        ) : (
                          <span className={`ad-reviewed-tag ${a.status === "dismissed" ? "dismissed" : ""}`}>
                            {a.status === "dismissed" ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                            {a.status === "dismissed" ? "Dismissed" : "Resolved"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ SYSTEM ═══ */}
        {activeNav === "system" && (
          <div className="ad-content">
            <div className="ad-kpi-row">
              <KpiCard icon={Database} label="Database" value={system?.database?.ok ? "Supabase" : "Down"}
                sub={system?.database ? `Connected · ${system.database.latencyMs}ms latency` : "—"}
                tone={system?.database?.ok ? { bg: "rgba(16,185,129,.12)", fg: "#34D399" } : { bg: "rgba(244,63,94,.12)", fg: "#FB7185" }} />
              <KpiCard icon={Globe} label="WhatsApp Bot" value={system?.whatsappBot?.ok ? "Online" : "Not Configured"}
                sub={system?.whatsappBot?.label || "—"}
                tone={system?.whatsappBot?.ok ? { bg: "rgba(16,185,129,.12)", fg: "#34D399" } : { bg: "rgba(245,158,11,.12)", fg: "#FBBF24" }} />
              <KpiCard icon={Activity} label="AI Services" value={`${Object.values(system?.aiServices || {}).filter(Boolean).length} / 3`}
                sub="LLM · TTS · STT"
                tone={{ bg: "rgba(139,92,246,.12)", fg: "#A78BFA" }} />
              <KpiCard icon={ShieldCheck} label="Pending Verifications" value={stats?.pendingVerifications ?? "—"}
                sub="across all committees" tone={{ bg: "rgba(6,182,212,.12)", fg: "#22D3EE" }} />
            </div>

            <div className="ad-bottom-row">
              <div className="ad-chart-card">
                <div className="ad-chart-head"><h3>Platform Jobs</h3></div>
                <div className="ad-jobs-list">
                  {(system?.jobs || []).map((j) => {
                    const committeesList = Object.values(j.committeeStatus || {});
                    const isOpen = openJobDropdown === j.key;
                    return (
                      <div key={j.key} className="ad-job-block">
                        <button
                          className={`ad-job-row ad-job-clickable ${isOpen ? "open" : ""}`}
                          onClick={() => setOpenJobDropdown(isOpen ? null : j.key)}
                          title={`Show per-committee status for ${j.name}`}
                        >
                          <CheckCircle2 size={14} className="ad-job-ok" />
                          <div>
                            <p className="ad-job-name">{j.name}</p>
                            <p className="ad-job-sub">{j.schedule}</p>
                          </div>
                          <span className="ad-badge ad-badge-green">Active</span>
                          <span className={`ad-job-chevron ${isOpen ? "up" : ""}`} aria-hidden>▾</span>
                        </button>
                        {isOpen && (
                          <div className="ad-job-committee-dropdown">
                            {committeesList.length === 0 && (
                              <p className="ad-empty-text">No committees yet.</p>
                            )}
                            {committeesList.map((c) => (
                              <div key={c.code} className="ad-job-committee-row">
                                <div className="ad-top-info">
                                  <p>{c.name}</p>
                                  <span>{c.code}</span>
                                </div>
                                <span className={`ad-badge ${c.status === "Success" ? "ad-badge-green" : "ad-badge-gray"}`}>
                                  {c.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!system && <p className="ad-empty-text">System data unavailable.</p>}
                </div>
              </div>

              <div className="ad-chart-card">
                <div className="ad-chart-head"><h3>Recent Admin Activity</h3></div>
                <div className="ad-jobs-list">
                  {(system?.recentActivity || []).length === 0 && (
                    <p className="ad-empty-text">No audit entries yet.</p>
                  )}
                  {(system?.recentActivity || []).map((r, i) => (
                    <div key={i} className="ad-job-row">
                      <Activity size={14} className="ad-muted" />
                      <div>
                        <p className="ad-job-name">{r.action}</p>
                        <p className="ad-job-sub">{timeAgo(r.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const adTooltipStyle = {
  borderRadius: 10,
  border: "1px solid #1E2C47",
  background: "#0C1322",
  color: "#E2E8F0",
  fontSize: 12,
};
