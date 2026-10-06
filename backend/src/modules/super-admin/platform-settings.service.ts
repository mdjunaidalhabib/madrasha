import { BadRequestError } from "../../shared/errors";
import { encryptSecret, decryptSecret } from "../../shared/utils/crypto.util";
import { platformSettingsRepository, PlatformSettingsRepository } from "./platform-settings.repository";
import { r2Service, R2Credentials, r2CredentialsFromEnv, R2_ENV_VARS } from "../../shared/storage/r2.service";
import { smsService, SmsBalanceConfig, BalanceResult } from "../../shared/notifications/sms.service";
import { emailService, SmtpConfig, ConnectionCheckResult } from "../../shared/notifications/email.service";
import { t } from "../../shared/i18n";

export interface SaveSmsConfigRequestDto {
  provider?: string;
  api_url?: string;
  api_key?: string;
  sender_id?: string;
  http_method?: string;
  param_api_key?: string;
  param_sender_id?: string;
  param_number?: string;
  param_message?: string;
  balance_url?: string;
  balance_http_method?: string;
  balance_param_api_key?: string;
  balance_response_path?: string;
}

export interface SaveEmailConfigRequestDto {
  host?: string;
  port?: number | string;
  secure?: boolean;
  user?: string;
  pass?: string;
  from_name?: string;
  from_email?: string;
}

export class PlatformSettingsService {
  constructor(private readonly repository: PlatformSettingsRepository = platformSettingsRepository) {}

  /* ================= OBJECT STORAGE (Cloudflare R2, platform-wide) ================= */

  /** Read-only status for the Super Admin Settings page - the bucket itself
   * is configured through R2_* env vars on the server, never from the UI. */
  async getStorageConfig() {
    const c = r2CredentialsFromEnv();
    const missing = R2_ENV_VARS.filter((name) => !process.env[name]?.trim());
    if (!c) return { configured: false as const, missing };
    return {
      configured: true as const,
      provider: "cloudflare-r2" as const,
      bucket: c.bucket,
      public_url: c.publicUrl,
    };
  }

  async testStorageConnection() {
    const credentials = await this.resolveStorageCredentials();
    if (!credentials) throw new BadRequestError(t({ bn: "স্টোরেজ কনফিগার করা নেই", en: "Storage is not configured" }));
    return r2Service.testConnection(credentials);
  }

  /** R2 credentials for uploads (tenant + Super Admin), or null while the
   * R2_* env vars are not all set. */
  async resolveStorageCredentials(): Promise<R2Credentials | null> {
    return r2CredentialsFromEnv();
  }

  /* ================= SMS (platform-wide gateway) ================= */

  async getSmsConfig() {
    const config = await this.repository.findSmsConfig();
    if (!config) return { configured: false as const };
    return {
      configured: true as const,
      provider: config.provider,
      api_url: config.apiUrl,
      sender_id: config.senderId,
      http_method: config.httpMethod,
      param_api_key: config.paramApiKey,
      param_sender_id: config.paramSenderId,
      param_number: config.paramNumber,
      param_message: config.paramMessage,
      balance_url: config.balanceUrl,
      balance_http_method: config.balanceHttpMethod,
      balance_param_api_key: config.balanceParamApiKey,
      balance_response_path: config.balanceResponsePath,
    };
  }

  async saveSmsConfig(dto: SaveSmsConfigRequestDto) {
    if (!dto.api_url?.trim() || !dto.api_key?.trim()) {
      throw new BadRequestError(t({ bn: "api_url এবং api_key আবশ্যক", en: "api_url and api_key are required" }));
    }

    await this.repository.upsertSmsConfig({
      provider: dto.provider?.trim() || null,
      apiUrl: dto.api_url.trim(),
      apiKeyEnc: encryptSecret(dto.api_key.trim()),
      senderId: dto.sender_id?.trim() || null,
      httpMethod: dto.http_method?.trim().toUpperCase() === "POST" ? "POST" : "GET",
      paramApiKey: dto.param_api_key?.trim() || "api_key",
      paramSenderId: dto.param_sender_id?.trim() || "senderid",
      paramNumber: dto.param_number?.trim() || "number",
      paramMessage: dto.param_message?.trim() || "message",
      balanceUrl: dto.balance_url?.trim() || null,
      balanceHttpMethod: dto.balance_http_method?.trim().toUpperCase() === "POST" ? "POST" : "GET",
      balanceParamApiKey: dto.balance_param_api_key?.trim() || dto.param_api_key?.trim() || "api_key",
      balanceResponsePath: dto.balance_response_path?.trim() || "balance",
    });
  }

  async deleteSmsConfig() {
    await this.repository.deleteSmsConfig();
  }

  /** Resolves the platform's SMS gateway config (with the API key
   * decrypted) for actually sending/checking balance. Used by
   * notification.service.ts for every tenant's SMS send. */
  async resolveSmsConfig(): Promise<SmsBalanceConfig | null> {
    const config = await this.repository.findSmsConfig();
    if (!config) return null;
    return {
      apiUrl: config.apiUrl,
      apiKey: decryptSecret(config.apiKeyEnc),
      senderId: config.senderId || undefined,
      httpMethod: config.httpMethod === "POST" ? "POST" : "GET",
      paramApiKey: config.paramApiKey,
      paramSenderId: config.paramSenderId,
      paramNumber: config.paramNumber,
      paramMessage: config.paramMessage,
      balanceUrl: config.balanceUrl || "",
      balanceHttpMethod: config.balanceHttpMethod === "POST" ? "POST" : "GET",
      balanceParamApiKey: config.balanceParamApiKey,
      balanceResponsePath: config.balanceResponsePath,
    };
  }

  async checkSmsBalance(): Promise<BalanceResult> {
    const config = await this.resolveSmsConfig();
    if (!config) throw new BadRequestError(t({ bn: "SMS গেটওয়ে কনফিগার করা নেই", en: "SMS gateway is not configured" }));
    return smsService.getBalance(config);
  }

  /* ================= EMAIL (platform-wide SMTP) ================= */

  async getEmailConfig() {
    const config = await this.repository.findEmailConfig();
    if (!config) return { configured: false as const };
    return {
      configured: true as const,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      from_name: config.fromName,
      from_email: config.fromEmail,
    };
  }

  async saveEmailConfig(dto: SaveEmailConfigRequestDto) {
    if (!dto.host?.trim() || !dto.user?.trim() || !dto.pass?.trim() || !dto.from_email?.trim()) {
      throw new BadRequestError(t({ bn: "host, user, pass এবং from_email আবশ্যক", en: "host, user, pass and from_email are required" }));
    }

    await this.repository.upsertEmailConfig({
      host: dto.host.trim(),
      port: dto.port ? Number(dto.port) : 587,
      secure: Boolean(dto.secure),
      user: dto.user.trim(),
      passEnc: encryptSecret(dto.pass.trim()),
      fromName: dto.from_name?.trim() || "Madrasa Management",
      fromEmail: dto.from_email.trim(),
    });
  }

  async deleteEmailConfig() {
    await this.repository.deleteEmailConfig();
  }

  /** Resolves the platform's SMTP config (with the password decrypted)
   * for actually sending/testing. Used by notification.service.ts for
   * every tenant's Email send. */
  async resolveEmailConfig(): Promise<SmtpConfig | null> {
    const config = await this.repository.findEmailConfig();
    if (!config) return null;
    return {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      pass: decryptSecret(config.passEnc),
      fromName: config.fromName,
      fromEmail: config.fromEmail,
    };
  }

  async checkEmailConnection(): Promise<ConnectionCheckResult> {
    const config = await this.resolveEmailConfig();
    if (!config) throw new BadRequestError(t({ bn: "SMTP কনফিগার করা নেই", en: "SMTP is not configured" }));
    return emailService.verifyConnection(config);
  }
}

export const platformSettingsService = new PlatformSettingsService();
