// This file's job: given a committee code (like "C-P417VL"), find the
// matching committee in the database.

const supabase = require("../config/supabaseClient");

async function findCommitteeByCode(code) {
  const { data, error } = await supabase
    .from("committees")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error) {
    console.error("Error looking up committee:", error.message);
    return null;
  }

  return data; // null if no committee has this code
}

module.exports = { findCommitteeByCode };
