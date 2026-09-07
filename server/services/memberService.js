// const supabase = require("../config/supabaseClient");
// async function getMembershipsByPhone(phone) {
//   const { data, error } = await supabase
//     .from("members")
//     .select(`
//       *,
//       committees(*)
//     `)
//     .eq("phone", phone);

//   if (error) {
//     console.error(
//       "Error looking up memberships:",
//       error.message
//     );

//     return [];
//   }

//   return data || [];
// }
// async function registerMemberToCommittee(
//   phone,
//   committeeId,
//   name
// ) {
//   const {
//     data: existing,
//     error: existingError
//   } = await supabase
//     .from("members")
//     .select("id, name, phone, committee_id")
//     .eq("phone", phone)
//     .eq("committee_id", committeeId)
//     .maybeSingle();

//   if (existingError) {
//     console.error(
//       "Error checking existing member:",
//       existingError.message
//     );

//     return {
//       error: existingError.message
//     };
//   }
//   if (existing) {
//     return {
//       alreadyRegistered: true,
//       member: existing
//     };
//   }
//   const {
//     data,
//     error
//   } = await supabase
//     .from("members")
//     .insert([
//       {
//         phone,
//         name,
//         committee_id: committeeId
//       }
//     ])
//     .select()
//     .single();
//   if (error) {
//     console.error(
//       "Error registering member:",
//       error.message
//     );

//     return {
//       error: error.message
//     };
//   }

//   return {
//     alreadyRegistered: false,
//     member: data
//   };
// }
// async function getMemberSession(phone) {

//   const {
//     data,
//     error
//   } = await supabase
//     .from("member_sessions")
//     .select("*")
//     .eq("phone", phone)
//     .maybeSingle();

//   if (error) {
//     console.error(
//       "Error getting member session:",
//       error.message
//     );

//     return null;
//   }

//   return data || null;
// }
// async function saveMemberSession({
//   phone,
//   state,
//   pendingCommitteeId = null,
//   language = null
// }) {
//   const existing = await getMemberSession(phone);
//   if (existing) {

//     const updateData = {
//       state,
//       pending_committee_id: pendingCommitteeId,
//       updated_at: new Date().toISOString()
//     };
//     if (language) {
//       updateData.language = language;
//     }

//     const {
//       data,
//       error
//     } = await supabase
//       .from("member_sessions")
//       .update(updateData)
//       .eq("phone", phone)
//       .select()
//       .single();

//     if (error) {
//       console.error(
//         "Error updating member session:",
//         error.message
//       );

//       return null;
//     }

//     return data;
//   }
//  const {
//     data,
//     error
//   } = await supabase
//     .from("member_sessions")
//     .insert([
//       {
//         phone,
//         state,
//         pending_committee_id: pendingCommitteeId,
//         language
//       }
//     ])
//     .select()
//     .single();

//   if (error) {
//     console.error(
//       "Error creating member session:",
//       error.message
//     );

//     return null;
//   }

//   return data;
// }
// async function clearMemberSession(phone) {

//   const {
//     error
//   } = await supabase
//     .from("member_sessions")
//     .delete()
//     .eq("phone", phone);

//   if (error) {
//     console.error(
//       "Error clearing member session:",
//       error.message
//     );

//     return false;
//   }

//   return true;
// }
// // ─────────────────────────────────────────────────────────
// // MARK RULES ACCEPTED
// // Called when member accepts committee rules via WhatsApp
// // ─────────────────────────────────────────────────────────
// async function markRulesAccepted(phone, committeeId) {
//   const { data, error } = await supabase
//     .from("members")
//     .update({
//       rules_accepted: true,
//       rules_accepted_at: new Date().toISOString(),
//     })
//     .eq("phone", phone)
//     .eq("committee_id", committeeId)
//     .select()
//     .single();

//   if (error) {
//     console.error("Error marking rules accepted:", error.message);
//     return null;
//   }

//   return data;
// }

// module.exports = {
//   getMembershipsByPhone,
//   registerMemberToCommittee,
//   getMemberSession,
//   saveMemberSession,
//   clearMemberSession,
//   markRulesAccepted
// };

const supabase = require("../config/supabaseClient");
async function getMembershipsByPhone(phone) {
  const { data, error } = await supabase
    .from("members")
    .select(`
      *,
      committees(*)
    `)
    .eq("phone", phone);

  if (error) {
    console.error(
      "Error looking up memberships:",
      error.message
    );

    return [];
  }

  return data || [];
}
async function registerMemberToCommittee(
  phone,
  committeeId,
  name
) {
  const {
    data: existing,
    error: existingError
  } = await supabase
    .from("members")
    .select("id, name, phone, committee_id")
    .eq("phone", phone)
    .eq("committee_id", committeeId)
    .maybeSingle();

  if (existingError) {
    console.error(
      "Error checking existing member:",
      existingError.message
    );

    return {
      error: existingError.message
    };
  }
  if (existing) {
    return {
      alreadyRegistered: true,
      member: existing
    };
  }
  const {
    data,
    error
  } = await supabase
    .from("members")
    .insert([
      {
        phone,
        name,
        committee_id: committeeId
      }
    ])
    .select()
    .single();
  if (error) {
    console.error(
      "Error registering member:",
      error.message
    );

    return {
      error: error.message
    };
  }

  return {
    alreadyRegistered: false,
    member: data
  };
}
async function getMemberSession(phone) {

  const {
    data,
    error
  } = await supabase
    .from("member_sessions")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    console.error(
      "Error getting member session:",
      error.message
    );

    return null;
  }

  return data || null;
}
async function saveMemberSession({
  phone,
  state,
  pendingCommitteeId = null,
  language = null
}) {
  const existing = await getMemberSession(phone);
  if (existing) {

    const updateData = {
      state,
      pending_committee_id: pendingCommitteeId,
      updated_at: new Date().toISOString()
    };
    if (language) {
      updateData.language = language;
    }

    const {
      data,
      error
    } = await supabase
      .from("member_sessions")
      .update(updateData)
      .eq("phone", phone)
      .select()
      .single();

    if (error) {
      console.error(
        "Error updating member session:",
        error.message
      );

      return null;
    }

    return data;
  }
 const {
    data,
    error
  } = await supabase
    .from("member_sessions")
    .insert([
      {
        phone,
        state,
        pending_committee_id: pendingCommitteeId,
        language
      }
    ])
    .select()
    .single();

  if (error) {
    console.error(
      "Error creating member session:",
      error.message
    );

    return null;
  }

  return data;
}
async function clearMemberSession(phone) {

  const {
    error
  } = await supabase
    .from("member_sessions")
    .delete()
    .eq("phone", phone);

  if (error) {
    console.error(
      "Error clearing member session:",
      error.message
    );

    return false;
  }

  return true;
}
// ─────────────────────────────────────────────────────────
// MARK RULES ACCEPTED
// Called when member accepts committee rules via WhatsApp
// ─────────────────────────────────────────────────────────
async function markRulesAccepted(phone, committeeId) {
  const { data, error } = await supabase
    .from("members")
    .update({
      rules_accepted: true,
      rules_accepted_at: new Date().toISOString(),
    })
    .eq("phone", phone)
    .eq("committee_id", committeeId)
    .select()
    .single();

  if (error) {
    console.error("Error marking rules accepted:", error.message);
    return null;
  }

  return data;
}

// ─────────────────────────────────────────────────────────
// GET KNOWN NAME
// When joining a second committee, reuse the name from
// the member's first committee membership
// ─────────────────────────────────────────────────────────
async function getKnownName(phone) {
  const { data, error } = await supabase
    .from("members")
    .select("name")
    .eq("phone", phone)
    .not("name", "is", null)
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.name) return null;
  return data.name;
}

module.exports = {
  getMembershipsByPhone,
  registerMemberToCommittee,
  getMemberSession,
  saveMemberSession,
  clearMemberSession,
  markRulesAccepted,
  getKnownName
};