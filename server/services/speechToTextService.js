const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

async function transcribeAudio(filePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("model", "whisper-large-v3");
  form.append("language", "ur"); // Urdu

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

  const transcript = response.data.text;

  if (!transcript || transcript.trim() === "") {
    console.log("Could not transcribe audio -- no speech detected or unclear audio.");
    return null;
  }

  console.log("Transcribed text:", transcript);
  return transcript;
}

module.exports = { transcribeAudio };