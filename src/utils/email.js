import nodemailer from "nodemailer";

// Create transport from env or use Ethereal for local dev when not configured
export async function getTransport() {
  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT || "587", 10);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({ host, port, auth: { user, pass } });
  }

  // Dev fallback: auto-create Ethereal test account
  const testAccount = await nodemailer.createTestAccount();
  const transport = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  console.log("Using Ethereal test SMTP");
  console.log("Ethereal user:", testAccount.user);
  console.log("Ethereal pass:", testAccount.pass);
  return transport;
}

// Modified sendEmail to support attachments
export async function sendEmail({ to, subject, text, html, attachments = [] }) {
  const transporter = await getTransport();
  const from = process.env.APP_FROM_EMAIL || "no-reply@example.com";

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    attachments, // array of attachments
  });

  // If using Ethereal, log preview URL
  if (nodemailer.getTestMessageUrl) {
    const url = nodemailer.getTestMessageUrl(info);
    if (url) console.log("Preview URL:", url);
  }

  return info;
}
