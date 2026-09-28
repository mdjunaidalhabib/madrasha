import { type NotificationLogItem, type NotificationStatus } from "../../services/phase4Api";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { commonText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { notificationsText } from "./notifications.text";

const STATUS_LABELS: Record<NotificationStatus, { label: string; className: string }> = {
  PENDING: { label: "প্রক্রিয়াধীন", className: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400" },
  SENT: { label: "পাঠানো হয়েছে", className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  FAILED: { label: "ব্যর্থ", className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
};

interface NotificationHistoryListProps {
  logs: NotificationLogItem[];
  loading: boolean;
}

const NotificationHistoryList = ({ logs, loading }: NotificationHistoryListProps) => {
  const t = useText(notificationsText);
  const c = useText(commonText);
  const lang = useLang();
  if (loading) return <SkeletonList items={6} />;
  if (logs.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">{t.noHistory}</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {logs.map((log) => (
        <div key={log.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-gray-800 dark:text-slate-200">
              {log.channel === "SMS" ? "SMS" : t.email} → {log.recipient}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs ${STATUS_LABELS[log.status].className}`}>
              {({ PENDING: t.statusPending, SENT: t.statusSent, FAILED: t.failed } as Record<string, string>)[log.status] ?? STATUS_LABELS[log.status].label}
            </span>
          </div>
          {log.subject && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t.subjectLabel} {log.subject}</p>}
          <p className="mt-1 truncate text-xs text-gray-500 dark:text-slate-400">{log.message}</p>
          {log.errorMessage && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t.errorLabel} {log.errorMessage}</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default NotificationHistoryList;
