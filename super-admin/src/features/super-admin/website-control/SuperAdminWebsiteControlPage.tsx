import { useEffect, useMemo, useState } from "react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import {
  listMadrasas,
  type MadrasaListItem,
} from "../../../services/superAdminApi";
import { updateMadrasaWebsiteStatus, resetMadrasaWebsite, getMadrasaWebsiteTheme, updateMadrasaWebsiteTheme } from "../../../services/websiteApi";
import { WEBSITE_THEMES, type WebsiteThemeKey } from "@madrasha/shared-ui/src/website/themes";
import WebsiteThemePreview from "@madrasha/shared-ui/src/website/WebsiteThemePreview";
import { confirmWebsiteReset } from "@madrasha/shared-ui/src/website/confirmWebsiteReset";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import {
  INSTITUTION_TYPE_LABELS,
  getText,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";
import { websiteControlText } from "./websiteControl.text";
import { Globe2, LayoutTemplate, RotateCcw } from "lucide-react";
import WebsiteTemplateEditor from "./WebsiteTemplateEditor";
import DonationAccessControl from "./DonationAccessControl";
import InstitutionWebsiteLink from "../../../components/super-admin/InstitutionWebsiteLink";

type WebsiteStatus = "active" | "limited" | "disabled";

export default function SuperAdminWebsiteControlPage() {
  const t = useText(websiteControlText);
  const lang = useLang();
  const toast = useToastStore((s) => s.show);
  const [view, setView] = useState<"template" | "status">("template");
  const statusLabel = (s?: string) =>
    t.statuses[s || "active"] || s || "active";
  const [madrasas, setMadrasas] = useState<MadrasaListItem[]>([]);
  const [madrasaId, setMadrasaId] = useState("");
  const [status, setStatus] = useState<WebsiteStatus>("active");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<WebsiteThemeKey | null>(null);
  const [themeLoading, setThemeLoading] = useState(false);
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

  useEffect(() => {
    let current = true;
    setTheme(null);
    if (!madrasaId) return;
    setThemeLoading(true);
    getMadrasaWebsiteTheme(Number(madrasaId))
      .then((value) => { if (current) setTheme(value); })
      .catch((err) => { if (current) setError(err?.response?.data?.message || tx("থিম আনা যায়নি।", "Unable to load theme.")); })
      .finally(() => { if (current) setThemeLoading(false); });
    return () => { current = false; };
  }, [madrasaId]);

  const changeTheme = async (next: WebsiteThemeKey) => {
    if (!madrasaId || busy || themeLoading || next === theme) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await updateMadrasaWebsiteTheme(Number(madrasaId), next);
      setTheme(next);
      setMessage(tx("ওয়েবসাইট থিম পরিবর্তন হয়েছে।", "Website theme updated."));
    } catch (err: any) {
      setError(err?.response?.data?.message || tx("থিম বদলানো যায়নি।", "Unable to update theme."));
    } finally { setBusy(false); }
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
    confirmWebsiteReset({
      institutionName: institution.name,
      lang,
      onConfirm: async (password) => {
        setBusy(true);
        setMessage("");
        setError("");
        try {
          await resetMadrasaWebsite(institution.id, password);
          setMessage(tx("ওয়েবসাইট মূল ডেমোতে ফিরে এসেছে।", "Website restored to the main demo."));
          toast(tx("ওয়েবসাইট সফলভাবে মূল ডেমোতে ফিরিয়ে আনা হয়েছে। সর্বশেষ ডেমোর ডিজাইন ও কনটেন্ট এখন প্রয়োগ করা হয়েছে।", "Website successfully restored to the main demo. The latest demo design and content have been applied."), "success", { duration: 7000 });
          setThemeLoading(true);
          try { setTheme(await getMadrasaWebsiteTheme(institution.id)); }
          catch { setTheme(null); }
          finally { setThemeLoading(false); }
        } catch (err: any) {
          setError(err?.response?.data?.message || tx("ওয়েবসাইট রিসেট করা যায়নি।", "Unable to reset website."));
          throw err;
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
          {lang === "bn" ? "প্রতিষ্ঠানের থিম ও স্ট্যাটাস" : "Institution theme & status"}
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
          <DonationAccessControl key={madrasaId} institutionId={madrasaId} disabled={!selected || loading || busy} />
          <fieldset disabled={!selected || loading || busy || themeLoading || theme === null} className="border-t border-slate-200 pt-5 dark:border-slate-700">
            <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tx("ওয়েবসাইট থিম", "Website theme")}</legend>
            <p className="mb-3 text-xs leading-6 text-slate-500">{themeLoading ? tx("থিম লোড হচ্ছে…", "Loading theme…") : tx("থিম বেছে নিলে সঙ্গে সঙ্গে সংরক্ষণ হবে।", "Choose a theme to save it immediately.")}</p>
            <div role="group" aria-label={tx("ওয়েবসাইট থিম", "Website theme")} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {WEBSITE_THEMES.map((item) => (
                <button type="button" key={item.key} aria-pressed={theme === item.key} onClick={() => changeTheme(item.key)} className={`overflow-hidden rounded-xl border-2 p-2 text-start transition disabled:opacity-50 ${theme === item.key ? "border-teal-600 bg-teal-50 dark:bg-teal-950/30" : "border-slate-200 dark:border-slate-700"}`}>
                  <div className="h-20 overflow-hidden rounded-lg"><WebsiteThemePreview themeKey={item.key} accent="#0f766e" /></div>
                  <span className="mt-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">{tx(item.bn, item.en)}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{tx(item.descriptionBn, item.descriptionEn)}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 dark:border-slate-700">
            <div className="max-w-lg">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tx("মূল ডেমোতে ফিরুন", "Restore main demo")}</h2>
              <p className="mt-1 text-xs leading-6 text-slate-500">{tx("নির্বাচিত প্রতিষ্ঠানের ওয়েবসাইট সর্বশেষ সংরক্ষিত ডেমো দিয়ে প্রতিস্থাপন করুন। রিসেটের আগে ৩ ধাপে নিশ্চিত করতে হবে।", "Replace the selected institution's website with the latest saved demo. Three confirmations are required before resetting.")}</p>
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
