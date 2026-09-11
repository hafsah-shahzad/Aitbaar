// payment/monthlyPaymentReminder.js
//
// Runs daily — checks each committee's due date (based on its own start_date)
// and sends escalating reminders to members who haven't paid yet this month.
// Despite the filename, this must run daily, not on a fixed calendar date,
// because each committee's due date is different (set by its own start_date).
//
// Tier 1: 1-2 days late   — gentle nudge
// Tier 3: 3-5 days late   — firmer reminder
// Tier 6: 6+ days late    — final warning, repeats daily until paid

const cron = require("node-cron");
const supabase = require("../config/supabaseClient");
const { sendWhatsAppMessage } = require("../services/whatsappService");
const { getDueDateForNow } = require("../services/paymentService");

const REMINDER_MESSAGES = {
  1: (name, committee, amount) =>
    `Assalam o Alaikum ${name}, "${committee}" ki is mahine ki Rs ${amount} payment abhi tak record nahi hui. Please jald payment karein.`,
  3: (name, committee, amount) =>
    `${name}, "${committee}" ki Rs ${amount} payment 3 din se pending hai. Please jaldi payment confirm karwayein taake koi masla na ho.`,
  6: (name, committee, amount) =>
    `${name}, "${committee}" ki Rs ${amount} payment ${amount ? "6 din ya us se zyada se" : "kaafi arsay se"} late hai. Is se aapka trust score come ho sakta hai please jaldi payment karein.`,
};

// Picks the highest tier the member currently qualifies for.
// Returns null if not late enough for any tier yet.
function getTierForDaysLate(daysLate) {
  if (daysLate >= 6) return 6;
  if (daysLate >= 3) return 3;
  if (daysLate >= 1) return 1;
  return null;
}

async function checkCommitteeReminders(committee) {
  if (!committee.start_date) return;

  const now = new Date();
  const dueDate = getDueDateForNow(committee.start_date, now);
  const daysLate = Math.round((now - dueDate) / (1000 * 60 * 60 * 24));

  const tier = getTierForDaysLate(daysLate);
  if (tier === null) return;

  const monthLabel = now.toLocaleString("en-PK", { month: "long", year: "numeric" });

  const { data: members } = await supabase
    .from("members")
    .select("id, name, phone")
    .eq("committee_id", committee.id);

  if (!members || members.length === 0) return;

  let sent = 0;

  for (const member of members) {
    const { data: existingPayment } = await supabase
      .from("payment_records")
      .select("id")
      .eq("member_id", member.id)
      .eq("committee_id", committee.id)
      .eq("month", monthLabel)
      .in("status", ["pending", "confirmed"])
      .maybeSingle();

    if (existingPayment) continue;
    if (!member.phone) continue;

    const message = REMINDER_MESSAGES[tier](member.name || "Member", committee.name, committee.monthly_amount || 0);

    try {
      await sendWhatsAppMessage(member.phone, message);
      sent++;
    } catch (err) {
      console.error(`Failed to send reminder to ${member.phone}:`, err.message);
    }
  }

  console.log(`[REMINDER] ${committee.name}: tier ${tier} reminder sent to ${sent} member(s) (${daysLate} days late)`);
}

function startMonthlyPaymentReminder() {
  cron.schedule("0 10 * * *", async () => {  // ← production schedule
  // cron.schedule("*/2 * * * *", async () => { // testing: every 2 minutes
    console.log("Running daily payment reminder check...");

    try {
      const { data: committees } = await supabase
        .from("committees")
        .select("id, name, monthly_amount, start_date");

      if (!committees || committees.length === 0) return;

      for (const committee of committees) {
        await checkCommitteeReminders(committee);
      }

      console.log("Daily payment reminder check complete.");
    } catch (err) {
      console.error("Payment reminder job failed:", err.message);
    }
  });

  console.log("Payment reminder job scheduled (daily, 10:00 AM — per-committee due dates)");
}

async function forceCheckReminder(committeeId, tier = 1) {
  const { data: committee } = await supabase.from("committees").select("id, name, monthly_amount, start_date").eq("id", committeeId).single();
  if (!committee) throw new Error("Committee not found");

  const { data: members } = await supabase.from("members").select("id, name, phone").eq("committee_id", committeeId);
  const monthLabel = new Date().toLocaleString("en-PK", { month: "long", year: "numeric" });
  let sent = 0;

  for (const member of members || []) {
    const { data: existingPayment } = await supabase.from("payment_records").select("id").eq("member_id", member.id).eq("committee_id", committeeId).eq("month", monthLabel).in("status", ["pending", "confirmed"]).maybeSingle();
    if (existingPayment || !member.phone) continue;

    await sendWhatsAppMessage(member.phone, REMINDER_MESSAGES[tier](member.name || "Member", committee.name, committee.monthly_amount || 0));
    sent++;
  }
  return { sent };
}

module.exports = { startMonthlyPaymentReminder, forceCheckReminder };