require("dotenv").config();
const express = require("express");
const cors = require("cors");
const supabase = require("./config/supabaseClient");
const organizerRoutes = require("./routes/organizerRoutes");
const committeeRoutes = require("./routes/committeeRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const payoutRoutes = require("./routes/payoutRoutes");
const priorityRoutes = require("./routes/priorityRoutes");
const scamShieldRoutes = require("./routes/scamShieldRoutes");
const { generalLimiter } = require("./middleware/rateLimiter");
const { startWeeklyAnomalyCheck, runManualCheck } = require("./jobs/weeklyAnomalyCheckJob");
const { startMonthlyReminderJob } = require("./jobs/monthlyReminderJob");
const { predictPaymentRisk, sendPaymentReminders } = require("./services/predictiveService");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", generalLimiter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Aitbaar backend is running" });
});

app.get("/api/test-db", async (req, res) => {
  const { data, error } = await supabase.from("organizers").select("*").limit(1);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, message: "Connected to Supabase successfully", data });
});

// Manual anomaly check (demo trigger)
app.post("/api/anomaly/run", async (req, res) => {
  try {
    await runManualCheck();
    res.json({ success: true, message: "Anomaly check complete." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Predict payment risk for a committee (returns risk data + sends reminders)
app.post("/api/predict/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;
    const { sendReminders = false } = req.body;

    let riskMembers;

    if (sendReminders) {
      const result = await sendPaymentReminders(committeeId);
      riskMembers = result.riskMembers;
    } else {
      riskMembers = await predictPaymentRisk(committeeId);
    }

    res.json({
      success: true,
      totalAtRisk: riskMembers.length,
      members: riskMembers.map((r) => ({
        name: r.member.name || r.member.phone,
        phone: r.member.phone,
        riskLevel: r.riskLevel,
        riskScore: r.riskScore,
        trustScore: r.trustScore,
        reminderMessage: r.reminderMessage,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use("/api/organizer", organizerRoutes);
app.use("/api/committee", committeeRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/payout", payoutRoutes);
app.use("/api/priority", priorityRoutes);
app.use("/api/scam", scamShieldRoutes);
app.use("/webhook", whatsappRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Aitbaar backend running on http://localhost:${PORT}`);
  startWeeklyAnomalyCheck();
  startMonthlyReminderJob();
});