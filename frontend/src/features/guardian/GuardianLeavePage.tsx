import { useCallback, useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import Badge, { type BadgeTone } from "@madrasha/shared-ui/src/components/ui/Badge";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import { formatDate, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";

/** Wire shape of GET /guardian/leaves (backend attendance-leave module). */
type LeaveItem = {
  id: number;
  attendee_id: number;
  attendee_name: string | null;
  from_date: string;
  to_date: string;
  days: number;
  leave_type: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requested_via: string;
  review_note: string | null;
  created_at: string;
};

const LEAVE_TYPES = ["sick", "family", "travel", "other"] as const;
// Same limits the backend enforces (GUARDIAN_BACKDATE_DAYS / MAX_GUARDIAN_LEAVE_DAYS).
const BACKDATE_DAYS = 3;
const MAX_DAYS = 30;

const STATUS_TONE: Record<LeaveItem["status"], BadgeTone> = {
  PENDING: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "slate",
};

/** Browser-local YYYY-MM-DD, shifted by n days. */
const localDate = (n = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const addDaysTo = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function GuardianLeavePage() {
  const t = useText(guardianText);
  const lang = useLang();
  const toast = useToastStore();
  const confirm = useConfirmStore((s) => s.show);
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);

  const [items, setItems] = useState<LeaveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromDate, setFromDate] = useState(localDate());
  const [toDate, setToDate] = useState(localDate());
  const [leaveType, setLeaveType] = useState<(typeof LEAVE_TYPES)[number]>("sick");
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);

  const load = useCallback(async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    try {
      const res = await guardianApi.get("/guardian/leaves", { params: { student_id: selectedStudentId } });
      setItems(res.data?.data || []);
    } catch {
      // handled by guardianApi interceptor
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!selectedStudentId) {
    return <EmptyState title={t.noChild} />;
  }

  const minDate = localDate(-BACKDATE_DAYS);

  const handleSubmit = async () => {
    if (!fromDate || !toDate || !reason.trim()) {
      setInvalid(true);
      toast.push("error", t.fillAllFields);
      return;
    }
    if (fromDate > toDate) {
      toast.push("error", t.invalidRange);
      return;
    }
    setSaving(true);
    try {
      await guardianApi.post("/guardian/leaves", {
        student_id: selectedStudentId,
        from_date: fromDate,
        to_date: toDate,
        leave_type: leaveType,
        reason: reason.trim(),
      });
      toast.push("success", t.leaveSubmitted);
      setReason("");
      setInvalid(false);
      await load();
    } catch {
      // handled by guardianApi interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (item: LeaveItem) => {
    confirm({
      title: t.cancelLeaveTitle,
      message: t.cancelLeaveMessage,
      confirmText: t.cancelRequest,
      danger: true,
      onConfirm: async () => {
        try {
          await guardianApi.post(`/guardian/leaves/${item.id}/cancel`);
          toast.push("success", t.leaveCancelled);
          await load();
        } catch {
          // handled by guardianApi interceptor
        }
      },
    });
  };

  const fmt = (date: string) => formatDate(`${date}T00:00:00`, lang);

  return (
    <div className="space-y-6">
      <PageHeader title={t.leave} subtitle={t.leaveSubtitle} />

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">{t.applyLeave}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{t.fromDate}</span>
            <Input
              type="date"
              value={fromDate}
              min={minDate}
              onChange={(e) => {
                const v = e.target.value;
                setFromDate(v);
                if (v && (toDate < v || toDate > addDaysTo(v, MAX_DAYS - 1))) setToDate(v);
              }}
              invalid={invalid && !fromDate}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{t.toDate}</span>
            <Input
              type="date"
              value={toDate}
              min={fromDate || minDate}
              max={fromDate ? addDaysTo(fromDate, MAX_DAYS - 1) : undefined}
              onChange={(e) => setToDate(e.target.value)}
              invalid={invalid && !toDate}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{t.leaveType}</span>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as (typeof LEAVE_TYPES)[number])}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            >
              {LEAVE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t.leaveTypes[type]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium text-slate-700">{t.reason}</span>
          <textarea
            value={reason}
            maxLength={500}
            rows={3}
            placeholder={t.reasonPlaceholder}
            onChange={(e) => setReason(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
              invalid && !reason.trim()
                ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
                : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            }`}
          />
        </label>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">{t.leaveRangeHint}</p>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? t.submitting : t.submitLeave}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{t.myRequests}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-start text-slate-500">
              <tr>
                <th className="px-5 py-3 text-start">{t.period}</th>
                <th className="px-5 py-3 text-start">{t.leaveType}</th>
                <th className="px-5 py-3 text-start">{t.reason}</th>
                <th className="px-5 py-3 text-start">{t.status}</th>
                <th className="px-5 py-3 text-end">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                    {t.noLeaves}
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-t align-top">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">
                      {fmt(item.from_date)}
                      {item.to_date !== item.from_date ? ` - ${fmt(item.to_date)}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">{t.workingDays(localizeDigits(item.days, lang))}</p>
                  </td>
                  <td className="px-5 py-3">{t.leaveTypes[item.leave_type] || item.leave_type}</td>
                  <td className="px-5 py-3">
                    <p className="whitespace-pre-line text-slate-700">{item.reason}</p>
                    {item.review_note && (
                      <p className="mt-1 text-xs text-slate-500">
                        {t.reviewNote}: {item.review_note}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={STATUS_TONE[item.status] || "slate"}>{t.leaveStatus[item.status] || item.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-end">
                    {item.status === "PENDING" && item.requested_via === "guardian" && (
                      <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => handleCancel(item)}>
                        {t.cancelRequest}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
