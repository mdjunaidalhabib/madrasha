"use client";

import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { formatReportValue } from "@madrasha/shared-ui/src/utils/reportUtils";
import { commonText, localizeDigits, useIsMadrasa, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { resultStatusBadge } from "./resultStatus";
import { resultPanelText } from "./resultPanel.text";

interface SummaryMark {
  book_id: number;
  book_name: string;
  mark: number;
  is_absent?: boolean;
}

interface Summary {
  result_master_id?: number;
  student_id: number;
  registration_no: number;
  name_bn: string;
  total: number;
  average: number;
  general_grade?: string;
  /** Board GPA (school/college only). */
  gpa?: number | null;
  madrasa_grade?: string;
  status: string;
  rank_no: number;
  publish_status?: string;
  marks?: SummaryMark[];
}

interface Book {
  book_id: number;
  book_name?: string;
  book_name_bn?: string;
  name_bn?: string;
  is_miyari?: boolean;
  full_marks?: number;
  pass_mark?: number | null;
}

interface Props {
  summary: Summary[];
  books: Book[];
  loading?: boolean;
  publishing?: boolean;
  applyingRoll?: boolean;
  canUndoRoll?: boolean;
  onView?: (student_id: number) => void;
  onEdit?: () => void;
  onEditStudent?: (student_id: number) => void;
  onDelete?: (result_master_id: number) => void;
  onPublish?: () => void;
  onApplyRollByRank?: () => void;
  onUndoRollByRank?: () => void;
  canVerifyResult?: boolean;
  onVerifyResult?: () => void;
  verifyingResult?: boolean;
  canApprove?: boolean;
  onApprove?: () => void;
  approving?: boolean;
  onRequestRejectResult?: () => void;
  /** Re-grade this session against the current fail mark / grade bands.
   * Only offered once a result has been processed (PROCESSING and later,
   * including PUBLISHED/LOCKED, where /process itself is refused). */
  onRecalculate?: () => void;
}

export default function FullResultTable({
  summary,
  books,
  loading = false,
  publishing = false,
  applyingRoll = false,
  canUndoRoll = false,
  onView,
  onEdit,
  onEditStudent,
  onDelete,
  onPublish,
  onApplyRollByRank,
  onUndoRollByRank,
  canVerifyResult = false,
  onVerifyResult,
  verifyingResult = false,
  canApprove = false,
  onApprove,
  approving = false,
  onRequestRejectResult,
  onRecalculate,
}: Props) {
  const lang = useLang();
  const rt = useText(resultPanelText);
  const t = rt.full;
  const c = useText(commonText);
  const isMadrasa = useIsMadrasa();
  const num = (value: number | string) => localizeDigits(value, lang);
  // Madrasa-grade column only for madrasas - schools/colleges see general grades.
  const columnCount = (Array.isArray(books) ? books.length : 0) + (isMadrasa ? 9 : 8);
  const statusLabel = (status: string) =>
    rt.resultStatus[String(status || "").toUpperCase()] ?? localizeDigits(formatReportValue(status), lang);
  const dataList = Array.isArray(summary) ? summary : [];
  const subjectList = Array.isArray(books) ? books : [];

  const rawStatus = dataList[0]?.publish_status;
  const alreadyPublished = rawStatus === "PUBLISHED" || rawStatus === "LOCKED";
  const isProcessing = rawStatus === "PROCESSING";
  const isResultVerified = rawStatus === "RESULT_VERIFIED";
  const isApproved = rawStatus === "APPROVED";
  const statusBadge = resultStatusBadge(rawStatus);
  // Backend publishResult auto-chains verify-result -> approve for an actor
  // holding both result.verify and result.approve (hasFullResultAuthority),
  // so those users can Publish straight from PROCESSING/RESULT_VERIFIED.
  // Anyone else must wait for APPROVED.
  const canPublishNow =
    isApproved || ((isProcessing || isResultVerified) && canVerifyResult && canApprove);

  const handleDelete = () => {
    const resultMasterId = dataList[0]?.result_master_id;
    if (!resultMasterId || !onDelete) return;

    useConfirmStore.getState().show({
      title: t.deleteTitle,
      message: t.deleteMessage,
      confirmText: c.delete,
      danger: true,
      onConfirm: () => onDelete(resultMasterId),
    });
  };

  const getMark = (student: Summary, bookId: number) => {
    const found = student.marks?.find((m) => m.book_id === bookId);
    if (!found) return "-";
    return found.is_absent ? rt.absentShort : num(found.mark);
  };

  return (
    <div className="bg-white shadow-md rounded-xl p-3 sm:p-4 mt-4 dark:bg-slate-900">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">{t.title}</h2>
          {dataList.length > 0 && (
            <p className="text-sm text-gray-500 mt-1 dark:text-slate-400 flex items-center gap-2">
              {t.status}{" "}
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => window.print()}
            className="flex-1 sm:flex-none bg-gray-700 text-white px-3 sm:px-4 py-2 rounded text-sm"
          >
            🖨 {c.print}
          </button>

          {/* Opens the whole-class entry grid. Once published the backend
              refuses direct writes, so that page switches into সংশোধন mode:
              the same grid, but only the changed cells are submitted as a
              (reasoned, audited) correction. */}
          {onEdit && (
            <button
              onClick={onEdit}
              title={
                alreadyPublished
                  ? t.editAllPublishedTitle
                  : t.editAllTitle
              }
              className="flex-1 sm:flex-none bg-blue-600 text-white px-3 sm:px-4 py-2 rounded text-sm"
            >
              {alreadyPublished ? t.correctAll : t.editMarks}
            </button>
          )}

          {onDelete && (
            <button
              onClick={handleDelete}
              className="flex-1 sm:flex-none bg-red-600 text-white px-3 sm:px-4 py-2 rounded text-sm"
            >
              {c.delete}
            </button>
          )}

          {onRecalculate && (isProcessing || isResultVerified || isApproved || alreadyPublished) && (
            <button
              onClick={onRecalculate}
              title={t.recalcTitle}
              className="flex-1 sm:flex-none bg-teal-600 text-white px-3 sm:px-4 py-2 rounded text-sm hover:bg-teal-700"
            >
              {t.recalc}
            </button>
          )}

          {onApplyRollByRank && dataList.length > 0 && (
            <button
              onClick={onApplyRollByRank}
              disabled={applyingRoll}
              title={t.rollByRankTitle}
              className="flex-1 sm:flex-none bg-purple-600 text-white px-3 sm:px-4 py-2 rounded text-sm disabled:bg-gray-400"
            >
              {applyingRoll ? t.rollUpdating : t.rollByRank}
            </button>
          )}

          {onUndoRollByRank && canUndoRoll && dataList.length > 0 && (
            <button
              onClick={onUndoRollByRank}
              disabled={applyingRoll}
              title={t.undoRollTitle}
              className="flex-1 sm:flex-none bg-amber-600 text-white px-3 sm:px-4 py-2 rounded text-sm disabled:bg-gray-400"
            >
              {t.undoRoll}
            </button>
          )}

          {isProcessing && canVerifyResult && onVerifyResult && (
            <button
              onClick={onVerifyResult}
              disabled={verifyingResult}
              title={t.verifyTitle}
              className="flex-1 sm:flex-none bg-sky-600 text-white px-3 sm:px-4 py-2 rounded text-sm disabled:bg-gray-400"
            >
              {verifyingResult ? t.verifying : t.verify}
            </button>
          )}

          {isResultVerified && canApprove && onApprove && (
            <button
              onClick={onApprove}
              disabled={approving}
              title={t.approveTitle}
              className="flex-1 sm:flex-none bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded text-sm disabled:bg-gray-400"
            >
              {approving ? t.approving : t.approve}
            </button>
          )}

          {isResultVerified && canApprove && onRequestRejectResult && (
            <button
              onClick={onRequestRejectResult}
              disabled={approving}
              title={t.rejectTitle}
              className="flex-1 sm:flex-none bg-red-600 text-white px-3 sm:px-4 py-2 rounded text-sm disabled:bg-gray-400"
            >
              {t.reject}
            </button>
          )}

          {onPublish && canPublishNow && !alreadyPublished && (
            <button
              onClick={onPublish}
              disabled={publishing}
              className="flex-1 sm:flex-none bg-green-600 text-white px-3 sm:px-4 py-2 rounded text-sm disabled:bg-gray-400"
            >
              {publishing ? t.publishing : t.publish}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={8} columns={columnCount} />
      ) : (
      <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
      <table className="w-full table-fixed min-w-[900px] border text-xs sm:text-sm dark:border-slate-800">
        <colgroup>
          {Array.from({ length: columnCount }).map((_, i) => (
            <col key={i} style={{ width: `${100 / columnCount}%` }} />
          ))}
        </colgroup>
        <thead className="bg-gray-100 dark:bg-slate-800">
          <tr>
            <th className="border px-2 py-2 text-center dark:border-slate-800">{t.regNo}</th>
            <th className="border px-2 py-2 text-center dark:border-slate-800">{t.studentName}</th>

            {subjectList.map((b) => (
              <th key={b.book_id} className="border px-2 py-2 text-center dark:border-slate-800">
                <span>
                  {b.book_name || b.book_name_bn || b.name_bn || t.bookFallback(num(b.book_id))}
                  {b.is_miyari ? <span className="ms-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">{t.miyari}</span> : null}
                  {b.pass_mark != null ? (
                    <span
                      className="ms-1 text-[10px] font-semibold text-sky-700 dark:text-sky-400"
                      title={rt.marks.passMarkTitle}
                    >
                      {t.pass(num(b.pass_mark))}
                    </span>
                  ) : null}
                  <span className="ms-1 text-[10px] text-gray-400 dark:text-slate-500">/{num(b.full_marks ?? 100)}</span>
                </span>
              </th>
            ))}

            <th className="border px-2 py-2 text-center dark:border-slate-800">{t.total}</th>
            <th className="border px-2 py-2 text-center dark:border-slate-800">{t.average}</th>
            <th className="border px-2 py-2 text-center dark:border-slate-800">{t.generalGrade}</th>
            {isMadrasa && <th className="border px-2 py-2 text-center dark:border-slate-800">{t.madrasaGrade}</th>}
            <th className="border px-2 py-2 text-center dark:border-slate-800">{t.resultState}</th>
            <th className="border px-2 py-2 text-center dark:border-slate-800">{t.rank}</th>
            <th className="border px-2 py-2 text-center dark:border-slate-800">{t.actions}</th>
          </tr>
        </thead>

        <tbody>
          {dataList.length === 0 ? (
            <tr>
              <td
                colSpan={columnCount}
                className="text-center py-10 text-gray-400 dark:text-slate-500"
              >
                {t.noResult}
              </td>
            </tr>
          ) : (
            dataList.map((s) => (
              <tr
                key={s.student_id}
                className={
                  String(s.status || "").toUpperCase() === "FAIL"
                    ? "bg-red-50 hover:bg-red-100"
                    : String(s.status || "").toUpperCase() === "ABSENT"
                      ? "bg-amber-50 hover:bg-amber-100"
                      : "hover:bg-gray-50"
                }
              >
                <td className="border px-2 py-2 text-center break-words">
                  {num(s.registration_no)}
                </td>
                <td className="border px-2 py-2 text-center break-words">{s.name_bn}</td>

                {subjectList.map((b) => (
                  <td key={b.book_id} className="border px-2 py-2 text-center break-words">
                    {getMark(s, b.book_id)}
                  </td>
                ))}

                <td className="border px-2 py-2 text-blue-600 text-center break-words">
                  {num(s.total)}
                </td>
                <td className="border px-2 py-2 text-green-600 text-center break-words">
                  {num(Number(s.average).toFixed(2))}
                </td>
                <td className="border px-2 py-2 text-center break-words">
                  {s.general_grade || "-"}
                  {typeof s.gpa === "number" && s.general_grade ? ` (${num(s.gpa.toFixed(2))})` : ""}
                </td>
                {isMadrasa && (
                  <td className="border px-2 py-2 text-center break-words">
                    {s.madrasa_grade || "-"}
                  </td>
                )}
                <td className="border px-2 py-2 text-center break-words">
                  {statusLabel(s.status)}
                </td>
                <td className="border px-2 py-2 text-center font-bold break-words">
                  {num(s.rank_no)}
                </td>

                <td className="border px-2 py-2 text-center break-words">
                  <div className="flex gap-2 justify-center flex-wrap">
                    {onView && (
                      <button
                        onClick={() => onView(s.student_id)}
                        className="text-blue-600"
                      >
                        {t.view}
                      </button>
                    )}
                    {onEditStudent && (
                      <button
                        onClick={() => onEditStudent(s.student_id)}
                        title={
                          alreadyPublished
                            ? t.correctPublishedTitle
                            : t.editOneTitle
                        }
                        className="text-indigo-600"
                      >
                        {alreadyPublished ? t.correct : t.edit}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
      )}
    </div>
  );
}
