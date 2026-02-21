import nodemailer from "nodemailer";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  replyTo?: string;
};

type ResetPasswordEmailPayload = {
  to: string;
  name?: string | null;
  resetUrl: string;
};

const isProduction = process.env.NODE_ENV === "production";

let cachedConfig: SmtpConfig | null | undefined;
let cachedTransporter:
  | nodemailer.Transporter<nodemailer.SentMessageInfo>
  | null
  | undefined;
let missingConfigWarned = false;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveSmtpConfig(): SmtpConfig | null {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  let host = process.env.SMTP_HOST?.trim() || "";
  if (host.toLowerCase() === "google.com") {
    // Common misconfiguration for Gmail SMTP.
    host = "smtp.gmail.com";
  }
  const from = process.env.SMTP_FROM?.trim() || "";

  if (!host || !from) {
    cachedConfig = null;
    return cachedConfig;
  }

  const port = parsePort(process.env.SMTP_PORT, 587);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? parseBoolean(process.env.SMTP_SECURE, false)
      : port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const replyTo = process.env.SMTP_REPLY_TO?.trim();

  cachedConfig = {
    host,
    port,
    secure,
    ...(user ? { user } : {}),
    ...(pass ? { pass } : {}),
    from,
    ...(replyTo ? { replyTo } : {}),
  };

  return cachedConfig;
}

function getOrCreateTransporter():
  | nodemailer.Transporter<nodemailer.SentMessageInfo>
  | null {
  if (cachedTransporter !== undefined) {
    return cachedTransporter;
  }

  const smtp = resolveSmtpConfig();
  if (!smtp) {
    cachedTransporter = null;
    return cachedTransporter;
  }

  const auth =
    smtp.user && smtp.pass
      ? {
          user: smtp.user,
          pass: smtp.pass,
        }
      : undefined;

  cachedTransporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(auth ? { auth } : {}),
  });

  return cachedTransporter;
}

function ensureMailerConfigured(): void {
  if (resolveSmtpConfig()) return;

  const message =
    "[auth-mailer] SMTP is not configured. Set SMTP_HOST and SMTP_FROM (plus SMTP_PORT/SMTP_USER/SMTP_PASS as needed).";

  if (isProduction) {
    throw new Error(message);
  }

  if (!missingConfigWarned) {
    missingConfigWarned = true;
    console.warn(message);
  }
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: ResetPasswordEmailPayload): Promise<void> {
  ensureMailerConfigured();
  const smtp = resolveSmtpConfig();
  const transporter = getOrCreateTransporter();
  if (!smtp || !transporter) return;

  const displayName = name?.trim() || "there";
  const subject = "Reset your Paayo Nepal password";
  const text = [
    `Hello ${displayName},`,
    "",
    "We received a request to reset your password.",
    `Reset it here: ${resetUrl}`,
    "",
    "If you didn't request this, you can safely ignore this email.",
    "",
    "- Paayo Nepal",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <p>Hello ${displayName},</p>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${resetUrl}" style="color: #0b74de; text-decoration: none;">
          Reset your password
        </a>
      </p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p style="margin-top: 16px;">- Paayo Nepal</p>
    </div>
  `;

  await transporter.sendMail({
    from: smtp.from,
    to,
    ...(smtp.replyTo ? { replyTo: smtp.replyTo } : {}),
    subject,
    text,
    html,
  });
}
