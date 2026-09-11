// payment/monthlyPaymentReminder.js
//
// Runs daily — checks each committee's due date (based on its own start_date)
// and sends escalating reminders to members who haven't paid yet this month.
// Despite the filename, this must run daily, not on a fixed calendar date,
// because each committee's due date is different (set by its own start_date).
//
// Tier 1: 1 day late   — gentle nudge
// Tier 2: 3 days late  — firmer reminder
// Tier 3: 6 days late  — final warning, mentions trust score impact

const cron = require("node-cron");
const supabase = require("../config/supabaseClient");
const { sendWhatsAppMessage } = require("../services/whatsappService");
const { getDueDateForNow } = require("../services/paymentService");

const REMINDER_TIERS = [1, 3, 6]; // days late

const REMINDER_MESSAGES = {
  1: (name, committee, amount) =>
    `Assalam o Alaikum ${name}, "${committee}" ki is mahine ki Rs ${amount} payment abhi tak record nahi hui. Please jald payment karein.`,
  3: (name, committee, amount) =>
    `${name}, "${committee}" ki Rs ${amount} payment 3 din se pending hai. Please jaldi payment confirm karwayein taake koi masla na ho.`,
  6: (name, committee, amount) =>
    `${name}, "${committee}" ki Rs ${amount} payment 6 din se late hai. Is se aapka trust score prabhavit ho sakta hai — please turant payment karein.`,
};

async function checkCommitteeReminders(committee) {
  if (!committee.start_date) return; // can't compute a due date without one

  const now = new Date();
  const dueDate = getDueDateForNow(committee.start_date, now);
  const daysLate = Math.round((now - dueDate) / (1000 * 60 * 60 * 24));

  if (!REMINDER_TIERS.includes(daysLate)) return;

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

    const message = REMINDER_MESSAGES[daysLate](member.name || "Member", committee.name, committee.monthly_amount || 0);

    try {
      await sendWhatsAppMessage(member.phone, message);
      sent++;
    } catch (err) {
      console.error(`Failed to send reminder to ${member.phone}:`, err.message);
    }
  }

  console.log(`[REMINDER] ${committee.name}: tier ${daysLate}-day reminder sent to ${sent} member(s)`);
}

function startMonthlyPaymentReminder() {
  // Runs once a day at 10 AM; each committee is checked against its own due date
  //cron.schedule("0 10 * * *", async () => { #original time
    cron.schedule("*/2 * * * *", async () => { //testing: every 2 minutes
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

module.exports = { startMonthlyPaymentReminder };