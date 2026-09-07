
const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function downloadWhatsAppMedia(mediaId) {

  const metaResponse = await axios.get(
    `https://graph.facebook.com/v20.0/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
    }
  );

  const mediaUrl = metaResponse.data.url;

  // Step 2: download the actual audio bytes from that URL
  // (this URL also requires our access token to access)
  const audioResponse = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
    responseType: "arraybuffer",
  });

  // Save it to a temporary local file so the next step (speech-to-text)
  // can read it.
  const filePath = path.join(__dirname, "..", "temp", `${mediaId}.ogg`);
  fs.mkdirSync(path.join(__dirname, "..", "temp"), { recursive: true });
  fs.writeFileSync(filePath, audioResponse.data);

  console.log("Voice note downloaded to:", filePath);
  return filePath;
}

module.exports = { downloadWhatsAppMedia };