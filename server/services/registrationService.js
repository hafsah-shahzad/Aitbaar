const supabase = require("../config/supabaseClient");

async function savePendingRegistration(
  phone,
  committeeId
) {

  const { error: deleteError } = await supabase
    .from("pending_registrations")
    .delete()
    .eq("phone", phone);

  if (deleteError) {
    console.error(
      "Error clearing old pending registration:",
      deleteError.message
    );
  }
  const { data, error } = await supabase
    .from("pending_registrations")
    .insert([
      {
        phone,
        committee_id: committeeId,
      },
    ])
    .select()
    .single();


  if (error) {
    console.error(
      "Error saving pending registration:",
      error.message
    );

    return null;
  }


  return data;
}

async function getPendingRegistration(phone) {

  const { data, error } = await supabase
    .from("pending_registrations")
    .select(`
      *,
      committees(*)
    `)
    .eq("phone", phone)
    .maybeSingle();


  if (error) {
    console.error(
      "Error getting pending registration:",
      error.message
    );

    return null;
  }


  return data;
}

async function clearPendingRegistration(phone) {

  const { error } = await supabase
    .from("pending_registrations")
    .delete()
    .eq("phone", phone);

  if (error) {
    console.error(
      "Error clearing pending registration:",
      error.message
    );
  }
}


module.exports = {
  savePendingRegistration,
  getPendingRegistration,
  clearPendingRegistration,
};