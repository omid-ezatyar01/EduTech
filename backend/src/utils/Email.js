import nodemailer from "nodemailer";

const parsePort = (value, fallback = 465) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getSmtpConfig = () => {
  const port = parsePort(process.env.SMTP_PORT, 465);
  const secure = String(process.env.SMTP_SECURE || (port === 465 ? "true" : "false")).toLowerCase() === "true";

  return {
    host: String(process.env.SMTP_HOST || "").trim(),
    port,
    secure,
    auth: {
      user: String(process.env.SMTP_USER || "").trim(),
      pass: String(process.env.SMTP_PASS || ""),
    },
  };
};

const createTransporter = () => nodemailer.createTransport(getSmtpConfig());
const getFromEmail = () => String(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "").trim();

export class EmailSendError extends Error {
  constructor(message, { code = "EMAIL_SEND_FAILED", status = "failed", reason = "" } = {}) {
    super(message || "Failed to send email");
    this.name = "EmailSendError";
    this.code = code;
    this.status = status;
    this.reason = reason || message || "";
  }
}

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderMessageParagraphs = (body = "") =>
  String(body || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:14px 0 0; color:#475569; font-size:16px; line-height:1.7;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");

export const sendEduTechEmail = async ({
  to,
  subject,
  heading,
  greetingName,
  body,
  footerNote = "This email was sent by EduTech.",
}) => {
  try {
    const transport = createTransporter();
    const result = await transport.sendMail({
      from: getFromEmail(),
      to,
      subject,
      html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${escapeHtml(subject)}</title>
        </head>

        <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:Arial, Helvetica, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:40px 0;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.12);">
                  <tr>
                    <td style="background:linear-gradient(135deg, #2563eb, #7c3aed); padding:32px 28px; text-align:center;">
                      <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:800; letter-spacing:0.5px;">EduTech</h1>
                      <p style="margin:8px 0 0; color:#dbeafe; font-size:15px;">Online Learning Platform</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:36px 32px 28px;">
                      <h2 style="margin:0; color:#0f172a; font-size:24px; font-weight:700;">${escapeHtml(heading || subject)}</h2>
                      ${
                        greetingName
                          ? `<p style="margin:18px 0 0; color:#475569; font-size:16px; line-height:1.7;">Hello <strong style="color:#0f172a;">${escapeHtml(greetingName)}</strong>,</p>`
                          : ""
                      }
                      ${renderMessageParagraphs(body)}
                    </td>
                  </tr>

                  <tr>
                    <td style="background-color:#f8fafc; padding:22px 32px; text-align:center; border-top:1px solid #e2e8f0;">
                      <p style="margin:0; color:#94a3b8; font-size:13px; line-height:1.6;">© ${new Date().getFullYear()} EduTech. All rights reserved.</p>
                      <p style="margin:8px 0 0; color:#94a3b8; font-size:13px;">${escapeHtml(footerNote)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    });

    return {
      id: result?.messageId || "",
      messageId: result?.messageId || "",
      accepted: result?.accepted || [],
      rejected: result?.rejected || [],
      response: result?.response || "",
    };
  } catch (error) {
    console.error("SMTP email error:", error);
    throw new EmailSendError(error?.message || "Failed to send email", {
      reason: error?.message || "",
    });
  }
};

export const sendOtpEmail = async ({
  to,
  name,
  otp,
  purpose = "registration",
}) => {
  const isPasswordReset = purpose === "password_reset";
  try {
    const transport = createTransporter();
    const result = await transport.sendMail({
      from: getFromEmail(),
      to,
      subject: isPasswordReset
        ? "Reset your EduTech teacher password"
        : "Verify your EduTech account",
      html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>EduTech OTP Verification</title>
        </head>

        <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:Arial, Helvetica, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:40px 0;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.12);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg, #2563eb, #7c3aed); padding:32px 28px; text-align:center;">
                      <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:800; letter-spacing:0.5px;">
                        EduTech
                      </h1>
                      <p style="margin:8px 0 0; color:#dbeafe; font-size:15px;">
                        Online Learning Platform
                      </p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:36px 32px 28px;">
                      <h2 style="margin:0; color:#0f172a; font-size:24px; font-weight:700;">
                        ${isPasswordReset ? "Reset your password" : "Verify your email"}
                      </h2>

                      <p style="margin:18px 0 0; color:#475569; font-size:16px; line-height:1.7;">
                        Hello <strong style="color:#0f172a;">${escapeHtml(name)}</strong>,
                      </p>

                      <p style="margin:12px 0 0; color:#475569; font-size:16px; line-height:1.7;">
                        ${
                          isPasswordReset
                            ? "We received a request to reset your teacher account password. Use the verification code below to continue."
                            : "Thank you for registering with EduTech. Use the verification code below to complete your account registration."
                        }
                      </p>

                      <!-- OTP Box -->
                      <div style="margin:30px 0; text-align:center;">
                        <div style="display:inline-block; background-color:#eff6ff; border:2px dashed #2563eb; border-radius:14px; padding:18px 30px;">
                          <span style="display:block; color:#64748b; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
                            Your OTP Code
                          </span>

                          <span style="display:block; color:#1d4ed8; font-size:38px; font-weight:800; letter-spacing:8px;">
                            ${otp}
                          </span>
                        </div>
                      </div>

                      <p style="margin:0; color:#475569; font-size:15px; line-height:1.7;">
                        This code will expire in 
                        <strong style="color:#dc2626;">10 minutes</strong>.
                      </p>

                      <p style="margin:14px 0 0; color:#64748b; font-size:14px; line-height:1.7;">
                        ${
                          isPasswordReset
                            ? "If you did not request a password reset, ignore this email. Your password will not change."
                            : "If you did not create an EduTech account, you can safely ignore this email."
                        }
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color:#f8fafc; padding:22px 32px; text-align:center; border-top:1px solid #e2e8f0;">
                      <p style="margin:0; color:#94a3b8; font-size:13px; line-height:1.6;">
                        © ${new Date().getFullYear()} EduTech. All rights reserved.
                      </p>

                      <p style="margin:8px 0 0; color:#94a3b8; font-size:13px;">
                        This is an automatic email. Please do not reply.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    });

    return {
      id: result?.messageId || "",
      messageId: result?.messageId || "",
      accepted: result?.accepted || [],
      rejected: result?.rejected || [],
      response: result?.response || "",
    };
  } catch (error) {
    console.error("SMTP OTP email error:", {
      message: error?.message,
      name: error?.name,
      code: error?.code,
      response: error?.response,
    });
    const message = error?.message || "Failed to send OTP email";
    throw new EmailSendError(message, {
      code: "OTP_EMAIL_SEND_FAILED",
      status: "failed",
      reason: message,
    });
  }
};
