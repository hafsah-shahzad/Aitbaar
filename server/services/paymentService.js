const supabase = require("../config/supabaseClient");

// ── Due date logic ──
// The due date for any given month is the same day-of-month as the
// committee's start_date, clamped to the length of that month
// (e.g. start_date on the 31st becomes the 28th/29th in February).
function getDueDateForNow(startDate, referenceDate) {
  const start = new Date(startDate);
  const ref = new Date(referenceDate);

  const monthsSinceStart =
    (ref.getFullYear() - start.getFullYear()) * 12 +
    (ref.getMonth() - start.getMonth());

  const targetMonthRaw = start.getMonth() + monthsSinceStart;
  const targetYear = start.getFullYear() + Math.floor(targetMonthRaw / 12);
  const targetMonth = ((targetMonthRaw % 12) + 12) % 12;

  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(start.getDate(), lastDayOfTargetMonth);

  return new Date(targetYear, targetMonth, day);
}

function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const aDate = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bDate = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bDate - aDate) / msPerDay);
}

// Returns the due date for the Nth cycle (0-indexed) of a committee,
// clamping to the last valid day of that month (e.g. start on the 31st
// becomes the 28th/29th in February).
function getDueDateForCycle(startDate, cycleIndex) {
  const start = new Date(startDate);
  const targetMonthRaw = start.getMonth() + cycleIndex;
  const targetYear = start.getFullYear() + Math.floor(targetMonthRaw / 12);
  const targetMonth = ((targetMonthRaw % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(start.getDate(), lastDay);
  return new Date(targetYear, targetMonth, day);
}

// Finds which cycle (month) a new payment claim should actually count
// toward — the first cycle that doesn't already have a pending/confirmed
// claim. This is what makes a 2nd payment in the same month roll forward
// to next month instead of creating a duplicate record for the same month.
async function findTargetCycle(memberId, committeeId) {
  const { data: committee } = await supabase
    .from("committees")
    .select("start_date, duration_months, monthly_amount")
    .eq("id", committeeId)
    .maybeSingle();

  if (!committee || !committee.start_date) return null;

  const { data: payments } = await supabase
    .from("payment_records")
    .select("month, status")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .in("status", ["pending", "confirmed"]);

  const claimedMonths = new Set((payments || []).map((p) => p.month));
  const durationMonths = committee.duration_months || 12;

  for (let i = 0; i < durationMonths; i++) {
    const dueDate = getDueDateForCycle(committee.start_date, i);
    const monthLabel = dueDate.toLocaleString("en-PK", { month: "long", year: "numeric" });
    if (!claimedMonths.has(monthLabel)) {
      return { monthLabel, dueDate, monthlyAmount: committee.monthly_amount };
    }
  }

  // Every cycle already claimed — fall back to the last one rather than crash
  const lastIndex = durationMonths - 1;
  const dueDate = getDueDateForCycle(committee.start_date, lastIndex);
  return {
    monthLabel: dueDate.toLocaleString("en-PK", { month: "long", year: "numeric" }),
    dueDate,
    monthlyAmount: committee.monthly_amount,
    allCyclesClaimed: true,
  };
}

// Finds the member's next unpaid cycle — walking forward from the
// committee's own start date, not from "today". Returns whether that
// cycle is upcoming or already overdue.
async function getNextPaymentInfo(memberId, committeeId) {
  const { data: committee } = await supabase
    .from("committees")
    .select("name, start_date, duration_months, monthly_amount")
    .eq("id", committeeId)
    .maybeSingle();

  if (!committee || !committee.start_date) return { found: false };

  const { data: payments } = await supabase
    .from("payment_records")
    .select("month, status")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .in("status", ["pending", "confirmed"]);

  const paidMonths = new Set((payments || []).map((p) => p.month));
  const today = new Date();
  const durationMonths = committee.duration_months || 12;

  for (let i = 0; i < durationMonths; i++) {
    const dueDate = getDueDateForCycle(committee.start_date, i);
    const monthLabel = dueDate.toLocaleString("en-PK", { month: "long", year: "numeric" });

    if (paidMonths.has(monthLabel)) continue; // already paid/claimed — check next cycle

    const diffDays = daysBetween(dueDate, today); // positive if due date has passed
    return {
      found: true,
      committee_name: committee.name,
      monthly_amount: committee.monthly_amount,
      due_date: dueDate.toISOString().slice(0, 10),
      is_overdue: diffDays > 0,
      days_overdue: diffDays > 0 ? diffDays : 0,
      days_until_due: diffDays <= 0 ? Math.abs(diffDays) : 0,
    };
  }

  return { found: true, all_cycles_paid: true, committee_name: committee.name };
}

async function savePaymentRecord({ memberId, committeeId, amount }) {
  const now = new Date();

  let finalAmount = amount;
  let month;
  let dueDateStr = null;
  let isLate = false;
  let daysLate = 0;
  let rolledForward = false;
  let previousCycleMonth = null;

  try {
    const target = await findTargetCycle(memberId, committeeId);

    if (target) {
      month = target.monthLabel;
      dueDateStr = target.dueDate.toISOString().slice(0, 10);
      const diff = daysBetween(target.dueDate, now);
      isLate = diff > 0;
      daysLate = Math.max(0, diff);
      if (!finalAmount || finalAmount <= 0) finalAmount = target.monthlyAmount || 0;

      // Check whether this differs from what "today's natural month" would
      // be — if so, the natural month was already claimed, and this
      // payment is being rolled forward to the next unclaimed cycle.
      const { data: committee } = await supabase.from("committees").select("start_date").eq("id", committeeId).maybeSingle();
      if (committee && committee.start_date) {
        const naturalDue = getDueDateForNow(committee.start_date, now);
        const naturalMonth = naturalDue.toLocaleString("en-PK", { month: "long", year: "numeric" });
        if (naturalMonth !== target.monthLabel) {
          rolledForward = true;
          previousCycleMonth = naturalMonth;
        }
      }
    } else {
      month = now.toLocaleString("en-PK", { month: "long", year: "numeric" });
    }
  } catch (e) {
    console.error("[PAY] Failed to determine target cycle:", e.message);
    month = now.toLocaleString("en-PK", { month: "long", year: "numeric" });
  }

  const { data, error } = await supabase
    .from("payment_records")
    .insert([{
      member_id: memberId,
      committee_id: committeeId,
      amount: finalAmount || 0,
      month,
      status: "pending",
      due_date: dueDateStr,
      is_late: isLate,
      days_late: daysLate,
    }])
    .select()
    .single();

  if (error) {
    console.error("Error saving payment record:", error.message);
    return null;
  }

  console.log(`Payment claim saved as pending for ${month} (${isLate ? daysLate + " days late" : "on time"})${rolledForward ? " [rolled forward from " + previousCycleMonth + "]" : ""}:`, data);
  return { ...data, rolledForward, previousCycleMonth };
}

async function verifyPayment(paymentId) {
  const { data: payment, error: paymentError } = await supabase
    .from("payment_records")
    .select("*")
    .eq("id", paymentId)
    .single();

  if (paymentError || !payment) {
    console.error("Payment not found:", paymentError?.message);
    return { success: false, error: "Payment not found" };
  }
  if (payment.status === "confirmed") {
    return { success: false, error: "Payment already confirmed" };
  }

  const { data: updatedPayment, error } = await supabase
    .from("payment_records")
    .update({ status: "confirmed" })
    .eq("id", paymentId)
    .select()
    .single();

  if (error) {
    console.error("Error verifying payment:", error.message);
    return { success: false, error: error.message };
  }

  const { recalculateTrustScore } = require("./trustScoreCalculator");
  const newScore = await recalculateTrustScore(payment.member_id, payment.committee_id);
  console.log(`Payment verified. Trust score recalculated to ${newScore}`);

  return { success: true, payment: updatedPayment, newScore };
}

async function rejectPayment(paymentId) {
  const { data: payment } = await supabase.from("payment_records").select("member_id, committee_id").eq("id", paymentId).single();

  const { data, error } = await supabase
    .from("payment_records")
    .update({ status: "rejected" })
    .eq("id", paymentId)
    .select()
    .single();

  if (error) {
    console.error("Error rejecting payment:", error.message);
    return { success: false, error: error.message };
  }

  if (payment) {
    const { recalculateTrustScore } = require("./trustScoreCalculator");
    await recalculateTrustScore(payment.member_id, payment.committee_id);
  }

  return { success: true, payment: data };
}

async function getTrustScore(memberId, committeeId) {
  const { data, error } = await supabase
    .from("trust_scores")
    .select("score")
    .eq("member_id", memberId)
    .eq("committee_id", committeeId)
    .maybeSingle();

  if (error) {
    console.error("Error getting trust score:", error.message);
    return 0;
  }
  return data?.score ?? 0;
}

async function getPendingPayments(committeeId) {
  const { data, error } = await supabase
    .from("payment_records")
    .select(`*, members ( id, name, phone )`)
    .eq("committee_id", committeeId)
    .eq("status", "pending")
    .order("month", { ascending: false });

  if (error) {
    console.error("Error getting pending payments:", error.message);
    return [];
  }
  return data || [];
}

module.exports = {
  savePaymentRecord,
  verifyPayment,
  rejectPayment,
  getTrustScore,
  getPendingPayments,
  getDueDateForNow,
  getDueDateForCycle,
  getNextPaymentInfo,
  findTargetCycle,
};