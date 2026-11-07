import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Target, Users, CalendarClock, CheckCircle2 } from "lucide-react";
import { useLang } from "@madrasha/shared-ui/src/i18n";
import adminApi from "../../../services/adminApi";
import { type LeadSummaryData, statusLabels, statusColors } from "./lead.types";

export default function LeadSummary({ refresh = 0, recent = false }: { refresh?: number; recent?: boolean }) {
  const bn = useLang() === "bn";
  const [data, setData] = useState<LeadSummaryData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    adminApi.get("/super/leads/summary", { signal: controller.signal }).then((res) => setData(res.data.data)).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [refresh, retry]);
  if (error) return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{bn ? "লিডের সারসংক্ষেপ লোড হয়নি।" : "Could not load lead summary."} <button className="underline" onClick={() => setRetry((v) => v + 1)}>{bn ? "আবার চেষ্টা" : "Retry"}</button></div>;
  const stats = [
    { label: bn ? "মোট লিড" : "Total leads", value: data?.total, icon: Users, color: "text-indigo-500", to: "/leads" },
    { label: bn ? "নতুন লিড" : "New leads", value: data?.counts.NEW, icon: Target, color: "text-blue-500", to: "/leads?status=NEW" },
    { label: bn ? "ফলোআপ বাকি" : "Follow-ups due", value: data?.due, icon: CalendarClock, color: "text-amber-500", to: "/leads?due=true" },
    { label: bn ? "গ্রাহক হয়েছেন" : "Converted", value: data?.counts.CONVERTED, icon: CheckCircle2, color: "text-emerald-500", to: "/leads?status=CONVERTED" },
  ];
  return <section aria-label={bn ? "লিডের সারসংক্ষেপ" : "Lead overview"} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-900 dark:text-white">{bn ? "লিড ও গ্রোথ" : "Leads & growth"}<span className="ml-3 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{bn ? "আজ" : "Today"}: {data ? data.today.toLocaleString(bn ? "bn-BD" : "en-GB") : "…"}</span></h2><Link to="/leads" className="flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-300">{bn ? "সব লিড দেখুন" : "Manage leads"}<ArrowUpRight size={16} /></Link></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon, color, to }) => <Link key={label} to={to} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span><Icon size={19} className={color} /></div><p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">{value === undefined ? "…" : value.toLocaleString(bn ? "bn-BD" : "en-GB")}</p></Link>)}</div>
    {recent && data && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><div className="border-b border-slate-100 px-5 py-4 text-sm font-semibold dark:border-slate-700 dark:text-white">{bn ? "সাম্প্রতিক ডেমো অনুরোধ" : "Latest demo requests"}</div>{data.recent.length ? data.recent.map((lead) => <Link key={lead.id} to={`/leads?search=${encodeURIComponent(lead.phone)}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><div><p className="text-sm font-semibold text-slate-900 dark:text-white">{lead.institution}</p><p className="mt-1 text-xs text-slate-500">{lead.name} · {lead.phone} · {lead.utmCampaign || lead.utmSource || (lead.fbclid ? "Facebook" : "Website")}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[lead.status]}`}>{statusLabels[lead.status][bn ? 0 : 1]}</span></Link>) : <p className="p-6 text-sm text-slate-500">{bn ? "এখনও কোনো লিড আসেনি। ডেমো পেজের লিংক দিয়ে শুরু করুন।" : "No leads yet. Share your demo page to get started."}</p>}</div>}
  </section>;
}
