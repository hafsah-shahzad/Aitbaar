const supabase = require("../config/supabaseClient");

async function saveMessage({ memberId, phone, transcript, response }) {
  const { data, error } = await supabase
    .from("messages")
    .insert([{ member_id: memberId, phone, transcript, response }])
    .select()
    .single();

  if (error) {
    console.error("Error saving message:", error.message);
    return null;
  }

  return data;
}

module.exports = { saveMessage };