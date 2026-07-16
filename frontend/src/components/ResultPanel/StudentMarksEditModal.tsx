import { useState } from "react";

interface SummaryMark {
  book_id: number;
  book_name: string;
  mark: number;
}

interface Book {
  book_id: number;
  book_name?: string;
  book_name_bn?: string;
  name_bn?: string;
  full_marks?: number;
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
    if (found) initial[b.book_id] = found.mark;
  });

  const [values, setValues] = useState<Record<number, number>>(initial);

  const handleChange = (bookId: number, val: string, max: number) => {
    if (val === "") {
      setValues((prev) => {
        const copy = { ...prev };
        delete copy[bookId];
        return copy;
      });
      return;
    }

    const num = Number(val);
    if (Number.isNaN(num) || num < 0 || num > max) return;

    setValues((prev) => ({ ...prev, [bookId]: num }));
  };

  const bookLabel = (b: Book) =>
    b.book_name_bn || b.name_bn || b.book_name || `Book ${b.book_id}`;

  // Same pass/fail color logic as the bulk entry table, so single-student
  // edit visually matches full-class entry.
  const getCellStyle = (value: number | undefined, max: number) => {
    if (value === undefined) {
      return "border-gray-300 bg-white text-gray-700 focus:ring-blue-400";
    }

    const pct = max > 0 ? (value / max) * 100 : 0;

    if (pct < failMark) {
      return "border-red-400 bg-red-50 text-red-700 focus:ring-red-400";
    }

    return "border-green-400 bg-green-50 text-green-700 focus:ring-green-400";
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      {/* Hide native number input spin buttons, same as the bulk entry table */}
      <style>{`
        input.no-spinner::-webkit-outer-spin-button,
        input.no-spinner::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input.no-spinner[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-700">
              ✏️ শুধুমাত্র এর নাম্বার এডিট
            </h3>
            <p className="text-sm text-gray-500">{student.name_bn}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2 text-left">বিষয়</th>
              <th className="border px-3 py-2">নাম্বার</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => {
              const max = b.full_marks ?? 100;
              const value = values[b.book_id];

              return (
                <tr key={b.book_id} className="hover:bg-gray-50 transition">
                  <td className="border px-3 py-2 font-medium text-gray-700">
                    <div className="flex flex-col">
                      <span>{bookLabel(b)}</span>
                      <span className="text-xs text-gray-400">/ {max}</span>
                    </div>
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      max={max}
                      placeholder="0"
                      disabled={saving}
                      className={`no-spinner w-20 mx-auto block border rounded px-2 py-1 text-center font-medium outline-none transition focus:ring-2 ${
                        saving
                          ? "bg-gray-100 cursor-not-allowed text-gray-400"
                          : getCellStyle(value, max)
                      }`}
                      value={value ?? ""}
                      onChange={(e) => handleChange(b.book_id, e.target.value, max)}
                      onFocus={(e) => e.target.select()}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-50 border border-red-400 inline-block" /> Fail
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-50 border border-green-400 inline-block" /> Pass
          </span>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            বাতিল
          </button>
          <button
            onClick={() => onSave(values)}
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}
