const supabase = require("../config/supabaseClient");

async function savePaymentRecord({
  memberId,
  committeeId,
  amount,
}) {
  const month = new Date().toLocaleString("en-PK", {
    month: "long",
    year: "numeric",
  });

  const { data, error } = await supabase
    .from("payment_records")
    .insert([
      {
        member_id: memberId,
        committee_id: committeeId,
        amount: amount || null,
        month,
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(
      "Error saving payment record:",
      error.message
    );

    return null;
  }

  console.log(
    "Payment claim saved as pending:",
    data
  );

  return data;
}
async function verifyPayment(paymentId) {
  const { data: payment, error: paymentError } =
    await supabase
      .from("payment_records")
      .select("*")
      .eq("id", paymentId)
      .single();

  if (paymentError || !payment) {
    console.error(
      "Payment not found:",
      paymentError?.message
    );

    return {
      success: false,
      error: "Payment not found",
    };
  }
  if (payment.status === "verified") {
    return {
      success: false,
      error: "Payment already verified",
    };
  }
  const { data: updatedPayment, error } =
    await supabase
      .from("payment_records")
      .update({
        status: "verified",
      })
      .eq("id", paymentId)
      .select()
      .single();

  if (error) {
    console.error(
      "Error verifying payment:",
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
  const newScore = await updateTrustScore(
    payment.member_id,
    payment.committee_id,
    true
  );
  console.log(
    `Payment verified. Trust score updated to ${newScore}`
  );
  return {
    success: true,
    payment: updatedPayment,
    newScore,
  };
}
async function updateTrustScore(
  memberId,
  committeeId,
  wasPayment = true
) {

  const { data: existing, error } =
    await supabase
      .from("trust_scores")
      .select("*")
      .eq("member_id", memberId)
      .eq("committee_id", committeeId)
      .maybeSingle();

  if (error) {
    console.error(
      "Error getting trust score:",
      error.message
    );

    return null;
  }
  const change = wasPayment ? 5 : -10;
  let newScore;
  if (existing) {

    newScore = Math.min(
      100,
      Math.max(
        0,
        existing.score + change
      )
    );


    const { error: updateError } =
      await supabase
        .from("trust_scores")
        .update({
          score: newScore,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);


    if (updateError) {
      console.error(
        "Error updating trust score:",
        updateError.message
      );

      return null;
    }

  }
  else {

    newScore = Math.min(
      100,
      Math.max(
        0,
        100 + change
      )
    );


    const { error: insertError } =
      await supabase
        .from("trust_scores")
        .insert([
          {
            member_id: memberId,
            committee_id: committeeId,
            score: newScore,
          },
        ]);


    if (insertError) {
      console.error(
        "Error creating trust score:",
        insertError.message
      );

      return null;
    }
  }


  console.log(
    `Trust score updated to ${newScore}`
  );

  return newScore;
}
async function getTrustScore(
  memberId,
  committeeId
) {

  const { data, error } =
    await supabase
      .from("trust_scores")
      .select("score")
      .eq("member_id", memberId)
      .eq("committee_id", committeeId)
      .maybeSingle();


  if (error) {
    console.error(
      "Error getting trust score:",
      error.message
    );

    return 100;
  }


  return data?.score ?? 100;
}
async function getPendingPayments(
  committeeId
) {

  const { data, error } =
    await supabase
      .from("payment_records")
      .select(`
        *,
        members(
          id,
          name,
          phone
        )
      `)
      .eq("committee_id", committeeId)
      .eq("status", "pending")
      .order("month", {
        ascending: false,
      });


  if (error) {
    console.error(
      "Error getting pending payments:",
      error.message
    );

    return [];
  }


  return data || [];
}
async function rejectPayment(paymentId) {

  const { data, error } =
    await supabase
      .from("payment_records")
      .update({
        status: "rejected",
      })
      .eq("id", paymentId)
      .select()
      .single();


  if (error) {
    console.error(
      "Error rejecting payment:",
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }


  return {
    success: true,
    payment: data,
  };
}


module.exports = {
  savePaymentRecord,
  verifyPayment,
  updateTrustScore,
  getTrustScore,
  getPendingPayments,
  rejectPayment,
};