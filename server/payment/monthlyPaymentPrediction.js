
// Runs on the 1st of every month at 8 AM
// Predicts payment risks and sends WhatsApp alert to organizer

const cron = require("node-cron");
const supabase = require("../config/supabaseClient");
const { predictPaymentRisks } = require("../services/predictionService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

function monthlyPaymentPrediction() {
  cron.schedule("0 8 1 * *", async () => {
    console.log("Running monthly payment prediction job...");

    try {
      const { data: committees } = await supabase
        .from("committees")
        .select("*, organizers(phone, name)");

      if (!committees || committees.length === 0) return;

      for (const committee of committees) {
        const { riskMembers, aiMessage } = await predictPaymentRisks(committee.id);

        if (riskMembers.length === 0) continue;

        const highRisk = riskMembers.filter((r) => r.riskLevel === "high");
        const mediumRisk = riskMembers.filter((r) => r.riskLevel === "medium");

        // Build WhatsApp message for organizer
        let message = `[Aitbaar Prediction] "${committee.name}" committee — is mahinay payment risk:\n\n`;

        if (highRisk.length > 0) {
          message += `🔴 High Risk:\n`;
          highRisk.forEach((r) => {
            message += `• ${r.member.name || r.member.phone} (Trust: ${r.trustScore})\n`;
          });
          message += "\n";
        }

        if (mediumRisk.length > 0) {
          message += `🟡 Medium Risk:\n`;
          mediumRisk.forEach((r) => {
            message += `• ${r.member.name || r.member.phone} (Trust: ${r.trustScore})\n`;
          });
          message += "\n";
        }

        if (aiMessage) {
          message += `💡 ${aiMessage}`;
        }

        // Send to organizer
        if (committee.organizers?.phone) {
          await sendWhatsAppMessage(committee.organizers.phone, message).catch(
            (e) => console.log("Prediction alert failed:", e.message)
          );
        }
      }

      console.log("Monthly payment prediction complete.");
    } catch (err) {
      console.error("Monthly payment prediction failed:", err.message);
    }
  });

  console.log("Monthly payment prediction scheduled (1st of every month, 8:00 AM)");
}

module.exports = { monthlyPaymentPrediction };
