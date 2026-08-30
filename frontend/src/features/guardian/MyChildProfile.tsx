import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import PageHeader from "../../components/ui/PageHeader";
import StatTile from "../../components/ui/StatTile";
import EmptyState from "../../components/ui/EmptyState";

const TABS = [
  { key: "overview", label: "ওভারভিউ" },
  { key: "academic", label: "একাডেমিক" },
  { key: "attendance", label: "উপস্থিতি" },
  { key: "financial", label: "আর্থিক" },
  { key: "library", label: "লাইব্রেরি" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const money = (value: number | string | undefined) => `৳ ${Number(value || 0).toLocaleString("bn-BD")}`;

const dateBn = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString("bn-BD") : "-";

const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  PRESENT: "উপস্থিত",
  ABSENT: "অনুপস্থিত",
  LATE: "বিলম্বে",
  LEAVE: "ছুটি",
};

const LIBRARY_STATUS_LABEL: Record<string, string> = {
  BORROWED: "ধারে নেওয়া আছে",
  RETURNED: "ফেরত দেওয়া হয়েছে",
  LOST: "হারিয়ে গেছে",
};

const PROMOTION_STATUS_LABEL: Record<string, string> = {
  PROMOTED: "উন্নীত",
  RETAINED: "অবস্থান",
  TRANSFERRED: "স্থানান্তরিত",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  UNPAID: "বকেয়া",
  PARTIALLY_PAID: "আংশিক পরিশোধিত",
  PAID: "পরিশোধিত",
  WAIVED: "মওকুফ",
};

export default function MyChildProfile() {
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const children = useGuardianAuthStore((s) => s.children);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");

  const child = children.find((c) => c.id === selectedStudentId);

  useEffect(() => {
    if (!selectedStudentId) return;
    setLoading(true);
    setData(null);
    (async () => {
      const res = await guardianApi.get(`/guardian/students/${selectedStudentId}/profile-360`);
      setData(res.data?.data || null);
      setLoading(false);
    })();
  }, [selectedStudentId]);

  if (!selectedStudentId) {
    return <EmptyState title="কোনো সন্তান যুক্ত নেই" hint="এই লগইনের সাথে কোনো শিক্ষার্থী যুক্ত পাওয়া যায়নি।" />;
  }

  const attendance = data?.attendance;
  const results = data?.results || [];
  const fees = data?.fees;
  const library = data?.library || [];
  const promotion = data?.promotion || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={child ? child.nameBn : "সন্তানের প্রোফাইল"}
        subtitle={child ? `${child.className || ""} · রোল ${child.roll ?? "-"} · রেজি. ${child.registrationNo ?? "-"}` : undefined}
      />

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="এই মাসের হাজিরা %"
            value={attendance?.summary?.percentage ?? 0}
            variant="percentage"
            tone="emerald"
            loading={loading}
          />
          <StatTile label="প্রকাশিত ফলাফল" value={results.length} tone="indigo" loading={loading} />
          <StatTile label="বকেয়া ফি" value={fees?.summary?.totalDue ?? 0} variant="currency" tone="rose" loading={loading} />
          <StatTile label="লাইব্রেরি রেকর্ড" value={library.length} tone="amber" loading={loading} />
        </div>
      )}

      {tab === "academic" && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">প্রকাশিত ফলাফল</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-3">পরীক্ষা</th>
                    <th className="px-5 py-3">শ্রেণি</th>
                    <th className="px-5 py-3">মোট নম্বর</th>
                    <th className="px-5 py-3">গড়</th>
                    <th className="px-5 py-3">গ্রেড</th>
                    <th className="px-5 py-3">মেধাক্রম</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && results.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                        এখনো কোনো ফলাফল প্রকাশিত হয়নি
                      </td>
                    </tr>
                  )}
                  {results.map((row: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="px-5 py-3">{row.examName}</td>
                      <td className="px-5 py-3">{row.className}</td>
                      <td className="px-5 py-3">{row.total}</td>
                      <td className="px-5 py-3">{row.average}</td>
                      <td className="px-5 py-3">{row.generalGrade || row.madrasaGrade || "-"}</td>
                      <td className="px-5 py-3">{row.rankNo ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">পদোন্নতির ইতিহাস</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-3">শিক্ষাবর্ষ</th>
                    <th className="px-5 py-3">রোল পরিবর্তন</th>
                    <th className="px-5 py-3">অবস্থা</th>
                    <th className="px-5 py-3">তারিখ</th>
                  </tr>
                </thead>
                <tbody>
                  {promotion.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                        কোনো তথ্য নেই
                      </td>
                    </tr>
                  )}
                  {promotion.map((row: any) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-5 py-3">
                        {row.batch?.fromYear} → {row.batch?.toYear}
                      </td>
                      <td className="px-5 py-3">
                        {row.oldRoll} → {row.newRoll ?? "-"}
                      </td>
                      <td className="px-5 py-3">{PROMOTION_STATUS_LABEL[row.status] || row.status}</td>
                      <td className="px-5 py-3">{dateBn(row.batch?.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <StatTile label="উপস্থিত" value={attendance?.summary?.PRESENT ?? 0} tone="emerald" loading={loading} />
            <StatTile label="অনুপস্থিত" value={attendance?.summary?.ABSENT ?? 0} tone="rose" loading={loading} />
            <StatTile label="বিলম্বে" value={attendance?.summary?.LATE ?? 0} tone="amber" loading={loading} />
            <StatTile
              label="হাজিরার হার"
              value={attendance?.summary?.percentage ?? 0}
              variant="percentage"
              tone="blue"
              loading={loading}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">সাম্প্রতিক রেকর্ড</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-3">তারিখ</th>
                    <th className="px-5 py-3">অবস্থা</th>
                  </tr>
                </thead>
                <tbody>
                  {(attendance?.recent || []).length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-5 py-6 text-center text-slate-400">
                        কোনো রেকর্ড নেই
                      </td>
                    </tr>
                  )}
                  {(attendance?.recent || []).map((row: any) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-5 py-3">{dateBn(row.date)}</td>
                      <td className="px-5 py-3">{ATTENDANCE_STATUS_LABEL[row.status] || row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "financial" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="মোট বিল" value={fees?.summary?.totalBilled ?? 0} variant="currency" tone="slate" loading={loading} />
            <StatTile label="পরিশোধিত" value={fees?.summary?.totalPaid ?? 0} variant="currency" tone="emerald" loading={loading} />
            <StatTile label="বকেয়া" value={fees?.summary?.totalDue ?? 0} variant="currency" tone="rose" loading={loading} />
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">ইনভয়েস</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-3">খাত</th>
                    <th className="px-5 py-3">নির্ধারিত তারিখ</th>
                    <th className="px-5 py-3">পরিমাণ</th>
                    <th className="px-5 py-3">পরিশোধিত</th>
                    <th className="px-5 py-3">অবস্থা</th>
                  </tr>
                </thead>
                <tbody>
                  {(fees?.invoices || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                        কোনো ইনভয়েস নেই
                      </td>
                    </tr>
                  )}
                  {(fees?.invoices || []).map((invoice: any) => (
                    <tr key={invoice.id} className="border-t">
                      <td className="px-5 py-3">{invoice.title}</td>
                      <td className="px-5 py-3">{dateBn(invoice.dueDate)}</td>
                      <td className="px-5 py-3">{money(invoice.amount)}</td>
                      <td className="px-5 py-3">{money(invoice.paidAmount)}</td>
                      <td className="px-5 py-3">{INVOICE_STATUS_LABEL[invoice.status] || invoice.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            অনলাইনে ফি পরিশোধের সুবিধা শীঘ্রই আসছে। বর্তমানে ফি পরিশোধ করতে মাদরাসা অফিসে যোগাযোগ করুন।
          </p>
        </div>
      )}

      {tab === "library" && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">লাইব্রেরি রেকর্ড</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3">বইয়ের নাম</th>
                  <th className="px-5 py-3">নেওয়ার তারিখ</th>
                  <th className="px-5 py-3">ফেরতের তারিখ</th>
                  <th className="px-5 py-3">অবস্থা</th>
                  <th className="px-5 py-3">জরিমানা</th>
                </tr>
              </thead>
              <tbody>
                {library.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                      কোনো রেকর্ড নেই
                    </td>
                  </tr>
                )}
                {library.map((record: any) => (
                  <tr key={record.id} className="border-t">
                    <td className="px-5 py-3">{record.book?.title}</td>
                    <td className="px-5 py-3">{dateBn(record.borrowedAt)}</td>
                    <td className="px-5 py-3">{dateBn(record.dueDate)}</td>
                    <td className="px-5 py-3">{LIBRARY_STATUS_LABEL[record.status] || record.status}</td>
                    <td className="px-5 py-3">
                      {money(record.status === "BORROWED" ? record.estimatedFine : record.fineAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
