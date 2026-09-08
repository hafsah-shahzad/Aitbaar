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

async function savePaymentRecord({ memberId, committeeId, amount }) {
  const now = new Date();
  const month = now.toLocaleString("en-PK", { month: "long", year: "numeric" });

  // Fetch committee once — needed for both the fallback amount and the due date
  let finalAmount = amount;
  let dueDate = null;
  let isLate = false;
  let daysLate = 0;

  try {
    const { data: committee } = await supabase
      .from("committees")
      .select("monthly_amount, start_date")
      .eq("id", committeeId)
      .maybeSingle();

    if (committee) {
      if (!finalAmount || finalAmount <= 0) {
        finalAmount = committee.monthly_amount || 0;
      }
      if (committee.start_date) {
        const due = getDueDateForNow(committee.start_date, now);
        dueDate = due.toISOString().slice(0, 10);
        const diff = daysBetween(due, now);
        isLate = diff > 0;
        daysLate = Math.max(0, diff);
      }
    }
  } catch (e) {
    console.error("[PAY] Failed to fetch committee for due-date calc:", e.message);
  }

  const { data, error } = await supabase
    .from("payment_records")
    .insert([{
      member_id: memberId,
      committee_id: committeeId,
      amount: finalAmount || 0,
      month,
      status: "pending",
      due_date: dueDate,
      is_late: isLate,
      days_late: daysLate,
    }])
    .select()
    .single();

  if (error) {
    console.error("Error saving payment record:", error.message);
    return null;
  }

  console.log(`Payment claim saved as pending (${isLate ? daysLate + " days late" : "on time"}):`, data);
  return data;
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
    return 100;
  }
  return data?.score ?? 100;
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
};