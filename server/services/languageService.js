function detectLanguage(text) {
  if (!text || typeof text !== "string") {
    return "roman_urdu";
  }

  const value = text.trim();

  if (!value) {
    return "roman_urdu";
  }

  // --------------------------------------------------
  // 1. Proper Urdu script
  // --------------------------------------------------
  if (/[\u0600-\u06FF]/.test(value)) {
    return "urdu";
  }

  const lower = value.toLowerCase();

  // --------------------------------------------------
  // 2. English words
  // --------------------------------------------------
  const englishWords = new Set([
    "the", "this", "that", "these", "those", "what", "when", "where", "why",
    "how", "who", "which", "can", "could", "would", "should", "please",
    "tell", "show", "give", "want", "need", "help", "have", "has", "had",
    "is", "are", "was", "were", "do", "does", "did", "my", "your", "our",
    "their", "me", "you", "we", "they", "about", "from", "with", "for",
    "into", "months", "month", "monthly", "payment", "payments", "committee",
    "committees", "member", "members", "trust", "score", "payout", "balance",
    "status", "record", "verify", "hello", "hi", "thanks", "thank", "yes",
    "no", "join", "left", "remaining", "completed", "start", "end", "date"
  ]);

  // --------------------------------------------------
  // 3. Roman Urdu words
  // --------------------------------------------------
  const romanUrduWords = new Set([
    "hai", "hain", "ho", "tha", "thi", "the", "ka", "ki", "ke", "ko", "se",
    "ne", "pe", "par", "mera", "meri", "mere", "aap", "aapka", "aapki",
    "aapke", "mujhe", "mujhy", "main", "mein", "hum", "hamara", "hamari",
    "hamare", "kya", "kyun", "kyunke", "kaise", "kab", "kahan", "kitna",
    "kitni", "kitne", "nahi", "nahin", "haan", "acha", "achha", "theek",
    "batao", "batayein", "batana", "chahiye", "karna", "karni", "karne",
    "karo", "hoga", "hogi", "hona", "jana", "aana", "gaya", "gayi", "raha",
    "rahi", "paisa", "paise", "rakam", "maheena", "maheene", "mahina",
    "mahine", "qawaid", "uska", "uski", "yeh", "woh", "is", "committee",
    "kameti", "payment", "payout", "trust", "score", "shukriya", "mubarak",
    "please", "help"
  ]);

  // --------------------------------------------------
  // 4. Tokenize properly
  // --------------------------------------------------
  const words = lower
    .replace(/[^\p{L}\p{N}'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  let englishScore = 0;
  let romanUrduScore = 0;

  for (const word of words) {
    if (englishWords.has(word)) englishScore++;
    if (romanUrduWords.has(word)) romanUrduScore++;
  }

  console.log("Language detection:", { text: value, englishScore, romanUrduScore });

  // --------------------------------------------------
  // 5. Clear language
  // --------------------------------------------------
  if (englishScore > romanUrduScore && englishScore >= 2) return "english";
  if (romanUrduScore > englishScore && romanUrduScore >= 2) return "roman_urdu";

  // --------------------------------------------------
  // 6. Single strong signal
  // --------------------------------------------------
  if (englishScore > 0 && romanUrduScore === 0) return "english";
  if (romanUrduScore > 0 && englishScore === 0) return "roman_urdu";

  // --------------------------------------------------
  // 7. Special English sentence detection
  // --------------------------------------------------
  const englishPatterns = [
    /\bhow much\b/i, /\bhow many\b/i, /\bhow long\b/i, /\bwhat is\b/i,
    /\bwhat are\b/i, /\bwhen is\b/i, /\bwhen will\b/i, /\bwhere is\b/i,
    /\bcan i\b/i, /\bdo i\b/i, /\bmy payment\b/i, /\bmy committee\b/i,
    /\bmonthly payment\b/i, /\bmonths left\b/i, /\bmonths remaining\b/i
  ];

  if (englishPatterns.some((pattern) => pattern.test(value))) return "english";

  return "roman_urdu";
}

// --------------------------------------------------
// Response language
// --------------------------------------------------

function getResponseLanguage(detectedLanguage, storedLanguage) {
  const supportedLanguages = ["english", "roman_urdu", "urdu"];

  if (supportedLanguages.includes(detectedLanguage)) return detectedLanguage;
  if (supportedLanguages.includes(storedLanguage)) return storedLanguage;

  return "roman_urdu";
}

// --------------------------------------------------
// Message helper
// --------------------------------------------------

function getMessage(key, lang, vars) {
  vars = vars || {};

  const messageSet = MESSAGES[key];
  if (!messageSet) return "";

  let msg = messageSet[lang] || messageSet["roman_urdu"] || "";

  Object.keys(vars).forEach((key) => {
    const value = vars[key] ?? "";
    msg = msg.replace(new RegExp("\\{" + key + "\\}", "g"), String(value));
  });

  return msg;
}

// --------------------------------------------------
// Static messages
// --------------------------------------------------

const MESSAGES = {
  welcome: {
    urdu: "السلام علیکم! میں اعتبار ہوں۔ آپ کمیٹی میں رجسٹر ہونے کے لیے اپنا کمیٹی کوڈ بتائیں۔",
    roman_urdu: "Assalam o Alaikum! Main Aitbaar hoon. Committee mein registration karwane ke liye apna committee code bataiye.",
    english: "Assalam o Alaikum! I'm Aitbaar, your agent. To register in a committee, please share your committee code."
  },

  invalidCode: {
    urdu: "یہ کمیٹی کوڈ صحیح نہیں ہے۔ براہِ کرم اپنے آرگنائزر سے دوبارہ تصدیق کر لیں۔",
    roman_urdu: "Yeh committee code sahi nahi hai. Apne organizer se dobara confirm kar lein.",
    english: "This committee code is not valid. Please confirm with your organizer."
  },

  joinAnother: {
    urdu: "بالکل! آپ کون سی کمیٹی میں شامل ہونا چاہتے ہیں؟ براہِ کرم نیا کمیٹی کوڈ بتائیں۔",
    roman_urdu: "Bilkul! Aap kaunsi committee mein shamil hona chahte hain? Apna naya committee code batayein.",
    english: "Of course! Which committee would you like to join? Please provide the new committee code."
  },

  alreadyMember: {
    urdu: "آپ پہلے سے اس کمیٹی کے ممبر ہیں!",
    roman_urdu: "Aap pehle se is committee ke member hain!",
    english: "You are already a member of this committee!"
  },

  whichCommittee: {
    urdu: "آپ {count} کمیٹیوں کے ممبر ہیں۔ کس کمیٹی کی بات ہو رہی ہے؟",
    roman_urdu: "Aap {count} committees ke member hain. Kis committee ki baat ho rahi hai?",
    english: "You are a member of {count} committees. Which committee are you referring to?"
  },


  askName: {
    urdu: "رجسٹریشن مکمل کرنے کے لیے براہِ کرم اپنا نام بتائیں:\nنام: [آپ کا نام]",
    roman_urdu: "Registration complete karne ke liye please apna naam batayein:\nName: [aapka naam]",
    english: "To complete registration, please provide your name :\nName: [your name]"
  },

  invalidNameAndPhone: {
    urdu: "معاف کیجیے، براہِ کرم درست فارمیٹ میں بتائیں:\nنام: [آپ کا نام]",
    roman_urdu: "Maaf kijiye, sahi format mein batayein:\nName: [aapka naam]\nPhone: [aapka number]",
    english: "Sorry, please provide it in this format:\nName: [your name]"
  },

  registrationComplete: {
    urdu: "مبارک ہو {name}! آپ \"{committee}\" کمیٹی میں رجسٹر ہو گئے ہیں۔\n\nنام: {name}\nفون: {phone}\nماہانہ ادائیگی: Rs {amount}\nمدت: {duration} مہینے",
    roman_urdu: "Mubarak ho {name}! Aap \"{committee}\" committee mein register ho gaye hain.\n\nName: {name}\nPhone: {phone}\nMaheenaana payment: Rs {amount}\nMuddat: {duration} maheene",
    english: "Congratulations {name}! You are now registered in \"{committee}\" committee.\n\nName: {name}\nPhone: {phone}\nMonthly payment: Rs {amount}\nDuration: {duration} months"
  },

  rulesAccepted: {
    urdu: "شکریہ {name}! آپ کی rules acceptance ریکارڈ ہو گئی ہے۔",
    roman_urdu: "Shukriya {name}! Aapki rules acceptance record ho gayi hai.",
    english: "Thank you {name}! Your rules acceptance has been recorded."
  },

  pendingPayment: {
    urdu: "آپ کی Rs {amount} کی {month} کی ادائیگی ہو گئی ہے۔ آرگنائزر پیمنٹ کنفرم کرے گا تو آپ کا پیمنٹ اسٹیٹس کنفرم ہو جائے گا۔",
    roman_urdu: "Apke Rs {amount} {month} ke payment hogaye hai. Organizer payment confirm karega to apka payment status confirm ho jaye ga.",
    english: "Your Rs {amount} payment for {month} has been recorded. Once the organizer confirms it, your payment status will be marked confirmed."

  },

  committeeFull: {
    urdu: "یہ کمیٹی بھر چکی ہے۔ آرگنائزر سے رابطہ کریں۔",
    roman_urdu: "Yeh committee bhar chuki hai. Organizer se rabta karein.",
    english: "This committee is full. Please contact the organizer."
  },

  sorryNotUnderstood: {
    urdu: "معاف کیجیے، میں سمجھ نہیں پایا۔ براہِ کرم دوبارہ کوشش کریں۔",
    roman_urdu: "Maaf kijiye, main samajh nahi paya. Dobara koshish karein.",
    english: "Sorry, I did not understand. Please try again."
  },

  askPriorityReason: {
    urdu: "{committee} کے لیے۔\nبراہِ مہربانی اپنی وجہ تفصیل سے بتائیں، آڈیو نوٹ یا ٹیکسٹ میں۔",
    roman_urdu: "{committee} ke liye.\nBaraye mehrbani apni wajah tafseel se batayein - audio note ya text mein.",
    english: "{committee}.\nPlease explain your reason in detail - via voice note or text."
  },

  askCommitteeCode: {
    urdu: "براہِ مہربانی اپنا کمیٹی کوڈ بتائیں۔",
    roman_urdu: "Baraye mehrbani apna committee code batayein.",
    english: "Please enter your committee code."
  },

  memberCommitteesList: {
    urdu: "آپ ان کمیٹیوں کے ممبر ہیں:\n{list}\n\nکس کمیٹی کا کوڈ چاہیے؟ اُس کمیٹی کا کوڈ بتائیں۔",
    roman_urdu: "Ap is waqt {count} kameti mein registered hain. Kis committee ki information maloom karna chahte hain? Please us committee ka code provide karein.\n\n{list}",
    english: "You are currently registered in {count} committees. Which committee would you like information about? Please provide that committee's code.\n\n{list}"
  },

  multipleMemberships: {
    urdu: "آپ اب {count} کمیٹیوں کے ممبر ہیں:\n{list}",
    roman_urdu: "Aap ab {count} committees ke member hain:\n{list}",
    english: "You are now a member of {count} committees:\n{list}"
  },

  askPaymentAmount: {
    urdu: "{committee} کے لیے۔ ماہانہ contribution: Rs {amount}\nآپ نے کتنی رقم بھیجی ہے؟",
    roman_urdu: "{committee} ke liye. Maheenaana contribution: Rs {amount}\nAapne kitni rakam bheji hai?",
    english: "{committee}. Monthly contribution: Rs {amount}\nHow much have you paid?"
  },

  rulesAcceptancePrompt: {
    urdu: "کیا آپ ان قواعد سے اتفاق کرتے ہیں؟\n\nجواب دیں:\n*ہاں* — اگر آپ قبول کرتے ہیں\n*نہیں* — اگر آپ قبول نہیں کرتے",
    roman_urdu: "Kya aap in qawaid se ittefaq karte hain?\n\nJawab dein:\n*Haan* - agar aap qubool karte hain\n*Nahi* - agar aap qubool nahi karte",
    english: "Do you agree to these rules?\n\nReply with:\n*Yes* - if you accept\n*No* - if you do not accept"
   

  },

  confirmRegistration: {
    urdu: "آپ \"{name}\" کمیٹی میں شامل ہو رہے ہیں۔\nماہانہ contribution: Rs {amount}\nکل ممبران: {members}\n\nکیا آپ اس کمیٹی کے ممبر بننا چاہتے ہیں؟\n1. ہاں، مجھے رجسٹر کرو\n2. نہیں، منسوخ کریں",
    roman_urdu: "Aap \"{name}\" committee mein shamil ho rahe hain.\nMaheenaana contribution: Rs {amount}\nTotal members: {members}\n\nKya aap is committee ke member banna chahte hain?\n1. Haan, Mujhe Register Karo\n2. Nahi, Cancel",
    english: "You are joining \"{name}\" committee.\nMonthly contribution: Rs {amount}\nTotal members: {members}\n\nWould you like to register?\n1. Yes, Register Me\n2. No, Cancel"
  },

  registrationError: {
    urdu: "رجسٹریشن میں مسئلہ ہوا۔ براہِ کرم دوبارہ کوشش کریں۔",
    roman_urdu: "Registration mein masla hua. Dobara try karein.",
    english: "Registration failed. Please try again."
  },

  trustScoreResponse: {
    urdu: "{committee} میں آپ کا ٹرسٹ اسکور: {score}/100 ⭐\n{message}",
    roman_urdu: "{committee} mein aapka trust score: {score}/100 ⭐\n{message}",
    english: "{committee} trust score: {score}/100 ⭐\n{message}"
  }
};

module.exports = {
  detectLanguage,
  getResponseLanguage,
  getMessage,
  MESSAGES
};