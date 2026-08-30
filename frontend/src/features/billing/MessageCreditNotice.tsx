import { useEffect, useState } from "react";
import { billingApi, type SmsEncoding, type SmsPreviewResult, type SubscriptionSummaryDto } from "../../services/billingApi";
import { type NotificationChannel } from "../../services/phase4Api";
import { logger } from "../../utils/logger";

interface MessageCreditNoticeProps {
  channel: NotificationChannel;
  message: string;
  onDisabledChange?: (disabled: boolean) => void;
}

// Mirrors backend/src/shared/utils/sms-segment.util.ts's segment limits -
// used here only to *display* the per-SMS cap the server already applied,
// not to recompute billing.
const SMS_SEGMENT_LIMITS: Record<SmsEncoding, { single: number; multipart: number }> = {
  GSM_7: { single: 160, multipart: 153 },
  UNICODE: { single: 70, multipart: 67 },
};

/** The per-segment character cap that's actually in effect for this message
 * - once a message splits into multiple SMS, each part's usable length drops
 * (space is reserved for the concatenation header), so the cap shown here
 * flips from the single-SMS limit to the multipart limit automatically. */
const perSmsLength = (encoding: SmsEncoding, segmentCount: number) => {
  const limits = SMS_SEGMENT_LIMITS[encoding];
  return segmentCount > 1 ? limits.multipart : limits.single;
};

const StatTile = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col rounded-md bg-white px-2.5 py-1.5 dark:bg-slate-900/60">
    <span className="text-[10px] font-medium uppercase tracking-wide text-blue-500/80 dark:text-blue-400/70">
      {label}
    </span>
    <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">{value}</span>
  </div>
);

/** Shows remaining SMS/Email credit near the composer's send button, plus a
 * live SMS segment/cost preview (debounced, server-authoritative). Purely
 * UX-level guidance - the backend already enforces the real credit check. */
const MessageCreditNotice = ({ channel, message, onDisabledChange }: MessageCreditNoticeProps) => {
  const [subscription, setSubscription] = useState<SubscriptionSummaryDto | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [preview, setPreview] = useState<SmsPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingSub(true);
    billingApi
      .getSubscription(channel)
      .then((res) => {
        if (!cancelled) setSubscription(res.data.data);
      })
      .catch((err) => logger.error("LOAD BILLING SUBSCRIPTION ERROR:", err))
      .finally(() => {
        if (!cancelled) setLoadingSub(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channel]);

  useEffect(() => {
    if (channel !== "SMS" || !message.trim()) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      billingApi
        .previewSms(message)
        .then((res) => {
          if (!cancelled) setPreview(res.data.data);
        })
        .catch((err) => logger.error("SMS PREVIEW ERROR:", err))
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [channel, message]);

  const blocked = !!subscription && (!subscription.active || subscription.remainingCredit <= 0);

  useEffect(() => {
    onDisabledChange?.(blocked);
  }, [blocked, onDisabledChange]);

  if (loadingSub) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {subscription && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            blocked
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
              : subscription.isLowCredit
                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
                : "border-gray-200 bg-gray-50 text-gray-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
          }`}
        >
          {!subscription.active
            ? `${channel === "SMS" ? "SMS" : "ইমেইল"} প্যাকেজ সক্রিয় নেই — মেসেজ পাঠানো যাবে না, আগে প্যাকেজ কিনুন`
            : subscription.remainingCredit <= 0
              ? `আপনার ${channel === "SMS" ? "SMS" : "ইমেইল"} শেষ হয়ে গেছে — নতুন প্যাকেজ কিনুন`
              : `আপনার কাছে আছে: ${subscription.remainingCredit.toLocaleString("bn-BD")} টি ${channel === "SMS" ? "SMS" : "ইমেইল"}`}
        </div>
      )}

      {channel === "SMS" && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          শুধু ইংরেজি/সংখ্যা দিয়ে লিখলে ১৬০ অক্ষর পর্যন্ত = ১টি SMS, তারপর প্রতি ১৫৩ অক্ষরে আরেকটি SMS যোগ হয়। মেসেজে
          বাংলা অক্ষর, আরবি বা ইমোজি থাকলে ৭০ অক্ষর পর্যন্ত = ১টি SMS, তারপর প্রতি ৬৭ অক্ষরে আরেকটি SMS যোগ হয়।
        </div>
      )}

      {channel === "SMS" &&
        (() => {
          const hasMessage = !!message.trim();
          const stillLoading = hasMessage && (previewLoading || !preview);
          const encoding = preview?.encoding ?? "GSM_7";
          const characterCount = hasMessage ? (preview?.characterCount ?? 0) : 0;
          const segmentCount = hasMessage ? (preview?.segmentCount ?? 0) : 0;
          const cost = hasMessage ? Number(preview?.estimatedCost ?? 0) : 0;

          return (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <StatTile label="ভাষা" value={encoding === "UNICODE" ? "বাংলা/বিশেষ" : "ইংরেজি"} />
                <StatTile label="SMS Length" value={stillLoading ? "..." : characterCount} />
                <StatTile label="Per SMS Length" value={perSmsLength(encoding, segmentCount)} />
                <StatTile label="SMS Count" value={stillLoading ? "..." : segmentCount} />
              </div>
              <p className="mt-1.5 text-xs text-blue-700 dark:text-blue-300">
                আনুমানিক খরচ: <strong>৳{stillLoading ? "..." : cost.toLocaleString("bn-BD")}</strong>
              </p>
            </div>
          );
        })()}
    </div>
  );
};

export default MessageCreditNotice;
