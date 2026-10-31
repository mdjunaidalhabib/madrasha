"use client";

import { useState } from "react";
import {
  Search,
  Printer,
  Pencil,
  RefreshCw,
  Trophy,
  Undo2,
  Trash2,
  Eye,
  Table2,
  ArrowDownUp,
  ArrowLeftRight,
  X,
} from "lucide-react";
import { getSubjectResult } from "@madrasha/shared-ui/src/utils/subjectResult";
import "./FullResultTable.css";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { formatReportValue } from "@madrasha/shared-ui/src/utils/reportUtils";
import {
  commonText,
  localizeDigits,
  useIsMadrasa,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";
import { ToggleSwitch } from "../settings/ToggleSwitch";
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
  /** পরীক্ষার সময়ের রোল। */
  roll?: number | null;
  name_bn: string;
  total: number;
  average: number;
  general_grade?: string;
  /** Board GPA (school/college only). */
  gpa?: number | null;
  madrasa_grade?: string;
  status: string;
  rank_no: number;
  /** Tie-aware merit position (1,2,2,4) - null for absent / not yet re-processed. */
  place_no?: number | null;
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
  failMark?: number | null;
  loading?: boolean;
  publishing?: boolean;
  applyingRoll?: boolean;
  canUndoRoll?: boolean;
  onView?: (student_id: number) => void;
  onEdit?: () => void;
  onEditStudent?: (student_id: number) => void;
  onDelete?: (result_master_id: number) => void;
  onPublish?: () => void;
  /** প্রকাশিত ফলাফল অপ্রকাশিত (অভিভাবক পোর্টাল থেকে সরানো) করার কন্ট্রোল। */
  onUnpublish?: () => void;
  unpublishing?: boolean;
  onApplyRollByRank?: () => void;
  onUndoRollByRank?: () => void;
  /** Re-grade this session against the current fail mark / grade bands.
   * Only offered once a result has been processed (PROCESSING and later,
   * including PUBLISHED, where /process itself is refused). */
  onRecalculate?: () => void;
}

export default function FullResultTable({
  summary,
  books,
  failMark = null,
  loading = false,
  publishing = false,
  applyingRoll = false,
  canUndoRoll = false,
  onView,
  onEdit,
  onEditStudent,
  onDelete,
  onPublish,
  onUnpublish,
  unpublishing = false,
  onApplyRollByRank,
  onUndoRollByRank,
  onRecalculate,
}: Props) {
  const lang = useLang();
  const rt = useText(resultPanelText);
  const t = rt.full;
  const c = useText(commonText);
  const isMadrasa = useIsMadrasa();
  const num = (value: number | string) => localizeDigits(value, lang);
  // Madrasa-grade column only for madrasas - schools/colleges see general grades.
  const statusLabel = (status: string) =>
    rt.resultStatus[String(status || "").toUpperCase()] ??
    localizeDigits(formatReportValue(status), lang);
  const dataList = Array.isArray(summary) ? summary : [];
  const subjectList = Array.isArray(books) ? books : [];
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sort, setSort] = useState("original");
  const hasActions = Boolean(onView || onEditStudent);
  const tableColumns = subjectList.length + (isMadrasa ? 9 : 8) + Number(hasActions);
  const normalize = (value: string) =>
    value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit))).toLocaleLowerCase();
  const needle = normalize(query.trim());
  const counts = dataList.reduce<Record<string, number>>(
    (acc, student) => {
      const status = student.status.toUpperCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { ALL: dataList.length },
  );
  const visibleRows = dataList.filter(
    (student) =>
      (statusFilter === "ALL" || student.status.toUpperCase() === statusFilter) &&
      (!needle ||
        normalize(`${student.name_bn} ${student.roll ?? ""} ${student.registration_no}`).includes(
          needle,
        )),
  );
  if (sort !== "original")
    visibleRows.sort((a, b) => {
      if (sort === "total") return Number(b.total) - Number(a.total);
      const value = (student: Summary) =>
        sort === "merit"
          ? student.rank_no > 0
            ? student.rank_no
            : Infinity
          : (student.roll ?? Infinity);
      return value(a) - value(b);
    });
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
  };
  const cleanLabel = (label: string) => label.replace(/^[^\p{L}\p{N}]+/u, "");

  const rawStatus = dataList[0]?.publish_status;
  const alreadyPublished = rawStatus === "PUBLISHED";
  const canUnpublishNow = alreadyPublished;
  const isProcessing = rawStatus === "PROCESSING";
  const statusBadge = resultStatusBadge(rawStatus);
  // One person reviews and publishes: a processed (PROCESSING) result can be
  // published straight away; the backend runs its sanity checks on publish.
  const canPublishNow = isProcessing;

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

  const handleUnpublish = () => {
    if (!onUnpublish) return;

    useConfirmStore.getState().show({
      title: t.unpublishConfirmTitle,
      message: t.unpublishConfirmMessage,
      confirmText: t.unpublishConfirmButton,
      danger: true,
      onConfirm: () => onUnpublish(),
    });
  };

  const getMark = (student: Summary, bookId: number) => {
    const found = student.marks?.find((m) => m.book_id === bookId);
    if (!found) return "-";
    return found.is_absent ? rt.absentShort : num(found.mark);
  };

  return (
    <section className="full-result-panel" aria-label={t.title}>
      <div className="full-result-heading">
        <div className="flex items-start gap-3">
          <div className="full-result-icon">
            <Table2 size={22} aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight sm:text-xl">{t.title}</h2>
              {dataList.length > 0 && (
                <span
                  className={
                    "rounded-full px-2.5 py-1 text-xs font-semibold " + statusBadge.className
                  }
                >
                  {statusBadge.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              {t.subtitle}
            </p>
          </div>
        </div>
        {(alreadyPublished || (onPublish && canPublishNow)) && (
          <label
            className="full-result-publish"
            title={alreadyPublished ? t.unpublishTitle : undefined}
          >
            <span
              className={
                "h-2 w-2 rounded-full " + (alreadyPublished ? "bg-emerald-500" : "bg-amber-400")
              }
            />
            <span>
              {publishing
                ? t.publishing
                : unpublishing
                  ? t.unpublishing
                  : alreadyPublished
                    ? t.published
                    : t.notPublished}
            </span>
            <ToggleSwitch
              checked={alreadyPublished}
              disabled={
                publishing ||
                unpublishing ||
                (alreadyPublished ? !(onUnpublish && canUnpublishNow) : !onPublish)
              }
              onChange={(on) => {
                if (on) onPublish?.();
                else handleUnpublish();
              }}
            />
          </label>
        )}
      </div>
      <div className="full-result-actions print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              title={alreadyPublished ? t.editAllPublishedTitle : t.editAllTitle}
              className="full-result-button full-result-primary"
            >
              <Pencil size={15} />
              {cleanLabel(alreadyPublished ? t.correctAll : t.editMarks)}
            </button>
          )}
          <button type="button" onClick={() => window.print()} className="full-result-button">
            <Printer size={15} />
            {c.print}
          </button>
          {onRecalculate && (isProcessing || alreadyPublished) && (
            <button
              type="button"
              onClick={onRecalculate}
              title={t.recalcTitle}
              className="full-result-button"
            >
              <RefreshCw size={15} />
              {cleanLabel(t.recalc)}
            </button>
          )}
          {onApplyRollByRank && dataList.length > 0 && (
            <button
              type="button"
              onClick={onApplyRollByRank}
              disabled={applyingRoll}
              title={t.rollByRankTitle}
              className="full-result-button"
            >
              <Trophy size={15} />
              {cleanLabel(applyingRoll ? t.rollUpdating : t.rollByRank)}
            </button>
          )}
          {onUndoRollByRank && canUndoRoll && dataList.length > 0 && (
            <button
              type="button"
              onClick={onUndoRollByRank}
              disabled={applyingRoll}
              title={t.undoRollTitle}
              className="full-result-button"
            >
              <Undo2 size={15} />
              {cleanLabel(t.undoRoll)}
            </button>
          )}
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="full-result-button full-result-danger"
          >
            <Trash2 size={15} />
            {c.delete}
          </button>
        )}
      </div>
      <div className="full-result-toolbar print:hidden">
        <div className="full-result-filters" aria-label={t.resultState}>
          {["ALL", "PASS", "FAIL", "ABSENT"].map((status) => (
            <button
              type="button"
              key={status}
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              data-status={status}
              className={"full-result-filter " + (statusFilter === status ? "is-active" : "")}
            >
              {status === "ALL" ? t.all : statusLabel(status)}
              <span>{num(counts[status] || 0)}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
          <div className="full-result-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label={t.search}
              placeholder={t.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label={t.clearFilters}>
                <X size={14} />
              </button>
            )}
          </div>
          <label className="full-result-sort">
            <ArrowDownUp size={15} aria-hidden="true" />
            <select
              aria-label={t.sort}
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="original">{t.sort}</option>
              <option value="roll">{t.sortRoll}</option>
              <option value="merit">{t.sortMerit}</option>
              <option value="total">{t.sortTotal}</option>
            </select>
          </label>
        </div>
      </div>
      {loading ? (
        <div className="p-5">
          <SkeletonTable rows={8} columns={tableColumns} />
        </div>
      ) : (
        <div className="full-result-scroll" role="region" aria-label={t.title} tabIndex={0}>
          <table className="full-result-table">
            <caption className="sr-only">{t.title}</caption>
            <thead>
              <tr>
                <th scope="col" className="full-result-roll">
                  {t.roll}
                </th>
                <th scope="col" className="full-result-student">
                  {t.studentName}
                  <span className="full-result-header-sub">{t.regNo}</span>
                </th>
                {subjectList.map((book) => (
                  <th scope="col" key={book.book_id} className="full-result-subject">
                    <span className="block leading-relaxed">
                      {book.book_name ||
                        book.book_name_bn ||
                        book.name_bn ||
                        t.bookFallback(num(book.book_id))}
                    </span>
                    <span className="full-result-header-sub">
                      {num(book.full_marks ?? 100)}
                      {(book.pass_mark ?? failMark) != null && (
                        <span title={rt.marks.passMarkTitle}>
                          {" "}
                          · {t.pass(num((book.pass_mark ?? failMark)!))}
                        </span>
                      )}
                    </span>
                    {book.is_miyari && <span className="full-result-miyari">{t.miyari}</span>}
                  </th>
                ))}
                <th scope="col" className="full-result-summary">
                  {t.total}
                </th>
                <th scope="col" className="full-result-summary">
                  {t.average}
                </th>
                <th scope="col">{t.generalGrade}</th>
                {isMadrasa && <th scope="col">{t.madrasaGrade}</th>}
                <th scope="col">{t.resultState}</th>
                <th scope="col" title={t.placeTitle}>
                  {t.place}
                </th>
                <th scope="col">{t.rank}</th>
                {hasActions && (
                  <th scope="col" className="print:hidden">
                    {t.actions}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns} className="full-result-empty">
                    <Search size={28} className="mx-auto mb-3 text-slate-300" />
                    <p>{dataList.length === 0 ? t.noResult : t.noMatch}</p>
                    {(query || statusFilter !== "ALL") && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-3 text-sm font-semibold text-blue-600"
                      >
                        {t.clearFilters}
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                visibleRows.map((student) => {
                  const status = student.status.toUpperCase();
                  const absent = status === "ABSENT";
                  const topRank =
                    student.place_no != null &&
                    student.place_no >= 1 &&
                    student.place_no <= 3 &&
                    status === "PASS";
                  return (
                    <tr key={student.student_id} data-status={status}>
                      <td className="full-result-roll font-semibold">
                        {student.roll == null ? "-" : num(student.roll)}
                      </td>
                      <td className="full-result-student">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {student.name_bn}
                        </div>
                        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          {t.regNo}: {num(student.registration_no)}
                        </div>
                      </td>
                      {subjectList.map((book) => {
                        const mark = student.marks?.find((item) => item.book_id === book.book_id);
                        const result = getSubjectResult(
                          mark ? { ...mark, pass_mark: book.pass_mark } : undefined,
                          failMark,
                        );
                        return (
                          <td
                            key={book.book_id}
                            className={
                              "full-result-mark " +
                              (result === "fail"
                                ? "full-result-mark-fail"
                                : result === "absent"
                                  ? "full-result-mark-absent"
                                  : "")
                            }
                          >
                            <span>{getMark(student, book.book_id)}</span>
                          </td>
                        );
                      })}
                      <td className="full-result-total">{absent ? "-" : num(student.total)}</td>
                      <td className="full-result-average">
                        {absent ? "-" : num(Number(student.average).toFixed(2))}
                      </td>
                      <td>
                        <span className="font-semibold">{student.general_grade || "-"}</span>
                        {typeof student.gpa === "number" && student.general_grade && (
                          <span className="mt-1 block text-xs text-slate-400">
                            {num(student.gpa.toFixed(2))}
                          </span>
                        )}
                      </td>
                      {isMadrasa && <td className="font-medium">{student.madrasa_grade || "-"}</td>}
                      <td>
                        <span className="full-result-status" data-status={status}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {statusLabel(status)}
                        </span>
                      </td>
                      <td>
                        <span className={"full-result-place " + (topRank ? "is-top" : "")}>
                          {topRank && <Trophy size={13} aria-hidden="true" />}
                          {student.place_no == null ? "-" : num(student.place_no)}
                        </span>
                      </td>
                      <td className="text-slate-500 dark:text-slate-400">
                        {student.rank_no > 0 ? num(student.rank_no) : "-"}
                      </td>
                      {hasActions && (
                        <td className="print:hidden">
                          <div className="flex items-center justify-center gap-1.5">
                            {onView && (
                              <button
                                type="button"
                                onClick={() => onView(student.student_id)}
                                className="full-result-row-action"
                                title={t.view}
                                aria-label={t.view + ": " + student.name_bn}
                              >
                                <Eye size={15} />
                              </button>
                            )}
                            {onEditStudent && (
                              <button
                                type="button"
                                onClick={() => onEditStudent(student.student_id)}
                                title={alreadyPublished ? t.correctPublishedTitle : t.editOneTitle}
                                aria-label={
                                  cleanLabel(alreadyPublished ? t.correct : t.edit) +
                                  ": " +
                                  student.name_bn
                                }
                                className="full-result-row-action"
                              >
                                <Pencil size={14} />
                                <span>{cleanLabel(alreadyPublished ? t.correct : t.edit)}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="full-result-footer">
        <p aria-live="polite">
          {t.showing(num(visibleRows.length), num(dataList.length))}
          <span className="mx-2 text-slate-300">·</span>
          {num(subjectList.length)} {t.subjects}
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-red-200 bg-red-100" />
            {t.failedSubject}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-amber-200 bg-amber-100" />
            {t.absentSubject}
          </span>
          <span className="hidden items-center gap-1.5 2xl:flex print:hidden">
            <ArrowLeftRight size={14} />
            {t.scrollHint}
          </span>
        </div>
      </div>
    </section>
  );
}
