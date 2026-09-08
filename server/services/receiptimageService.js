const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const { buildReceiptData, generateReceiptHtml } = require("./paymentReceiptService");

// Temp directory for receipt images
const TEMP_DIR = path.join(__dirname, "..", "temp");

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ─────────────────────────────────────────────────────────
// GENERATE RECEIPT IMAGE (PNG)
// Takes the same HTML receipt and renders it as a PNG image
// Uses the SAME receipt data as the organizer's HTML receipt
// ─────────────────────────────────────────────────────────
async function generateReceiptImage(paymentId) {
  // Build the same receipt data used for HTML/PDF
  const receipt = await buildReceiptData(paymentId);
  const html = generateReceiptHtml(receipt);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Set viewport to match receipt card width (420px + padding)
    await page.setViewport({ width: 480, height: 800, deviceScaleFactor: 2 });

    // Load the HTML receipt
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Get the receipt card element dimensions
    const receiptCard = await page.$(".receipt");
    if (!receiptCard) {
      throw new Error("Receipt card element not found in HTML");
    }

    // Generate unique filename
    const filename = `receipt-${receipt.receiptId}-${Date.now()}.png`;
    const filePath = path.join(TEMP_DIR, filename);

    // Screenshot the receipt card only (not the full page)
    await receiptCard.screenshot({
      path: filePath,
      type: "png",
      omitBackground: true,
    });

    console.log(`[RECIPT] Receipt image generated: ${filePath}`);

    return {
      filePath,
      filename,
      receiptId: receipt.receiptId,
    };
  } catch (err) {
    console.error("[RECIPT] Failed to generate receipt image:", err.message);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ─────────────────────────────────────────────────────────
// CLEAN UP OLD RECEIPT IMAGES (call periodically)
// ─────────────────────────────────────────────────────────
function cleanupReceiptImages(maxAgeMs = 30 * 60 * 1000) {
  try {
    const now = Date.now();
    const files = fs.readdirSync(TEMP_DIR);
    let cleaned = 0;

    for (const file of files) {
      if (file.startsWith("receipt-") && file.endsWith(".png")) {
        const filePath = path.join(TEMP_DIR, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[RECIPT] Cleaned up ${cleaned} old receipt images`);
    }
  } catch (err) {
    // Ignore cleanup errors
  }
}

module.exports = {
  generateReceiptImage,
  cleanupReceiptImages,
};