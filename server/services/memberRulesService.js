const fs = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");
const supabase = require("../config/supabaseClient");
const {
  uploadWhatsAppMedia,
  sendWhatsAppDocument,
  sendInteractiveButtons,
} = require("./mediaService");

// ---------------------------------------------------------------------------
// Rules data
// ---------------------------------------------------------------------------
const POLICIES_MEMBER_EN = [
  { id: 1, title: "Accurate Information", text: "Members must provide accurate and complete information during registration and whenever requested by Aitbaar or the committee organizer." },
  { id: 2, title: "Payment Responsibility", text: "Members are responsible for making their committee contributions on time according to the agreed payment schedule." },
  { id: 3, title: "Payment Verification", text: "After making a payment, members must provide the required payment information or proof through Aitbaar. A payment will remain pending until it is verified by the committee organizer." },
  { id: 4, title: "Trust Score", text: "A member's trust score is based on their verified payment behavior and other relevant committee activity. The trust score is designed to promote transparency and reliability and cannot be purchased or changed through paid features." },
  { id: 5, title: "Payout Order", text: "Members must follow the agreed payout order of the committee. No member can purchase a better position or bypass the agreed payout process." },
  { id: 6, title: "Payout Changes", text: "If a member requests a change to their payout position, the request must follow the committee's defined rules and approval process. Aitbaar's AI may provide suggestions, but it does not make the final decision." },
  { id: 7, title: "Multiple Committees", text: "A member may participate in more than one committee using the same account or WhatsApp number. Committee-specific payments, payouts, trust scores, and other information will remain separate." },
  { id: 8, title: "Fraud and Suspicious Activity", text: "Members must not provide false payment information, use fraudulent payment methods, impersonate another person, or attempt to manipulate committee records. Suspicious activity may trigger an Aitbaar fraud alert and additional verification." },
  { id: 9, title: "Disputes", text: "If a member has a payment, payout, or committee-related dispute, they should report it through the appropriate Aitbaar or organizer process. Members should provide accurate information and supporting details when requested." },
  { id: 10, title: "Respectful Communication", text: "Members must communicate respectfully with organizers and other committee members. Harassment, threats, abuse, or intentionally disruptive behavior is not permitted." },
  { id: 11, title: "Data and Conversations", text: "Committee-related information and conversations with Aitbaar may be stored to support the member, maintain accurate records, provide committee services, and improve relevant functionality." },
  { id: 12, title: "Leaving a Committee", text: "If a member chooses to leave a committee, they are responsible for understanding any remaining obligations under the committee's agreed rules. Aitbaar does not guarantee or take responsibility for obligations created by a member leaving the committee." },
  { id: 13, title: "Security", text: "Members are responsible for keeping their account information and authentication details secure. Members should not share verification codes, or other account credentials with anyone." },
  { id: 14, title: "No Financial Guarantee", text: "Aitbaar provides technology and committee-management services. Aitbaar does not guarantee that a member will receive a specific payout amount by a specific date unless that commitment is explicitly supported by the applicable committee arrangement." },
  { id: 15, title: "Policy Acceptance", text: "By joining a committee, the member confirms that they have read, understood, and agreed to these Aitbaar Committee Member Rules and the specific rules of the committee they are joining." },
];

const POLICIES_MEMBER_UR = [
  { id: 1, title: "درست معلومات", text: "ممبرز کو رجسٹریشن کے وقت اور جب بھی اعتبار یا کمیٹی آرگنائزر کی جانب سے درخواست کی جائے، درست اور مکمل معلومات فراہم کرنی ہوں گی۔" },
  { id: 2, title: "ادائیگی کی ذمہ داری", text: "ممبرز طے شدہ ادائیگی کے شیڈول کے مطابق اپنی کمیٹی کی قسط بروقت ادا کرنے کے ذمہ دار ہیں۔" },
  { id: 3, title: "ادائیگی کی تصدیق", text: "ادائیگی کرنے کے بعد ممبرز کو اعتبار کے ذریعے مطلوبہ ادائیگی کی معلومات یا ثبوت فراہم کرنا ہوگا۔ جب تک کمیٹی آرگنائزر تصدیق نہ کرے، ادائیگی زیر التوا رہے گی۔" },
  { id: 4, title: "ٹرسٹ اسکور", text: "ممبر کا ٹرسٹ اسکور ان کی تصدیق شدہ ادائیگیوں اور دیگر متعلقہ کمیٹی سرگرمیوں پر مبنی ہوتا ہے۔ ٹرسٹ اسکور شفافیت اور اعتماد کو فروغ دینے کے لیے بنایا گیا ہے اور اسے خریدا یا کسی معاوضے کے ذریعے تبدیل نہیں کیا جا سکتا۔" },
  { id: 5, title: "پے آؤٹ کی ترتیب", text: "ممبرز کو کمیٹی کی طے شدہ پے آؤٹ ترتیب کی پابندی کرنی ہوگی۔ کوئی بھی ممبر بہتر پوزیشن خرید یا طے شدہ عمل کو نظرانداز نہیں کر سکتا۔" },
  { id: 6, title: "پے آؤٹ میں تبدیلی", text: "اگر کوئی ممبر اپنی پے آؤٹ پوزیشن میں تبدیلی کی درخواست کرتا ہے، تو یہ درخواست کمیٹی کے مقررہ اصولوں اور منظوری کے عمل کے مطابق ہونی چاہیے۔ اعتبار کا اے آئی تجاویز دے سکتا ہے، لیکن حتمی فیصلہ نہیں کرتا۔" },
  { id: 7, title: "ایک سے زیادہ کمیٹیاں", text: "ایک ممبر ایک ہی اکاؤنٹ یا واٹس ایپ نمبر کے ذریعے ایک سے زیادہ کمیٹیوں میں شامل ہو سکتا ہے۔ ہر کمیٹی کی ادائیگیاں، پے آؤٹس، ٹرسٹ اسکور اور دیگر معلومات الگ الگ رہیں گی۔" },
  { id: 8, title: "فراڈ اور مشکوک سرگرمی", text: "ممبرز کو غلط ادائیگی کی معلومات فراہم کرنے، فراڈ ادائیگی کے طریقے استعمال کرنے، کسی اور شخص کی نقالی کرنے، یا کمیٹی کے ریکارڈ میں ردوبدل کرنے کی اجازت نہیں ہے۔ مشکوک سرگرمی اعتبار کی جانب سے فراڈ الرٹ اور اضافی تصدیق کا باعث بن سکتی ہے۔" },
  { id: 9, title: "تنازعات", text: "اگر کسی ممبر کو ادائیگی، پے آؤٹ یا کمیٹی سے متعلق کوئی تنازع ہو تو انہیں اسے اعتبار یا آرگنائزر کے مناسب طریقہ کار کے ذریعے رپورٹ کرنا چاہیے۔ ممبرز کو درخواست کے وقت درست معلومات اور ضروری تفصیلات فراہم کرنی چاہئیں۔" },
  { id: 10, title: "باعزت رابطہ", text: "ممبرز کو آرگنائزرز اور دیگر کمیٹی ممبرز کے ساتھ باعزت گفتگو کرنی چاہیے۔ ہراساں کرنا، دھمکیاں دینا، بدسلوکی، یا جان بوجھ کر خلل ڈالنے والا رویہ قابل قبول نہیں ہے۔" },
  { id: 11, title: "ڈیٹا اور گفتگو", text: "کمیٹی سے متعلق معلومات اور اعتبار کے ساتھ گفتگو کو ممبر کی مدد کرنے، درست ریکارڈ برقرار رکھنے، کمیٹی کی خدمات فراہم کرنے اور متعلقہ فعالیت کو بہتر بنانے کے لیے محفوظ کیا جا سکتا ہے۔" },
  { id: 12, title: "کمیٹی چھوڑنا", text: "اگر کوئی ممبر کمیٹی چھوڑنے کا فیصلہ کرتا ہے، تو وہ کمیٹی کے طے شدہ اصولوں کے تحت باقی ذمہ داریوں کو سمجھنے کا خود ذمہ دار ہے۔ اعتبار ممبر کے کمیٹی چھوڑنے سے پیدا ہونے والی ذمہ داریوں کی ضمانت نہیں دیتا اور نہ ہی ان کا ذمہ دار ہے۔" },
  { id: 13, title: "سیکیورٹی", text: "ممبرز اپنے اکاؤنٹ کی معلومات اور تصدیقی تفصیلات کو محفوظ رکھنے کے ذمہ دار ہیں۔ ممبرز کو تصدیقی کوڈز یا دیگر اکاؤنٹ کی معلومات کسی کے ساتھ شیئر نہیں کرنی چاہئیں۔" },
  { id: 14, title: "مالی ضمانت کا فقدان", text: "اعتبار ٹیکنالوجی اور کمیٹی مینجمنٹ کی خدمات فراہم کرتا ہے۔ اعتبار اس بات کی ضمانت نہیں دیتا کہ کسی ممبر کو کسی مخصوص تاریخ تک کوئی مخصوص پے آؤٹ رقم ملے گی، جب تک کہ یہ عہد کمیٹی کے قابل اطلاق انتظام کے تحت واضح طور پر شامل نہ ہو۔" },
  { id: 15, title: "پالیسی کی منظوری", text: "کسی کمیٹی میں شامل ہو کر ممبر اس بات کی تصدیق کرتا ہے کہ اس نے یہ اعتبار کمیٹی ممبر رولز اور جس کمیٹی میں شامل ہو رہا ہے اس کے مخصوص اصول پڑھ، سمجھ اور قبول کر لیے ہیں۔" },
];

const ACCEPTANCE_PROMPTS = {
  english: { body: "Do you agree to these rules?", yes: "Yes", no: "No" },
  urdu: { body: "کیا آپ ان قواعد سے اتفاق کرتے ہیں؟", yes: "ہاں", no: "نہیں" },
  roman_urdu: { body: "Kya aap in qawaid se ittefaq karte hain?", yes: "Haan", no: "Nahi" },
};

// ---------------------------------------------------------------------------
// PDF generation (HTML -> PDF via Puppeteer, so Urdu/RTL renders correctly)
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildRulesHtml(lang) {
  const isUrdu = lang === "urdu";
  const rules = isUrdu ? POLICIES_MEMBER_UR : POLICIES_MEMBER_EN;
  const heading = isUrdu ? "اعتبار کمیٹی ممبر رولز" : "Aitbaar Committee Member Rules";

  const rulesHtml = rules
    .map((r) => `<div class="rule"><h3>${r.id}. ${escapeHtml(r.title)}</h3><p>${escapeHtml(r.text)}</p></div>`)
    .join("\n");

  return `
  <!DOCTYPE html>
  <html lang="${isUrdu ? "ur" : "en"}" dir="${isUrdu ? "rtl" : "ltr"}">
  <head>
    <meta charset="UTF-8" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu&family=Inter:wght@400;600&display=swap');
      body { font-family: ${isUrdu ? "'Noto Nastaliq Urdu'" : "'Inter'"}, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.8; }
      h1 { font-size: 22px; margin-bottom: 24px; text-align: center; }
      .rule { margin-bottom: 16px; }
      h3 { font-size: 15px; margin: 0 0 4px 0; }
      p { font-size: 13px; margin: 0; }
    </style>
  </head>
  <body>
    <h1>${heading}</h1>
    ${rulesHtml}
  </body>
  </html>`;
}

async function generateRulesPdf(lang) {
  const html = buildRulesHtml(lang);
  const outputPath = path.join(os.tmpdir(), `aitbaar-member-rules-${lang}-${Date.now()}.pdf`);

  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: outputPath, format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
  return outputPath;
}

// ---------------------------------------------------------------------------
// Member rules state (Supabase-backed)
// NOTE: adjust table/column names ("members", "phone", "rules_sent",
// "rules_accepted") to match your actual schema.
// ---------------------------------------------------------------------------
async function getMemberRulesState(phone) {
  const { data, error } = await supabase
    .from("members")
    .select("rules_sent, rules_accepted")
    .eq("phone", phone)
    .single();

  if (error) {
    console.error("Error fetching member rules state:", error.message);
    return { rules_sent: false, rules_accepted: null };
  }
  return data;
}

async function updateMemberRulesState(phone, fields) {
  const { error } = await supabase.from("members").update(fields).eq("phone", phone);
  if (error) console.error("Error updating member rules state:", error.message);
}

// ---------------------------------------------------------------------------
// Orchestrator: send PDF + acceptance prompt, with condition logic
// ---------------------------------------------------------------------------
async function sendMemberRulesToWhatsApp(phone, lang = "english") {
  const state = await getMemberRulesState(phone);

  // Already accepted -> don't resend
  if (state.rules_accepted === true) {
    return { skipped: true, reason: "already_accepted" };
  }

  // Already sent, still waiting on a reply -> re-nudge only, don't resend PDF
  if (state.rules_sent && state.rules_accepted === null) {
    await sendAcceptancePrompt(phone, lang);
    return { skipped: true, reason: "awaiting_reply_resent_prompt" };
  }

  // Not sent yet, or previously declined -> (re)send the PDF
  const pdfPath = await generateRulesPdf(lang);
  try {
    const mimeType = "application/pdf";
    const mediaId = await uploadWhatsAppMedia(pdfPath, mimeType);
    const filename = lang === "urdu" ? "Aitbaar_Member_Rules_UR.pdf" : "Aitbaar_Member_Rules_EN.pdf";
    const caption = lang === "urdu" ? "براہ کرم اعتبار کمیٹی ممبر رولز پڑھیں۔" : "Please read the Aitbaar Committee Member Rules.";

    await sendWhatsAppDocument(phone, mediaId, filename, caption);
    await sendAcceptancePrompt(phone, lang);

    await updateMemberRulesState(phone, { rules_sent: true, rules_accepted: null });

    return { skipped: false, sent: true };
  } finally {
    fs.unlink(pdfPath, () => {});
  }
}

async function sendAcceptancePrompt(phone, lang) {
  const p = ACCEPTANCE_PROMPTS[lang] || ACCEPTANCE_PROMPTS.english;
  return sendInteractiveButtons(phone, p.body, [
    { id: "rules_accept_yes", title: p.yes },
    { id: "rules_accept_no", title: p.no },
  ]);
}

// ---------------------------------------------------------------------------
// Call this from your webhook handler when a button reply arrives
// ---------------------------------------------------------------------------
async function handleAcceptanceReply(phone, buttonId) {
  if (buttonId === "rules_accept_yes") {
    await updateMemberRulesState(phone, { rules_accepted: true });
    return { accepted: true };
  }
  if (buttonId === "rules_accept_no") {
    await updateMemberRulesState(phone, { rules_accepted: false });
    return { accepted: false };
  }
  return { accepted: null }; // not a rules-related reply
}

module.exports = {
  POLICIES_MEMBER_EN,
  POLICIES_MEMBER_UR,
  sendMemberRulesToWhatsApp,
  handleAcceptanceReply,
};