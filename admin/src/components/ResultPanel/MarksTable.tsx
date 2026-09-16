import React, { useMemo, useRef, useState } from "react";
import {
  toBanglaDigits,
  normalizeBanglaDigits,
  ABSENT_MARK,
  ABSENT_MARK_LABEL,
} from "@madrasha/shared-ui/src/utils/reportUtils";
import { submissionStatusBadge, type SubmissionStatus } from "./resultStatus";

const displayNumber = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? "-" : toBanglaDigits(value);

interface Student {
  id: number;
  name_bn: string;
  roll?: number | string | null;
  registration_no?: number | string | null;
}

interface Book {
  book_id: number;
  book_name_bn?: string;
  name_bn?: string;
  full_marks?: number;
  is_miyari?: boolean;
  pass_mark?: number | null;
}

export interface SubmissionInfo {
  book_id: number;
  status: SubmissionStatus;
  submitted_by?: string | null;
  submitted_at?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  comment?: string | null;
}

interface Props {
  students: Student[];
  books: Book[];
  marks: Record<number, Record<number, number | null>>;
  setMarks: React.Dispatch<React.SetStateAction<Record<number, Record<number, number | null>>>>;
  disabled?: boolean;
  /** Fallback pass-mark threshold for subjects without their own override
   * (Book.pass_mark). Compared directly against the raw mark — not scaled
   * by full_marks — matching the backend's fail-mark semantics. Defaults to
   * 33 (a common global fail mark). */
  failMark?: number;
  /** Called when the user commits a cell (Enter / moves to next field) so the
   * parent can trigger an autosave. */
  onCommit?: () => void;
  /** Current autosave status, shown as a small indicator next to the progress bar. */
  autosaveStatus?: "idle" | "saving" | "saved" | "error";
  /** Per-cell free-text note (rare use — e.g. "re-checked on appeal"). */
  notes?: Record<number, Record<number, string>>;
  setNotes?: React.Dispatch<React.SetStateAction<Record<number, Record<number, string>>>>;
  /** Per-subject submission status, keyed by book_id — drives the header
   * badge and whether that subject's column is locked for editing. */
  submissions?: Record<number, SubmissionInfo>;
  /** Fired with a book_id when the user clicks "এই বিষয় জমা দিন" for that
   * subject's column. */
  onSubmitBook?: (bookId: number) => void;
  /** book_id currently being submitted (disables just that column's button). */
  submittingBookId?: number | null;
  /** Whether the submit-subject action should be shown at all
   * (marks.submit / result.manage permission check happens in the parent). */
  canSubmit?: boolean;
  /** Whether the verify/reject-subject actions should be shown
   * (marks.verify / result.manage permission check happens in the parent). */
  canVerify?: boolean;
  onVerifyBook?: (bookId: number) => void;
  /** Asks the parent to open its reject-reason prompt for this book — the
   * actual reject call (which needs a required reason) happens there. */
  onRequestRejectBook?: (bookId: number) => void;
  /** When true, columns never lock for editing regardless of submission
   * status — the status badge still renders normally. Set by the parent
   * for a full-marks-authority actor (see rbac.util.ts's
   * hasFullMarksAuthority) whose edits the backend now accepts even for an
   * already-submitted/verified subject instead of rejecting them. */
  lockOverride?: boolean;
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
  notes = {},
  setNotes,
  submissions = {},
  onSubmitBook,
  submittingBookId = null,
  canSubmit = false,
  canVerify = false,
  onVerifyBook,
  onRequestRejectBook,
  lockOverride = false,
}: Props) {
  // 2D grid of input refs so Enter / Arrow keys can jump straight to the
  // next cell without the user reaching for the mouse.
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // Which cell's note popover is open, e.g. "studentId-bookId".
  const [openNoteKey, setOpenNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const rowCount = students.length;
  const colCount = books.length;

  const cellKey = (row: number, col: number) => `${row}-${col}`;
  const noteKey = (sid: number, bid: number) => `${sid}-${bid}`;

  const isColLocked = (book: Book) => {
    if (lockOverride) return false;
    const status = submissions[book.book_id]?.status;
    return status === "SUBMITTED" || status === "VERIFIED";
  };

  const focusCell = (row: number, col: number) => {
    if (row < 0 || row >= rowCount || col < 0 || col >= colCount) return;
    if (isColLocked(books[col])) return;
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
        // Move downward through the same subject first. After the last
        // student, continue from the first student of the next subject.
        if (row + 1 < rowCount) {
          focusCell(row + 1, col);
        } else if (col + 1 < colCount) {
          focusCell(0, col + 1);
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

  const handle = (sid: number, bid: number, rawVal: string, max = 100) => {
    // A lone "-" marks the student absent for this subject — the fast path
    // for the common case, since the cell is select-all'd on focus, so this
    // is always a single clean keystroke, not appended to existing digits.
    if (rawVal === "-") {
      setMarks((prev) => ({
        ...prev,
        [sid]: {
          ...prev[sid],
          [bid]: ABSENT_MARK,
        },
      }));
      return;
    }

    // Digits only — typing stays plain ASCII, so strip anything else and
    // normalize any stray Bengali digits (e.g. from a mobile OS keyboard).
    const val = normalizeBanglaDigits(rawVal).replace(/\D/g, "");

    if (val === "") {
      // Keep the entry as `null` rather than deleting the key — this is what
      // tells the parent's autosave to actually persist the clear as a
      // delete instead of just quietly dropping the row from the payload.
      setMarks((prev) => ({
        ...prev,
        [sid]: {
          ...prev[sid],
          [bid]: null,
        },
      }));
      return;
    }

    const num = Number(val);

    if (Number.isNaN(num)) return;
    if (!Number.isInteger(num)) return;
    if (num < 0 || num > max) return;

    setMarks((prev) => ({
      ...prev,
      [sid]: {
        ...prev[sid],
        [bid]: num,
      },
    }));
  };

  const openNotePopover = (sid: number, bid: number) => {
    setOpenNoteKey(noteKey(sid, bid));
    setNoteDraft(notes?.[sid]?.[bid] || "");
  };

  const saveNote = (sid: number, bid: number) => {
    setNotes?.((prev) => ({
      ...prev,
      [sid]: { ...prev[sid], [bid]: noteDraft },
    }));
    setOpenNoteKey(null);
    onCommit?.();
  };

  // Overall completion stats for the little progress badge in the header.
  const { filled, total } = useMemo(() => {
    const totalCells = rowCount * colCount;
    let filledCells = 0;

    students.forEach((s) => {
      books.forEach((b) => {
        if (marks?.[s.id]?.[b.book_id] != null) filledCells += 1;
      });
    });

    return { filled: filledCells, total: totalCells };
  }, [students, books, marks, rowCount, colCount]);

  const getCellStyle = (value: number | null | undefined, book: Book) => {
    if (value == null) {
      return "border-gray-300 bg-white text-gray-700 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
    }

    if (value === ABSENT_MARK) {
      return "border-amber-400 bg-amber-50 text-amber-700 focus:ring-amber-400 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
    }

    // A subject's own pass mark (set per-subject, e.g. 20 on a 50-mark
    // হেফজ subject) takes priority over the madrasa's global fail mark —
    // otherwise every subject would be checked against a threshold tuned
    // for 100-mark subjects, regardless of what it's actually out of.
    const threshold = book.pass_mark ?? failMark;

    if (value < threshold) {
      // Failing mark — red
      return "border-red-400 bg-red-50 text-red-700 focus:ring-red-400 dark:border-red-700 dark:bg-red-950/40 dark:text-red-400";
    }

    // Passing — green
    return "border-green-400 bg-green-50 text-green-700 focus:ring-green-400 dark:border-green-700 dark:bg-green-950/40 dark:text-green-400";
  };

  const cellDisplayValue = (value: number | null | undefined) => {
    if (value === ABSENT_MARK) return ABSENT_MARK_LABEL;
    return value != null ? toBanglaDigits(value) : "";
  };

  return (
    <div className="bg-white shadow-md rounded-xl p-3 sm:p-4 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-slate-200">📊 নম্বর এন্ট্রি</h2>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {autosaveStatus !== "idle" && (
            <span
              className={`text-xs font-medium flex items-center gap-1 ${
                autosaveStatus === "saving"
                  ? "text-blue-500 dark:text-blue-400"
                  : autosaveStatus === "saved"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-500 dark:text-red-400"
              }`}
            >
              {autosaveStatus === "saving" && "⏳ সংরক্ষণ হচ্ছে..."}
              {autosaveStatus === "saved" && "✓ সংরক্ষিত"}
              {autosaveStatus === "error" && "⚠ সংরক্ষণ ব্যর্থ"}
            </span>
          )}

          {total > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-20 sm:w-32 h-2 bg-gray-200 rounded-full overflow-hidden dark:bg-slate-700">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${total > 0 ? (filled / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                {toBanglaDigits(filled)}/{toBanglaDigits(total)}
              </span>
            </div>
          )}
        </div>
      </div>

      {books.length > 0 && students.length > 0 && (
        <p className="hidden sm:block text-xs text-gray-400 mb-2 dark:text-slate-500">
          ⌨️ নাম্বার লিখে <kbd className="px-1 py-0.5 border rounded bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">⏎</kbd> চাপুন
          একই বিষয়ের নিচের শিক্ষার্থীর ঘরে যেতে — তীর চিহ্ন (↑ ↓ ← →) কী দিয়েও ঘরে ঘরে যাওয়া যাবে।
          কেউ পরীক্ষা না দিলে <kbd className="px-1 py-0.5 border rounded bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">-</kbd> চাপুন।
        </p>
      )}

      {/* Horizontally-scrollable on small screens, with the student-name
          column pinned via sticky positioning so it stays visible while
          scrolling through subjects — this is the main mobile ergonomics
          win for a table that's inherently wide (one column per subject). */}
      <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
        <table className="w-full border text-xs sm:text-sm dark:border-slate-700">
          {/* HEADER */}
          <thead className="bg-gray-100 sticky top-0 z-10 dark:bg-slate-800">
            <tr>
              <th className="border px-2 sm:px-3 py-2 text-center whitespace-nowrap dark:border-slate-700 dark:text-slate-200">রোল</th>
              <th className="border px-2 sm:px-3 py-2 text-center whitespace-nowrap dark:border-slate-700 dark:text-slate-200">রেজি. নং</th>
              <th className="border px-2 sm:px-3 py-2 text-left sticky left-0 z-20 bg-gray-100 min-w-[96px] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                শিক্ষার্থীর নাম
              </th>

              {books.length > 0 ? (
                books.map((b) => {
                  const submission = submissions[b.book_id];
                  const badgeInfo = submission ? submissionStatusBadge(submission.status) : null;
                  const locked = isColLocked(b);
                  return (
                    <th
                      key={b.book_id}
                      className={`border px-2 sm:px-3 py-2 whitespace-nowrap dark:border-slate-700 dark:text-slate-200 ${
                        locked ? "bg-gray-50 dark:bg-slate-800/60" : ""
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{b.book_name_bn || b.name_bn || `বই ${toBanglaDigits(b.book_id)}`}</span>
                        {b.is_miyari ? (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                            মিয়ারি
                          </span>
                        ) : null}
                        {b.pass_mark != null && (
                          <span
                            className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
                            title="এই বিষয়ের জন্য আলাদা পাস মার্ক সেট করা আছে"
                          >
                            পাস {toBanglaDigits(b.pass_mark)}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 dark:text-slate-500">/ {toBanglaDigits(b.full_marks ?? 100)}</span>

                        {badgeInfo && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badgeInfo.className}`}
                            title={
                              submission?.submitted_at
                                ? `জমা: ${submission.submitted_by ?? ""} ${submission.submitted_at ?? ""}`
                                : undefined
                            }
                          >
                            {badgeInfo.label}
                          </span>
                        )}

                        {canSubmit && onSubmitBook && !locked && (
                          <button
                            type="button"
                            onClick={() => onSubmitBook(b.book_id)}
                            disabled={submittingBookId === b.book_id}
                            className="mt-0.5 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400"
                          >
                            {submittingBookId === b.book_id ? "…" : "জমা দিন"}
                          </button>
                        )}

                        {canVerify &&
                          (submission?.status === "SUBMITTED" || submission?.status === "VERIFIED") && (
                            <div className="mt-0.5 flex gap-1">
                              {onVerifyBook && submission?.status === "SUBMITTED" && (
                                <button
                                  type="button"
                                  onClick={() => onVerifyBook(b.book_id)}
                                  className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-700"
                                >
                                  যাচাই
                                </button>
                              )}
                              {/* Backend allows reject from SUBMITTED or VERIFIED alike (see
                                  result-workflow.service.ts's rejectBook) - without this,
                                  a VERIFIED subject has no unlock path here at all, forcing
                                  the much heavier publish+correction flow for even a
                                  one-cell fix. */}
                              {onRequestRejectBook && (
                                <button
                                  type="button"
                                  onClick={() => onRequestRejectBook(b.book_id)}
                                  className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-red-700"
                                >
                                  {submission?.status === "VERIFIED" ? "সম্পাদনার জন্য খুলুন" : "বাতিল"}
                                </button>
                              )}
                            </div>
                          )}
                      </div>
                    </th>
                  );
                })
              ) : (
                <th className="border px-3 py-2 text-gray-400 dark:border-slate-700 dark:text-slate-500">বিষয়সমূহ এখানে দেখাবে</th>
              )}
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {students.length === 0 || books.length === 0 ? (
              <tr>
                <td
                  colSpan={books.length > 0 ? books.length + 3 : 4}
                  className="text-center py-10 text-gray-400 dark:text-slate-500"
                >
                  {disabled ? (
                    <div className="flex flex-col items-center gap-2">
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-slate-600 dark:border-t-blue-400" />
                      <p className="text-sm">লোড হচ্ছে...</p>
                    </div>
                  ) : students.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl">🧑‍🎓</span>
                      <p className="font-medium">এই শ্রেণিতে কোনো শিক্ষার্থী পাওয়া যায়নি</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl">📘</span>
                      <p className="font-medium">এই শ্রেণির জন্য কোনো বই যুক্ত করা হয়নি</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              students.map((s, rowIndex) => (
                <tr key={s.id} className="hover:bg-gray-50 transition dark:hover:bg-slate-800">
                  <td className="border px-2 sm:px-3 py-2 text-center text-gray-600 whitespace-nowrap dark:border-slate-700 dark:text-slate-400">
                    {displayNumber(s.roll)}
                  </td>
                  <td className="border px-2 sm:px-3 py-2 text-center text-gray-600 whitespace-nowrap dark:border-slate-700 dark:text-slate-400">
                    {displayNumber(s.registration_no)}
                  </td>
                  <td className="border px-2 sm:px-3 py-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 z-10 bg-white dark:border-slate-700 dark:text-slate-200 dark:bg-slate-900">
                    {s.name_bn}
                  </td>

                  {books.map((b, colIndex) => {
                    const value = marks?.[s.id]?.[b.book_id];
                    const max = b.full_marks ?? 100;
                    const locked = isColLocked(b);
                    const cellIsDisabled = disabled || locked;
                    const thisNoteKey = noteKey(s.id, b.book_id);
                    const hasNote = Boolean(notes?.[s.id]?.[b.book_id]);

                    return (
                      <td key={b.book_id} className="relative border px-1 sm:px-2 py-1 text-center dark:border-slate-700">
                        <input
                          ref={(el) => {
                            inputRefs.current[cellKey(rowIndex, colIndex)] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          // Mobile keyboards' own "next"/">" key (the iOS
                          // accessory toolbar's Next button, Gboard's arrow
                          // chevron, etc.) moves focus by native tab order —
                          // it never reaches our onKeyDown handler at all.
                          // Without an explicit tabIndex, that native order
                          // follows DOM order, which is row-major (all of a
                          // student's subjects before the next student), so
                          // "next" jumped sideways to the next subject
                          // instead of down to the next student. This
                          // tabIndex makes the column-major order (down
                          // through one subject, then across) the actual tab
                          // order too, matching handleKeyDown's Enter logic.
                          tabIndex={colIndex * rowCount + rowIndex + 1}
                          enterKeyHint={
                            rowIndex + 1 < rowCount || colIndex + 1 < colCount ? "next" : "done"
                          }
                          placeholder="০"
                          disabled={cellIsDisabled}
                          title={locked ? "এই বিষয়টি জমা দেয়া হয়েছে — সম্পাদনা বন্ধ" : undefined}
                          style={{ fontFamily: '"Noto Sans Bengali", "Hind Siliguri", sans-serif' }}
                          className={`w-16 sm:w-20 border rounded px-1 sm:px-2 py-1.5 sm:py-1 text-center font-medium outline-none transition focus:ring-2 ${
                            cellIsDisabled
                              ? "bg-gray-100 cursor-not-allowed text-gray-400 dark:bg-slate-800 dark:text-slate-500"
                              : getCellStyle(value, b)
                          }`}
                          value={cellDisplayValue(value)}
                          onChange={(e) => handle(s.id, b.book_id, e.target.value, max)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => onCommit?.()}
                        />

                        {setNotes && (
                          <button
                            type="button"
                            onClick={() => openNotePopover(s.id, b.book_id)}
                            title={notes?.[s.id]?.[b.book_id] || "নোট যোগ করুন"}
                            className={`absolute top-0 right-0 leading-none text-[10px] px-0.5 ${
                              hasNote
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-300 opacity-0 hover:opacity-100 focus:opacity-100 dark:text-slate-600"
                            }`}
                          >
                            📝
                          </button>
                        )}

                        {setNotes && openNoteKey === thisNoteKey && (
                          <div className="absolute z-30 top-full left-1/2 -translate-x-1/2 mt-1 w-40 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                            <textarea
                              autoFocus
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              rows={2}
                              className="w-full resize-none rounded border border-gray-200 p-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                              placeholder="নোট লিখুন..."
                            />
                            <div className="mt-1 flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setOpenNoteKey(null)}
                                className="rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700"
                              >
                                বাতিল
                              </button>
                              <button
                                type="button"
                                onClick={() => saveNote(s.id, b.book_id)}
                                className="rounded bg-blue-600 px-1.5 py-0.5 text-[11px] text-white hover:bg-blue-700"
                              >
                                সংরক্ষণ
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {books.length > 0 && students.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-50 border border-red-400 inline-block dark:bg-red-950/40 dark:border-red-700" /> ফেল
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-50 border border-green-400 inline-block dark:bg-green-950/40 dark:border-green-700" />{" "}
            পাশ
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-50 border border-amber-400 inline-block dark:bg-amber-950/40 dark:border-amber-700" />{" "}
            অনুপস্থিত (-)
          </span>
        </div>
      )}
    </div>
  );
}
