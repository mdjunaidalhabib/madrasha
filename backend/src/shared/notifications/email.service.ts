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

/** Resolved SMTP settings - either the platform config a Super Admin
 * saved (see platform-settings.service.ts) or, when that's unset, the
 * SMTP_* env vars (kept for deployments that don't use the Settings UI). */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface ConnectionCheckResult {
  success: boolean;
  errorMessage?: string;
}

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey = "";

const envConfig = (): SmtpConfig | null => {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) return null;
  return {
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    user: env.smtpUser,
    pass: env.smtpPass,
    fromName: env.smtpFromName,
    fromEmail: env.smtpFromEmail,
  };
};

const configKey = (config: SmtpConfig) =>
  `${config.host}:${config.port}:${config.secure}:${config.user}:${config.pass}`;

/** Builds (or reuses) a transporter for `config` - cached and keyed by the
 * config itself since the resolved config can now change at runtime
 * (Super Admin editing PlatformEmailConfig) instead of being a fixed
 * env-var value for the process lifetime. */
const getTransporter = (config: SmtpConfig): Transporter => {
  const key = configKey(config);
  if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  cachedTransporterKey = key;
  return cachedTransporter;
};

/**
 * Sends an email via nodemailer/SMTP, using whichever config is
 * configured (Super Admin's platform-wide config, passed in as `config`;
 * falls back to the SMTP_* env vars when `config` is omitted). If neither
 * is set, this logs the full email to the console instead of failing, so
 * the rest of the app (password reset, admission notices, ...) keeps
 * working end-to-end in dev/testing before real credentials exist.
 */
export const emailService = {
  async send(input: SendEmailInput, config?: SmtpConfig | null): Promise<SendResult> {
    const resolved = config ?? envConfig();
    if (!resolved) {
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
      await getTransporter(resolved).sendMail({
        from: `"${resolved.fromName}" <${resolved.fromEmail}>`,
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

  /** SMTP has no "balance" concept - this is the equivalent sanity check
   * offered on the Settings page: can we actually authenticate/connect. */
  async verifyConnection(config: SmtpConfig): Promise<ConnectionCheckResult> {
    try {
      await getTransporter(config).verify();
      return { success: true };
    } catch (err) {
      logger.error("EmailService.verifyConnection failed:", err);
      return { success: false, errorMessage: (err as Error)?.message || "Connection failed" };
    }
  },
};
