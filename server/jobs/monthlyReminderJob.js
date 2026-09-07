// Runs on 25th of every month at 10 AM
// Predicts which members might miss payment and sends them reminders

const cron = require("node-cron");
const supabase = require("../config/supabaseClient");
const { sendPaymentReminders } = require("../services/predictiveService");

function startMonthlyReminderJob() {
  cron.schedule("0 10 25 * *", async () => {
    console.log("Running monthly payment reminder job...");

    try {
      const { data: committees } = await supabase
        .from("committees")
        .select("id, code, name");

      if (!committees || committees.length === 0) return;

      for (const committee of committees) {
        console.log(`Sending reminders for: ${committee.name} (${committee.code})`);
        const result = await sendPaymentReminders(committee.id);
        console.log(`Sent ${result.sent} reminders for ${committee.code}`);
      }

      console.log("Monthly reminder job complete.");
    } catch (err) {
      console.error("Monthly reminder job failed:", err.message);
    }
  });

  console.log("Monthly reminder job scheduled (25th of every month, 10:00 AM)");
}

module.exports = { startMonthlyReminderJob };