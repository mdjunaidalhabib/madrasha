import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../logger/logger";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  success: boolean;
  provider: string;
  errorMessage?: string;
}

let cachedTransporter: Transporter | null = null;

const isSmtpConfigured = () => Boolean(env.smtpHost && env.smtpUser && env.smtpPass);

const getTransporter = (): Transporter => {
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
  return cachedTransporter;
};

/**
 * Sends an email via nodemailer/SMTP. If no SMTP credentials are set in
 * .env yet (SMTP_HOST / SMTP_USER / SMTP_PASS), this logs the full email
 * to the console instead of failing, so the rest of the app (password
 * reset, admission notices, ...) keeps working end-to-end in dev/testing
 * before real credentials exist.
 */
export const emailService = {
  async send(input: SendEmailInput): Promise<SendResult> {
    if (!isSmtpConfigured()) {
      logger.info("[EMAIL:console-dev-log] SMTP not configured — would have sent:", {
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      // eslint-disable-next-line no-console
      console.log(
        `\n📧 [DEV EMAIL] To: ${input.to}\nSubject: ${input.subject}\n${input.text || input.html}\n`,
      );
      return { success: true, provider: "console-dev-log" };
    }

    try {
      await getTransporter().sendMail({
        from: `"${env.smtpFromName}" <${env.smtpFromEmail}>`,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return { success: true, provider: "smtp" };
    } catch (err) {
      logger.error("EmailService.send failed:", err);
      return {
        success: false,
        provider: "smtp",
        errorMessage: (err as Error)?.message || "Failed to send email",
      };
    }
  },
};
