// const supabase = require("../config/supabaseClient");

// // Handles a new organizer signing up.
// // Steps: (1) create a login account in Supabase Auth,
// //        (2) save the organizer's profile info in our own "organizers" table,
// //        (3) link the two together using user_id.
// async function registerOrganizer(req, res) {
//   const { name, email, phone, password } = req.body;

//   if (!name || !email || !password) {
//     return res.status(400).json({
//       success: false,
//       error: "name, email, and password are required",
//     });
//   }

//   try {
//     console.log("Creating auth user...");

//     const { data: authData, error: authError } =
//       await supabase.auth.admin.createUser({
//         email,
//         password,
//         email_confirm: true,
//       });

//     console.log("AUTH ERROR:", authError);
//     console.log("AUTH DATA:", authData);

//     if (authError) {
//       return res.status(400).json({
//         success: false,
//         error: authError.message,
//       });
//     }

//     const newUserId = authData.user.id;

//     console.log("Inserting organizer profile...");

//     const { data: organizerData, error: organizerError } =
//       await supabase
//         .from("organizers")
//         .insert([
//           {
//             name,
//             email,
//             phone,
//             user_id: newUserId,
//           },
//         ])
//         .select()
//         .single();

//     console.log("ORGANIZER ERROR:", organizerError);
//     console.log("ORGANIZER DATA:", organizerData);

//     if (organizerError) {
//       return res.status(400).json({
//         success: false,
//         error: organizerError.message,
//       });
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Organizer registered successfully",
//       organizer: organizerData,
//     });
//   } catch (err) {
//     console.error(err);

//     return res.status(500).json({
//       success: false,
//       error: err.message,
//     });
//   }
// }
// // Handles an existing organizer logging in.
// // Supabase Auth checks the email/password and, if correct, returns a
// // session containing an access_token -- the dashboard will store this
// // token and send it along with future requests to prove who is logged in.
// async function loginOrganizer(req, res) {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     return res.status(400).json({
//       success: false,
//       error: "email and password are required",
//     });
//   }

//   try {
//     const { data, error } = await supabase.auth.signInWithPassword({
//       email,
//       password,
//     });

//     if (error) {
//       return res.status(401).json({ success: false, error: error.message });
//     }

//     const { data: organizerProfile } = await supabase
//       .from("organizers")
//       .select("*")
//       .eq("user_id", data.user.id)
//       .single();

//     res.json({
//       success: true,
//       message: "Login successful",
//       session: {
//         access_token: data.session.access_token,
//         expires_at: data.session.expires_at,
//       },
//       organizer: organizerProfile,
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// }

// module.exports = { registerOrganizer, loginOrganizer };


const supabase = require("../config/supabaseClient");

async function registerOrganizer(req, res) {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: "Name, email, and password are required.",
    });
  }

  try {
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    console.log("[REGISTER] createUser result:", JSON.stringify({ error: authError?.message, userId: authData?.user?.id }));

    if (authError) {
      // This specific case means: the login account already exists.
      // This can happen either because someone genuinely already signed up,
      // OR because of a past error that created the login account but not
      // the organizer profile row (an "orphaned" account). We check which
      // case this is, so we can give a clear, honest error message.
      if (authError.message.toLowerCase().includes("already been registered")) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const matchedUser = existingUsers?.users?.find((u) => u.email === email);

        if (matchedUser) {
          const { data: existingProfile } = await supabase
            .from("organizers")
            .select("*")
            .eq("user_id", matchedUser.id)
            .maybeSingle();

          if (existingProfile) {
            // Genuinely already registered -- tell them to log in instead.
            return res.status(400).json({
              success: false,
              error: "This email is already registered. Please log in instead.",
            });
          } else {
            // Orphaned account from a past failed registration -- repair it
            // by creating the missing profile row now, instead of making
            // the user stuck forever. IMPORTANT: the auth account already
            // exists but its stored password may NOT be the one just typed
            // (e.g. from an earlier aborted attempt), so we reset the auth
            // password to the newly submitted one. Without this, registration
            // succeeds but every later login fails with "Invalid credentials".
            const { error: passwordResetError } = await supabase.auth.admin.updateUserById(
              matchedUser.id,
              { password }
            );

            if (passwordResetError) {
              return res.status(400).json({ success: false, error: passwordResetError.message });
            }

            const { data: repairedOrganizer, error: repairError } = await supabase
              .from("organizers")
              .insert([{ name, email, phone, user_id: matchedUser.id }])
              .select()
              .single();

            if (repairError) {
              return res.status(400).json({ success: false, error: repairError.message });
            }

            return res.status(201).json({
              success: true,
              message: "Organizer registered successfully",
              organizer: repairedOrganizer,
            });
          }
        }
      }

      return res.status(400).json({ success: false, error: authError.message });
    }

    const newUserId = authData.user.id;

    const { data: organizerData, error: organizerError } = await supabase
      .from("organizers")
      .insert([{ name, email, phone, user_id: newUserId }])
      .select()
      .single();

    if (organizerError) {
      return res.status(400).json({ success: false, error: organizerError.message });
    }

    res.status(201).json({
      success: true,
      message: "Organizer registered successfully",
      organizer: organizerData,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function loginOrganizer(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required.",
    });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log("[LOGIN] signInWithPassword error:", error.message, error.status);
      return res.status(401).json({
        success: false,
        error: "Incorrect email or password. Please try again.",
      });
    }
    console.log("[LOGIN] signInWithPassword success for:", email);

    // Platform suspension check (optional column from migration 013 — skip silently if absent)
    try {
      const { data: statusRow, error: statusError } = await supabase
        .from("organizers")
        .select("status")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!statusError && statusRow?.status === "suspended") {
        return res.status(403).json({
          success: false,
          error: "Your organizer account has been suspended by the platform admin. Contact support.",
        });
      }
    } catch { /* migration not applied — suspension feature off */ }

    const { data: organizerProfile } = await supabase
      .from("organizers")
      .select("*")
      .eq("user_id", data.user.id)
      .single();

    res.json({
      success: true,
      message: "Login successful",
      session: {
        access_token: data.session.access_token,
        expires_at: data.session.expires_at,
      },
      organizer: organizerProfile,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { registerOrganizer, loginOrganizer };