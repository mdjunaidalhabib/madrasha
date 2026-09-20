import { Wifi, WifiOff, HelpCircle } from "lucide-react";
import Badge, { type BadgeTone } from "@madrasha/shared-ui/src/components/ui/Badge";
import type { AttendanceDevice, DeviceConnectionStatus, PunchSyncStatus, SmsStatus } from "./types";
import { formatDateTime, relativeTime } from "./utils";

export const inputLabelClass = "mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400";

export const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const DEVICE_STATUS: Record<DeviceConnectionStatus, { label: string; tone: BadgeTone }> = {
  online: { label: "অনলাইন", tone: "green" },
  offline: { label: "অফলাইন", tone: "red" },
  unknown: { label: "অজানা", tone: "slate" },
};

export function DeviceStatusBadge({
  status,
  inactive,
}: {
  status: DeviceConnectionStatus;
  inactive?: boolean;
}) {
  if (inactive) return <Badge tone="slate">নিষ্ক্রিয়</Badge>;
  const { label, tone } = DEVICE_STATUS[status] ?? DEVICE_STATUS.unknown;
  return <Badge tone={tone}>{label}</Badge>;
}

const SYNC_STATUS: Record<PunchSyncStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "অপেক্ষমাণ", tone: "yellow" },
  SYNCING: { label: "সিঙ্ক হচ্ছে", tone: "blue" },
  SYNCED: { label: "সিঙ্ক হয়েছে", tone: "green" },
  FAILED: { label: "ব্যর্থ", tone: "red" },
};

export function SyncStatusBadge({ status }: { status: PunchSyncStatus | null | undefined }) {
  const cfg = status ? SYNC_STATUS[status] : undefined;
  return cfg ? (
    <Badge tone={cfg.tone}>{cfg.label}</Badge>
  ) : (
    <span className="text-slate-400">—</span>
  );
}

const SMS_STATUS: Record<SmsStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "অপেক্ষমাণ", tone: "yellow" },
  PROCESSING: { label: "পাঠানো হচ্ছে", tone: "blue" },
  SENT: { label: "পাঠানো হয়েছে", tone: "green" },
  FAILED: { label: "ব্যর্থ", tone: "red" },
};

export function SmsStatusBadge({ status }: { status: SmsStatus | null | undefined }) {
  const cfg = status ? SMS_STATUS[status] : undefined;
  return cfg ? (
    <Badge tone={cfg.tone}>{cfg.label}</Badge>
  ) : (
    <span className="text-slate-400">—</span>
  );
}

/** Relative time with the exact timestamp in a tooltip. */
export function TimeAgo({
  value,
  now,
  fallback,
}: {
  value: string | null | undefined;
  now: number;
  fallback?: string;
}) {
  return (
    <span title={value ? formatDateTime(value) : undefined}>
      {relativeTime(value, now, fallback)}
    </span>
  );
}

/** Compact online/offline strip - one chip per device. */
export function DeviceStatusStrip({
  devices,
  now,
  loading,
  error,
}: {
  devices: AttendanceDevice[];
  now: number;
  loading: boolean;
  error: boolean;
}) {
  if (loading && devices.length === 0) {
    return <div className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
  }

  if (devices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {error ? "ডিভাইসের অবস্থা লোড করা যায়নি" : "কোনো ডিভাইস যোগ করা হয়নি"}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {devices.map((d) => {
        const status = d.is_active ? d.status : "unknown";
        const Icon =
          !d.is_active || status === "unknown" ? HelpCircle : status === "online" ? Wifi : WifiOff;
        const color =
          !d.is_active || status === "unknown"
            ? "text-slate-500"
            : status === "online"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400";
        return (
          <div
            key={d.id}
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <Icon size={18} className={`shrink-0 ${color}`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {d.name}
                </span>
                <DeviceStatusBadge status={d.status} inactive={!d.is_active} />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                সর্বশেষ যোগাযোগ: <TimeAgo value={d.last_seen_at} now={now} />
              </p>
            </div>
          </div>
        );
      })}
      {error && (
        <span className="self-center text-xs text-amber-600 dark:text-amber-400">
          রিফ্রেশ ব্যর্থ - পুরনো তথ্য দেখানো হচ্ছে
        </span>
      )}
    </div>
  );
}
