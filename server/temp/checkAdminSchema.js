// One-off probe: check which parts of migration 013 exist in the database.
// Safe — read-only SELECTs only. Delete this file after use.
const supabase = require("../config/supabaseClient");

(async () => {
  const { error: e1 } = await supabase.from("admins").select("id").limit(1);
  console.log("1. admins TABLE:            ", e1 ? "NOT APPLIED (" + e1.message.slice(0, 60) + ")" : "EXISTS");

  const { error: e2 } = await supabase.from("organizers").select("status").limit(1);
  console.log("2. organizers.status col:   ", e2 ? "NOT APPLIED (" + e2.message.slice(0, 60) + ")" : "EXISTS");

  const { error: e3 } = await supabase.from("anomaly_flags").select("status, reviewed_by_admin, reviewed_at").limit(1);
  console.log("3. anomaly review cols:     ", e3 ? "NOT APPLIED (" + e3.message.slice(0, 60) + ")" : "EXISTS");

  process.exit(0);
})();