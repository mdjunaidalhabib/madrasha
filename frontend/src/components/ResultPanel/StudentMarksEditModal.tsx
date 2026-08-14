import { useState } from "react";
import {
  toBanglaDigits,
  normalizeBanglaDigits,
  ABSENT_MARK,
  ABSENT_MARK_LABEL,
} from "../../utils/reportUtils";

interface SummaryMark {
  book_id: number;
  book_name: string;
  mark: number;
  is_absent?: boolean;
}

interface Book {
  book_id: number;
  book_name?: string;
  book_name_bn?: string;
  name_bn?: string;
  full_marks?: number;
  pass_mark?: number | null;
}

interface Student {
  student_id: number;
  name_bn: string;
  marks?: SummaryMark[];
}

interface Props {
  student: Student;
  books: Book[];
  failMark?: number;
  saving?: boolean;
  onClose: () => void;
  onSave: (values: Record<number, number>) => void;
}

export default function StudentMarksEditModal({
  student,
  books,
  failMark = 33,
  saving = false,
  onClose,
  onSave,
}: Props) {
  const initial: Record<number, number> = {};
  books.forEach((b) => {
    const found = student.marks?.find((m) => m.book_id === b.book_id);
    if (found) initial[b.book_id] = found.is_absent ? ABSENT_MARK : found.mark;
  });

  const [values, setValues] = useState<Record<number, number>>(initial);

  const handleChange = (bookId: number, rawVal: string, max: number) => {
    // A lone "-" marks the student absent for this subject — same shortcut
    // as the bulk marks-entry grid (see MarksTable.tsx).
    if (rawVal === "-") {
      setValues((prev) => ({ ...prev, [bookId]: ABSENT_MARK }));
      return;
    }

    const val = normalizeBanglaDigits(rawVal).replace(/\D/g, "");

    if (val === "") {
      setValues((prev) => {
        const copy = { ...prev };
        delete copy[bookId];
        return copy;
      });
      return;
    }

    const num = Number(val);
    if (Number.isNaN(num) || !Number.isInteger(num) || num < 0 || num > max) return;

    setValues((prev) => ({ ...prev, [bookId]: num }));
  };

  const bookLabel = (b: Book) =>
    b.book_name_bn || b.name_bn || b.book_name || `Book ${b.book_id}`;

  // Same pass/fail color logic as the bulk entry table, so single-student
  // edit visually matches full-class entry. A subject's own pass_mark
  // (per-subject override) takes priority over the shared fallback
  const getCellStyle = (value: number | undefined, book: Book) => {
    if (value === undefined) {
      return "border-gray-300 bg-white text-gray-700 focus:ring-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
    }

    if (value === ABSENT_MARK) {
      return "border-amber-400 bg-amber-50 text-amber-700 focus:ring-amber-400 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
    }

    const threshold = book.pass_mark ?? failMark;

    if (value < threshold) {
      return "border-red-400 bg-red-50 text-red-700 focus:ring-red-400 dark:border-red-700 dark:bg-red-950/40 dark:text-red-400";
    }

    return "border-green-400 bg-green-50 text-green-700 focus:ring-green-400 dark:border-green-700 dark:bg-green-950/40 dark:text-green-400";
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] flex flex-col p-4 dark:bg-slate-900">
        <div className="flex justify-between items-start mb-3 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-slate-100">
              ✏️ শুধুমাত্র এর নাম্বার এডিট
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">{student.name_bn}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none dark:text-slate-500 dark:hover:text-slate-300"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto">
        <table className="w-full border text-sm dark:border-slate-700">
          <thead className="bg-gray-100 dark:bg-slate-800">
            <tr>
              <th className="border px-3 py-2 text-left dark:border-slate-700">বিষয়</th>
              <th className="border px-3 py-2 dark:border-slate-700">নাম্বার</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => {
              const max = b.full_marks ?? 100;
              const value = values[b.book_id];

              return (
                <tr key={b.book_id} className="hover:bg-gray-50 transition dark:hover:bg-slate-800">
                  <td className="border px-3 py-2 font-medium text-gray-700 dark:border-slate-700 dark:text-slate-300">
                    <div className="flex flex-col">
                      <span>
                        {bookLabel(b)}
                        {b.pass_mark != null ? (
                          <span
                            className="ml-1 text-[10px] font-semibold text-sky-700 dark:text-sky-400"
                            title="এই বিষয়ের জন্য আলাদা পাস মার্ক সেট করা আছে"
                          >
                            (পাস {b.pass_mark})
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">/ {max}</span>
                    </div>
                  </td>
                  <td className="border px-2 py-1 dark:border-slate-700">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="০"
                      disabled={saving}
                      className={`w-20 mx-auto block border rounded px-2 py-1 text-center font-medium outline-none transition focus:ring-2 ${
                        saving
                          ? "bg-gray-100 cursor-not-allowed text-gray-400 dark:bg-slate-800 dark:text-slate-600"
                          : getCellStyle(value, b)
                      }`}
                      value={
                        value === ABSENT_MARK
                          ? ABSENT_MARK_LABEL
                          : value != null
                            ? toBanglaDigits(value)
                            : ""
                      }
                      onChange={(e) => handleChange(b.book_id, e.target.value, max)}
                      onFocus={(e) => e.target.select()}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 shrink-0 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-50 border border-red-400 inline-block dark:bg-red-950/40 dark:border-red-700" /> Fail
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-50 border border-green-400 inline-block dark:bg-green-950/40 dark:border-green-700" /> Pass
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-50 border border-amber-400 inline-block dark:bg-amber-950/40 dark:border-amber-700" />{" "}
            অনুপস্থিত ("-" চাপুন)
          </span>
        </div>

        <div className="flex justify-end gap-2 mt-5 shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            বাতিল
          </button>
          <button
            onClick={() => onSave(values)}
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-slate-600"
          >
            {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}
