import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 465,
    secure: Number(SMTP_PORT) !== 587,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // The mail server's own TLS certificate is expired/self-signed; we still
    // trust it because it's our own server on our own domain, not a third party.
    tls: { rejectUnauthorized: false },
  });
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] SMTP not configured — would have sent "${subject}" to ${to}`);
    return;
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER!;
  await t.sendMail({ from, to, subject, html });
}
