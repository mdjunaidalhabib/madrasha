import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Phone, MessageCircle, ArrowUpRight, X, Save, RefreshCw, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@madrasha/shared-ui/src/i18n";
import adminApi from "../../../services/adminApi";
import LeadSummary from "./LeadSummary";
import { type Lead, type LeadStatus, leadStatuses, statusLabels, statusColors, leadDate } from "./lead.types";

const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
export default function SuperAdminLeadsPage() {
  const bn = useLang() === "bn";
  const say = (b: string, e: string) => bn ? b : e;
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const status = params.get("status") || "";
  const due = params.get("due") === "true";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [draftSearch, setDraftSearch] = useState(search);
  const [rows, setRows] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [notice, setNotice] = useState("");
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }
  useEffect(() => { setDraftSearch(search); }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    adminApi.get("/super/leads", { params: { search, status, page, due }, signal: controller.signal }).then((res) => { setRows(res.data.data); setTotal(res.data.total); }).catch(() => { if (!controller.signal.aborted) setError(say("লিড লোড করা যায়নি। আবার চেষ্টা করুন।", "Could not load leads. Please try again.")); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, status, page, due, refresh, bn]);
  return <div className="space-y-7">
    <div className="relative overflow-hidden rounded-3xl bg-[#151c39] p-6 text-white sm:p-8"><div aria-hidden="true" className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[40px] border-indigo-400/10" /><div className="relative"><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">GROWTH WORKSPACE</p><h1 className="mt-3 text-3xl font-bold">{say("প্রতিটি আগ্রহ, একটি সম্ভাবনা।", "Turn interest into opportunity.")}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">{say("ডেমো অনুরোধ থেকে নতুন গ্রাহক—প্রতিটি লিডের যোগাযোগ, পরবর্তী পদক্ষেপ ও ক্যাম্পেইন এক জায়গায়।", "From first enquiry to a new customer. Keep conversations, next steps and campaign details together.")}</p><a href="/leads?status=NEW" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-indigo-100">{say("নতুন লিডে নজর দিন", "Start with new enquiries")}<ArrowUpRight size={15} /></a></div></div>
    <LeadSummary refresh={refresh} />
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-700"><div><h2 className="font-bold text-slate-900 dark:text-white">{say("লিড ইনবক্স", "Lead inbox")}</h2><p className="mt-1 text-xs text-slate-500">{say("যোগাযোগ করুন। ফলোআপ রাখুন। এগিয়ে যান।", "Connect. Follow up. Move forward.")}</p></div><button onClick={() => setRefresh((v) => v + 1)} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"><RefreshCw size={14} />{say("রিফ্রেশ", "Refresh")}</button></div>
      <div className="flex flex-wrap gap-3 p-5"><form onSubmit={(event) => { event.preventDefault(); filter("search", draftSearch.trim()); }} className="flex min-w-0 flex-1 gap-2"><input aria-label={say("লিড খুঁজুন", "Search leads")} placeholder={say("নাম, নম্বর, প্রতিষ্ঠান বা ক্যাম্পেইন খুঁজুন…", "Search name, phone, institution or campaign…")} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} className={field} /><button aria-label={say("খুঁজুন", "Search")} className="rounded-xl bg-indigo-600 px-3 text-white"><Search size={18} /></button></form><select aria-label={say("স্ট্যাটাস ফিল্টার", "Filter by status")} value={status} onChange={(event) => filter("status", event.target.value)} className={`${field} sm:!w-48`}><option value="">{say("সব স্ট্যাটাস", "All statuses")}</option>{leadStatuses.map((s) => <option key={s} value={s}>{statusLabels[s][bn ? 0 : 1]}</option>)}</select><label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={due} onChange={(event) => { const next = new URLSearchParams(params); next.delete("page"); next.delete("status"); event.target.checked ? next.set("due", "true") : next.delete("due"); setParams(next); }} />{say("ফলোআপ বাকি", "Follow-ups due")}</label></div>
      {error ? <div role="alert" className="p-8 text-center text-sm text-rose-600">{error}<button className="ml-3 underline" onClick={() => setRefresh((v) => v + 1)}>{say("আবার চেষ্টা", "Retry")}</button></div> : loading ? <p role="status" className="p-12 text-center text-sm text-slate-500">{say("লিড লোড হচ্ছে…", "Loading leads…")}</p> : !rows.length ? <div className="flex flex-col items-center gap-3 p-12 text-center text-slate-500"><Inbox size={36} className="text-indigo-300" /><p className="font-semibold">{say("কোনো লিড পাওয়া যায়নি", "No leads found")}</p><p className="text-sm">{say("ফিল্টার পরিবর্তন করুন অথবা ডেমো পেজটি শেয়ার করুন।", "Try another filter or share the demo page.")}</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800"><tr>{[say("ব্যক্তি ও প্রতিষ্ঠান", "Contact & institution"), say("উৎস / ক্যাম্পেইন", "Source / campaign"), say("স্ট্যাটাস", "Stage"), say("পরবর্তী যোগাযোগ", "Next follow-up"), say("বিস্তারিত", "Details")].map((h) => <th className="whitespace-nowrap px-5 py-3 font-medium" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((lead) => <tr key={lead.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-5 py-4"><p className="font-semibold text-slate-900 dark:text-white">{lead.institution}</p><p className="mt-1 text-xs text-slate-500">{lead.name}</p><a className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-300" href={`tel:${lead.phone}`}><Phone size={12} />{lead.phone}</a></td><td className="max-w-56 px-5 py-4"><p className="truncate font-medium text-slate-700 dark:text-slate-300">{lead.utmSource || (lead.fbclid ? "Facebook" : "Website")}</p><p className="mt-1 truncate text-xs text-slate-500" title={lead.utmCampaign || ""}>{lead.utmCampaign || "—"}</p><p className="mt-1 whitespace-nowrap text-[11px] text-slate-400">{leadDate(lead.createdAt, bn)}</p></td><td className="px-5 py-4"><span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${statusColors[lead.status]}`}>{statusLabels[lead.status][bn ? 0 : 1]}</span></td><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{lead.followUpAt ? leadDate(lead.followUpAt, bn) : "—"}</td><td className="px-5 py-4"><button onClick={() => { setNotice(""); setSelected(lead); }} className="whitespace-nowrap rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{say("ম্যানেজ করুন", "Manage lead")}</button></td></tr>)}</tbody></table></div>}
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs text-slate-500 dark:border-slate-700"><span>{total.toLocaleString(bn ? "bn-BD" : "en-GB")} {say("টি লিড", "leads")} · {say("পৃষ্ঠা", "Page")} {page} / {Math.max(1, Math.ceil(total / 20))}</span><div className="flex gap-2"><button aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => filter("page", String(page - 1))} className="rounded-lg border p-2 disabled:opacity-30 dark:border-slate-700"><ChevronLeft size={16} /></button><button aria-label="Next page" disabled={page * 20 >= total || loading} onClick={() => filter("page", String(page + 1))} className="rounded-lg border p-2 disabled:opacity-30 dark:border-slate-700"><ChevronRight size={16} /></button></div></div>
    </div>
    {selected && <LeadEditor key={selected.id} lead={selected} bn={bn} close={() => setSelected(null)} saved={() => { setSelected(null); setRefresh((v) => v + 1); setNotice(say("লিড আপডেট হয়েছে।", "Lead updated successfully.")); }} />}
  </div>;
}

function LeadEditor({ lead, bn, close, saved }: { lead: Lead; bn: boolean; close: () => void; saved: () => void }) {
  const say = (b: string, e: string) => bn ? b : e;
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes || "");
  const [followUp, setFollowUp] = useState(lead.followUpAt ? new Date(new Date(lead.followUpAt).getTime() + 6 * 3600000).toISOString().slice(0, 16) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.getElementById("lead-dialog")!;
    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea'));
    getFocusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) close();
      if (event.key !== "Tab") return;
      const elements = getFocusable();
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements[elements.length - 1]?.focus(); }
      else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0]?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, [busy]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await adminApi.patch(`/super/leads/${lead.id}`, { status, notes, followUpAt: followUp ? new Date(`${followUp}:00+06:00`).toISOString() : null }); saved(); }
    catch { setError(say("আপডেট হয়নি। আবার চেষ্টা করুন।", "Could not save. Please try again.")); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm" onClick={() => { if (!busy) close(); }}><section id="lead-dialog" role="dialog" aria-modal="true" aria-labelledby="lead-title" onClick={(event) => event.stopPropagation()} className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">LEAD #{lead.id}</p><h2 id="lead-title" className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{lead.institution}</h2><p className="mt-1 text-sm text-slate-500">{lead.name} · {lead.institutionType}{lead.studentCount ? ` · ${lead.studentCount}` : ""}</p></div><button disabled={busy} aria-label={say("বন্ধ করুন", "Close")} onClick={close} className="rounded-full bg-slate-100 p-2 text-slate-500 dark:bg-slate-800"><X size={20} /></button></div>
    <div className="my-6 grid grid-cols-2 gap-3"><a href={`tel:${lead.phone}`} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 text-sm font-semibold text-white"><Phone size={16} />{lead.phone}</a><a href={`https://wa.me/88${lead.phone}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><MessageCircle size={17} />WhatsApp</a></div>
    {lead.message && <div className="mb-6 rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs font-semibold text-slate-500">{say("ভিজিটরের বার্তা", "Visitor's message")}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-300">{lead.message}</p></div>}
    <form onSubmit={submit} className="space-y-5"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{say("স্ট্যাটাস", "Lead stage")}<select value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)} className={`${field} mt-2`}>{leadStatuses.map((s) => <option key={s} value={s}>{statusLabels[s][bn ? 0 : 1]}</option>)}</select></label><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{say("পরবর্তী ফলোআপ (বাংলাদেশ সময়)", "Next follow-up (Bangladesh time)")}<input type="datetime-local" value={followUp} onChange={(event) => setFollowUp(event.target.value)} className={`${field} mt-2`} /></label><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{say("টিমের নোট", "Team notes")}<textarea rows={5} maxLength={10000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={say("আলোচনার বিষয় ও পরবর্তী পদক্ষেপ লিখুন…", "Conversation details and next steps…")} className={`${field} mt-2`} /></label>{error && <p role="alert" className="text-sm text-rose-500">{error}</p>}<button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white disabled:opacity-50"><Save size={17} />{busy ? say("সেভ হচ্ছে…", "Saving…") : say("পরিবর্তন সেভ করুন", "Save changes")}</button></form>
    <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-700"><h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{say("ক্যাম্পেইন তথ্য", "Campaign attribution")}</h3><dl className="mt-4 space-y-3 text-xs">{[["Source", lead.utmSource || (lead.fbclid ? "Facebook" : "Website")], ["Medium", lead.utmMedium], ["Campaign", lead.utmCampaign], ["Content", lead.utmContent], ["Term", lead.utmTerm], ["Facebook click ID", lead.fbclid], ["Page", lead.landingPath], [say("তৈরি হয়েছে", "Received"), leadDate(lead.createdAt, bn)]].map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-3"><dt className="text-slate-500">{label}</dt><dd className="break-all text-slate-800 dark:text-slate-300">{value || "—"}</dd></div>)}</dl></div>
  </section></div>;
}
