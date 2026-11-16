import { useEffect, useMemo, useState } from "react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import {
  listMadrasas,
  type MadrasaListItem,
} from "../../../services/superAdminApi";
import { updateMadrasaWebsiteStatus, resetMadrasaWebsite } from "../../../services/websiteApi";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import {
  INSTITUTION_TYPE_LABELS,
  getText,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";
import { websiteControlText } from "./websiteControl.text";
import { Globe2, LayoutTemplate, RotateCcw } from "lucide-react";
import WebsiteTemplateEditor from "./WebsiteTemplateEditor";
import InstitutionWebsiteLink from "../../../components/super-admin/InstitutionWebsiteLink";

type WebsiteStatus = "active" | "limited" | "disabled";

export default function SuperAdminWebsiteControlPage() {
  const t = useText(websiteControlText);
  const lang = useLang();
  const [view, setView] = useState<"template" | "status">("template");
  const statusLabel = (s?: string) =>
    t.statuses[s || "active"] || s || "active";
  const [madrasas, setMadrasas] = useState<MadrasaListItem[]>([]);
  const [madrasaId, setMadrasaId] = useState("");
  const [status, setStatus] = useState<WebsiteStatus>("active");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tx = (bn: string, en: string) => lang === "bn" ? bn : en;

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
      .catch((err) => setError(err?.response?.data?.message || tx("প্রতিষ্ঠানের তালিকা আনা যায়নি।", "Unable to load institutions.")))
      .finally(() => setLoading(false));
  }, []);

  const onSelect = (id: string) => {
    setMessage("");
    setError("");
    setMadrasaId(id);
    const row = madrasas.find((m) => String(m.id) === id);
    setStatus((row?.website_status as WebsiteStatus) || "active");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!madrasaId) return;
    setBusy(true);
    setError("");
    try {
      await updateMadrasaWebsiteStatus(Number(madrasaId), status);
      setMadrasas((prev) =>
        prev.map((m) =>
          String(m.id) === madrasaId ? { ...m, website_status: status } : m,
        ),
      );
      const text = getText(websiteControlText);
      setMessage(text.updated(text.statuses[status] || status));
    } catch (err: any) {
      setError(err?.response?.data?.message || tx("ওয়েবসাইট স্ট্যাটাস বদলানো যায়নি।", "Unable to update website status"));
    } finally { setBusy(false); }
  };

  const resetWebsite = () => {
    if (!selected || busy) return;
    const institution = selected;
    useConfirmStore.getState().show({
      title: tx("মূল ডেমোতে রিসেট করুন", "Reset to main demo"),
      message: tx(
        `${institution.name}-এর ওয়েবসাইটের সেটিংস, পেজ, নোটিশ, স্লাইডার, গ্যালারি, বাণী, কমিটি ও ভিডিও সর্বশেষ সংরক্ষিত ডেমো দিয়ে প্রতিস্থাপিত হবে। নিজস্ব ওয়েবসাইট সম্পাদনা মুছে যাবে। ভর্তি আবেদন, শিক্ষার্থী ও প্রতিষ্ঠানের অন্যান্য তথ্য অপরিবর্তিত থাকবে।`,
        `${institution.name}'s website settings, pages, notices, slides, gallery, messages, committee and videos will be replaced with the latest saved demo. Custom website edits will be removed. Admission applications, students and other institution data will be preserved.`,
      ),
      confirmText: tx("ওয়েবসাইট রিসেট করুন", "Reset website"),
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        setMessage("");
        setError("");
        try {
          await resetMadrasaWebsite(institution.id);
          setMessage(tx("ওয়েবসাইট মূল ডেমোতে ফিরে এসেছে।", "Website restored to the main demo."));
        } catch (err: any) {
          setError(err?.response?.data?.message || tx("ওয়েবসাইট রিসেট করা যায়নি।", "Unable to reset website."));
        } finally { setBusy(false); }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex w-fit gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setView("template")}
          aria-pressed={view === "template"}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${view === "template" ? "bg-slate-900 text-white dark:bg-teal-700" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
        >
          <LayoutTemplate size={16} />
          {lang === "bn" ? "ডেমো টেমপ্লেট" : "Demo template"}
        </button>
        <button
          type="button"
          onClick={() => setView("status")}
          aria-pressed={view === "status"}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${view === "status" ? "bg-slate-900 text-white dark:bg-teal-700" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
        >
          <Globe2 size={16} />
          {lang === "bn" ? "প্রতিষ্ঠানের স্ট্যাটাস" : "Institution status"}
        </button>
      </div>
      <div className={view === "template" ? "" : "hidden"}>
        <WebsiteTemplateEditor />
      </div>
      <div className={view === "status" ? "space-y-6" : "hidden"}>
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 to-blue-900 p-6 text-white shadow">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="mt-1 text-sm text-blue-100">{t.subtitle}</p>
        </div>

        <form
          onSubmit={submit}
          className="max-w-3xl rounded-2xl border bg-white p-6 shadow-sm space-y-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t.institution}
            </label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={madrasaId}
              onChange={(e) => onSelect(e.target.value)}
              disabled={loading || busy}
              required
            >
              <option value="">{t.selectInstitution}</option>
              {madrasas.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.id} — {m.name}
                  {m.institution_type
                    ? ` (${INSTITUTION_TYPE_LABELS[m.institution_type][lang]})`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800 md:grid-cols-3">
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {t.id}
                </span>
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {selected.id}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {t.name}
                </span>
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {selected.name}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {t.currentStatus}
                </span>
                <p className="font-bold capitalize text-blue-700 dark:text-blue-400">
                  {statusLabel(selected.website_status)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t.websiteStatus}
            </label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={status}
              disabled={busy}
              onChange={(e) => setStatus(e.target.value as WebsiteStatus)}
            >
              <option value="active">{t.statuses.active}</option>
              <option value="limited">{t.statuses.limited}</option>
              <option value="disabled">{t.statuses.disabled}</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={!madrasaId || loading || busy}>{t.updateStatus}</Button>
            {selected && <InstitutionWebsiteLink slug={selected.slug} />}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 dark:border-slate-700">
            <div className="max-w-lg">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tx("মূল ডেমোতে ফিরুন", "Restore main demo")}</h2>
              <p className="mt-1 text-xs leading-6 text-slate-500">{tx("নির্বাচিত প্রতিষ্ঠানের ওয়েবসাইট সর্বশেষ সংরক্ষিত ডেমো দিয়ে প্রতিস্থাপন করুন।", "Replace the selected institution's website with the latest saved demo.")}</p>
            </div>
            <Button type="button" variant="secondary" disabled={!selected || loading || busy} onClick={resetWebsite}>
              <RotateCcw size={14} />{tx("ওয়েবসাইট রিসেট", "Reset website")}
            </Button>
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
          {message && (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
