import { env } from "../config/env";
import { logger } from "../logger/logger";
import type { SendResult } from "./email.service";

export interface SendSmsInput {
  to: string; // phone number, gateway-specific format (usually 8801XXXXXXXXX)
  message: string;
}

/** Resolved gateway settings needed to send an SMS - either the platform
 * config a Super Admin saved (see platform-settings.service.ts) or, when
 * that's unset, the SMS_* env vars (kept for deployments that don't use
 * the Settings UI). */
export interface SmsGatewayConfig {
  apiUrl: string;
  apiKey: string;
  senderId?: string;
  httpMethod: "GET" | "POST";
  paramApiKey: string;
  paramSenderId: string;
  paramNumber: string;
  paramMessage: string;
}

/** Gateway settings plus what's needed to check account balance. */
export interface SmsBalanceConfig extends SmsGatewayConfig {
  balanceUrl: string;
  balanceHttpMethod: "GET" | "POST";
  balanceParamApiKey: string;
  /** Dot-path into the balance endpoint's JSON response, e.g. "balance" or "data.balance". */
  balanceResponsePath: string;
}

export interface BalanceResult {
  success: boolean;
  balance?: number | string;
  /** Raw response body, returned when the response isn't JSON or the
   * configured response-path didn't match anything - lets an admin see
   * what the gateway actually said instead of a silent failure. */
  raw?: string;
  errorMessage?: string;
}

const envConfig = (): SmsGatewayConfig | null => {
  if (!env.smsApiUrl || !env.smsApiKey) return null;
  return {
    apiUrl: env.smsApiUrl,
    apiKey: env.smsApiKey,
    senderId: env.smsSenderId || undefined,
    httpMethod: env.smsHttpMethod === "POST" ? "POST" : "GET",
    paramApiKey: env.smsParamApiKey,
    paramSenderId: env.smsParamSenderId,
    paramNumber: env.smsParamNumber,
    paramMessage: env.smsParamMessage,
  };
};

const getByPath = (obj: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);

/**
 * Sends an SMS through whichever gateway is configured (Super Admin's
 * platform-wide config, passed in as `config`; falls back to the SMS_*
 * env vars when `config` is omitted). Written generically because
 * Bangladeshi SMS gateways (SSLWireless, Alpha SMS, BulkSMSBD, ...) all
 * expose a simple HTTP GET/POST with an api key + sender id + number +
 * message, but disagree on exact param names.
 *
 * If no gateway is configured at all, logs to the console instead of
 * failing, exactly like EmailService does for SMTP.
 */
export const smsService = {
  async send(input: SendSmsInput, config?: SmsGatewayConfig | null): Promise<SendResult> {
    const resolved = config ?? envConfig();
    if (!resolved) {
      logger.info("[SMS:console-dev-log] SMS gateway not configured — would have sent:", input);
      // eslint-disable-next-line no-console
      console.log(`\n📱 [DEV SMS] To: ${input.to}\nMessage: ${input.message}\n`);
      return { success: true, provider: "console-dev-log" };
    }

    const params: Record<string, string> = {
      [resolved.paramApiKey]: resolved.apiKey,
      [resolved.paramNumber]: input.to,
      [resolved.paramMessage]: input.message,
    };
    if (resolved.senderId) params[resolved.paramSenderId] = resolved.senderId;

    try {
      let response: Response;

      if (resolved.httpMethod === "POST") {
        response = await fetch(resolved.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
      } else {
        const url = new URL(resolved.apiUrl);
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
        response = await fetch(url.toString(), { method: "GET" });
      }

      const bodyText = await response.text();
      logger.info("[SMS:gateway] response", {
        status: response.status,
        body: bodyText.slice(0, 500),
      });

      if (!response.ok) {
        return {
          success: false,
          provider: "sms-gateway",
          errorMessage: `Gateway responded ${response.status}: ${bodyText.slice(0, 200)}`,
        };
      }

      return { success: true, provider: "sms-gateway" };
    } catch (err) {
      logger.error("SmsService.send failed:", err);
      return {
        success: false,
        provider: "sms-gateway",
        errorMessage: (err as Error)?.message || "Failed to send SMS",
      };
    }
  },

  /** Checks the configured gateway's account balance. The endpoint/param
   * names/response shape are all admin-configured (see
   * PlatformSmsConfig) since every gateway differs here too. */
  async getBalance(config: SmsBalanceConfig): Promise<BalanceResult> {
    if (!config.balanceUrl) {
      return { success: false, errorMessage: "Balance check endpoint কনফিগার করা নেই" };
    }

    try {
      const params: Record<string, string> = { [config.balanceParamApiKey]: config.apiKey };
      let response: Response;

      if (config.balanceHttpMethod === "POST") {
        response = await fetch(config.balanceUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
      } else {
        const url = new URL(config.balanceUrl);
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
        response = await fetch(url.toString(), { method: "GET" });
      }

      const bodyText = await response.text();
      if (!response.ok) {
        return {
          success: false,
          errorMessage: `Gateway responded ${response.status}: ${bodyText.slice(0, 200)}`,
        };
      }

      try {
        const json = JSON.parse(bodyText);
        const value = getByPath(json, config.balanceResponsePath);
        if (value === undefined) {
          return { success: true, raw: bodyText.slice(0, 300) };
        }
        return { success: true, balance: value as number | string };
      } catch {
        return { success: true, raw: bodyText.slice(0, 300) };
      }
    } catch (err) {
      logger.error("SmsService.getBalance failed:", err);
      return { success: false, errorMessage: (err as Error)?.message || "Balance check failed" };
    }
  },
};
