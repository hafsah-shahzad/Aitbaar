const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

const GRAPH_VERSION = "v20.0";
// NOTE: adjust this env var name if your project already uses a different one
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}`;

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

// ---------------------------------------------------------------------------
// Upload a local file (e.g. a generated PDF) to WhatsApp, get back a media_id
// ---------------------------------------------------------------------------
async function uploadWhatsAppMedia(filePath, mimeType) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), { contentType: mimeType });
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);

  const response = await axios.post(`${GRAPH_BASE}/media`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });

  console.log("Uploaded media to WhatsApp:", response.data.id);
  return response.data.id; // media_id
}

// ---------------------------------------------------------------------------
// Send a document message (e.g. a PDF) using a previously uploaded media_id
// ---------------------------------------------------------------------------
async function sendWhatsAppDocument(to, mediaId, filename, caption) {
  const response = await axios.post(
    `${GRAPH_BASE}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: { id: mediaId, filename, caption },
    },
    { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
  );

  return response.data;
}

// ---------------------------------------------------------------------------
// Send interactive Yes/No (or any 2-button) reply buttons
// ---------------------------------------------------------------------------
async function sendInteractiveButtons(to, bodyText, buttons) {
  // buttons: [{ id: "rules_accept_yes", title: "Yes" }, { id: "rules_accept_no", title: "No" }]
  const response = await axios.post(
    `${GRAPH_BASE}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    },
    { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
  );

  return response.data;
}

module.exports = {
  downloadWhatsAppMedia,
  uploadWhatsAppMedia,
  sendWhatsAppDocument,
  sendInteractiveButtons,
};