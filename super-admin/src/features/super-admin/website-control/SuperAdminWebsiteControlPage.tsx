import { useEffect, useMemo, useState } from "react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { listMadrasas, type MadrasaListItem } from "../../../services/superAdminApi";
import { updateMadrasaWebsiteStatus } from "../../../services/websiteApi";
import { INSTITUTION_TYPE_LABELS, getText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { websiteControlText } from "./websiteControl.text";

type WebsiteStatus = "active" | "limited" | "disabled";

export default function SuperAdminWebsiteControlPage() {
  const t = useText(websiteControlText);
  const lang = useLang();
  const statusLabel = (s?: string) => t.statuses[s || "active"] || s || "active";
  const [madrasas, setMadrasas] = useState<MadrasaListItem[]>([]);
  const [madrasaId, setMadrasaId] = useState("");
  const [status, setStatus] = useState<WebsiteStatus>("active");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const selected = useMemo(
    () => madrasas.find((m) => String(m.id) === madrasaId),
    [madrasas, madrasaId],
  );

  useEffect(() => {
    listMadrasas({ page: 1, limit: 100 })
      .then((data) => {
        const rows = Array.isArray(data) ? data : (data.data ?? []);
        setMadrasas(rows);
        if (rows[0]) {
          setMadrasaId(String(rows[0].id));
          setStatus((rows[0].website_status as WebsiteStatus) || "active");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const onSelect = (id: string) => {
    setMadrasaId(id);
    const row = madrasas.find((m) => String(m.id) === id);
    setStatus((row?.website_status as WebsiteStatus) || "active");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!madrasaId) return;
    await updateMadrasaWebsiteStatus(Number(madrasaId), status);
    setMadrasas((prev) =>
      prev.map((m) => (String(m.id) === madrasaId ? { ...m, website_status: status } : m)),
    );
    const tx = getText(websiteControlText);
    setMessage(tx.updated(tx.statuses[status] || status));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 to-blue-900 p-6 text-white shadow">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-blue-100">
          {t.subtitle}
        </p>
      </div>

      <form
        onSubmit={submit}
        className="max-w-3xl rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:border-slate-700 dark:bg-slate-900"
      >
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.institution}</label>
          <select
            className="mt-1 w-full rounded-xl border px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={madrasaId}
            onChange={(e) => onSelect(e.target.value)}
            disabled={loading}
            required
          >
            <option value="">{t.selectInstitution}</option>
            {madrasas.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id} — {m.name}
                {m.institution_type ? ` (${INSTITUTION_TYPE_LABELS[m.institution_type][lang]})` : ""}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800 md:grid-cols-3">
            <div>
              <span className="text-slate-500 dark:text-slate-400">{t.id}</span>
              <p className="font-bold text-slate-900 dark:text-slate-100">{selected.id}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">{t.name}</span>
              <p className="font-bold text-slate-900 dark:text-slate-100">{selected.name}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">{t.currentStatus}</span>
              <p className="font-bold capitalize text-blue-700 dark:text-blue-400">
                {statusLabel(selected.website_status)}
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.websiteStatus}</label>
          <select
            className="mt-1 w-full rounded-xl border px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={status}
            onChange={(e) => setStatus(e.target.value as WebsiteStatus)}
          >
            <option value="active">{t.statuses.active}</option>
            <option value="limited">{t.statuses.limited}</option>
            <option value="disabled">{t.statuses.disabled}</option>
          </select>
        </div>
        <Button disabled={!madrasaId || loading}>{t.updateStatus}</Button>
        {message && (
          <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">{message}</p>
        )}
      </form>
    </div>
  );
}
