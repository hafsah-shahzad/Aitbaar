// Email service using Nodemailer + Gmail
// No domain required -- works with any Gmail account
// No per-email restrictions -- can send to any address

const nodemailer = require("nodemailer");

// Create reusable transporter using Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // App password, not your Gmail password
  },
});

async function sendCommitteeCodeEmail({
  toEmail,
  organizerName,
  committeeName,
  committeeCode,
}) {
  const mailOptions = {
    from: `"Aitbaar" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `Aapki Committee Ready Hai — Code: ${committeeCode}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background: #F7F6F2; margin: 0; padding: 0; }
          .container { max-width: 520px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; border: 1px solid #E5E4E0; }
          .header { background: #1E3A5F; padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 600; }
          .header p { color: rgba(255,255,255,0.75); margin: 6px 0 0; font-size: 14px; }
          .body { padding: 32px; }
          .greeting { font-size: 16px; color: #2C2C2A; margin-bottom: 16px; }
          .code-box { background: #FBF0DE; border: 1px solid #EFD5A0; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
          .code-box p { color: #5A3A0E; font-size: 13px; margin: 0 0 8px; }
          .code { color: #B8792B; font-size: 32px; font-weight: 700; letter-spacing: 4px; }
          .info { background: #F7F6F2; border-radius: 10px; padding: 16px; margin: 20px 0; }
          .info p { margin: 4px 0; font-size: 13px; color: #5C6270; }
          .info strong { color: #2C2C2A; }
          .instructions { font-size: 14px; color: #5C6270; line-height: 1.6; }
          .footer { border-top: 1px solid #E5E4E0; padding: 20px 32px; text-align: center; }
          .footer p { font-size: 12px; color: #9B9A96; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>اعتبار — Aitbaar</h1>
            <p>Har mushkil waqt ka bharosemand sathi</p>
          </div>
          <div class="body">
            <p class="greeting">Assalam-o-Alaikum <strong>${organizerName}</strong>,</p>
            <p class="instructions">
              Aapki committee successfully ban gayi hai. Yeh code apne members ke saath share karein taake woh Aitbaar WhatsApp bot se register ho sakein.
            </p>
            <div class="code-box">
              <p>Aapka Committee Code</p>
              <div class="code">${committeeCode}</div>
            </div>
            <div class="info">
              <p><strong>Committee:</strong> ${committeeName}</p>
              <p><strong>Bot Number:</strong> Members ko yeh number WhatsApp pe save karwayein
              <br>
                 +1 (555) 659-7854</p>
            </div>
            <p class="instructions">
              Member ko sirf itna karna hai: Aitbaar ke WhatsApp number pe voice note bhejein aur apna committee code bolein.
            </p>
          </div>
          <div class="footer">
            <p>Aitbaar — Har mushkil waqt ka bharosemand sathi</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("Email sending failed:", err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendCommitteeCodeEmail };