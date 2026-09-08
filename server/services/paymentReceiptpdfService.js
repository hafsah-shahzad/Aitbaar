const PDFDocument = require("pdfkit");
const { buildReceiptData } = require("./paymentReceiptService");

// ─────────────────────────────────────────────────────────
// Generate PDF receipt that matches the HTML receipt exactly
// Same layout, same colors, same structure
// ─────────────────────────────────────────────────────────
async function generateReceiptPdf(paymentId) {
  const r = await buildReceiptData(paymentId);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [380, 620], // Match HTML receipt card width
      margin: 0,
      info: {
        Title: `Payment Receipt ${r.receiptId}`,
        Author: "Aitbaar",
      },
    });

    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // ── Colors (exact match to HTML) ──
    const navy = "#1E3A5F";
    const navyLight = "#2E5384";
    const amber = "#B8792B";
    const amberBg = "#FBF0DE";
    const green = "#16A34A";
    const greenBg = "#ECFDF5";
    const greenBorder = "#BBF7D0";
    const gray = "#5C6270";
    const dark = "#22262E";
    const pageBg = "#F7F6F2";
    const lightBlue = "#F0F7FF";
    const dashedLine = "#E8EEF4";
    const white = "#FFFFFF";

    const trustColor =
      r.trustScore >= 80 ? "#16A34A" :
      r.trustScore >= 50 ? "#D97706" : "#DC2626";

    const trustLabel =
      r.trustScore >= 80 ? "Excellent" :
      r.trustScore >= 60 ? "Good" :
      r.trustScore >= 40 ? "Fair" : "Needs Improvement";

    // ── Page background ──
    doc.rect(0, 0, 380, 620).fill(pageBg);

    // ── Receipt card ──
    const cardX = 0;
    const cardW = 380;
    let y = 0;

    // ═══ HEADER (navy gradient) ═══
    doc.rect(cardX, y, cardW, 70).fill(navy);
    doc.fontSize(16).font("Helvetica-Bold").fillColor(white);
    doc.text("AITBAAR", cardX, y + 20, { align: "center", width: cardW });
    doc.fontSize(9).font("Helvetica").fillColor("#CCCCCC");
    doc.text("Digital Payment Receipt", cardX, y + 42, { align: "center", width: cardW });
    y += 70;

    // ═══ RECEIPT ID BAR (amber bg) ═══
    doc.rect(cardX, y, cardW, 28).fill(amberBg);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(amber);
    doc.text(r.receiptId, cardX, y + 8, { align: "center", width: cardW });
    y += 28;

    // ═══ BODY ═══
    const bodyPad = 22;
    const colW = (cardW - bodyPad * 2) / 2;
    const leftX = cardX + bodyPad;
    const rightX = cardX + bodyPad + colW + 10;
    y += 16;

    // ── Info Grid ──
    function drawLabel(x, yy, label) {
      doc.fontSize(7).font("Helvetica").fillColor(gray);
      doc.text(label.toUpperCase(), x, yy, { width: colW });
    }
    function drawValue(x, yy, value) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor(dark);
      doc.text(value || "—", x, yy + 10, { width: colW });
    }

    // Row 1
    drawLabel(leftX, y, "Member");
    drawLabel(rightX, y, "Committee");
    drawValue(leftX, y, r.memberName);
    drawValue(rightX, y, r.committeeName);
    y += 42;

    // Row 2
    drawLabel(leftX, y, "Month / Cycle");
    drawLabel(rightX, y, "Payment Date");
    drawValue(leftX, y, r.month);
    drawValue(rightX, y, r.paymentDate);
    y += 42;

    // ═══ AMOUNT SECTION (light blue bg) ═══
    y += 4;
    doc.roundedRect(cardX + 14, y, cardW - 28, 72, 8).fill(lightBlue);

    doc.fontSize(7).font("Helvetica").fillColor(gray);
    doc.text("AMOUNT PAID", cardX + 14, y + 10, { align: "center", width: cardW - 28 });

    doc.fontSize(24).font("Helvetica-Bold").fillColor(navy);
    doc.text(`Rs ${r.monthlyAmount.toLocaleString()}`, cardX + 14, y + 22, { align: "center", width: cardW - 28 });

    // Status badge
    const badgeText = `✅  ${r.verificationStatus}`;
    const badgeW = 130;
    const badgeX = cardX + (cardW - badgeW) / 2;
    doc.roundedRect(badgeX, y + 52, badgeW, 16, 8).fill(greenBg);
    doc.fontSize(8).font("Helvetica-Bold").fillColor(green);
    doc.text(badgeText, badgeX, y + 56, { align: "center", width: badgeW });

    y += 86;

    // ═══ STATS SECTION ═══
    // Dashed separator
    doc.save();
    doc.moveTo(leftX, y).lineTo(leftX + colW * 2 + 10, y)
      .dash(3, { space: 3 }).lineWidth(0.5).strokeColor(dashedLine).stroke();
    doc.restore();
    y += 12;

    // Trust Score
    doc.fontSize(10).font("Helvetica-Bold").fillColor(trustColor);
    doc.text(`Trust Score: ${r.trustScore}/100`, leftX, y, { width: 200 });

    doc.fontSize(9).font("Helvetica").fillColor(gray);
    doc.text(trustLabel, leftX + 200, y + 1, { width: colW * 2 - 190, align: "right" });

    // Trust bar
    y += 16;
    const barX = leftX;
    const barW = colW * 2 + 10;
    doc.roundedRect(barX, y, barW, 5, 2.5).fill(dashedLine);
    const fillW = (r.trustScore / 100) * barW;
    if (fillW > 0) {
      doc.roundedRect(barX, y, fillW, 5, 2.5).fill(trustColor);
    }
    y += 14;

    // Stats rows
    function drawStatRow(label, value) {
      doc.fontSize(10).font("Helvetica").fillColor(gray);
      doc.text(label, leftX, y, { width: 240 });
      doc.fontSize(10).font("Helvetica-Bold").fillColor(dark);
      doc.text(String(value), leftX + 240, y, { width: colW * 2 - 230, align: "right" });
      y += 18;
    }

    drawStatRow("Total Confirmed Payments", r.totalConfirmedPayments);
    drawStatRow("Committee Size", `${r.totalMembers} members`);
    drawStatRow("Verified On", `${r.verificationDate}  ${r.verificationTime}`);

    // ═══ FOOTER ═══
    y += 10;
    const footerH = 55;
    doc.rect(cardX, y, cardW, footerH).fill(pageBg);
    doc.save();
    doc.moveTo(cardX, y).lineTo(cardX + cardW, y)
      .lineWidth(0.5).strokeColor(dashedLine).stroke();
    doc.restore();

    doc.fontSize(8).font("Helvetica").fillColor(gray);
    doc.text("This receipt is digitally generated by Aitbaar.", cardX, y + 12, { align: "center", width: cardW });
    doc.text("For disputes, contact your committee organizer.", cardX, y + 24, { align: "center", width: cardW });

    doc.fontSize(9).font("Helvetica-Bold").fillColor(amber);
    doc.text(`ID: ${r.receiptId}`, cardX, y + 38, { align: "center", width: cardW });

    doc.end();
  });
}

module.exports = { generateReceiptPdf };
