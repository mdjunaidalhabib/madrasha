import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  formatDate,
  formatNumber,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import ConfirmModal from "@madrasha/shared-ui/src/components/ui/ConfirmModal";
import {
  getDomainSubscriptions,
  removeDomainSubscription,
  saveDomainSubscription,
  type DomainDraft,
  type DomainSubscription,
} from "../../../services/subscriptionApi";
import { planToolsText } from "./plan-tools.text";

const inputClass =
  "mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";
function newDraft(domain: string) {
  const startDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return {
    domain,
    amount: "",
    startDate,
    endDate: new Date(+new Date(`${startDate}T00:00:00Z`) + 364 * 86400000)
      .toISOString()
      .slice(0, 10),
    isActive: 1 as 0 | 1,
    // DECISION: register domains in the institution's name by default.
    registeredInNameOf: "institution" as "institution" | "platform",
  };
}

export default function DomainAddOnFields({
  madrasaId,
  connectedDomain,
  prices,
  onConnectedChange,
  onBusyChange,
}: {
  madrasaId: number;
  connectedDomain: string;
  prices?: { firstYear: number; renewal: number };
  onConnectedChange: (domain: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useText(planToolsText);
  const lang = useLang();
  const show = useToastStore((s) => s.show);
  const [rows, setRows] = useState<DomainSubscription[]>([]);
  const [draft, setDraft] = useState(() => newDraft(connectedDomain));
  const [editing, setEditing] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const [removing, setRemoving] = useState<DomainSubscription | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setRows(await getDomainSubscriptions(madrasaId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [madrasaId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const body: DomainDraft = {
        domain: draft.domain.trim().toLowerCase(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        isActive: draft.isActive,
        registeredInNameOf: draft.registeredInNameOf,
        ...(draft.amount === "" ? {} : { amountPaid: Number(draft.amount) }),
      };
      await saveDomainSubscription(madrasaId, body, editing);
      if (body.isActive) onConnectedChange(body.domain);
      await load();
      show(t.domainSaved, "success");
      setEditing(undefined);
      setDraft(newDraft(body.domain));
    } catch (error) {
      show(
        (error as { response?: { data?: { message?: string } } }).response?.data
          ?.message || t.failed,
        "error",
      );
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    if (!removing || busy) return;
    setBusy(true);
    try {
      await removeDomainSubscription(madrasaId, removing.id);
      if (connectedDomain === removing.domain) onConnectedChange("");
      setRemoving(null);
      setEditing(undefined);
      setDraft(newDraft(""));
      await load();
    } catch {
      show(t.failed, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-4 space-y-3 rounded-xl border p-4 dark:border-slate-700">
      <h3 className="font-semibold dark:text-slate-100">{t.domain}</h3>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        {t.domainHint}
      </p>
      {prices && (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {t.domainDefaultPrice(
            formatNumber(prices.firstYear, lang),
            formatNumber(prices.renewal, lang),
          )}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm">
          {t.loading}
        </p>
      ) : failed ? (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {t.failed}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void load()}
          >
            {t.retry}
          </button>
        </p>
      ) : !rows.length ? (
        <p className="text-sm text-slate-500">{t.noDomains}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`rounded-lg border p-3 text-sm dark:text-slate-100 ${row.expired ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "dark:border-slate-700"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-all font-medium">{row.domain}</span>
                <span className="text-xs">
                  ৳{formatNumber(Number(row.amountPaid), lang)} ·{" "}
                  {row.expired
                    ? t.expired
                    : row.isActive
                      ? t.active
                      : t.inactive}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatDate(row.startDate, lang)} —{" "}
                {formatDate(row.endDate, lang)} ·{" "}
                {row.registeredInNameOf === "platform"
                  ? t.platform
                  : t.institution}
              </p>
              {row.expired && (
                <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
                  {t.domainExpired}
                </p>
              )}
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs underline"
                  onClick={() => {
                    setEditing(row.id);
                    setDraft({
                      domain: row.domain,
                      amount: String(row.amountPaid),
                      startDate: row.startDate.slice(0, 10),
                      endDate: row.endDate.slice(0, 10),
                      registeredInNameOf: row.registeredInNameOf,
                      isActive: row.isActive ? 1 : 0,
                    });
                  }}
                >
                  {t.edit}
                </button>
                {connectedDomain === row.domain && (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-xs text-rose-700 underline dark:text-rose-300"
                    onClick={() => setRemoving(row)}
                  >
                    {t.disconnect}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t pt-3 dark:border-slate-700">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium dark:text-slate-100">
            {editing ? t.edit : t.addDomain}
          </h4>
          {editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(undefined);
                setDraft(newDraft(connectedDomain));
              }}
              className="text-xs underline"
            >
              {t.addDomain}
            </button>
          )}
        </div>
        <form onSubmit={(event) => void save(event)} className="space-y-3">
          <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              {t.domainName}
              <input
                required
                className={inputClass}
                value={draft.domain}
                onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
                placeholder="example.com"
              />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-300">
              {t.domainPrice}
              <input
                type="number"
                min={0}
                max={99999999}
                step="0.01"
                required={!draft.domain.trim().toLowerCase().endsWith(".com")}
                className={inputClass}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                placeholder={t.autoAmount}
              />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-300">
              {t.start}
              <input
                type="date"
                required
                className={inputClass}
                value={draft.startDate}
                onChange={(e) =>
                  setDraft({ ...draft, startDate: e.target.value })
                }
              />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-300">
              {t.end}
              <input
                type="date"
                required
                min={draft.startDate}
                className={inputClass}
                value={draft.endDate}
                onChange={(e) =>
                  setDraft({ ...draft, endDate: e.target.value })
                }
              />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-300">
              {t.domainOwner}
              <select
                className={inputClass}
                value={draft.registeredInNameOf}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    registeredInNameOf: e.target.value as
                      | "institution"
                      | "platform",
                  })
                }
              >
                <option value="institution">{t.institution}</option>
                <option value="platform">{t.platform}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end py-2 text-sm dark:text-slate-100">
              <input
                type="checkbox"
                checked={!!draft.isActive}
                onChange={(e) =>
                  setDraft({ ...draft, isActive: e.target.checked ? 1 : 0 })
                }
              />
              {t.active}
            </label>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || loading || failed}
              className="rounded-lg bg-indigo-700 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? t.loading : t.saveDomain}
            </button>
            <p className="text-xs text-slate-500">{t.domainSeparate}</p>
          </div>
        </form>
      </div>
      <ConfirmModal
        open={!!removing}
        title={t.disconnect}
        message={t.disconnectConfirm}
        danger
        loading={busy}
        onClose={() => {
          if (!busy) setRemoving(null);
        }}
        onConfirm={() => void disconnect()}
      />
    </section>
  );
}
