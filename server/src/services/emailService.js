require("dotenv").config({ quiet: true });
const nodemailer = require("nodemailer");
const os = require("os");

/**
 * Finds a suitable local network interface address (e.g. Wi-Fi or Ethernet).
 * When running VPNs or proxy tunnels (such as tun2socks/TAP adapters),
 * SMTP ports (25, 465, 587) are often silently blocked by the tunnel.
 * Binding to the physical adapter IP bypasses the block directly.
 */
function getLocalAddress() {
  if (process.env.MAIL_LOCAL_ADDRESS || process.env.SMTP_LOCAL_ADDRESS) {
    return process.env.MAIL_LOCAL_ADDRESS || process.env.SMTP_LOCAL_ADDRESS;
  }

  const ifaces = os.networkInterfaces();
  const preferredSubstrings = ["wi-fi", "wifi", "ethernet", "wlan", "eth"];

  for (const pref of preferredSubstrings) {
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (name.toLowerCase().includes(pref)) {
        for (const a of addrs) {
          if (a.family === "IPv4" && !a.internal) {
            return a.address;
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Creates and returns a configured Nodemailer transporter for Gmail SMTP on port 587 with STARTTLS.
 */
function createTransporter() {
  const user = process.env.MAIL_USER || process.env.SMTP_USER;
  const pass = process.env.MAIL_PASSWORD || process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("Missing SMTP credentials: MAIL_USER and MAIL_PASSWORD must be configured.");
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const localAddress = getLocalAddress();

  return nodemailer.createTransport({
    host,
    port,
    secure: false, // Port 587 uses STARTTLS
    requireTLS: true,
    auth: {
      user,
      pass,
    },
    ...(localAddress ? { localAddress } : {}),
  });
}

/**
 * Verifies the SMTP connection and authentication.
 * Safe for diagnostics — never exposes passwords or credentials in logs.
 *
 * @returns {Promise<boolean>}
 */
async function verifySMTPConnection() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    if (process.env.NODE_ENV !== "test") {
      console.log("[EMAIL] SMTP connection verified successfully (smtp.gmail.com:587)");
    }
    return true;
  } catch (error) {
    console.error("[EMAIL] SMTP connection verification failed:", {
      code: error.code || "UNKNOWN",
      command: error.command || "UNKNOWN",
      message: error.message,
    });
    return false;
  }
}

/**
 * Sends a password reset email with a styled SupportPilot HTML template.
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} resetLink - Full URL for the password reset page
 * @returns {Promise<object>} Nodemailer send result
 */
async function sendPasswordResetEmail(toEmail, resetLink) {
  const transporter = createTransporter();

  const appName = process.env.APP_NAME || "SupportPilot";
  const senderEmail =
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.MAIL_USER ||
    process.env.SMTP_USER;

  const mailOptions = {
    from: `"${appName}" <${senderEmail}>`,
    to: toEmail,
    subject: `Reset Your ${appName} Password`,
    text: getPlainTextEmail(resetLink, appName),
    html: getHtmlEmail(resetLink, appName),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (process.env.NODE_ENV !== "test") {
      console.log(`[EMAIL] Password reset email sent successfully to ${toEmail} (messageId: ${info.messageId})`);
    }
    return info;
  } catch (error) {
    // Redact any possible credentials in the error log
    console.error(`[EMAIL] Failed to send password reset email to ${toEmail}:`, {
      code: error.code || "UNKNOWN",
      command: error.command || "UNKNOWN",
      message: error.message,
    });
    throw error;
  }
}

/**
 * Plain-text fallback for email clients that don't support HTML.
 */
function getPlainTextEmail(resetLink, appName) {
  return `
${appName} — Password Reset Request

You requested a password reset for your ${appName} account.

Click the link below to reset your password:
${resetLink}

This link is temporary and will expire in 15 minutes.

If you did not request this, you can safely ignore this email. Your password will not change.

— The ${appName} Team
`.trim();
}

/**
 * Styled HTML email template matching the SupportPilot brand.
 */
function getHtmlEmail(resetLink, appName) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7fa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f7fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${appName}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 20px; font-weight: 600;">Reset Your Password</h2>
              <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
                We received a request to reset the password for your <strong>${appName}</strong> account. Click the button below to create a new password.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 24px;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                    <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 14px 36px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                This link will expire in <strong>15 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.
              </p>

              <!-- Fallback link -->
              <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p style="margin: 0 0 8px; color: #64748b; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="margin: 0; word-break: break-all;">
                  <a href="${resetLink}" style="color: #6366f1; font-size: 12px; text-decoration: underline;">${resetLink}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.<br/>
                This is an automated message — please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

module.exports = {
  createTransporter,
  verifySMTPConnection,
  sendPasswordResetEmail,
};

