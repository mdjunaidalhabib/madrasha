import React, { useMemo, useRef } from "react";

interface Student {
  id: number;
  name_bn: string;
}

interface Book {
  book_id: number;
  book_name_bn?: string;
  name_bn?: string;
  full_marks?: number;
}

interface Props {
  students: Student[];
  books: Book[];
  marks: Record<number, Record<number, number>>;
  setMarks: React.Dispatch<React.SetStateAction<Record<number, Record<number, number>>>>;
  disabled?: boolean;
  /** Pass mark threshold as a percentage (0-100). Defaults to 33 (common fail-mark). */
  failMark?: number;
  /** Called when the user commits a cell (Enter / moves to next field) so the
   * parent can trigger an autosave. */
  onCommit?: () => void;
  /** Current autosave status, shown as a small indicator next to the progress bar. */
  autosaveStatus?: "idle" | "saving" | "saved" | "error";
}

export default function MarksTable({
  students,
  books,
  marks,
  setMarks,
  disabled = false,
  failMark = 33,
  onCommit,
  autosaveStatus = "idle",
}: Props) {
  // 2D grid of input refs so Enter / Arrow keys can jump straight to the
  // next cell without the user reaching for the mouse.
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const rowCount = students.length;
  const colCount = books.length;

  const cellKey = (row: number, col: number) => `${row}-${col}`;

  const focusCell = (row: number, col: number) => {
    if (row < 0 || row >= rowCount || col < 0 || col >= colCount) return;
    const el = inputRefs.current[cellKey(row, col)];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    switch (e.key) {
      case "Enter": {
        e.preventDefault();
        // Move to the next subject in the same row; wrap to the first
        // subject of the next student row when at the last column.
        if (col + 1 < colCount) {
          focusCell(row, col + 1);
        } else {
          focusCell(row + 1, 0);
        }
        onCommit?.();
        break;
      }
      case "ArrowRight":
        if (
          (e.target as HTMLInputElement).selectionStart ===
          (e.target as HTMLInputElement).value.length
        ) {
          e.preventDefault();
          focusCell(row, col + 1);
        }
        break;
      case "ArrowLeft":
        if ((e.target as HTMLInputElement).selectionStart === 0) {
          e.preventDefault();
          focusCell(row, col - 1);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        focusCell(row + 1, col);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusCell(row - 1, col);
        break;
      default:
        break;
    }
  };

  const handle = (sid: number, bid: number, val: string, max = 100) => {
    if (val === "") {
      setMarks((prev) => {
        const copy = { ...prev };

        if (copy[sid]) {
          delete copy[sid][bid];

          if (Object.keys(copy[sid]).length === 0) {
            delete copy[sid];
          }
        }

        return copy;
      });
      return;
    }

    const num = Number(val);

    if (Number.isNaN(num)) return;
    if (num < 0 || num > max) return;

    setMarks((prev) => ({
      ...prev,
      [sid]: {
        ...prev[sid],
        [bid]: num,
      },
    }));
  };

  // Overall completion stats for the little progress badge in the header.
  const { filled, total } = useMemo(() => {
    const totalCells = rowCount * colCount;
    let filledCells = 0;

    students.forEach((s) => {
      books.forEach((b) => {
        if (marks?.[s.id]?.[b.book_id] !== undefined) filledCells += 1;
      });
    });

    return { filled: filledCells, total: totalCells };
  }, [students, books, marks, rowCount, colCount]);

  const getCellStyle = (value: number | undefined, max: number) => {
    if (value === undefined) {
      return "border-gray-300 bg-white text-gray-700 focus:ring-blue-400";
    }

    const pct = max > 0 ? (value / max) * 100 : 0;

    if (pct < failMark) {
      // Failing mark — red
      return "border-red-400 bg-red-50 text-red-700 focus:ring-red-400";
    }

    // Passing — green
    return "border-green-400 bg-green-50 text-green-700 focus:ring-green-400";
  };

  return (
    <div className="bg-white shadow-md rounded-xl p-4 overflow-auto">
      {/* Hide native number input spin buttons (Chrome/Safari + Firefox) */}
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

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-700">📊 Marks Entry</h2>

        <div className="flex items-center gap-3">
          {autosaveStatus !== "idle" && (
            <span
              className={`text-xs font-medium flex items-center gap-1 ${
                autosaveStatus === "saving"
                  ? "text-blue-500"
                  : autosaveStatus === "saved"
                    ? "text-green-600"
                    : "text-red-500"
              }`}
            >
              {autosaveStatus === "saving" && "⏳ সংরক্ষণ হচ্ছে..."}
              {autosaveStatus === "saved" && "✓ সংরক্ষিত"}
              {autosaveStatus === "error" && "⚠ সংরক্ষণ ব্যর্থ"}
            </span>
          )}

          {total > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${total > 0 ? (filled / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-500">
                {filled}/{total}
              </span>
            </div>
          )}
        </div>
      </div>

      {books.length > 0 && students.length > 0 && (
        <p className="text-xs text-gray-400 mb-2">
          ⌨️ নাম্বার লিখে <kbd className="px-1 py-0.5 border rounded bg-gray-50">Enter</kbd> চাপুন
          পরের ঘরে যেতে — Arrow keys দিয়েও ঘরে ঘরে যাওয়া যাবে
        </p>
      )}

      <table className="w-full border text-sm">
        {/* HEADER */}
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            <th className="border px-3 py-2 text-left">Student</th>

            {books.length > 0 ? (
              books.map((b) => (
                <th key={b.book_id} className="border px-3 py-2">
                  <div className="flex flex-col items-center">
                    <span>{b.book_name_bn || b.name_bn || `Book ${b.book_id}`}</span>
                    <span className="text-xs text-gray-400">/ {b.full_marks ?? 100}</span>
                  </div>
                </th>
              ))
            ) : (
              <th className="border px-3 py-2 text-gray-400">Subjects will appear here</th>
            )}
          </tr>
        </thead>

        {/* BODY */}
        <tbody>
          {students.length === 0 || books.length === 0 ? (
            <tr>
              <td
                colSpan={books.length > 0 ? books.length + 1 : 2}
                className="text-center py-10 text-gray-400"
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl">📊</span>
                  <p className="font-medium">Division, Exam এবং Class select করুন</p>
                  <p className="text-sm text-gray-400">তারপর এখানে marks entry table দেখাবে</p>
                </div>
              </td>
            </tr>
          ) : (
            students.map((s, rowIndex) => (
              <tr key={s.id} className="hover:bg-gray-50 transition">
                <td className="border px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                  {s.name_bn}
                </td>

                {books.map((b, colIndex) => {
                  const value = marks?.[s.id]?.[b.book_id];
                  const max = b.full_marks ?? 100;

                  return (
                    <td key={b.book_id} className="border px-2 py-1">
                      <input
                        ref={(el) => {
                          inputRefs.current[cellKey(rowIndex, colIndex)] = el;
                        }}
                        type="number"
                        min={0}
                        max={max}
                        placeholder="0"
                        disabled={disabled}
                        className={`no-spinner w-20 border rounded px-2 py-1 text-center font-medium outline-none transition focus:ring-2 ${
                          disabled
                            ? "bg-gray-100 cursor-not-allowed text-gray-400"
                            : getCellStyle(value, max)
                        }`}
                        value={value ?? ""}
                        onChange={(e) => handle(s.id, b.book_id, e.target.value, max)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                        onFocus={(e) => e.target.select()}
                        onBlur={() => onCommit?.()}
                      />
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {books.length > 0 && students.length > 0 && (
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-50 border border-red-400 inline-block" /> Fail
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-50 border border-green-400 inline-block" />{" "}
            Pass
          </span>
        </div>
      )}
    </div>
  );
}
