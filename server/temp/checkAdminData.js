// One-off: count rows in migration-013 artifacts before cleanup. Read-only.
const supabase = require("../config/supabaseClient");

(async () => {
  const { count: adminCount } = await supabase
    .from("admins").select("id", { count: "exact", head: true });
  console.log("admins rows:", adminCount);

  const { count: suspCount } = await supabase
    .from("organizers").select("id", { count: "exact", head: true })
    .eq("status", "suspended");
  console.log("suspended organizers:", suspCount);

  const { count: reviewedCount } = await supabase
    .from("anomaly_flags").select("id", { count: "exact", head: true })
    .neq("status", "open");
  console.log("reviewed anomalies (non-open):", reviewedCount);

  process.exit(0);
})();