import { useMemo, useState } from "react";
import ExcelUpload from "../common/ExcelUpload";
import api from "../../services/api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";
import { TeacherFullRecord } from "../../types/teacher";

export interface BulkUpdateExcelRow {
  id?: string | number;
  registration_no?: string | number;
  division_id?: string | number;
  name_bn?: string;
  name_ar?: string;
  nid?: string;
  gender?: string | number;
  dob?: string;
  age?: string | number;
  phone?: string;
  email?: string;
  designation?: string;
  department?: string;
  qualification?: string;
  experience_year?: string | number;
  experience_month?: string | number;
  joining_date?: string;
  salary?: string | number;
  father_name?: string;
  father_name_ar?: string;
  father_nid?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_nid?: string;
  mother_occupation?: string;
  parent_phone?: string;
  division?: string;
  district?: string;
  thana?: string;
  village?: string;
  academic_division_name?: string;
  [key: string]: unknown;
}

interface BulkUpdateResultRow {
  row: number;
  id: number;
  name: string;
  status: "updated" | "unchanged" | "skipped";
  changes: Array<{ field: string; old: unknown; new: unknown }>;
  notes: string[];
  error?: string;
}

interface BulkUpdateResultData {
  updated: number;
  unchanged: number;
  skipped: number;
  preview: BulkUpdateResultRow[];
}

interface DivisionItem {
  division_id: number | string;
  division_name_bn: string;
}

interface BulkUpdateModalProps {
  open: boolean;
  teachers: TeacherFullRecord[];
  divisions: DivisionItem[];
  onClose: () => void;
  onSuccess: () => void;
}

// Order + labels must match backend TEACHER_BULK_UPDATE_FIELD_MAP
// (backend/src/modules/teacher/teacher.constants.ts). Unlike students,
// division_id is editable here - teachers have no Promotion-equivalent
// audit-trailed workflow, so changing it via bulk-update is allowed
// (existence re-checked server-side).
const EDITABLE_FIELDS: { key: string; label: string }[] = [
  { key: "division_id", label: "একাডেমিক বিভাগ আইডি" },
  { key: "name_bn", label: "নাম" },
  { key: "name_ar", label: "আরবি নাম" },
  { key: "nid", label: "এনআইডি" },
  { key: "gender", label: "লিঙ্গ" },
  { key: "dob", label: "জন্ম তারিখ" },
  { key: "age", label: "বয়স" },
  { key: "phone", label: "ফোন" },
  { key: "email", label: "ইমেইল" },
  { key: "designation", label: "পদবি" },
  { key: "department", label: "বিভাগ (পদ)" },
  { key: "qualification", label: "যোগ্যতা" },
  { key: "experience_year", label: "অভিজ্ঞতা (বছর)" },
  { key: "experience_month", label: "অভিজ্ঞতা (মাস)" },
  { key: "joining_date", label: "যোগদানের তারিখ" },
  { key: "salary", label: "বেতন" },
  { key: "father_name", label: "বাবার নাম" },
  { key: "father_name_ar", label: "বাবার আরবি নাম" },
  { key: "father_nid", label: "বাবার এনআইডি" },
  { key: "father_occupation", label: "বাবার পেশা" },
  { key: "mother_name", label: "মায়ের নাম" },
  { key: "mother_nid", label: "মায়ের এনআইডি" },
  { key: "mother_occupation", label: "মায়ের পেশা" },
  { key: "parent_phone", label: "অভিভাবকের ফোন" },
  { key: "division", label: "বিভাগ (ঠিকানা)" },
  { key: "district", label: "জেলা" },
  { key: "thana", label: "থানা" },
  { key: "village", label: "গ্রাম" },
];

const DATE_FIELDS = new Set(["dob", "joining_date"]);

const normValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (DATE_FIELDS.has(key)) return String(value).slice(0, 10);
  return String(value).trim();
};

const toDateCell = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : "");

const toNum = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

type PreviewRow = {
  index: number;
  rowNumber: number;
  id: number | null;
  name: string;
  matched: TeacherFullRecord | null;
  changes: { label: string; oldValue: string; newValue: string }[];
  willSubmit: boolean;
};

const BulkUpdateModal = ({ open, teachers, divisions, onClose, onSuccess }: BulkUpdateModalProps) => {
  const [excelRows, setExcelRows] = useState<BulkUpdateExcelRow[]>([]);
  const [result, setResult] = useState<BulkUpdateResultData | null>(null);
  const [loading, setLoading] = useState(false);

  const previewRows = useMemo<PreviewRow[]>(() => {
    return excelRows.map((row, index) => {
      const rowNumber = index + 1;
      const id = toNum(row.id);
      const matched = id !== null ? teachers.find((t) => Number(t.id) === id) || null : null;
      const name = String(row.name_bn ?? matched?.name_bn ?? "");

      if (!matched) {
        return { index, rowNumber, id, name, matched: null, changes: [], willSubmit: true };
      }

      const changes = EDITABLE_FIELDS.map(({ key, label }) => {
        const oldValue = normValue(key, (matched as unknown as Record<string, unknown>)[key]);
        const newValue = normValue(key, row[key]);
        return { label, oldValue, newValue };
      }).filter((c) => c.oldValue !== c.newValue);

      return { index, rowNumber, id, name, matched, changes, willSubmit: changes.length > 0 };
    });
  }, [excelRows, teachers]);

  const submitCount = previewRows.filter((r) => r.willSubmit).length;

  const reset = () => {
    setExcelRows([]);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const downloadExport = async () => {
    if (!teachers.length) {
      useToastStore.getState().show("এক্সপোর্ট করার জন্য কোনো শিক্ষক পাওয়া যায়নি", "error");
      return;
    }

    const XLSX = await import("xlsx-js-style");

    type ColType = "locked" | "required" | "optional";
    const columns: { key: string; type: ColType }[] = [
      { key: "id", type: "locked" },
      { key: "registration_no", type: "locked" },
      ...EDITABLE_FIELDS.map(({ key }) => ({
        key,
        type: (key === "name_bn" ? "required" : "optional") as ColType,
      })),
      { key: "academic_division_name", type: "locked" },
    ];

    const headerRow = columns.map((col) => (col.type === "required" ? `${col.key} *` : col.key));

    const dataRows = teachers.map((t) => {
      const record = t as unknown as Record<string, unknown>;
      return columns.map((col) => {
        if (DATE_FIELDS.has(col.key)) return toDateCell(record[col.key] as string | null);
        return record[col.key] ?? "";
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([
      [
        "ধূসর রঙের কলামগুলো (id, registration_no, academic_division_name) সম্পাদনাযোগ্য নয় - এডিট করলেও তা উপেক্ষা করা হবে। শুধু name_bn আবশ্যক (*), বাকি ঘর খালি রাখলে সেই তথ্য মুছে যাবে (division_id ব্যতিক্রম - খালি রাখলে অপরিবর্তিত থাকবে)।",
      ],
      [],
      headerRow,
      ...dataRows,
    ]);

    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
    ws["!cols"] = columns.map(() => ({ wch: 22 }));

    if (ws["A1"]) {
      ws["A1"].s = {
        font: { bold: true, color: { rgb: "92400E" }, sz: 12 },
        fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
      };
    }

    const headerFill: Record<ColType, { bg: string; text: string }> = {
      required: { bg: "DC2626", text: "FFFFFF" },
      locked: { bg: "94A3B8", text: "FFFFFF" },
      optional: { bg: "E5E7EB", text: "111827" },
    };

    columns.forEach((col, index) => {
      const cell = XLSX.utils.encode_cell({ r: 2, c: index });
      if (!ws[cell]) return;
      const style = headerFill[col.type];
      ws[cell].s = {
        font: { bold: true, color: { rgb: style.text } },
        fill: { patternType: "solid", fgColor: { rgb: style.bg } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "CBD5E1" } },
          bottom: { style: "thin", color: { rgb: "CBD5E1" } },
          left: { style: "thin", color: { rgb: "CBD5E1" } },
          right: { style: "thin", color: { rgb: "CBD5E1" } },
        },
      };
    });

    const guideRows = [
      ["লক করা কলাম (এডিট করলে উপেক্ষা হবে)"],
      ["id", "registration_no", "academic_division_name"],
      [],
      ["Gender Guide"],
      ["ID", "Name"],
      [1, "পুরুষ"],
      [2, "মহিলা"],
      [],
      ["Division Guide (academic division id হিসেবে ব্যবহার করুন)"],
      ["ID", "Division Name"],
      ...divisions.map((d) => [d.division_id, d.division_name_bn]),
    ];

    const guideWs = XLSX.utils.aoa_to_sheet(guideRows);
    guideWs["!cols"] = [{ wch: 15 }, { wch: 35 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bulk Update");
    XLSX.utils.book_append_sheet(wb, guideWs, "Guide");
    XLSX.writeFile(wb, "teacher-bulk-update.xlsx");
  };

  const handleDataUpload = (data: BulkUpdateExcelRow[]) => {
    setExcelRows(data);
  };

  const handleSubmit = async () => {
    const payload = previewRows.filter((r) => r.willSubmit).map((r) => excelRows[r.index]);
    if (!payload.length) {
      useToastStore.getState().show("পাঠানোর মতো কোনো পরিবর্তন পাওয়া যায়নি", "error");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("/teachers/bulk-update", { teachers: payload });
      setResult({
        updated: res.data?.updated || 0,
        unchanged: res.data?.unchanged || 0,
        skipped: res.data?.skipped || 0,
        preview: res.data?.preview || [],
      });
      setExcelRows([]);
      onSuccess();
    } catch (err: any) {
      logger.error("TEACHER BULK UPDATE SUBMIT ERROR:", err);
      useToastStore.getState().show(err?.response?.data?.message || "Bulk Update ব্যর্থ হয়েছে", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">বাল্ক আপডেট (Excel)</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              বিদ্যমান শিক্ষকদের তথ্য একসাথে এক্সেল দিয়ে আপডেট করুন।
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            ×
          </button>
        </div>

        <div className="max-h-[82vh] overflow-y-auto p-6">
          {result && (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">বাল্ক আপডেট সম্পন্ন হয়েছে</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    আপডেট: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{result.updated}</span> |
                    অপরিবর্তিত: <span className="font-semibold text-slate-600 dark:text-slate-400">{result.unchanged}</span> |
                    বাদ পড়েছে: <span className="font-semibold text-red-700 dark:text-red-400">{result.skipped}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  আরেকটি Excel Upload করুন
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-left font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">SL</th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-left font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">নাম</th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-left font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">id</th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-left font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">অবস্থা</th>
                        <th className="border-b px-3 py-3 text-left font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">পরিবর্তন / নোট</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.preview.map((row) => (
                        <tr key={row.row} className="border-b align-top transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                          <td className="whitespace-nowrap px-3 py-3">{row.row}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">{row.name || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{row.id || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {row.status === "updated" && (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                                আপডেট হয়েছে
                              </span>
                            )}
                            {row.status === "unchanged" && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                পরিবর্তন নেই
                              </span>
                            )}
                            {row.status === "skipped" && (
                              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-400">
                                বাদ পড়েছে
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {row.changes.length > 0 && (
                              <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                                {row.changes.map((c, i) => (
                                  <li key={i}>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{c.field}:</span>{" "}
                                    <span className="text-slate-400 line-through dark:text-slate-500">{String(c.old ?? "-")}</span> →{" "}
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{String(c.new ?? "-")}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {row.notes.map((n, i) => (
                              <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                                ⚠ {n}
                              </p>
                            ))}
                            {row.error && <p className="text-xs text-red-700 dark:text-red-400">{row.error}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!result && excelRows.length === 0 && (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">এক্সেল এক্সপোর্ট / আপলোড</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    বর্তমান ফিল্টার অনুযায়ী তালিকাভুক্ত {teachers.length} জন শিক্ষকের তথ্য এক্সপোর্ট
                    হবে।
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">ধূসর কলাম (id, registration_no) লক করা - সম্পাদনা করা যাবে না।</p>
                </div>

                <button
                  type="button"
                  onClick={downloadExport}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  এক্সেল এক্সপোর্ট করুন
                </button>
              </div>

              <ExcelUpload<BulkUpdateExcelRow>
                buttonText="আপডেট করা Excel আপলোড করুন"
                onDataUpload={handleDataUpload}
                disabled={loading}
                requiredColumns={["id", "name_bn"]}
              />
            </>
          )}

          {!result && excelRows.length > 0 && (
            <div>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">প্রিভিউ</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    মোট {excelRows.length} সারি — এর মধ্যে {submitCount} সারিতে পরিবর্তন পাওয়া গেছে
                  </p>
                </div>

                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  Clear Uploaded Data
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-left font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">SL</th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-left font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">id</th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-left font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">নাম</th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-left font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">অবস্থা</th>
                        <th className="border-b px-3 py-3 text-left font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">পরিবর্তিত ফিল্ড</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr
                          key={row.index}
                          className={`border-b align-top transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                            !row.willSubmit ? "opacity-50" : ""
                          }`}
                        >
                          <td className="whitespace-nowrap px-3 py-3">{row.rowNumber}</td>
                          <td className="whitespace-nowrap px-3 py-3">{row.id ?? "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">{row.name || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {!row.matched ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                                id পাওয়া যায়নি (তবুও পাঠানো হবে)
                              </span>
                            ) : row.willSubmit ? (
                              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
                                পরিবর্তন হবে
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                কোনো পরিবর্তন নেই
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {row.changes.length > 0 && (
                              <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                                {row.changes.map((c, i) => (
                                  <li key={i}>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{c.label}:</span>{" "}
                                    <span className="text-slate-400 line-through dark:text-slate-500">{c.oldValue || "-"}</span> →{" "}
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{c.newValue || "-"}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || submitCount === 0}
                className="mt-5 w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {loading ? "পাঠানো হচ্ছে..." : `${submitCount} জন আপডেট করুন`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUpdateModal;
