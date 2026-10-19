import nodemailer from 'nodemailer';

/**
 * Configure email transporter
 * Supports:
 * 1. Custom SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * 2. Gmail / standard service (EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS)
 */
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(port || '587', 10),
      secure: port === '465',
      auth: { user, pass },
    });
  } else if (user && pass) {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: { user, pass },
    });
  }

  return transporter;
};

/**
 * Send 6-digit OTP email to user
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit verification code
 * @param {string} name - Recipient name
 */
export const sendPasswordResetOtpEmail = async (email, otp, name = 'User') => {
  // Always log clearly to server console so the code is immediately available in development
  console.log('====================================================');
  console.log(`[AUTH] 🔐 PASSWORD RESET OTP: ${otp}`);
  console.log(`[AUTH] 📧 Recipient: ${email}`);
  console.log(`[AUTH] ⏰ Valid for: 10 minutes`);
  console.log('====================================================');

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    console.log('[AUTH] ℹ️ SMTP not configured. OTP printed above for testing.');
    return { sent: false, reason: 'SMTP not configured in .env' };
  }

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Smart Business'}" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
    to: email,
    subject: `Your Smart Business Password Reset Code: ${otp}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b1329; color: #ffffff; padding: 40px 20px; border-radius: 12px; max-width: 500px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 1px;">
            SMART <span style="color: #3b82f6;">BUSINESS</span>
          </h2>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 6px;">Small Business Management System</p>
        </div>

        <div style="background-color: #111d38; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 16px; padding: 30px; text-align: center;">
          <h3 style="margin-top: 0; color: #ffffff; font-size: 20px;">Password Reset Code</h3>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
            Hello ${name},<br/>
            We received a request to reset your password. Use the verification code below to complete your reset:
          </p>

          <div style="margin: 30px 0; padding: 18px; background: rgba(59, 130, 246, 0.15); border: 2px dashed #3b82f6; border-radius: 12px; display: inline-block;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #60a5fa; font-family: monospace;">
              ${otp}
            </span>
          </div>

          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
            This code will expire in <strong>10 minutes</strong>.<br/>
            If you did not request this password reset, please ignore this email.
          </p>
        </div>

        <div style="text-align: center; margin-top: 25px; color: #64748b; font-size: 12px;">
          &copy; ${new Date().getFullYear()} Smart Business Management. All rights reserved.
        </div>
      </div>
    `,
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`[AUTH] ✅ Email delivered successfully: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('[AUTH] ❌ Error sending reset email:', err.message);
    return { sent: false, error: err.message };
  }
};
