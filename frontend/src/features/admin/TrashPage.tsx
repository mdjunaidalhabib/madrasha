import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import { logger } from "../../utils/logger";
import { SkeletonTable } from "../../components/ui/Skeleton";
import { toBanglaDigits } from "../../utils/reportUtils";

type TabKey = "students" | "teachers" | "exams";

interface TrashStudentRow {
  id: number | string;
  name_bn?: string | null;
  roll?: number | string | null;
  registration_no?: number | string | null;
  current_class?: string | null;
  deleted_at?: string | null;
  days_remaining: number;
}

interface TrashTeacherRow {
  id: number | string;
  name_bn?: string | null;
  registration_no?: number | string | null;
  phone?: string | null;
  academic_division_name?: string | null;
  deleted_at?: string | null;
  days_remaining: number;
}

interface TrashExamRow {
  id: number | string;
  name?: string | null;
  year?: string | null;
  deleted_at?: string | null;
  days_remaining: number;
}

type TrashRow = TrashStudentRow | TrashTeacherRow | TrashExamRow;

const TABS: { key: TabKey; label: string }[] = [
  { key: "students", label: "শিক্ষার্থী" },
  { key: "teachers", label: "শিক্ষক" },
  { key: "exams", label: "পরীক্ষা" },
];

const extractArray = (res: any): any[] => {
  const data = res?.data?.data ?? res?.data ?? [];
  return Array.isArray(data) ? data : [];
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return toBanglaDigits(date.toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" }));
};

const daysBadge = (days: number) => {
  const label = days <= 0 ? "আজই মুছে যাবে" : `বাকি আছে: ${toBanglaDigits(days)} দিন`;
  const classes =
    days <= 1
      ? "bg-red-100 text-red-700 border-red-300"
      : days <= 3
        ? "bg-amber-100 text-amber-700 border-amber-300"
        : "bg-gray-100 text-gray-600 border-gray-300";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes}`}>
      ⏳ {label}
    </span>
  );
};

export default function TrashPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("students");
  const [rowsByTab, setRowsByTab] = useState<Record<TabKey, TrashRow[]>>({
    students: [],
    teachers: [],
    exams: [],
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | number | null>(null);

  // Load all three tabs up front (not just the active one) so the tab
  // counts are visible immediately instead of only appearing once a tab
  // has actually been clicked into.
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [students, teachers, exams] = await Promise.all([
        api.get("/trash/students"),
        api.get("/trash/teachers"),
        api.get("/trash/exams"),
      ]);
      setRowsByTab({
        students: extractArray(students),
        teachers: extractArray(teachers),
        exams: extractArray(exams),
      });
    } catch (err) {
      logger.error("LOAD TRASH ERROR:", err);
      useToastStore.getState().show("ট্র্যাশ লোড করা যায়নি", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const removeRow = (tab: TabKey, id: string | number) => {
    setRowsByTab((prev) => ({
      ...prev,
      [tab]: prev[tab].filter((row) => row.id !== id),
    }));
  };

  const handleRestore = (tab: TabKey, row: TrashRow) => {
    const name = "name_bn" in row ? row.name_bn : (row as TrashExamRow).name;
    useConfirmStore.getState().show({
      title: "ফিরিয়ে আনবেন?",
      message: `"${name || ""}" ট্র্যাশ থেকে ফিরিয়ে আনতে চান? এটি আগের মতোই সক্রিয় হয়ে যাবে।`,
      confirmText: "ফিরিয়ে আনুন",
      onConfirm: async () => {
        try {
          setBusyId(row.id);
          await api.post(`/trash/${tab}/${row.id}/restore`);
          useToastStore.getState().show("ফিরিয়ে আনা হয়েছে", "success");
          removeRow(tab, row.id);
        } catch (err: any) {
          useToastStore
            .getState()
            .show(err?.response?.data?.message || "ফিরিয়ে আনা যায়নি", "error");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const handlePermanentDelete = (tab: TabKey, row: TrashRow) => {
    const name = "name_bn" in row ? row.name_bn : (row as TrashExamRow).name;
    useConfirmStore.getState().show({
      title: "স্থায়ীভাবে মুছবেন?",
      message: `"${name || ""}" স্থায়ীভাবে মুছে ফেলতে চান? এই কাজটি আর ফিরিয়ে আনা যাবে না — সম্পর্কিত সব তথ্য (রেজাল্ট, মার্কস ইত্যাদি) একসাথে মুছে যাবে।`,
      confirmText: "স্থায়ীভাবে মুছে ফেলুন",
      danger: true,
      onConfirm: async () => {
        try {
          setBusyId(row.id);
          await api.delete(`/trash/${tab}/${row.id}`);
          useToastStore.getState().show("স্থায়ীভাবে মুছে ফেলা হয়েছে", "success");
          removeRow(tab, row.id);
        } catch (err: any) {
          useToastStore
            .getState()
            .show(err?.response?.data?.message || "মুছে ফেলা যায়নি", "error");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const rows = rowsByTab[activeTab];

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">🗑️ ট্র্যাশ</h1>
          <p className="mt-1 text-sm text-gray-500">
            মুছে ফেলা শিক্ষার্থী, শিক্ষক ও পরীক্ষা এখানে ৭ দিন থাকে — এর মধ্যে ফিরিয়ে আনতে না
            পারলে স্বয়ংক্রিয়ভাবে স্থায়ীভাবে মুছে যাবে।
          </p>
        </div>

        <div className="mb-4 flex gap-2 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${
                  rowsByTab[tab.key].length > 0
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {toBanglaDigits(rowsByTab[tab.key].length)}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
          {loading ? (
            <SkeletonTable rows={5} columns={4} />
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">ট্র্যাশ খালি আছে</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="flex flex-col gap-3 sm:hidden">
                {rows.map((row) => (
                  <div key={row.id} className="rounded-lg border border-gray-200 p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-800">
                        {"name_bn" in row ? row.name_bn : (row as TrashExamRow).name}
                      </span>
                      {daysBadge(row.days_remaining)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {activeTab === "students" && (
                        <>
                          রোল: {(row as TrashStudentRow).roll ?? "নেই"} | শ্রেণি:{" "}
                          {(row as TrashStudentRow).current_class || "নেই"}
                        </>
                      )}
                      {activeTab === "teachers" && (
                        <>
                          রেজি. নং: {(row as TrashTeacherRow).registration_no ?? "নেই"} | ফোন:{" "}
                          {(row as TrashTeacherRow).phone || "নেই"}
                        </>
                      )}
                      {activeTab === "exams" && <>সাল: {(row as TrashExamRow).year || "নেই"}</>}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      মুছে ফেলা হয়েছে: {formatDate(row.deleted_at)}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => handleRestore(activeTab, row)}
                        className="h-9 flex-1 rounded-md bg-green-600 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                      >
                        ফিরিয়ে আনুন
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => handlePermanentDelete(activeTab, row)}
                        className="h-9 flex-1 rounded-md bg-red-600 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        স্থায়ী মুছুন
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th className="px-3 py-2">নাম</th>
                      {activeTab === "students" && (
                        <>
                          <th className="px-3 py-2">রোল</th>
                          <th className="px-3 py-2">শ্রেণি</th>
                        </>
                      )}
                      {activeTab === "teachers" && (
                        <>
                          <th className="px-3 py-2">রেজি. নং</th>
                          <th className="px-3 py-2">ফোন</th>
                        </>
                      )}
                      {activeTab === "exams" && <th className="px-3 py-2">সাল</th>}
                      <th className="px-3 py-2">মুছে ফেলা হয়েছে</th>
                      <th className="px-3 py-2">মেয়াদ</th>
                      <th className="px-3 py-2 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {"name_bn" in row ? row.name_bn : (row as TrashExamRow).name}
                        </td>
                        {activeTab === "students" && (
                          <>
                            <td className="px-3 py-2">{(row as TrashStudentRow).roll ?? "নেই"}</td>
                            <td className="px-3 py-2">
                              {(row as TrashStudentRow).current_class || "নেই"}
                            </td>
                          </>
                        )}
                        {activeTab === "teachers" && (
                          <>
                            <td className="px-3 py-2">
                              {(row as TrashTeacherRow).registration_no ?? "নেই"}
                            </td>
                            <td className="px-3 py-2">{(row as TrashTeacherRow).phone || "নেই"}</td>
                          </>
                        )}
                        {activeTab === "exams" && (
                          <td className="px-3 py-2">{(row as TrashExamRow).year || "নেই"}</td>
                        )}
                        <td className="px-3 py-2 text-gray-500">{formatDate(row.deleted_at)}</td>
                        <td className="px-3 py-2">{daysBadge(row.days_remaining)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => handleRestore(activeTab, row)}
                              className="h-8 rounded-md bg-green-600 px-3 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                            >
                              ফিরিয়ে আনুন
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => handlePermanentDelete(activeTab, row)}
                              className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              স্থায়ী মুছুন
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
