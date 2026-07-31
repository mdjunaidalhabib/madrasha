import { useCallback, useEffect, useState } from "react";
import {
  notificationApi,
  type NotificationChannel,
  type NotificationLogItem,
  type NotificationStatus,
} from "../../services/phase4Api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";

const STATUS_LABELS: Record<NotificationStatus, { label: string; className: string }> = {
  PENDING: { label: "প্রক্রিয়াধীন", className: "bg-gray-100 text-gray-600" },
  SENT: { label: "পাঠানো হয়েছে", className: "bg-green-100 text-green-700" },
  FAILED: { label: "ব্যর্থ", className: "bg-red-100 text-red-700" },
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const parseRecipients = (raw: string) =>
  raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

const NotificationsPage = () => {
  const [channel, setChannel] = useState<NotificationChannel>("SMS");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [logs, setLogs] = useState<NotificationLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await notificationApi.list({
        status: (statusFilter as NotificationStatus) || undefined,
      });
      setLogs(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD NOTIFICATIONS ERROR:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const recipientCount = parseRecipients(recipientsRaw).length;

  const handleSend = async () => {
    const recipients = parseRecipients(recipientsRaw);
    if (recipients.length === 0) {
      useToastStore.getState().show("কমপক্ষে একজন প্রাপক দিন", "error");
      return;
    }
    if (!message.trim()) {
      useToastStore.getState().show("মেসেজ লিখুন", "error");
      return;
    }
    if (channel === "EMAIL" && !subject.trim()) {
      useToastStore.getState().show("ইমেইলের জন্য সাবজেক্ট দিন", "error");
      return;
    }

    try {
      setSending(true);
      const res = await notificationApi.send({
        channel,
        recipients,
        subject: channel === "EMAIL" ? subject.trim() : undefined,
        message: message.trim(),
      });
      const data = (res.data as any)?.data;
      useToastStore
        .getState()
        .show(`পাঠানো হয়েছে: ${data?.sent ?? 0} জন, ব্যর্থ: ${data?.failed ?? 0} জন`, "success");
      setRecipientsRaw("");
      setSubject("");
      setMessage("");
      loadLogs();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "পাঠাতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">SMS / ইমেইল নোটিফিকেশন</h1>
          <p className="mt-1 text-sm text-gray-500">
            অভিভাবক বা স্টাফদের কাছে একসাথে SMS বা ইমেইল পাঠান
          </p>
        </div>

        {/* Send form */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setChannel("SMS")}
              className={`h-9 rounded-md px-4 text-sm font-medium transition ${
                channel === "SMS" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              SMS
            </button>
            <button
              type="button"
              onClick={() => setChannel("EMAIL")}
              className={`h-9 rounded-md px-4 text-sm font-medium transition ${
                channel === "EMAIL" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              ইমেইল
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                প্রাপক ({channel === "SMS" ? "ফোন নম্বর" : "ইমেইল"}, কমা বা নতুন লাইন দিয়ে আলাদা করুন)
                {recipientCount > 0 && <span className="text-gray-400"> — {recipientCount} জন</span>}
              </label>
              <textarea
                value={recipientsRaw}
                onChange={(e) => setRecipientsRaw(e.target.value)}
                rows={3}
                placeholder={channel === "SMS" ? "01711xxxxxx, 01911xxxxxx" : "guardian1@email.com, guardian2@email.com"}
                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              />
            </div>

            {channel === "EMAIL" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">সাবজেক্ট</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">মেসেজ</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              />
            </div>

            <button
              type="button"
              disabled={sending}
              onClick={handleSend}
              className="h-10 w-full rounded-lg bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {sending ? "পাঠানো হচ্ছে..." : "পাঠান"}
            </button>
          </div>
        </div>

        {/* History */}
        <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">পাঠানোর ইতিহাস</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-gray-300 px-2 text-xs outline-none"
            >
              <option value="">সব স্ট্যাটাস</option>
              <option value="SENT">পাঠানো হয়েছে</option>
              <option value="FAILED">ব্যর্থ</option>
            </select>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">লোড হচ্ছে...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">কোনো ইতিহাস নেই</div>
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-gray-800">
                      {log.channel === "SMS" ? "SMS" : "ইমেইল"} → {log.recipient}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${STATUS_LABELS[log.status].className}`}
                    >
                      {STATUS_LABELS[log.status].label}
                    </span>
                  </div>
                  {log.subject && <p className="mt-1 text-xs text-gray-500">বিষয়: {log.subject}</p>}
                  <p className="mt-1 truncate text-xs text-gray-500">{log.message}</p>
                  {log.errorMessage && (
                    <p className="mt-1 text-xs text-red-600">ত্রুটি: {log.errorMessage}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
