import { env } from "../config/env";
import { logger } from "../logger/logger";
import type { SendResult } from "./email.service";

export interface SendSmsInput {
  to: string; // phone number, gateway-specific format (usually 8801XXXXXXXXX)
  message: string;
}

const isSmsConfigured = () => Boolean(env.smsApiUrl && env.smsApiKey);

/**
 * Sends an SMS through whichever gateway is configured in .env
 * (SMS_API_URL / SMS_API_KEY / SMS_SENDER_ID / SMS_HTTP_METHOD /
 * SMS_PARAM_*). Written generically because Bangladeshi SMS gateways
 * (SSLWireless, Alpha SMS, BulkSMSBD, ...) all expose a simple HTTP
 * GET/POST with an api key + sender id + number + message, but disagree
 * on exact param names - the SMS_PARAM_* env vars let this adapt to
 * whichever gateway you already have an account with, without a code
 * change.
 *
 * If SMS_API_URL/KEY aren't set yet, logs to the console instead of
 * failing, exactly like EmailService does for SMTP.
 */
export const smsService = {
  async send(input: SendSmsInput): Promise<SendResult> {
    if (!isSmsConfigured()) {
      logger.info("[SMS:console-dev-log] SMS gateway not configured — would have sent:", input);
      // eslint-disable-next-line no-console
      console.log(`\n📱 [DEV SMS] To: ${input.to}\nMessage: ${input.message}\n`);
      return { success: true, provider: "console-dev-log" };
    }

    const params: Record<string, string> = {
      [env.smsParamApiKey]: env.smsApiKey,
      [env.smsParamNumber]: input.to,
      [env.smsParamMessage]: input.message,
    };
    if (env.smsSenderId) params[env.smsParamSenderId] = env.smsSenderId;

    try {
      let response: Response;

      if (env.smsHttpMethod === "POST") {
        response = await fetch(env.smsApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
      } else {
        const url = new URL(env.smsApiUrl);
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
};
