import { BadRequestError } from "../../shared/errors";
import { encryptSecret, decryptSecret } from "../../shared/utils/crypto.util";
import { platformSettingsRepository, PlatformSettingsRepository } from "./platform-settings.repository";
import type { CloudinaryCredentials } from "../../shared/storage/cloudinary.service";
import { smsService, SmsBalanceConfig, BalanceResult } from "../../shared/notifications/sms.service";
import { emailService, SmtpConfig, ConnectionCheckResult } from "../../shared/notifications/email.service";

export interface SaveCloudinaryConfigRequestDto {
  cloud_name?: string;
  api_key?: string;
  api_secret?: string;
}

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

  async getCloudinaryConfig() {
    const config = await this.repository.findCloudinaryConfig();
    if (!config) return { configured: false, cloud_name: null, api_key: null };
    return { configured: true, cloud_name: config.cloudName, api_key: config.apiKey };
  }

  async saveCloudinaryConfig(dto: SaveCloudinaryConfigRequestDto) {
    if (!dto.cloud_name?.trim() || !dto.api_key?.trim() || !dto.api_secret?.trim()) {
      throw new BadRequestError("cloud_name, api_key and api_secret are all required");
    }

    await this.repository.upsertCloudinaryConfig({
      cloudName: dto.cloud_name.trim(),
      apiKey: dto.api_key.trim(),
      apiSecretEnc: encryptSecret(dto.api_secret.trim()),
    });
  }

  async deleteCloudinaryConfig() {
    await this.repository.deleteCloudinaryConfig();
  }

  /** Resolves the platform's own Cloudinary credentials for Super Admin
   * uploads (System Template backgrounds). Used by
   * super-admin/platform-cloudinary.util.ts - kept here since it needs the
   * same encrypted-at-rest row this service already owns. */
  async resolveCredentials(): Promise<CloudinaryCredentials | null> {
    const config = await this.repository.findCloudinaryConfig();
    if (!config) return null;
    return {
      cloudName: config.cloudName,
      apiKey: config.apiKey,
      apiSecret: decryptSecret(config.apiSecretEnc),
    };
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
      throw new BadRequestError("api_url এবং api_key আবশ্যক");
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
    if (!config) throw new BadRequestError("SMS গেটওয়ে কনফিগার করা নেই");
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
      throw new BadRequestError("host, user, pass এবং from_email আবশ্যক");
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
    if (!config) throw new BadRequestError("SMTP কনফিগার করা নেই");
    return emailService.verifyConnection(config);
  }
}

export const platformSettingsService = new PlatformSettingsService();
