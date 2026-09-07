const supabase = require("../config/supabaseClient");
const { calculateHealthScore, getHealthStatus, generateHealthSummary } = require("../services/healthScoreService");

async function getDashboardData(req, res) {
  const { committeeId } = req.params;

  try {
    const { data: committee, error: committeeError } = await supabase
      .from("committees")
      .select("*")
      .eq("id", committeeId)
      .single();

    if (committeeError) {
      return res.status(400).json({ success: false, error: committeeError.message });
    }

    const { data: members } = await supabase
      .from("members")
      .select("*")
      .eq("committee_id", committeeId)
      .order("joined_at", { ascending: true });

    const { data: trustScores } = await supabase
      .from("trust_scores")
      .select("*")
      .eq("committee_id", committeeId);

    const currentMonth = new Date().toLocaleString("en-PK", {
      month: "long", year: "numeric",
    });

    const { data: currentPayments } = await supabase
      .from("payment_records")
      .select("*")
      .eq("committee_id", committeeId)
      .eq("month", currentMonth);

    const { data: allPayments } = await supabase
      .from("payment_records")
      .select("*")
      .eq("committee_id", committeeId);

    const { data: anomalies } = await supabase
      .from("anomaly_flags")
      .select("*, members(phone, name)")
      .eq("committee_id", committeeId)
      .order("created_at", { ascending: false })
      .limit(5);

    // Merge member data
    const membersWithScores = (members || []).map((member) => {
      const scoreRecord = (trustScores || []).find((ts) => ts.member_id === member.id);
      const hasPaidThisMonth = (currentPayments || []).some(
        (p) => p.member_id === member.id && p.status !== "rejected"
      );
      const totalPaymentsMade = (allPayments || []).filter(
        (p) => p.member_id === member.id && p.status === "confirmed"
      ).length;
      return {
        ...member,
        trust_score: scoreRecord?.score ?? 100,
        paid_this_month: hasPaidThisMonth,
        total_payments_made: totalPaymentsMade,
      };
    });

    const totalMembers = membersWithScores.length;
    const paidCount = membersWithScores.filter((m) => m.paid_this_month).length;

    const confirmedPaymentsTotal = (allPayments || []).filter(
      (p) => p.status === "confirmed"
    ).length;

    const rejectedPaymentsTotal = (allPayments || []).filter(
      (p) => p.status === "rejected"
    ).length;

    const totalCollected = (allPayments || [])
      .filter((p) => p.status === "confirmed")
      .reduce((sum, p) => sum + (p.amount || committee.monthly_amount || 0), 0);

    const thisMonthCollected = (currentPayments || [])
      .filter((p) => p.status !== "rejected")
      .reduce((sum, p) => sum + (p.amount || committee.monthly_amount || 0), 0);

    const avgTrustScore = totalMembers > 0
      ? Math.round(membersWithScores.reduce((sum, m) => sum + m.trust_score, 0) / totalMembers)
      : 100;

    const collectionRate = totalMembers > 0
      ? Math.round((paidCount / totalMembers) * 100)
      : 0;

    const startDate = committee.start_date ? new Date(committee.start_date) : new Date();
    const now = new Date();
    const monthsElapsed = Math.max(0, Math.min(
      committee.duration_months,
      (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth())
    ));
    const progressPercent = Math.round((monthsElapsed / committee.duration_months) * 100);

    const nextPayoutIndex = totalMembers > 0 ? monthsElapsed % totalMembers : 0;
    const nextPayoutMember = membersWithScores[nextPayoutIndex];

    // ── HEALTH SCORE ──────────────────────────────
    const anomalyCount = (anomalies || []).length;

    const healthScore = calculateHealthScore({
      avgTrustScore,
      collectionRate,
      anomalyCount,
      totalMembers,
      confirmedPaymentsTotal,
      rejectedPaymentsTotal,
      monthsElapsed,
      durationMonths: committee.duration_months,
    });

    const healthStatus = getHealthStatus(healthScore);

    // Generate Gemini summary (non-blocking)
    const healthSummary = await generateHealthSummary(healthScore, healthStatus, {
      avgTrustScore,
      collectionRate,
      anomalyCount,
      totalMembers,
      monthsElapsed,
      durationMonths: committee.duration_months,
    });

    const paymentTrend = buildPaymentTrend(allPayments || [], totalMembers);

    const trustDistribution = {
      high: membersWithScores.filter((m) => m.trust_score >= 80).length,
      medium: membersWithScores.filter((m) => m.trust_score >= 50 && m.trust_score < 80).length,
      low: membersWithScores.filter((m) => m.trust_score < 50).length,
    };

    res.json({
      success: true,
      committee,
      health: {
        score: healthScore,
        status: healthStatus,
        summary: healthSummary,
      },
      kpis: {
        totalMembers,
        paidThisMonth: paidCount,
        pendingThisMonth: totalMembers - paidCount,
        totalCollected,
        thisMonthCollected,
        avgTrustScore,
        activeFlags: anomalyCount,
        collectionRate,
        monthsElapsed,
        progressPercent,
      },
      nextPayoutMember: nextPayoutMember || null,
      members: membersWithScores,
      anomalies: anomalies || [],
      paymentTrend,
      trustDistribution,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function buildPaymentTrend(payments, totalMembers) {
  const months = [];
  for (let i = 3; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthName = date.toLocaleString("en-PK", { month: "short", year: "numeric" });
    const fullMonthName = date.toLocaleString("en-PK", { month: "long", year: "numeric" });
    const paidThisMonth = payments.filter(
      (p) => p.month === fullMonthName && p.status !== "rejected"
    ).length;
    months.push({
      month: monthName,
      paid: paidThisMonth,
      pending: Math.max(0, totalMembers - paidThisMonth),
    });
  }
  return months;
}

module.exports = { getDashboardData };