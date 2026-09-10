// const supabase = require("../config/supabaseClient");

// // async function registerOrganizer(req, res) {
// //   const { name, email, phone, password } = req.body;

// //   if (!name || !email || !password) {
// //     return res.status(400).json({
// //       success: false,
// //       error: "Name, email, and password are required.",
// //     });
// //   }
// const { name, email, phone, password } = req.body;

// if (!name || !email || !password) {
//   return res.status(400).json({ success: false, error: "Name, email, and password are required." });
// }

// // Guard: reject pre-hashed passwords. Supabase hashes internally.
// if (typeof password !== "string" || password.length < 6 || password.length > 72) {
//   return res.status(400).json({ success: false, error: "Password must be 6–72 characters." });
// }
// // bcrypt hashes start with $2a$/$2b$/$2y$ and are 60 chars
// if (/^\$2[aby]\$/.test(password)) {
//   return res.status(400).json({ success: false, error: "Do not pre-hash passwords; send plaintext." });
// }
//   try {
//     const { data: authData, error: authError } =
//       await supabase.auth.admin.createUser({
//         email,
//         password,
//         email_confirm: true,
//       });
//  console.log("[REGISTER] createUser result:", JSON.stringify({ error: authError?.message, userId: authData?.user?.id }));
//     if (authError) {
//       // This specific case means: the login account already exists.
//       // This can happen either because someone genuinely already signed up,
//       // OR because of a past error that created the login account but not
//       // the organizer profile row (an "orphaned" account). We check which
//       // case this is, so we can give a clear, honest error message.
//       if (authError.message.toLowerCase().includes("already been registered")) {
//         const { data: existingUsers } = await supabase.auth.admin.listUsers();
//         const matchedUser = existingUsers?.users?.find((u) => u.email === email);

//         if (matchedUser) {
//           const { data: existingProfile } = await supabase
//             .from("organizers")
//             .select("*")
//             .eq("user_id", matchedUser.id)
//             .maybeSingle();

//           if (existingProfile) {
//             // Genuinely already registered -- tell them to log in instead.
//             return res.status(400).json({
//               success: false,
//               error: "This email is already registered. Please log in instead.",
//             });
//           // } else {
//           //   // Orphaned account from a past failed registration -- repair it
//           //   // by creating the missing profile row now, instead of making
//           //   // the user stuck forever.
//           //   const { data: repairedOrganizer, error: repairError } = await supabase
//           //     .from("organizers")
//           //     .insert([{ name, email, phone, user_id: matchedUser.id }])
//           //     .select()
//           //     .single();

//           //   if (repairError) {
//           //     return res.status(400).json({ success: false, error: repairError.message });
//           //   }

//           //   return res.status(201).json({
//           //     success: true,
//           //     message: "Organizer registered successfully",
//           //     organizer: repairedOrganizer,
//           //   });
//           // }

//                     } else {
//             // Orphaned account from a past failed registration -- repair it.
//             // First sync the password/email-confirm state on the existing
//             // auth user, since the earlier createUser call never completed,
//             // then create the missing profile row.
//             const { error: updateError } = await supabase.auth.admin.updateUserById(
//               matchedUser.id,
//               { password, email_confirm: true }
//             );

//             if (updateError) {
//               return res.status(400).json({ success: false, error: updateError.message });
//             }

//             const { data: repairedOrganizer, error: repairError } = await supabase
//               .from("organizers")
//               .insert([{ name, email, phone, user_id: matchedUser.id }])
//               .select()
//               .single();

//             if (repairError) {
//               return res.status(400).json({ success: false, error: repairError.message });
//             }

//             return res.status(201).json({
//               success: true,
//               message: "Organizer registered successfully",
//               organizer: repairedOrganizer,
//             });
//           }
//         }
//       }

//       return res.status(400).json({ success: false, error: authError.message });
//     }

//     const newUserId = authData.user.id;

//     const { data: organizerData, error: organizerError } = await supabase
//       .from("organizers")
//       .insert([{ name, email, phone, user_id: newUserId }])
//       .select()
//       .single();

//     if (organizerError) {
//       return res.status(400).json({ success: false, error: organizerError.message });
//     }

//     res.status(201).json({
//       success: true,
//       message: "Organizer registered successfully",
//       organizer: organizerData,
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// // }

// async function loginOrganizer(req, res) {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     return res.status(400).json({
//       success: false,
//       error: "Email and password are required.",
//     });
//   }

//   try {
//     const { data, error } = await supabase.auth.signInWithPassword({
//       email,
//       password,
//     });

//     if (error) {
//          console.log("[LOGIN] signInWithPassword error:", error.message, error.status);
//       return res.status(401).json({
//         success: false,
//         error: "Incorrect email or password. Please try again.",
//       });
//     }
//   console.log("[LOGIN] signInWithPassword success for:", email);
//     //     if (error) {
//     //   console.error("Supabase login error:", error.message, error.status);
//     //   return res.status(401).json({
//     //     success: false,
//     //     error: "Incorrect email or password. Please try again.",
//     //   });
//     // }

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

  // Guard: reject pre-hashed passwords. Supabase hashes internally.
  if (typeof password !== "string" || password.length < 6 || password.length > 72) {
    return res.status(400).json({
      success: false,
      error: "Password must be 6–72 characters.",
    });
  }

  // bcrypt hashes start with $2a$/$2b$/$2y$ and are 60 chars
  if (/^\$2[aby]\$/.test(password)) {
    return res.status(400).json({
      success: false,
      error: "Do not pre-hash passwords; send plaintext.",
    });
  }

  try {
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
console.log("[REGISTER] incoming:", {
  email,
  passwordType: typeof password,
  passwordLength: password?.length,
  passwordLooksHashed: typeof password === "string" && /^\$2[aby]\$/.test(password),
});
    console.log(
      "[REGISTER] createUser result:",
      JSON.stringify({ error: authError?.message, userId: authData?.user?.id })
    );

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
            // Orphaned account from a past failed registration -- repair it.
            // First sync the password/email-confirm state on the existing
            // auth user, since the earlier createUser call never completed,
            // then create the missing profile row.
            const { error: updateError } =
              await supabase.auth.admin.updateUserById(matchedUser.id, {
                password,
                email_confirm: true,
              });

            if (updateError) {
              return res
                .status(400)
                .json({ success: false, error: updateError.message });
            }

            const { data: repairedOrganizer, error: repairError } =
              await supabase
                .from("organizers")
                .insert([{ name, email, phone, user_id: matchedUser.id }])
                .select()
                .single();

            if (repairError) {
              return res
                .status(400)
                .json({ success: false, error: repairError.message });
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
      return res
        .status(400)
        .json({ success: false, error: organizerError.message });
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
   console.log("[LOGIN] received:", {
  email,
  emailType: typeof email,
  passwordType: typeof password,
  passwordLength: password?.length,
  passwordLooksHashed: typeof password === "string" && /^\$2[aby]\$/.test(password),
  bodyKeys: Object.keys(req.body || {}),
}); 
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
      console.log(
        "[LOGIN] signInWithPassword error:",
        error.message,
        error.status
      );
      return res.status(401).json({
        success: false,
        error: "Incorrect email or password. Please try again.",
      });
    }

    console.log("[LOGIN] signInWithPassword success for:", email);

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