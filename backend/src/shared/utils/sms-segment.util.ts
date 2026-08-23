/**
 * Encoding-aware SMS segment calculation (GSM 03.38 default alphabet vs
 * UCS-2/Unicode), used by the message-billing module to compute how many
 * SMS credits a message actually costs. Never use `message.length` alone
 * for billing - a 71-character Bangla/Arabic/emoji message is 2 SMS, not 1.
 */

export type SmsEncoding = "GSM_7" | "UNICODE";

export interface SmsSegmentAnalysis {
  encoding: SmsEncoding;
  /** Raw UTF-16 code unit count (what the composer shows as "characters"). */
  characterCount: number;
  /** Septets used (GSM-7) or UCS-2 units used (Unicode) - the number segment limits are measured against. */
  effectiveLength: number;
  segmentCount: number;
}

// GSM 03.38 default alphabet (128 code points, positions 0x00-0x7F). Each
// character here costs exactly 1 septet.
const GSM_7BIT_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

// GSM 03.38 extension table. Each of these requires an ESC (0x1B) prefix,
// so it costs 2 septets, not 1.
const GSM_7BIT_EXTENDED = "^{}\\[~]|€";

const GSM_BASIC_SET = new Set(GSM_7BIT_BASIC);
const GSM_EXTENDED_SET = new Set(GSM_7BIT_EXTENDED);

const GSM_SINGLE_SEGMENT_LIMIT = 160;
const GSM_MULTIPART_SEGMENT_LIMIT = 153;
const UNICODE_SINGLE_SEGMENT_LIMIT = 70;
const UNICODE_MULTIPART_SEGMENT_LIMIT = 67;

const segmentsFor = (effectiveLength: number, singleLimit: number, multipartLimit: number): number => {
  if (effectiveLength <= 0) return 0;
  if (effectiveLength <= singleLimit) return 1;
  return Math.ceil(effectiveLength / multipartLimit);
};

/**
 * Analyzes `message` and returns its encoding + segment count. Detects
 * GSM-7 vs Unicode automatically by checking every character against the
 * GSM 03.38 alphabet - a single Bangla/Arabic/emoji character anywhere in
 * the message forces the whole message into UCS-2/Unicode billing, exactly
 * like real SMS gateways do.
 *
 * `characterCount` is the raw UTF-16 code unit count (`message.length`),
 * which is also what's used for Unicode segment math - this matches how
 * gateways encode astral-plane characters (emoji) as UTF-16 surrogate
 * pairs, i.e. 2 UCS-2 units, not 1.
 */
export function analyzeSmsContent(message: string): SmsSegmentAnalysis {
  const characterCount = message.length;

  let isGsm7 = true;
  let septetLength = 0;
  for (const ch of message) {
    if (GSM_BASIC_SET.has(ch)) {
      septetLength += 1;
    } else if (GSM_EXTENDED_SET.has(ch)) {
      septetLength += 2;
    } else {
      isGsm7 = false;
      break;
    }
  }

  if (isGsm7) {
    return {
      encoding: "GSM_7",
      characterCount,
      effectiveLength: septetLength,
      segmentCount: segmentsFor(septetLength, GSM_SINGLE_SEGMENT_LIMIT, GSM_MULTIPART_SEGMENT_LIMIT),
    };
  }

  return {
    encoding: "UNICODE",
    characterCount,
    effectiveLength: characterCount,
    segmentCount: segmentsFor(characterCount, UNICODE_SINGLE_SEGMENT_LIMIT, UNICODE_MULTIPART_SEGMENT_LIMIT),
  };
}
