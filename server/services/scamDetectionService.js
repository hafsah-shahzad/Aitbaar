const supabase = require("../config/supabaseClient");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────────────────────
// RULE-BASED KEYWORD DETECTION
// Fast, no-API-cost first pass. Catches obvious scam
// patterns before the AI even runs.
// ─────────────────────────────────────────────────────────

const SCAM_KEYWORDS = {
  account_change: [
    "new account", "naya account", "naya number", "new number",
    "change account", "account badal", "number badal",
    "new bank", "naya bank", "new jazzcash", "naya jazzcash",
    "new easypaisa", "naya easypaisa", "new sadapay", "naya sadapay",
    "is account mein bhejo", "is number pe bhejo",
    "dusre account", "alag account", "new upi",
  ],
  urgency_pressure: [
    "jaldi karo", "turant karo", "abhi karo", "furan karo",
    "do it now", "hurry up", "urgent hai", "bohot zaroori hai",
    "time nahi hai", "raat tak", "aaj tak", "is waqt",
    "last chance", "aakhri mauka", "miss ho jayega",
    "paise kat jayenge", " penalty lagegi", "account band",
  ],
  secrecy: [
    "admin ko mat batao", "admin ko mat batana",
    "don't tell admin", "don't tell organizer",
    "organizer ko mat batao", "organizer ko mat batana",
    "kisi ko mat batao", "kisi ko nahi batana",
    "keep it secret", "raaz rakho", "chup rakho",
    "sirf tumhe pata hai", "sirf aapko pata hai",
    "privately karo", "secretly karo",
  ],
  impersonation: [
    "main organizer hoon", "i am the organizer",
    "main admin hoon", "i am the admin",
    "organizer ne bheja hai", "organizer sent me",
    "admin ka message hai", "this is from admin",
    "mera number naya hai", "this is my new number",
    "organizer ka naya number", "admin ka naya number",
    "main committee se bol raha hoon",
  ],
  payment_scam: [
    "payment bhejo", "paisay bhejo", "transfer karo",
    "raam raam", "jaldi paisay bhejo",
    "account details", "bank details", "account number",
    "iban", "wallet address",
  ],
};

// ─────────────────────────────────────────────────────────
// RULE-BASED SCAN
// Returns matched categories and a raw risk score.
// ─────────────────────────────────────────────────────────

function ruleBasedScan(text) {
  const lower = text.toLowerCase();
  const matches = {};
  let rawScore = 0;

  for (const [category, keywords] of Object.entries(SCAM_KEYWORDS)) {
    const matched = keywords.filter((kw) => lower.includes(kw));
    if (matched.length > 0) {
      matches[category] = matched;
      // Weight: account_change and secrecy are heaviest
      if (category === "account_change") rawScore += matched.length * 30;
      else if (category === "secrecy") rawScore += matched.length * 25;
      else if (category === "impersonation") rawScore += matched.length * 25;
      else if (category === "urgency_pressure") rawScore += matched.length * 15;
      else if (category === "payment_scam") rawScore += matched.length * 20;
    }
  }

  return { matches, rawScore: Math.min(100, rawScore) };
}

// ─────────────────────────────────────────────────────────
// AI DEEP ANALYSIS
// Runs only if the rule-based scan flags something, or
// on a sample basis (1 in 10 messages) for zero-day scams.
// ─────────────────────────────────────────────────────────

async function aiScamAnalysis({
  transcript,
  senderPhone,
  senderName,
  committeeName,
  organizerPhone,
  ruleMatches,
  ruleScore,
}) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

  const prompt = `
You are a scam detection AI for Aitbaar, a committee (kameti/bisi) app in Pakistan.

Your job is to protect committee members from WhatsApp payment scams.

MESSAGE ANALYSIS:
- Sender: ${senderName || "Unknown"} (${senderPhone})
- Committee: ${committeeName}
- Registered organizer phone: ${organizerPhone}

RULE-BASED SCAN RESULTS:
- Raw risk score: ${ruleScore}/100
- Flagged categories: ${Object.keys(ruleMatches).join(", ") || "none"}

MESSAGE TEXT:
"${transcript}"

ANALYSIS RULES:
1. Check if the message tries to change the payment account/number.
2. Check if the sender is NOT the registered organizer.
3. Check for urgency language designed to pressure quick action.
4. Check for secrecy phrases ("don't tell admin", "keep it secret").
5. Check for impersonation ("I am the organizer", "this is from admin").
6. Check if the message references a different process than normal committee rules.
7. Even if the sender IS the organizer, flag if the message content is unusual.

Return ONLY valid JSON:
{
  "is_scam": true/false,
  "confidence": "high" | "medium" | "low",
  "risk_score": <0-100>,
  "flags": ["<list of specific scam indicators found>"],
  "scam_type": "account_swap" | "impersonation" | "urgency_scam" | "social_engineering" | "none",
  "explanation": "<2-3 sentences in Urdu/Roman Urdu explaining why this is or isn't suspicious>",
  "recommended_action": "block" | "warn" | "verify" | "safe"
}

Do NOT add markdown or text outside the JSON.
`.trim();

  try {
    const result = await model.generateContent(prompt);
    const text = result.response
      .text()
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(text);

    // Clamp values
    parsed.risk_score = Math.max(0, Math.min(100, Number(parsed.risk_score) || 0));
    if (!parsed.flags) parsed.flags = [];

    console.log("AI scam analysis:", parsed);
    return parsed;
  } catch (err) {
    console.error("AI scam analysis failed:", err.message);

    // If rule score is high, still warn even if AI fails
    if (ruleScore >= 40) {
      return {
        is_scam: true,
        confidence: "low",
        risk_score: ruleScore,
        flags: Object.values(ruleMatches).flat(),
        scam_type: "unknown",
        explanation: "AI analysis unavailable but rule-based scan flagged suspicious patterns.",
        recommended_action: "warn",
      };
    }

    return {
      is_scam: false,
      confidence: "low",
      risk_score: ruleScore,
      flags: [],
      scam_type: "none",
      explanation: "",
      recommended_action: "safe",
    };
  }
}

// ─────────────────────────────────────────────────────────
// FULL SCAN PIPELINE
// Rule-based → conditional AI → log → return verdict
// ─────────────────────────────────────────────────────────

async function scanMessage({
  transcript,
  senderPhone,
  senderName,
  committeeId,
  committeeName,
  organizerPhone,
}) {
  // 1. Rule-based scan (always runs, instant, no API cost)
  const { matches: ruleMatches, rawScore: ruleScore } = ruleBasedScan(transcript);

  // 2. Decide whether to run AI analysis
  //    - Always run if rule score >= 30 (suspicious)
  //    - Run 1 in 10 messages even if clean (zero-day detection)
  const shouldRunAI = ruleScore >= 30 || Math.random() < 0.1;

  let aiResult = null;

  if (shouldRunAI) {
    aiResult = await aiScamAnalysis({
      transcript,
      senderPhone,
      senderName,
      committeeName,
      organizerPhone,
      ruleMatches,
      ruleScore,
    });
  }

  // 3. Combine results
  const finalScore = aiResult
    ? Math.max(ruleScore, aiResult.risk_score)
    : ruleScore;

  const isScam = finalScore >= 50 || !!(aiResult && aiResult.is_scam);
  const recommendedAction = isScam
    ? (finalScore >= 70 ? "block" : "warn")
    : "safe";

  const allFlags = [
    ...Object.values(ruleMatches).flat(),
    ...(aiResult?.flags || []),
  ];

  const scamType = aiResult?.scam_type || "none";

  const explanation = aiResult?.explanation || "";

  // 4. Log to database (always, even if safe — for audit)
  const logEntry = await logScamAttempt({
    committeeId,
    senderPhone,
    senderName,
    transcript,
    riskScore: finalScore,
    isScam,
    scamType,
    flags: allFlags,
    ruleMatches,
    aiAnalyzed: !!aiResult,
    recommendedAction,
  });

  // 5. Build the result
  const result = {
    is_scam: isScam,
    risk_score: finalScore,
    scam_type: scamType,
    flags: allFlags,
    explanation,
    recommended_action: recommendedAction,
    log_id: logEntry?.id || null,
  };

  console.log(`[SCAM] scan complete: score=${finalScore}, is_scam=${!!isScam}, type=${scamType}`);
  return result;
}

// ─────────────────────────────────────────────────────────
// LOG SCAM ATTEMPT
// ─────────────────────────────────────────────────────────

async function logScamAttempt({
  committeeId,
  senderPhone,
  senderName,
  transcript,
  riskScore,
  isScam,
  scamType,
  flags,
  ruleMatches,
  aiAnalyzed,
  recommendedAction,
}) {
  // Ensure isScam is always a boolean — never null/undefined
  const safeIsScam = Boolean(isScam);
  const safeScore = Math.max(0, Math.min(100, Number(riskScore) || 0));
  const safeType = scamType || "none";

  console.log(`[SCAM] score=${safeScore}, is_scam=${safeIsScam}, type=${safeType}`);

  const { data, error } = await supabase
    .from("scam_alerts")
    .insert([{
      committee_id: committeeId,
      sender_phone: senderPhone,
      sender_name: senderName,
      transcript,
      risk_score: safeScore,
      is_scam: safeIsScam,
      scam_type: safeType,
      flags,
      rule_matches: ruleMatches,
      ai_analyzed: aiAnalyzed,
      recommended_action: recommendedAction,
      status: isScam ? "active" : "dismissed",
    }])
    .select()
    .single();

  if (error) {
    console.error("[SCAM] Failed to log scam attempt:", error.message, error);
    return null;
  }
  console.log("[SCAM] Alert saved successfully");

  return data;
}

// ─────────────────────────────────────────────────────────
// SCAM WARNING MESSAGE
// Pre-built warning message to send to members.
// ─────────────────────────────────────────────────────────

function getScamWarningMessage(flags, scamType) {
  const baseWarning =
    `🚨 *⚠️ اہتیاتی پیغام — Aitbaar Scam Shield*\n\n` +
    `یہ پیغام مشکوک لگ رہا ہے۔ براہ کرم نیچے دیے گئے نشانوں کو پہچانیں:\n\n`;

  const flagMessages = [];

  if (flags.includes("account_change") || scamType === "account_swap") {
    flagMessages.push(
      `🏦 *اکاؤنٹ تبدیلی:* کسی سے بھی نیا اکاؤنٹ نمبر لینے سے پہلے اپنے اصل organizer کا نمبر چیک کریں۔`
    );
  }
  if (flags.includes("impersonation") || scamType === "impersonation") {
    flagMessages.push(
      `👤 *نقلی شناخت:* بھیجنے والا اپنے آپ کو organizer/admin بتا رہا ہے۔ حقیقی organizer سے واٹس ایپ پر تصدیق کریں۔`
    );
  }
  if (flags.includes("urgency_pressure") || scamType === "urgency_scam") {
    flagMessages.push(
      `⏰ *جبری فوریت:* "جaldi karo" جیسے الفاظ اکثر اسکیم کا حصہ ہوتے ہیں۔ اپنے آپ پر دباؤ نہ ڈالیں۔`
    );
  }
  if (flags.includes("secrecy") || scamType === "social_engineering") {
    flagMessages.push(
      `🤫 *خفیگی:* "Admin ko mat batao" ایک عام اسکیم ہے۔ کمیٹی کے قوانین کے مطابق، organizer کو ہمیشہ اطلاع دیں۔`
    );
  }
  if (flags.includes("payment_scam")) {
    flagMessages.push(
      `💰 *ادائیگی کی درخواست:* کسی کو بھی ادائیگی اس وقت نہ کریں جب تک organizer سے 2 بار تصدیق نہ ہو جائے۔`
    );
  }

  if (flagMessages.length === 0) {
    flagMessages.push(
      `🔍 اس پیغام میں مشکوک پیٹرن ملے ہیں۔ براہ کرم احتیاط برتیں۔`
    );
  }

  const footer =
    `\n---\n` +
    `✅ *امن کیا کریں:*\n` +
    `1. اپنے organizer کا رجسٹرڈ نمبر چیک کریں\n` +
    `2. کمیٹی کوڈ اور اکاؤنٹ نمبر verify کریں\n` +
    `3. شک ہو تو ڈیش بورڈ سے تصدیق کریں\n\n` +
    `_— Aitbaar Scam Shield 🛡️_`;

  return baseWarning + flagMessages.join("\n\n") + footer;
}

// ─────────────────────────────────────────────────────────
// ALERT ORGANIZER
// Sends a scam alert to the committee organizer.
// ─────────────────────────────────────────────────────────

function getOrganizerAlertMessage(senderName, senderPhone, transcript, riskScore, scamType) {
  return (
    `🚨 *Aitbaar — Scam Alert*\n\n` +
    `Suspicious message detected in your committee.\n\n` +
    `📱 *From:* ${senderName || "Unknown"} (${senderPhone})\n` +
    `⚠️ *Risk Score:* ${riskScore}/100\n` +
    `🔍 *Type:* ${scamType}\n\n` +
    `📝 *Message:*\n"${transcript.substring(0, 200)}"\n\n` +
    `Review on your dashboard immediately.\n` +
    `_— Aitbaar Scam Shield 🛡️_`
  );
}

module.exports = {
  ruleBasedScan,
  aiScamAnalysis,
  scanMessage,
  logScamAttempt,
  getScamWarningMessage,
  getOrganizerAlertMessage,
};
