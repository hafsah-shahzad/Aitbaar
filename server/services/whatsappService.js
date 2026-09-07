const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

async function sendWhatsAppMessage(toNumber, messageText) {
  const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: toNumber,
    type: "text",
    text: {
      body: messageText,
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Text message sent successfully");

    return response.data;
  } catch (err) {
    console.error(
      "Failed to send text message:",
      err.response?.data || err.message
    );
    throw err;
  }
}
async function uploadMedia(audioPath) {
  const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`;

  const form = new FormData();

  form.append("messaging_product", "whatsapp");
  form.append("file", fs.createReadStream(audioPath));
  form.append("type", "audio/mpeg");

  try {
    const response = await axios.post(url, form, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        ...form.getHeaders(),
      },
    });

    console.log("Audio uploaded successfully");

    return response.data.id;
  } catch (err) {
    console.error(
      "Media Upload Error:",
      err.response?.data || err.message
    );
    throw err;
  }
}
async function sendVoiceMessage(toNumber, audioPath) {
  try {
    const mediaId = await uploadMedia(audioPath);

    const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to: toNumber,
      type: "audio",
      audio: {
        id: mediaId,
      },
    };

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Voice message sent successfully");

    return response.data;
  } catch (err) {
    console.error(
      "Failed to send voice message:",
      err.response?.data || err.message
    );
    throw err;
  }
}

module.exports = {
  sendWhatsAppMessage,
  sendVoiceMessage,
};