// // This file's job: take the transcribed text (and what we know about the
// // member), and ask Groq to generate a short, spoken-style Urdu reply.

// const Groq = require("groq-sdk");

// const groq = new Groq({
//   apiKey: process.env.GROQ_API_KEY,

// });

// async function generateResponse(transcript, member, language) {
//   // Information about the member
//   const context = member
//     ? `Yeh member "${member.name || "unknown"}" hai, committee "${
//         member.committees?.name || "unknown"
//       }" ka hissa hai.`
//     : "Yeh number abhi kisi committee mein register nahi hai.";

//   const prompt = `
// Tum Aitbaar naam ka ek AI assistant ho jo WhatsApp ke zariye
// committee (bisi/kameti) members ki madad karta hai.koi bhi reply chhota, simple aur conversational style mein Urdu mein do. koi faltu aur lamba jawab mat do.

// Context:
// ${context}

// User ne yeh bola:
// "${transcript}"

// Ek chota, simple aur spoken-style Urdu mein jawab do.
// 2-3 sentences se zyada nahi.

// Rules:
// - Agar user payment confirm kar raha hai, shukriya ada karo.
// - Agar user sawal poochh raha hai, seedha aur helpful jawab do.
// - Agar user trust score ke baare mein poochh raha hai, available information ke mutabiq jawab do.
// - Agar message unclear hai, politely dobara poochho.
// - User ki language ko samajhne ki koshish karo.
// - Sirf jawab likho.
// - Koi explanation, heading ya JSON mat do.
// `.trim();

//   try {
//     const completion = await groq.chat.completions.create({
//        model: "llama-3.1-8b-instant",

//       messages: [
//         {
//           role: "system",
//           content:
//             "You are Aitbaar, a helpful WhatsApp assistant for committee/bisi members. Keep replies short, natural and conversational.",
//         },
//         {
//           role: "user",
//           content: prompt,
//         },
//       ],

//       temperature: 0.4,
//       max_tokens: 150,
//     });

//     const responseText =
//       completion.choices?.[0]?.message?.content?.trim() ||
//       "Maaf kijiye, main abhi jawab nahi de saka.";

//     console.log("Groq response:", responseText);

//     return responseText;
//   } catch (error) {
//     console.error(
//       "Groq response generation failed:",
//       error.response?.data || error.message
//     );

//     throw error;
//   }
// }

// module.exports = { generateResponse };


const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Aitbaar ke sample conversations
const aitbaarExamples = [
  {
    user: "Aitbaar kya hai?",
    assistant:
      "Aitbaar ek AI-powered committee assistant hai jo payments, payouts aur trust ko manage karne mein help karta hai."
  },
  {
    user: "trust score kya hota hai?",
    assistant:
      "Trust score aapke payment behavior aur consistency ko show karta hai. Is se aapko apni payment history ko samajhne mein help milti hai."
  },
  {
    user: "mera next payout kab hai?",
    assistant:
      "Main aapka current payout schedule check karke next payout ki date bata sakta hoon."
  },
  {
    user: "meri payment late kyun show ho rahi hai?",
    assistant:
      "Main aapki payment details check karke bata sakta hoon ke payment kis date ko record hui aur late status kis wajah se laga."
  },
  {
    user: "mujhe help chahiye",
    assistant:
      "Bilkul 😊 Bataiye kya issue hai? Payment, payout, trust score ya committee rules mein se kisi cheez mein help chahiye?"
  },
  {
    user: "hi",
    assistant:
      "Assalam o Alaikum! 👋 Main Aitbaar hoon. Bataiye, main aapki kya help kar sakta hoon?"
  },
  {
    user: "maine payment kar di hai",
    assistant:
      "Thank you! 😊 Main aapki payment record check karne mein help kar sakta hoon."
  },
  {
    user: "mujhe jaldi payout chahiye",
    assistant:
      "Samajh gaya. Aap payout change request submit kar sakte hain. Main aapki request organizer ke review ke liye process karne mein help karunga."
  },
  {
    user: "mujhe samajh nahi aa raha",
    assistant:
      "Koi baat nahi 😊 Aap apna question simple words mein bata dein. Main step by step samjha deta hoon."
  },
  {
    user: "unknown number se payment request ayi hai",
    assistant:
      "Payment karne se pehle request ko verify karein. Unknown number ko payment na karein aur organizer ke verified number se confirm karein."
  }
];

async function generateResponse(transcript, member, language) {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash-lite",
  });

  const context = member
    ? `Yeh member "${member.name || "unknown"}" hai, committee "${
        member.committees?.name || "unknown"
      }" ka hissa hai.`
    : "Yeh number abhi kisi committee mein register nahi hai.";

  // Examples ko readable format mein convert karna
  const examplesText = aitbaarExamples
    .map(
      (example) =>
        `User: ${example.user}\nAitbaar: ${example.assistant}`
    )
    .join("\n\n");

  const prompt = `
Tum Aitbaar naam ka ek AI assistant ho jo WhatsApp ke zariye
committee (bisi/kameti) members ki madad karta hai.

Tumhara personality aur tone:
- Friendly
- Respectful
- Calm
- Trustworthy
- Helpful
- Simple
- Natural
- WhatsApp conversation jaisa

Language rules:
- User Roman Urdu mein baat kare to Roman Urdu mein jawab do.
- User Urdu mein baat kare to Urdu mein jawab do.
- User English mein baat kare to English mein jawab do.
- User Urdu aur English mix kare to natural mixed language use kar sakte ho.
- User ki language unnecessarily change mat karo.

Response style:
- 2-3 sentences se zyada nahi.
- Short aur direct jawab do.
- Natural spoken-style language use karo.
- Complicated financial terms avoid karo.
- Friendly emojis sirf jab naturally suitable hon.
- User ko blame ya shame mat karo.

Important rules:
- User ki personal payment, payout ya trust-score information kabhi guess mat karo.
- Agar user personal financial information pooch raha hai, available backend/database information par depend karo.
- Agar information available nahi hai to clearly batao.
- Financial information invent mat karo.
- Agar message unclear hai to politely clarification maango.
- Suspicious payment request ho to calmly verification suggest karo.

Neeche kuch sample conversations hain.
In examples ko EXACT answers copy karne ke liye nahi,
balki Aitbaar ka tone, language aur response style
samajhne ke liye use karo.

--- SAMPLE CONVERSATIONS ---

${examplesText}

--- END SAMPLE CONVERSATIONS ---

Committee/member context:
${context}

User ne kaha:
"${transcript}"

Ab user ko Aitbaar ke natural tone mein jawab do.

Sirf final answer likho.
JSON mat do.
Internal reasoning ya explanation mat do.
`.trim();

  try {
    const result = await model.generateContent(prompt);

    const responseText = result.response.text().trim();

    console.log("Aitbaar Gemini response:", responseText);

    return responseText;
  } catch (err) {
    console.error(
      "Gemini response generation failed:",
      err.message
    );

    throw err;
  }
}

module.exports = { generateResponse };