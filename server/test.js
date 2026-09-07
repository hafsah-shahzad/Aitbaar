const { convertToSpeech } = require("./services/textToSpeechService");

(async () => {
  try {
    const file = await convertToSpeech(
      "السلام علیکم، آپ کی ادائیگی کامیابی سے موصول ہوگئی ہے۔"
    );

    console.log("Generated:", file);
  } catch (err) {
    console.error(err);
  }
})();