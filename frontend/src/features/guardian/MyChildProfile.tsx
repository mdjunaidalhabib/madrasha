import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { formatCurrency, formatDate, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";

// Labels come from guardianText.tabs[key].
const TABS = [
  { key: "overview" },
  { key: "academic" },
  { key: "attendance" },
  { key: "financial" },
  { key: "library" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function MyChildProfile() {
  const t = useText(guardianText);
  const lang = useLang();
  const money = (value: number | string | undefined) => formatCurrency(value || 0, lang);
  const dateBn = (value: string | Date | null | undefined) => (value ? formatDate(value, lang) : "-");
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
    return <EmptyState title={t.noChild} hint={t.noChildHint} />;
  }

  const attendance = data?.attendance;
  const results = data?.results || [];
  const fees = data?.fees;
  const library = data?.library || [];
  const promotion = data?.promotion || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={child ? child.nameBn : t.childProfile}
        subtitle={child ? `${child.className || ""} · ${t.roll} ${localizeDigits(child.roll ?? "-", lang)} · ${t.regShort} ${localizeDigits(child.registrationNo ?? "-", lang)}` : undefined}
      />

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === item.key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.tabs[item.key]}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={t.monthAttendancePct}
            value={attendance?.summary?.percentage ?? 0}
            variant="percentage"
            tone="emerald"
            loading={loading}
          />
          <StatTile label={t.publishedResults} value={results.length} tone="indigo" loading={loading} />
          <StatTile label={t.dueFees} value={fees?.summary?.totalDue ?? 0} variant="currency" tone="rose" loading={loading} />
          <StatTile label={t.libraryRecords} value={library.length} tone="amber" loading={loading} />
        </div>
      )}

      {tab === "academic" && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">{t.publishedResults}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-start text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t.exam}</th>
                    <th className="px-5 py-3">{t.class}</th>
                    <th className="px-5 py-3">{t.totalMarks}</th>
                    <th className="px-5 py-3">{t.average}</th>
                    <th className="px-5 py-3">{t.grade}</th>
                    <th className="px-5 py-3">{t.rank}</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && results.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                        {t.noResults}
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
              <h2 className="text-lg font-bold text-slate-900">{t.promotionHistory}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-slate-50 text-start text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t.session}</th>
                    <th className="px-5 py-3">{t.rollChange}</th>
                    <th className="px-5 py-3">{t.status}</th>
                    <th className="px-5 py-3">{t.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {promotion.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                        {t.noData}
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
                      <td className="px-5 py-3">{t.promotionStatus[row.status] || row.status}</td>
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
            <StatTile label={t.attendanceStatus.PRESENT} value={attendance?.summary?.PRESENT ?? 0} tone="emerald" loading={loading} />
            <StatTile label={t.attendanceStatus.ABSENT} value={attendance?.summary?.ABSENT ?? 0} tone="rose" loading={loading} />
            <StatTile label={t.attendanceStatus.LATE} value={attendance?.summary?.LATE ?? 0} tone="amber" loading={loading} />
            <StatTile
              label={t.attendanceRate}
              value={attendance?.summary?.percentage ?? 0}
              variant="percentage"
              tone="blue"
              loading={loading}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">{t.recentRecords}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-slate-50 text-start text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t.date}</th>
                    <th className="px-5 py-3">{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {(attendance?.recent || []).length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-5 py-6 text-center text-slate-400">
                        {t.noRecords}
                      </td>
                    </tr>
                  )}
                  {(attendance?.recent || []).map((row: any) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-5 py-3">{dateBn(row.date)}</td>
                      <td className="px-5 py-3">{t.attendanceStatus[row.status] || row.status}</td>
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
            <StatTile label={t.totalBilled} value={fees?.summary?.totalBilled ?? 0} variant="currency" tone="slate" loading={loading} />
            <StatTile label={t.paid} value={fees?.summary?.totalPaid ?? 0} variant="currency" tone="emerald" loading={loading} />
            <StatTile label={t.due} value={fees?.summary?.totalDue ?? 0} variant="currency" tone="rose" loading={loading} />
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">{t.invoices}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-start text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t.feeHead}</th>
                    <th className="px-5 py-3">{t.dueDate}</th>
                    <th className="px-5 py-3">{t.amount}</th>
                    <th className="px-5 py-3">{t.paid}</th>
                    <th className="px-5 py-3">{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {(fees?.invoices || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                        {t.noInvoices}
                      </td>
                    </tr>
                  )}
                  {(fees?.invoices || []).map((invoice: any) => (
                    <tr key={invoice.id} className="border-t">
                      <td className="px-5 py-3">{invoice.title}</td>
                      <td className="px-5 py-3">{dateBn(invoice.dueDate)}</td>
                      <td className="px-5 py-3">{money(invoice.amount)}</td>
                      <td className="px-5 py-3">{money(invoice.paidAmount)}</td>
                      <td className="px-5 py-3">{t.invoiceStatus[invoice.status] || invoice.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            {t.onlinePaymentSoon}
          </p>
        </div>
      )}

      {tab === "library" && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">{t.libraryRecords}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-start text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t.bookName}</th>
                  <th className="px-5 py-3">{t.borrowedDate}</th>
                  <th className="px-5 py-3">{t.returnDate}</th>
                  <th className="px-5 py-3">{t.status}</th>
                  <th className="px-5 py-3">{t.fine}</th>
                </tr>
              </thead>
              <tbody>
                {library.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                      {t.noRecords}
                    </td>
                  </tr>
                )}
                {library.map((record: any) => (
                  <tr key={record.id} className="border-t">
                    <td className="px-5 py-3">{record.book?.title}</td>
                    <td className="px-5 py-3">{dateBn(record.borrowedAt)}</td>
                    <td className="px-5 py-3">{dateBn(record.dueDate)}</td>
                    <td className="px-5 py-3">{t.libraryStatus[record.status] || record.status}</td>
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
