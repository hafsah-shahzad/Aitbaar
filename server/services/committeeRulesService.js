const supabase = require("../config/supabaseClient");

// ─────────────────────────────────────────────────────────
// RULE TEMPLATES — Separate for Organizers and Members
// ─────────────────────────────────────────────────────────

function generateRules({
  committeeName,
  monthlyAmount,
  totalMembers,
  durationMonths,
  startDate,
}) {
  const start = startDate
    ? new Date(startDate).toLocaleDateString("en-PK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "N/A";

  const totalPool = monthlyAmount * totalMembers;
  const lateFee = Math.round(monthlyAmount * 0.05);

  // ══════════════════════════════════════════════════════
  // ORGANIZER RULES — What the organizer must/knows
  // ══════════════════════════════════════════════════════
  const organizerRules = [
    {
      id: 1,
      title: "Verify Member Payments",
      icon: "✅",
      text: `As organizer, you must verify each member's monthly payment of Rs ${monthlyAmount.toLocaleString()}. Payments sent to the bot are marked as self-declared until you confirm them from the registered account.`,
    },
    {
      id: 2,
      title: "Reject Late or Incomplete Payments",
      icon: "❌",
      text: `You have the authority to reject payments that are incomplete, from unregistered accounts, or sent after the deadline without valid reason. Rejected payments reduce the member's trust score.`,
    },
    {
      id: 3,
      title: "Remove Non-Paying Members",
      icon: "🚫",
      text: `If a member misses 3 consecutive months, you may remove them from the committee. Before removal, the system will send 2 warnings via WhatsApp. Removal is logged in the audit trail.`,
    },
    {
      id: 4,
      title: "Approve Account Changes",
      icon: "🔒",
      text: `Any member requesting a bank account change must submit fresh verification. You must approve the change before it takes effect. All members will be notified of the change.`,
    },
    {
      id: 5,
      title: "Assign and Manage Payout Order",
      icon: "📋",
      text: `You trigger the random payout assignment. The system shuffles members fairly. You can review, approve, and finalize the order. Changes require majority committee approval (50%+1 votes).`,
    },
    {
      id: 6,
      title: "Review AI Recommendations",
      icon: "🤖",
      text: `When members request priority payouts, the AI analyzes urgency and fairness. You receive the recommendation but make the final decision. AI never decides on its own.`,
    },
    {
      id: 7,
      title: "Set Late Fee Policy",
      icon: "⏰",
      text: `A late fee of Rs ${lateFee.toLocaleString()} (5% of monthly amount) applies after the 5th. Two consecutive late payments trigger a trust score deduction of 10 points each.`,
    },
    {
      id: 8,
      title: "Resolve Disputes",
      icon: "⚖️",
      text: `If committee members cannot reach a majority on a dispute, your decision is final. All dispute details and resolutions are recorded in the audit log for transparency.`,
    },
    {
      id: 9,
      title: "View Full Audit Log",
      icon: "🔍",
      text: `You have access to the complete audit log showing all payments, trust score changes, payout order changes, priority requests, and dispute resolutions. This log cannot be edited.`,
    },
    {
      id: 10,
      title: "Approve or Reject Priority Requests",
      icon: "🚨",
      text: `When a member submits a priority payout request via voice note, you review the AI analysis (urgency, fairness score, deadline). You can approve, reject, or let the committee vote decide.`,
    },
    {
      id: 11,
      title: "Send Rules to All Members",
      icon: "📤",
      text: `After committee creation, you must send the generated rules to all members via WhatsApp. Each member must accept the rules before they can participate in the committee.`,
    },
    {
      id: 12,
      title: "Committee Transparency",
      icon: "🔍",
      text: `All payment records, trust scores, payout orders, and audit logs are visible to all members through the Aitbaar dashboard. You cannot hide or modify any records.`,
    },
  ];

  // ══════════════════════════════════════════════════════
  // MEMBER RULES — What each member must know/follow
  // ══════════════════════════════════════════════════════
  const memberRules = [
    {
      id: 1,
      title: "Monthly Contribution",
      icon: "💰",
      text: `You must pay Rs ${monthlyAmount.toLocaleString()} every month. Payment is due by the 5th of each month. Pay on time to maintain your trust score.`,
    },
    {
      id: 2,
      title: "Payment Deadline",
      icon: "📅",
      text: `All payments must be made on or before the 5th of every month. Payments received after the 5th will be marked as late and may incur a penalty.`,
    },
    {
      id: 3,
      title: "Late Fee",
      icon: "⏰",
      text: `A late fee of Rs ${lateFee.toLocaleString()} (5% of monthly amount) will be charged for payments made after the 5th. Two consecutive late payments will reduce your trust score.`,
    },
    {
      id: 4,
      title: "Payout Order",
      icon: "📋",
      text: `Your payout position is assigned randomly at the start. You cannot change it without majority committee approval (50%+1 votes). You may request a priority change through the bot.`,
    },
    {
      id: 5,
      title: "Payout Amount",
      icon: "🏦",
      text: `When your turn comes, you will receive Rs ${totalPool.toLocaleString()} (${totalMembers} members × Rs ${monthlyAmount.toLocaleString()}). This is your total payout for the committee.`,
    },
    {
      id: 6,
      title: "Payment Method",
      icon: "📲",
      text: `All payments must be made through the registered committee account. Do NOT send money to personal accounts. Confirm every payment through the Aitbaar WhatsApp bot.`,
    },
    {
      id: 7,
      title: "Missed Payment Policy",
      icon: "🚫",
      text: `Missing 2 consecutive months reduces your trust score by 20 points. Missing 3 consecutive months may result in removal from the committee. Pay on time to stay in good standing.`,
    },
    {
      id: 8,
      title: "Emergency Policy",
      icon: "🚨",
      text: `In case of a genuine emergency, you can request priority payout by sending a voice note to the Aitbaar bot. The AI will analyze your request fairly, and the committee will vote.`,
    },
    {
      id: 9,
      title: "Account Changes",
      icon: "🔒",
      text: `If you need to change your bank account, you must submit fresh verification through the bot. The organizer must approve the change before it takes effect.`,
    },
    {
      id: 10,
      title: "Trust Score",
      icon: "⭐",
      text: `Your trust score starts at 50 and goes up to 100 based on on-time payments, consistency, and committee participation. You can ask the bot "Why is my score this way?" for a full breakdown.`,
    },
    {
      id: 11,
      title: "Transparency",
      icon: "🔍",
      text: `All payment records, trust scores, and payout orders are visible to all committee members through the Aitbaar dashboard. You can request your full payment history at any time.`,
    },
    {
      id: 12,
      title: "Dispute Resolution",
      icon: "⚖️",
      text: `If you have a dispute with another member, it will be resolved through committee voting. If no majority is reached, the organizer's decision will be final.`,
    },
  ];

  // ══════════════════════════════════════════════════════
  // URDU TRANSLATIONS — Separate for each role
  // ══════════════════════════════════════════════════════
  const organizerRulesUrdu = [
    {
      id: 1,
      title: "ممبران کی ادائیگیوں کی تصدیق",
      icon: "✅",
      text: `آپ کو ہر ممبر کی ماہانہ Rs ${monthlyAmount.toLocaleString()} ادائیگی کی تصدیق کرنی ہوگی۔ بار کے ذریعے بھیجی گئی ادائیگیاں تب تک خود اعلان شدہ ہیں جب تک آپ رجسٹرڈ اکاؤنٹ سے تصدیق نہ کریں۔`,
    },
    {
      id: 2,
      title: "نا مناسب ادائیگیوں کی رد",
      icon: "❌",
      text: `آپ کو نامکمل، غیر رجسٹرڈ اکاؤنٹ سے بھیجی گئی، یا ڈیڈ لائن کے بعد بغیر درست وجہ ادائیگیوں کو رد کرنے کا اختیار ہے۔ رد شدہ ادائیگیاں ممبر کے ٹرسٹ اسکور کو کم کرتی ہیں۔`,
    },
    {
      id: 3,
      title: "ادائیگی نہ کرنے والوں کو نکالنا",
      icon: "🚫",
      text: `اگر کوئی ممبر تسلسل سے 3 ماہ ادائیگی نہ کرے تو آپ اسے کمیٹی سے نکال سکتے ہیں۔ نکالنے سے پہلے 2 وارننگ واٹس ایپ پر بھیجی جائیں گی۔`,
    },
    {
      id: 4,
      title: "اکاؤنٹ تبدیلی کی منظوری",
      icon: "🔒",
      text: `کسی بھی ممبر کی بینک اکاؤنٹ تبدیلی کے لیے نئی تصدیق درکار ہے۔ آپ کو تبدیلی کی منظوری دینی ہوگی۔ تمام ممبران کو تبدیلی کے بارے میں آگاہ کیا جائے گا۔`,
    },
    {
      id: 5,
      title: "ادائیگی کا ترتیب管理",
      icon: "📋",
      text: `آپ بے ترتیب ادائیگی ترتیب شروع کرتے ہیں۔ آپ ترتیب کی جائزہ لے سکتے ہیں، منظور کر سکتے ہیں، اور finalize کر سکتے ہیں۔ تبدیلی کے لیے کمیٹی کی اکثریت درکار ہے۔`,
    },
    {
      id: 6,
      title: "AI تجاویز کا جائزہ",
      icon: "🤖",
      text: `جب ممبر پرائیورٹی ادائیگی کی درخواست کریں تو AI فیطریت اور مناسبیت کا تجزیہ کرتا ہے۔ آپ تجویز ملتے ہیں لیکن حتمی فیصلہ آپ کا ہوتا ہے۔`,
    },
    {
      id: 7,
      title: "جھرمہ کی پالیسی",
      icon: "⏰",
      text: `5 تاریخ کے بعد Rs ${lateFee.toLocaleString()} (ماہانہ رقم کا 5%) جھرمہ لگتا ہے۔ تسلسل سے 2 ماہ دیر سے ادائیگی پر ٹرسٹ اسکور 10 پوائنٹ کم ہوتا ہے۔`,
    },
    {
      id: 8,
      title: "تنازعات کا حل",
      icon: "⚖️",
      text: `اگر ممبر اکثریت نہ بنا سکیں تو آپ کا فیصلہ حتمی ہوگا۔ تمام تنازعات اور ان کے حل آڈٹ لاگ میں ریکارڈ ہوتے ہیں۔`,
    },
    {
      id: 9,
      title: "مکمل آڈٹ لاگ",
      icon: "🔍",
      text: `آپ کو مکمل آڈٹ لاگ تک رسائی ہے جس میں تمام ادائیگیاں، ٹرسٹ اسکور تبدیلیاں، ادائیگی ترتیب، پرائیورٹی درخواستیں، اور تنازعات شامل ہیں۔`,
    },
    {
      id: 10,
      title: "پرائیورٹی درخواستوں کی منظوری",
      icon: "🚨",
      text: `جب کوئی ممبر واٹس ایپ بار کے ذریعے پرائیورٹی ادائیگی کی درخواست دے تو آپ AI تجزیہ دیکھ کر منظور یا رد کر سکتے ہیں۔`,
    },
    {
      id: 11,
      title: "قواعد ممبران کو بھیجنا",
      icon: "📤",
      text: `کمیٹی بنانے کے بعد آپ کو بنائے گئے قواعد تمام ممبران کو واٹس ایپ پر بھیجنے ہوں گے۔ ہر ممبر کو قواعد قبول کرنے کے بعد شمولیت ہوگی۔`,
    },
    {
      id: 12,
      title: "کمیٹی شفافیت",
      icon: "🔍",
      text: `تمام ادائیگیوں کے ریکارڈ، ٹرسٹ اسکور، ادائیگی ترتیب، اور آڈٹ لاگ تمام ممبران کے لیے دیکھنے کے لیے دستیاب ہیں۔`,
    },
  ];

  const memberRulesUrdu = [
    {
      id: 1,
      title: "ماہانہ حصہ",
      icon: "💰",
      text: `آپ کو ہر ماہ Rs ${monthlyAmount.toLocaleString()} ادا کرنے ہوں گے۔ ہر ماہ 5 تاریخ تک ادائیگی ہونی چاہئیے۔`,
    },
    {
      id: 2,
      title: "ادائیگی کی آخری تاریخ",
      icon: "📅",
      text: `تمام ادائیگیاں ہر ماہ 5 تاریخ تک ہونی چاہئیں۔ 5 تاریخ کے بعد ادائیگی "دیر سے" مانی جائے گی۔`,
    },
    {
      id: 3,
      title: "جھرمہ / لیٹ فیس",
      icon: "⏰",
      text: `5 تاریخ کے بعد ادائیگی کرنے پر Rs ${lateFee.toLocaleString()} (ماہانہ رقم کا 5%) جھرمہ لگے گا۔ تسلسل سے 2 ماہ دیر سے ادائیگی پر ٹرسٹ اسکور کم ہوگا۔`,
    },
    {
      id: 4,
      title: "ادائیگی کا ترتیب",
      icon: "📋",
      text: `آپ کا ادائیگی نمبر شروع میں بے ترتیب طریقے سے مقرر ہوتا ہے۔ تبدیلی کے لیے کمیٹی کی اکثریت (50%+1 ووٹ) درکار ہے۔`,
    },
    {
      id: 5,
      title: "ادائیگی کی رقم",
      icon: "🏦",
      text: `جب آپ کی باری آئے تو آپ کو Rs ${totalPool.toLocaleString()} ملیں گے (${totalMembers} ممبران × Rs ${monthlyAmount.toLocaleString()})۔`,
    },
    {
      id: 6,
      title: "ادائیگی کا طریقہ",
      icon: "📲",
      text: `تمام ادائیگیاں رجسٹرڈ کمیٹی اکاؤنٹ سے ہونی چاہئیں۔ ذاتی اکاؤنٹ میں ٹرانسفر کی اجازت نہیں ہے۔ ہر ادائیگی کی تصدیق واٹس ایپ بار سے کریں۔`,
    },
    {
      id: 7,
      title: "ادائیگی نہ کرنے کی پالیسی",
      icon: "🚫",
      text: `تسلسل سے 2 ماہ ادائیگی نہ کرنے پر ٹرسٹ اسکور 20 پوائنٹ کم ہوگا۔ تسلسل سے 3 ماہ نہ کرنے پر کمیٹی سے نکالا جا سکتا ہے۔`,
    },
    {
      id: 8,
      title: "ایمرجنسی پالیسی",
      icon: "🚨",
      text: `واقعی ایمرجنسی کی صورت میں آپ واٹس ایپ بار کو آڈیو نوٹ بھیج کر پرائیورٹی ادائیگی کی درخواست دے سکتے ہیں۔ AI تجزیہ کے بعد کمیٹی ووٹ کرے گی۔`,
    },
    {
      id: 9,
      title: "اکاؤنٹ تبدیلی",
      icon: "🔒",
      text: `اگر آپ کو بینک اکاؤنٹ تبدیل کرنا ہے تو بار کے ذریعے نئی تصدیق بھیجیں۔ رجسٹر سے منظوری ملنے کے بعد تبدیلی ہوگی۔`,
    },
    {
      id: 10,
      title: "ٹرسٹ اسکور",
      icon: "⭐",
      text: `آپ کا ٹرسٹ اسکور 50 سے شروع ہوتا ہے اور 100 تک جا سکتا ہے۔ واٹ پر ادائیگی، تسلسل، اور شمولیت سے بڑھتا ہے۔ بار سے "Mera score kyun itna hai" پوچھیں۔`,
    },
    {
      id: 11,
      title: "شفافیت",
      icon: "🔍",
      text: `تمام ادائیگیوں کے ریکارڈ، ٹرسٹ اسکور، اور ادائیگی ترتیب تمام ممبران کے لیے دیکھنے کے لیے دستیاب ہیں۔`,
    },
    {
      id: 12,
      title: "تنازعات کا حل",
      icon: "⚖️",
      text: `کوئی بھی تنازعہ کمیٹی ووٹ سے حل ہوگا۔ اکثریت نہ ملنے پر رجسٹر کا فیصلہ حتمی ہوگا۔`,
    },
  ];

  // ── WhatsApp Summaries (role-based) ────────────────
  const organizerWhatsAppSummary =
    `📋 *Committee Rules — Organizer*\n` +
    `📌 *${committeeName}*\n\n` +
    organizerRules
      .map((r) => `${r.icon} *${r.title}*\n${r.text}`)
      .join("\n\n") +
    `\n\n---\n_Generated by Aitbaar — ${new Date().toLocaleDateString("en-PK")}_`;

  const memberWhatsAppSummary =
    `📋 *Committee Rules — Member*\n` +
    `📌 *${committeeName}*\n\n` +
    memberRules
      .map((r) => `${r.icon} *${r.title}*\n${r.text}`)
      .join("\n\n") +
    `\n\n---\n_Generated by Aitbaar — ${new Date().toLocaleDateString("en-PK")}_`;

  return {
    organizer: {
      english: organizerRules,
      urdu: organizerRulesUrdu,
      whatsappSummary: organizerWhatsAppSummary,
    },
    member: {
      english: memberRules,
      urdu: memberRulesUrdu,
      whatsappSummary: memberWhatsAppSummary,
    },
  };
}

// ─────────────────────────────────────────────────────────
// SAVE RULES TO DATABASE
// ─────────────────────────────────────────────────────────

async function saveRules(committeeId, rules) {
  const { data, error } = await supabase
    .from("committee_rules")
    .upsert(
      [
        {
          committee_id: committeeId,
          rules_english: rules.organizer.english,
          rules_urdu: rules.organizer.urdu,
          organizer_rules_english: rules.organizer.english,
          organizer_rules_urdu: rules.organizer.urdu,
          member_rules_english: rules.member.english,
          member_rules_urdu: rules.member.urdu,
          whatsapp_summary: rules.organizer.whatsappSummary,
          organizer_whatsapp_summary: rules.organizer.whatsappSummary,
          member_whatsapp_summary: rules.member.whatsappSummary,
          generated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "committee_id" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ─────────────────────────────────────────────────────────
// GET RULES FROM DATABASE
// ─────────────────────────────────────────────────────────

async function getRules(committeeId) {
  const { data, error } = await supabase
    .from("committee_rules")
    .select("*")
    .eq("committee_id", committeeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

// ─────────────────────────────────────────────────────────
// GET RULES BY ROLE
// ─────────────────────────────────────────────────────────

async function getRulesByRole(committeeId, role) {
  const rules = await getRules(committeeId);
  if (!rules) return null;

  if (role === "organizer") {
    return {
      english: rules.organizer_rules_english || rules.rules_english,
      urdu: rules.organizer_rules_urdu || rules.rules_urdu,
      whatsappSummary:
        rules.organizer_whatsapp_summary || rules.whatsapp_summary,
    };
  }

  return {
    english: rules.member_rules_english || rules.rules_english,
    urdu: rules.member_rules_urdu || rules.rules_urdu,
    whatsappSummary: rules.member_whatsapp_summary || rules.whatsapp_summary,
  };
}

// ─────────────────────────────────────────────────────────
// GENERATE PDF CONTENT — Two sections: Organizer + Member
// ─────────────────────────────────────────────────────────

function generatePdfHtml(rules, committeeConfig) {
  const { organizer, member } = rules;
  const {
    committeeName,
    monthlyAmount,
    totalMembers,
    durationMonths,
    startDate,
  } = committeeConfig;

  const start = startDate
    ? new Date(startDate).toLocaleDateString("en-PK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "N/A";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #22262E; max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #1E3A5F; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { color: #1E3A5F; margin: 0; font-size: 22px; }
    .header p { color: #5C6270; font-size: 12px; margin: 5px 0 0; }
    .config { background: #F7F6F2; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
    .config strong { color: #1E3A5F; }
    .section-title { color: #1E3A5F; font-size: 18px; margin: 25px 0 12px; padding: 8px 12px; border-radius: 6px; }
    .section-organizer { background: #E8F0FE; border-left: 4px solid #1E3A5F; }
    .section-member { background: #FFF3E0; border-left: 4px solid #B8792B; }
    .section-urdu { background: #F3E5F5; border-left: 4px solid #7B1FA2; text-align: right; direction: rtl; }
    .rule { margin-bottom: 10px; padding: 8px 12px; border-left: 3px solid #B8792B; background: #FBFBFB; border-radius: 0 6px 6px 0; }
    .rule-organizer { border-left-color: #1E3A5F; }
    .rule-urdu { direction: rtl; text-align: right; border-left: none; border-right: 3px solid #7B1FA2; border-radius: 6px 0 0 6px; }
    .rule h3 { margin: 0 0 3px; font-size: 13px; color: #1E3A5F; }
    .rule p { margin: 0; font-size: 12px; line-height: 1.5; color: #444; }
    .divider { border: none; border-top: 2px dashed #E8EEF4; margin: 30px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #E8EEF4; font-size: 11px; color: #5C6270; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Committee Rules</h1>
    <p>${committeeName} | Generated by Aitbaar</p>
  </div>

  <div class="config">
    <strong>Committee:</strong> ${committeeName}<br>
    <strong>Monthly Amount:</strong> Rs ${monthlyAmount.toLocaleString()}<br>
    <strong>Total Members:</strong> ${totalMembers}<br>
    <strong>Duration:</strong> ${durationMonths} months<br>
    <strong>Start Date:</strong> ${start}
  </div>

  <!-- ═══════════════ ORGANIZER RULES (ENGLISH) ═══════════════ -->
  <div class="section-title section-organizer">👤 Organizer Rules</div>
  ${organizer.english
    .map(
      (r) => `
  <div class="rule rule-organizer">
    <h3>${r.icon} ${r.title}</h3>
    <p>${r.text}</p>
  </div>`
    )
    .join("")}

  <hr class="divider">

  <!-- ═══════════════ MEMBER RULES (ENGLISH) ═══════════════ -->
  <div class="section-title section-member">👥 Member Rules</div>
  ${member.english
    .map(
      (r) => `
  <div class="rule">
    <h3>${r.icon} ${r.title}</h3>
    <p>${r.text}</p>
  </div>`
    )
    .join("")}

  <hr class="divider">

  <!-- ═══════════════ ORGANIZER RULES (URDU) ═══════════════ -->
  <div class="section-title section-urdu">👤 رجسٹر کے قواعد — اردو</div>
  ${organizer.urdu
    .map(
      (r) => `
  <div class="rule rule-urdu">
    <h3>${r.icon} ${r.title}</h3>
    <p>${r.text}</p>
  </div>`
    )
    .join("")}

  <hr class="divider">

  <!-- ═══════════════ MEMBER RULES (URDU) ═══════════════ -->
  <div class="section-title section-urdu">👥 ممبران کے قواعد — اردو</div>
  ${member.urdu
    .map(
      (r) => `
  <div class="rule rule-urdu">
    <h3>${r.icon} ${r.title}</h3>
    <p>${r.text}</p>
  </div>`
    )
    .join("")}

  <div class="footer">
    <p>This document is computer-generated by Aitbaar and serves as the official committee rules.</p>
    <p>Generated on ${new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}</p>
  </div>
</body>
</html>`;
}

module.exports = {
  generateRules,
  saveRules,
  getRules,
  getRulesByRole,
  generatePdfHtml,
};
