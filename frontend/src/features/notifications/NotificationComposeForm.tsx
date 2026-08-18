import { ReactNode } from "react";
import { type NotificationChannel } from "../../services/phase4Api";

interface NotificationComposeFormProps {
  channel: NotificationChannel;
  onChannelChange: (channel: NotificationChannel) => void;
  subject: string;
  onSubjectChange: (subject: string) => void;
  message: string;
  onMessageChange: (message: string) => void;
  messageLabel?: string;
  messageHint?: ReactNode;
  recipientCount: number;
  sending: boolean;
  onSend: () => void;
  sendLabel?: string;
  children?: ReactNode;
}

/** Channel toggle + subject/message fields shared by Single Send and Bulk
 * Send - recipient selection differs per page, so it's passed in as
 * `children` (rendered above the message field) instead of living here. */
const NotificationComposeForm = ({
  channel,
  onChannelChange,
  subject,
  onSubjectChange,
  message,
  onMessageChange,
  messageLabel = "মেসেজ",
  messageHint,
  recipientCount,
  sending,
  onSend,
  sendLabel = "পাঠান",
  children,
}: NotificationComposeFormProps) => {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => onChannelChange("SMS")}
          className={`h-9 rounded-md px-4 text-sm font-medium transition ${
            channel === "SMS" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          SMS
        </button>
        <button
          type="button"
          onClick={() => onChannelChange("EMAIL")}
          className={`h-9 rounded-md px-4 text-sm font-medium transition ${
            channel === "EMAIL" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          ইমেইল
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {children}

        {channel === "EMAIL" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">সাবজেক্ট</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
            {messageLabel}
          </label>
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {messageHint && <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{messageHint}</p>}
        </div>

        <button
          type="button"
          disabled={sending || recipientCount === 0}
          onClick={onSend}
          className="h-10 w-full rounded-lg bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto sm:px-6"
        >
          {sending ? "পাঠানো হচ্ছে..." : `${sendLabel} (${recipientCount} জন)`}
        </button>
      </div>
    </div>
  );
};

export default NotificationComposeForm;
