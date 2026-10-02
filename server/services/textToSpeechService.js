const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { EdgeTTS } = require("node-edge-tts");

// Urdu script
function hasUrduScript(text) {
  return /[\u0600-\u06FF]/.test(text);
}
// Devanagari (Hindi)
function hasDevanagari(text) {
  return /[\u0900-\u097F]/.test(text);
}
// Roman Urdu words detect karo
function looksLikeRomanUrdu(text) {
  const romanWords = /\b(hai|hain|kya|mera|meri|aap|ka|ki|ke|ko|se|main|mein|nahi|haan|acha|theek|batao|karo|paisa|score|trust|payment|committee|kameti|shukriya|salam|alaikum|kaise|kab|kitna)\b/i;
  return romanWords.test(text);
}

async function convertToSpeech(text) {
  try {
    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const outputPath = path.join(tempDir, `${uuidv4()}.mp3`);

    // ── Urdu voice agar Urdu/Hindi/Roman Urdu hai ──
    let voice, lang;
    if (hasUrduScript(text) || hasDevanagari(text) || looksLikeRomanUrdu(text)) {
      voice = "ur-PK-UzmaNeural";   // Urdu female (clear)
      lang = "ur-PK";
    } else {
      voice = "en-US-AriaNeural";   // English female
      lang = "en-US";
    }

    console.log(`TTS voice: "${voice}" (lang: ${lang})`);

    const tts = new EdgeTTS({
      voice: voice,
      lang: lang,
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    });

    await tts.ttsPromise(text, outputPath);
    console.log("Voice generated:", outputPath);
    return outputPath;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
}

module.exports = { convertToSpeech };
