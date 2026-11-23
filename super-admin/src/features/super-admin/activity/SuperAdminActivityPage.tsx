import { useEffect, useState } from "react";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Card from "@madrasha/shared-ui/src/components/ui/Card";
import adminApi from "../../../services/adminApi";
import PlatformActivityTable from "./PlatformActivityTable";
import { bnNumber, type PlatformActivity } from "./platformActivity";

export default function SuperAdminActivityPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filters, setFilters] = useState({ search: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PlatformActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const limit = 25;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    adminApi.get("/super/activity", { signal: controller.signal, params: { ...filters, page, limit } })
      .then(({ data }) => { setRows(data.rows); setTotal(data.total); })
      .catch(() => { if (!controller.signal.aborted) { setRows([]); setTotal(0); setError("কার্যক্রম লোড করা যায়নি। আবার চেষ্টা করুন।"); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, page, refresh]);
  const pages = Math.max(1, Math.ceil(total / limit));
  const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  return <div className="space-y-6">
    <PageHeader title="কার্যক্রম লগ" subtitle="সুপার অ্যাডমিনের সংরক্ষিত কার্যক্রম, পরিবর্তনের বিবরণ ও সময়। সময় বাংলাদেশ অনুযায়ী দেখানো হচ্ছে।" />
    <Card><form className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => { event.preventDefault(); setPage(1); setFilters({ search, from, to }); }}>
      <label className="text-sm dark:text-slate-200">খুঁজুন<input className={input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="নাম, প্রতিষ্ঠান বা বিবরণ" /></label>
      <label className="text-sm dark:text-slate-200">শুরুর তারিখ<input type="date" className={input} value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="text-sm dark:text-slate-200">শেষের তারিখ<input type="date" className={input} value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={loading}>খুঁজুন</Button><Button type="button" variant="secondary" onClick={() => { setSearch(""); setFrom(""); setTo(""); setPage(1); setFilters({ search: "", from: "", to: "" }); }}>সব দেখুন</Button></div>
    </form></Card>
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-700"><p className="text-sm dark:text-slate-200">মোট কার্যক্রম: {bnNumber(total)}</p><Button variant="secondary" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>রিফ্রেশ</Button></div>
      {loading ? <p role="status" className="p-6 text-slate-500">কার্যক্রম লোড হচ্ছে…</p> : error ? <p role="alert" className="p-6 text-red-600">{error}</p> : <PlatformActivityTable rows={rows} />}
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4 dark:border-slate-700"><Button variant="secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>আগের</Button><p className="text-sm dark:text-slate-200">পৃষ্ঠা {bnNumber(page)} / {bnNumber(pages)}</p><Button variant="secondary" disabled={loading || page >= pages} onClick={() => setPage((value) => value + 1)}>পরের</Button></div>
    </Card>
    <p className="text-sm text-slate-500">সফল পরিবর্তন ও লগইন এখানে সংরক্ষিত হয়। পুরোনো লগে যে বিবরণ সংরক্ষিত ছিল, সেটুকুই দেখানো হয়। লগ সংরক্ষণের বর্তমান মেয়াদ ৯০ দিন।</p>
  </div>;
}
