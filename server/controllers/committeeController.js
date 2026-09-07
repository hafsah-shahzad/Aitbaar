const supabase = require("../config/supabaseClient");
const { sendCommitteeCodeEmail } = require("../services/emailService");
const MAX_COMMITTEES_PER_ORGANIZER = 3;

function generateCommitteeCode() {
  return `C-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

async function createCommittee(req, res) {
  const { organizer_id, name, monthly_amount, total_members, duration_months, start_date } = req.body;

  if (!organizer_id || !name || !monthly_amount || !total_members || !duration_months) {
    return res.status(400).json({ success: false, error: "All fields are required." });
  }

  try {
    const { count } = await supabase
      .from("committees")
      .select("id", { count: "exact", head: true })
      .eq("organizer_id", organizer_id);

    if (count >= MAX_COMMITTEES_PER_ORGANIZER) {
      return res.status(400).json({
        success: false,
        error: `You can only create up to ${MAX_COMMITTEES_PER_ORGANIZER} committees per account.`,
      });
    }

    let code = generateCommitteeCode();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase.from("committees").select("id").eq("code", code).maybeSingle();
      if (!existing) break;
      code = generateCommitteeCode();
    }

    const { data, error } = await supabase
      .from("committees")
      .insert([{ code, organizer_id, name, monthly_amount, total_members, duration_months, start_date: start_date || null }])
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    // Fetch organizer details to send email
    const { data: organizer } = await supabase
      .from("organizers")
      .select("name, email")
      .eq("id", organizer_id)
      .single();

    // Send committee code to organizer's email (non-blocking -- don't fail
    // the request if email fails, just log it)
    if (organizer?.email) {
      sendCommitteeCodeEmail({
        toEmail: organizer.email,
        organizerName: organizer.name,
        committeeName: name,
        committeeCode: code,
      }).catch((err) => console.error("Email failed (non-critical):", err.message));
    }

    res.status(201).json({ success: true, message: "Committee created successfully", committee: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getCommitteesByOrganizer(req, res) {
  const { organizerId } = req.params;
  try {
    const { data, error } = await supabase
      .from("committees")
      .select("*")
      .eq("organizer_id", organizerId)
      .order("created_at", { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, committees: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { createCommittee, getCommitteesByOrganizer };