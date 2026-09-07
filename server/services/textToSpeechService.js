const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { EdgeTTS } = require("node-edge-tts");

async function convertToSpeech(text) {
  try {
    // Create temp folder if it doesn't exist
    const tempDir = path.join(__dirname, "../temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Output file
    const outputPath = path.join(tempDir, `${uuidv4()}.mp3`);

    // Initialize Edge TTS
    const tts = new EdgeTTS({
      voice: "ur-PK-AsadNeural", // Female Urdu
      lang: "ur-PK",
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    });

    // Generate speech
    await tts.ttsPromise(text, outputPath);

    console.log("Voice generated:", outputPath);

    return outputPath;
  } catch (error) {
    console.error("Text-to-Speech Error:", error);
    throw error;
  }
}

module.exports = {
  convertToSpeech,
};