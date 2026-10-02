const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

async function tryTranscribe(filePath, forcedLanguage) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("model", "whisper-large-v3");
  if (forcedLanguage) form.append("language", forcedLanguage);

  const response = await axios.post(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    form,
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        ...form.getHeaders(),
      },
    }
  );
  return response.data.text;
}

async function transcribeAudio(filePath) {
  let transcript = await tryTranscribe(filePath, null);
  console.log("First pass:", transcript);

  // Agar Hindi (Devanagari) mein aaya, toh Urdu force karke dobara
  if (transcript && /[\u0900-\u097F]/.test(transcript)) {
    console.log("Hindi detect hui — Urdu force kar rahe hain...");
    transcript = await tryTranscribe(filePath, "ur");
    console.log("Second pass:", transcript);
  }

  if (!transcript || transcript.trim() === "") return null;
  console.log("Final:", transcript);
  return transcript;
}

module.exports = { transcribeAudio };
