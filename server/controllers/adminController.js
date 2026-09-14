const supabase = require("../config/supabaseClient");

// ════════════════════════════════════════════════════════════
// Platform Admin Controllers — cross-organizer oversight data.
// Auth is env-based (ADMIN_EMAIL/ADMIN_PASSWORD + signed tokens);
// no admins table is required.
// ════════════════════════════════════════════════════════════

const MONTH_FMT = { month: "long", year: "numeric" };

// GET /api/admin/stats — KPI tiles + growth/payment trend + trust distribution
async function getPlatformStats(req, res) {
  try {
    const [
      organizersRes, committeesRes, membersRes, paymentsRes, anomaliesRes,
    ] = await Promise.all([
      supabase.from("organizers").select("id, created_at"),
      supabase.from("committees").select("id, monthly_amount, duration_months, start_date, created_at"),
      supabase.from("members").select("id, committee_id, joined_at"),
      supabase.from("payment_records").select("id, member_id, amount, status, month, committee_id"),
      supabase.from("anomaly_flags").select("id, severity, created_at"),
    ]);

    const organizers = organizersRes.data || [];
    const committees = committeesRes.data || [];
    const members = membersRes.data || [];
    const payments = paymentsRes.data || [];
    const anomalies = anomaliesRes.data || [];

    // Trust scores joined to members
    const { data: trustScores } = await supabase.from("trust_scores").select("member_id, score");
    const scoreByMember = {};
    (trustScores || []).forEach((t) => { scoreByMember[t.member_id] = t.score ?? 100; });

    const memberIds = new Set(members.map((m) => m.id));

    const confirmed = payments.filter((p) => p.status === "confirmed" && memberIds.has(p.member_id));
    const totalVolume = confirmed.reduce((s, p) => s + (p.amount || 0), 0);
    const pendingNow = payments.filter((p) =>
      p.status === "pending" && memberIds.has(p.member_id) &&
      p.month === new Date().toLocaleString("en-PK", MONTH_FMT)
    ).length;
    const openAnomalies = anomalies; // no review-state column — all flags count as open

    // 6-month growth series (members + committees created)
    const growth = [];
    const paymentTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString("en-PK", { month: "short" });
      const monthKey = d.toLocaleString("en-PK", MONTH_FMT);
      const next = new Date(d);
      next.setMonth(next.getMonth() + 1);

      const inMonth = (dateStr) => {
        if (!dateStr) return false;
        const dt = new Date(dateStr);
        return dt >= d && dt < next;
      };

      growth.push({
        month: label,
        members: members.filter((m) => inMonth(m.joined_at)).length,
        committees: committees.filter((c) => inMonth(c.created_at)).length,
      });
      paymentTrend.push({
        month: label,
        confirmed: payments.filter((p) => p.month === monthKey && p.status === "confirmed").length,
        pending: payments.filter((p) => p.month === monthKey && p.status === "pending").length,
        rejected: payments.filter((p) => p.month === monthKey && p.status === "rejected").length,
      });
    }

    const trustDist = { high: 0, medium: 0, low: 0 };
      let trustSum = 0;
    members.forEach((m) => {
      const s = scoreByMember[m.id] ?? 100;
      if (s >= 80) trustDist.high++;
      else if (s >= 50) trustDist.medium++;
      else trustDist.low++;
    });
    const avgTrust = members.length > 0 ? Math.round(trustSum / members.length) : null;
    res.json({
      success: true,
      stats: {
        totalOrganizers: organizers.length,
        suspendedOrganizers: 0, // suspension needs optional migration 013 (organizers.status)
        activeCommittees: committees.length,
        totalMembers: members.length,
        totalVolume,
        pendingVerifications: pendingNow,
        openAnomalies: openAnomalies.length,
        criticalAnomalies: openAnomalies.filter((a) => a.severity === "high").length,
     confirmedPayments: confirmed.length,
        rejectedPayments: payments.filter((p) => p.status === "rejected" && memberIds.has(p.member_id)).length,
        avgTrust,
        growth,
        paymentTrend,
        trustDistribution: trustDist,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/admin/organizers — enriched roster with per-organizer rollups
async function getOrganizers(req, res) {
  try {
    const { data: organizers, error } = await supabase
      .from("organizers")
      .select("id, name, email, phone, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });

    const { data: committees } = await supabase
      .from("committees")
      .select("id, organizer_id, monthly_amount, duration_months, start_date");
    const { data: members } = await supabase.from("members").select("id, committee_id");
    const { data: trustScores } = await supabase.from("trust_scores").select("member_id, score, committee_id");
    const { data: payments } = await supabase
      .from("payment_records")
      .select("member_id, amount, status");

    const memberById = {};
    (members || []).forEach((m) => { memberById[m.id] = m; });
    const scoreByMember = {};
    (trustScores || []).forEach((t) => { scoreByMember[t.member_id] = t.score ?? 100; });

    const enriched = (organizers || []).map((o) => {
      const myCommittees = (committees || []).filter((c) => c.organizer_id === o.id);
      const myCommitteeIds = new Set(myCommittees.map((c) => c.id));
      const myMembers = (members || []).filter((m) => myCommitteeIds.has(m.committee_id));
      const myScores = (trustScores || []).filter((t) => myCommitteeIds.has(t.committee_id));
      const avgTrust = myScores.length
        ? Math.round(myScores.reduce((s, t) => s + (t.score ?? 100), 0) / myScores.length)
        : null;
      const myVolume = (payments || []).filter((p) => p.status === "confirmed" && myMembers.some((m) => m.id === p.member_id))
        .reduce((s, p) => s + (p.amount || 0), 0);

      return {
        ...o,
        committee_count: myCommittees.length,
        member_count: myMembers.length,
        avg_trust: avgTrust,
        volume: myVolume,
        flagged: myScores.some((t) => (t.score ?? 100) < 50),
      };
    });

    res.json({ success: true, organizers: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// PATCH /api/admin/organizers/:id/status  { status: "active" | "suspended" }
// NOTE: requires the optional organizers.status column (migration 013).
async function setOrganizerStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ success: false, error: "status must be 'active' or 'suspended'." });
    }

    const { data, error } = await supabase
      .from("organizers")
      .update({ status })
      .eq("id", id)
      .select("id, name, status")
      .single();

    if (error) {
      if (error.code === "PGRST116" || error.message.includes("Cannot coerce")) {
        return res.status(404).json({ success: false, error: "Organizer not found." });
      }
      if (error.message.includes("column") || error.message.includes("status")) {
        return res.status(400).json({
          success: false,
          error: "Suspension requires the optional migration (server/migrations/013_admin_console.sql). Run it in Supabase to enable this action.",
        });
      }
      return res.status(400).json({ success: false, error: error.message });
    }

    // Audit log (best-effort)
    await supabase.from("payout_audit_log").insert([{
      committee_id: null,
      action: `admin:${status === "suspended" ? "suspend" : "reinstate"}_organizer`,
      actor: req.admin?.email || "platform-admin",
      details: { organizer_id: id, name: data?.name },
    }]).then(null, () => {});

    res.json({ success: true, organizer: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/admin/committees — all committees with organizer + health rollup
async function getCommittees(req, res) {
  try {
    const { data: committees, error } = await supabase
      .from("committees")
      .select("id, code, name, monthly_amount, total_members, duration_months, start_date, organizer_id, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });

    const { data: organizers } = await supabase.from("organizers").select("id, name");
    const { data: members } = await supabase.from("members").select("id, committee_id");
    const { data: payments } = await supabase
      .from("payment_records")
      .select("committee_id, member_id, amount, status");
    const { data: anomalies } = await supabase
      .from("anomaly_flags")
      .select("committee_id");

    const organizerById = {};
    (organizers || []).forEach((o) => { organizerById[o.id] = o.name; });
    const memberIdsByCommittee = {};
    (members || []).forEach((m) => {
      (memberIdsByCommittee[m.committee_id] ||= []).push(m.id);
    });

    const enriched = (committees || []).map((c) => {
      const ids = memberIdsByCommittee[c.id] || [];
      const cPayments = (payments || []).filter((p) => p.committee_id === c.id);
      const confirmed = cPayments.filter((p) => p.status === "confirmed");
      const collected = confirmed.reduce((s, p) => s + (p.amount || c.monthly_amount || 0), 0);

      const startDate = c.start_date ? new Date(c.start_date) : new Date(c.created_at || Date.now());
      const now = new Date();
      const monthsElapsed = Math.max(0, Math.min(
        c.duration_months || 1,
        (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth())
      ));

      const openAnoms = (anomalies || []).filter(
        (a) => a.committee_id === c.id
      ).length;

      // Lightweight health: collection vs elapsed schedule, penalised by open anomalies
      const expected = monthsElapsed * (c.total_members || ids.length || 0) * (c.monthly_amount || 0);
      const collectRatio = expected > 0 ? Math.min(1, collected / expected) : 0.8;
      const health = Math.max(0, Math.round(70 + collectRatio * 30 - openAnoms * 8));

      return {
        ...c,
        organizer_name: organizerById[c.organizer_id] || "—",
        member_count: ids.length,
        months_elapsed: monthsElapsed,
        collected,
        open_anomalies: openAnoms,
        health,
      };
    });

    res.json({ success: true, committees: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/admin/anomalies — platform-wide anomaly feed (with member + committee labels)
// anomaly_flags has two FKs to members, so we resolve names manually instead of embedding.
async function getAnomalies(req, res) {
  try {
    const { data, error } = await supabase
      .from("anomaly_flags")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return res.status(400).json({ success: false, error: error.message });

    const anomalies = data || [];

    // Resolve committee codes
    const committeeIds = [...new Set(anomalies.map((a) => a.committee_id).filter(Boolean))];
    let committeeMap = {};
    if (committeeIds.length > 0) {
      const { data: comms } = await supabase.from("committees").select("id, code, name").in("id", committeeIds);
      (comms || []).forEach((c) => { committeeMap[c.id] = c; });
    }

    // Resolve member names/phones (anomaly_flags.member_id)
    const memberIds = [...new Set(anomalies.map((a) => a.member_id).filter(Boolean))];
    let memberMap = {};
    if (memberIds.length > 0) {
      const { data: mems } = await supabase.from("members").select("id, name, phone").in("id", memberIds);
      (mems || []).forEach((m) => { memberMap[m.id] = m; });
    }

    const enriched = anomalies.map((a) => ({
      ...a,
      committees: a.committee_id ? (committeeMap[a.committee_id] || null) : null,
      members: a.member_id ? (memberMap[a.member_id] || null) : null,
    }));

    res.json({ success: true, anomalies: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// PATCH /api/admin/anomalies/:id  { status: "resolved" | "dismissed" | "open" }
// NOTE: requires the optional anomaly review columns (migration 013).
async function reviewAnomaly(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["open", "resolved", "dismissed"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status." });
    }

    const { data, error } = await supabase
      .from("anomaly_flags")
      .update({
        status,
        reviewed_by_admin: req.admin.email,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) {
      if (error.message.includes("column") || error.message.includes("status")) {
        return res.status(400).json({
          success: false,
          error: "Reviewing requires the optional migration (server/migrations/013_admin_console.sql). Run it in Supabase to enable this action.",
        });
      }
      return res.status(400).json({ success: false, error: error.message });
    }
    res.json({ success: true, anomaly: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/admin/system — jobs + service health snapshot
async function getSystemHealth(req, res) {
  try {
    const started = Date.now();
    const { error: dbError } = await supabase.from("organizers").select("id").limit(1);

    const { data: audits } = await supabase
      .from("payout_audit_log")
      .select("action, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    res.json({
      success: true,
      system: {
        database: {
          ok: !dbError,
          latencyMs: Date.now() - started,
          error: dbError?.message || null,
        },
        whatsappBot: { ok: Boolean(process.env.WHATSAPP_ACCESS_TOKEN), label: "Webhook configured" },
        aiServices: {
          llm: Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY),
          tts: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
          stt: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
        },
        jobs: [
          { name: "Weekly Anomaly Check", schedule: "Every Monday 09:00", ok: true },
          { name: "Monthly Payment Reminders", schedule: "25th of each month 10:00 AM", ok: true },
          { name: "Payment Risk Prediction", schedule: "On demand", ok: true },
        ],
        recentActivity: audits || [],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getPlatformStats,
  getOrganizers,
  setOrganizerStatus,
  getCommittees,
  getAnomalies,
  reviewAnomaly,
  getSystemHealth,
};
