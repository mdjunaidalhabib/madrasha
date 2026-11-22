import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cachedGet } from "../../services/api";
import {
  promotionApi,
  type PromotionPreviewRow,
  type PromotionTargetRow,
} from "../../services/phase1Api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useText, getText, commonText } from "@madrasha/shared-ui/src/i18n";
import { promotionText } from "./StudentPromotionPage.text";
import {
  examsForDivision,
  useClearMismatchedExam,
} from "../../components/ExamPanel/examDivisionScope";
import { type Session } from "../../services/sessionApi";

type Division = {
  division_id: number;
  division_name_bn: string;
};

type ClassItem = {
  class_id: number;
  class_name_bn: string;
};

type Exam = {
  id: number;
  name: string;
  year: string | number;
  division_ids?: number[];
};

type DecisionStatus = "PROMOTED" | "RETAINED" | "TRANSFERRED";

// Decision values are backend enums; labels come from promotionText.status.
const DECISION_STATUSES: DecisionStatus[] = ["PROMOTED", "RETAINED", "TRANSFERRED"];

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const StudentPromotionPage = () => {
  const t = useText(promotionText);
  const c = useText(commonText);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  // FROM side
  const [fromDivision, setFromDivision] = useState("");
  const [fromClasses, setFromClasses] = useState<ClassItem[]>([]);
  const [fromClass, setFromClass] = useState("");
  const [fromYear, setFromYear] = useState("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");

  useClearMismatchedExam(exams, examId, fromDivision, () => setExamId(""));

  // TO side
  const [toDivision, setToDivision] = useState("");
  const [toClasses, setToClasses] = useState<ClassItem[]>([]);
  const [toClass, setToClass] = useState("");
  const [toYear, setToYear] = useState("");

  const [fromClassLoading, setFromClassLoading] = useState(false);
  const [toClassLoading, setToClassLoading] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [rows, setRows] = useState<(PromotionPreviewRow & { status: DecisionStatus })[]>([]);
  const [previewed, setPreviewed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetPreview, setTargetPreview] = useState<{
    key: string;
    rows: PromotionTargetRow[];
    token: string;
  } | null>(null);
  const sourceKey = JSON.stringify([fromDivision, fromClass, fromYear, examId]);
  const latestSourceKey = useRef(sourceKey);
  latestSourceKey.current = sourceKey;
  useEffect(() => {
    setRows([]);
    setSelected(new Set());
    setPreviewed(false);
    setTargetPreview(null);
    setConfirmOpen(false);
  }, [sourceKey]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.student_id)),
    [rows, selected],
  );
  const payload = {
    from_class_id: Number(fromClass),
    from_year: fromYear,
    to_class_id: Number(toClass),
    to_year: toYear,
    decisions: selectedRows.map((row) => ({ student_id: row.student_id, status: row.status })),
  };
  const targetKey = JSON.stringify(payload);
  const validTarget = targetPreview?.key === targetKey ? targetPreview : null;

  const loadDivisions = useCallback(async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      setDivisions(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD DIVISIONS ERROR:", err);
      setDivisions([]);
    }
  }, []);

  const loadExams = useCallback(async () => {
    try {
      const res = await cachedGet("/exams", { params: { active_only: true } });
      setExams(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD EXAMS ERROR:", err);
      setExams([]);
    }
  }, []);

  useEffect(() => {
    loadDivisions();
    loadExams();
    cachedGet("/sessions")
      .then((res) => setSessions(normalizeArray(res)))
      .catch((err) => {
        logger.error("LOAD SESSIONS ERROR:", err);
        useToastStore.getState().show(getText(promotionText).sessionsFailed, "error");
      });
  }, [loadDivisions, loadExams]);

  const sourceSessions = sessions.filter(
    (session) => session.divisionId == null || String(session.divisionId) === fromDivision,
  );
  const destinationSessions = sessions.filter(
    (session) => session.divisionId == null || String(session.divisionId) === toDivision,
  );
  const sourceYears = [...new Set(sourceSessions.map((session) => session.name))];
  const destinationYears = [...new Set(destinationSessions.map((session) => session.name))];

  const loadClasses = async (
    divisionId: string,
    setClasses: (v: ClassItem[]) => void,
    setLoading: (v: boolean) => void,
  ) => {
    if (!divisionId) {
      setClasses([]);
      return;
    }
    try {
      setLoading(true);
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      setClasses(normalizeArray(res));
    } catch (err) {
      logger.error("CLASS LOAD ERROR:", err);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const canPreview = fromClass && fromYear && sourceYears.includes(fromYear);
  const canExecute = Boolean(
    toClass &&
    toYear &&
    destinationYears.includes(toYear) &&
    selectedRows.length > 0 &&
    validTarget &&
    !targetLoading &&
    !executing,
  );

  const handlePreview = async () => {
    if (!canPreview) {
      useToastStore.getState().show(getText(promotionText).selectFirst, "error");
      return;
    }

    try {
      setPreviewLoading(true);
      setPreviewed(false);
      const res = await promotionApi.preview({
        from_class_id: Number(fromClass),
        from_year: fromYear,
        exam_id: examId ? Number(examId) : undefined,
      });
      const data = res.data?.data || [];
      if (latestSourceKey.current !== sourceKey) return;
      setRows(
        data.map((row) => ({
          ...row,
          status: row.suggested_status as DecisionStatus,
        })),
      );
      setPreviewed(true);
      setSelected(new Set());
      setTargetPreview(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || getText(promotionText).previewFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setPreviewLoading(false);
    }
  };

  const setRowStatus = (studentId: number, status: DecisionStatus) => {
    setRows((prev) => prev.map((row) => (row.student_id === studentId ? { ...row, status } : row)));
  };

  const summary = useMemo(() => {
    const counts = { PROMOTED: 0, RETAINED: 0, TRANSFERRED: 0 };
    for (const row of selectedRows) counts[row.status] += 1;
    return counts;
  }, [selectedRows]);

  const handleTargetPreview = async () => {
    setTargetLoading(true);
    setTargetPreview(null);
    try {
      const res = await promotionApi.targetPreview(payload);
      setTargetPreview({
        key: targetKey,
        rows: res.data.data.rows,
        token: res.data.data.preview_token,
      });
    } catch (err: any) {
      useToastStore
        .getState()
        .show(err?.response?.data?.message || getText(promotionText).previewFailed, "error");
    } finally {
      setTargetLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!canExecute) return;

    try {
      setExecuting(true);
      const res = await promotionApi.execute({
        ...payload,
        preview_token: validTarget!.token,
      });
      const data = (res.data as any)?.data;
      useToastStore
        .getState()
        .show(
          getText(promotionText).done(
            String(data?.promoted ?? summary.PROMOTED),
            String(data?.retained ?? summary.RETAINED),
            String(data?.transferred ?? summary.TRANSFERRED),
          ),
          "success",
        );
      setRows((previous) => previous.filter((row) => !selected.has(row.student_id)));
      setSelected(new Set());
      setTargetPreview(null);
      setConfirmOpen(false);
    } catch (err: any) {
      setTargetPreview(null);
      setConfirmOpen(false);
      const msg = err?.response?.data?.message || getText(promotionText).failed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <fieldset disabled={executing} className="mx-auto min-w-0 max-w-7xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t.subtitle}</p>
        </div>

        {/* FROM section */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">
            {t.step1}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={fromDivision}
              onChange={(event) => {
                const value = event.target.value;
                setFromDivision(value);
                setFromClass("");
                setFromYear("");
                loadClasses(value, setFromClasses, setFromClassLoading);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            >
              <option value="">{t.selectDivision}</option>
              {divisions.map((division) => (
                <option key={division.division_id} value={division.division_id}>
                  {division.division_name_bn}
                </option>
              ))}
            </select>

            <select
              value={fromClass}
              onChange={(event) => setFromClass(event.target.value)}
              disabled={!fromDivision || fromClassLoading}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 sm:w-[180px]"
            >
              <option value="">{fromClassLoading ? c.loading : t.selectClass}</option>
              {fromClasses.map((classItem) => (
                <option key={classItem.class_id} value={classItem.class_id}>
                  {classItem.class_name_bn}
                </option>
              ))}
            </select>

            <select
              value={fromYear}
              aria-label={t.currentSession}
              onChange={(event) => setFromYear(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[130px]"
            >
              <option value="">{t.selectSession}</option>
              {sourceYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <select
              value={examId}
              onChange={(event) => setExamId(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[200px]"
            >
              <option value="">{t.resultCheck}</option>
              {examsForDivision(exams, fromDivision).map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} — {exam.year}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!canPreview || previewLoading}
              onClick={handlePreview}
              className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
            >
              {previewLoading ? t.previewLoading : t.showPreview}
            </button>
          </div>
        </div>

        {/* Preview + decisions */}
        {(previewLoading || previewed) && (
          <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
            {previewLoading ? (
              <SkeletonList items={6} />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                    {t.step2}
                  </h2>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-slate-400">
                    <span>
                      {t.totalLabel} {rows.length}
                    </span>
                    <span>
                      {t.selectedLabel} {selectedRows.length}
                    </span>
                    <span className="text-green-700 dark:text-green-400">
                      {t.promotedLabel} {summary.PROMOTED}
                    </span>
                    <span className="text-red-700 dark:text-red-400">
                      {t.retainedLabel} {summary.RETAINED}
                    </span>
                    <span className="text-gray-700 dark:text-slate-300">
                      {t.transferredLabel} {summary.TRANSFERRED}
                    </span>
                  </div>
                </div>

                {rows.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">
                    {t.noActive}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-slate-800">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={rows.length > 0 && selectedRows.length === rows.length}
                          ref={(node) => {
                            if (node)
                              node.indeterminate =
                                selectedRows.length > 0 && selectedRows.length < rows.length;
                          }}
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? new Set(rows.map((row) => row.student_id))
                                : new Set(),
                            )
                          }
                        />
                        {t.selectAll}
                      </label>
                      <select
                        aria-label={t.bulkDecision}
                        value=""
                        disabled={!selectedRows.length}
                        onChange={(event) => {
                          const status = event.target.value as DecisionStatus;
                          if (status)
                            setRows((previous) =>
                              previous.map((row) =>
                                selected.has(row.student_id) ? { ...row, status } : row,
                              ),
                            );
                        }}
                        className="h-9 max-w-full rounded-md border px-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="">{t.bulkDecision}</option>
                        {DECISION_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t.status[status]}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm text-gray-500 dark:text-slate-400">
                        {t.selectionHelp}
                      </span>
                    </div>
                    {rows.map((row) => (
                      <div
                        key={row.student_id}
                        className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            aria-label={`${t.selectStudent}: ${row.name_bn}`}
                            checked={selected.has(row.student_id)}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setSelected((previous) => {
                                const next = new Set(previous);
                                if (checked) next.add(row.student_id);
                                else next.delete(row.student_id);
                                return next;
                              });
                            }}
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-800 dark:text-slate-200">
                              {row.name_bn}
                            </span>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-slate-400">
                              <span>
                                {t.rollLabel}: {row.roll ?? "—"}
                              </span>
                              <span>
                                {t.registrationLabel}: {row.registration_no ?? "—"}
                              </span>
                              <span>
                                {t.classLabel}:{" "}
                                {fromClasses.find((item) => item.class_id === row.class_id)
                                  ?.class_name_bn || "—"}
                              </span>
                              <span>
                                {t.sessionLabel}: {fromYear}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              row.result_status === "FAIL"
                                ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                                : row.result_status === "PASS"
                                  ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                                  : row.result_status === "ABSENT"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                    : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {t.result[row.result_status] || row.result_status}
                          </span>
                        </div>

                        <select
                          aria-label={`${t.decisionLabel}: ${row.name_bn}`}
                          value={row.status}
                          onChange={(event) =>
                            setRowStatus(row.student_id, event.target.value as DecisionStatus)
                          }
                          className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[320px]"
                        >
                          {DECISION_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {t.status[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TO section + execute */}
        {previewed && rows.length > 0 && (
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">
              {t.step3}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <select
                value={toDivision}
                onChange={(event) => {
                  const value = event.target.value;
                  setToDivision(value);
                  setToClass("");
                  setToYear("");
                  loadClasses(value, setToClasses, setToClassLoading);
                }}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
              >
                <option value="">{t.selectDivision}</option>
                {divisions.map((division) => (
                  <option key={division.division_id} value={division.division_id}>
                    {division.division_name_bn}
                  </option>
                ))}
              </select>

              <select
                value={toClass}
                onChange={(event) => setToClass(event.target.value)}
                disabled={!toDivision || toClassLoading}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 sm:w-[180px]"
              >
                <option value="">{toClassLoading ? c.loading : t.selectClass}</option>
                {toClasses.map((classItem) => (
                  <option key={classItem.class_id} value={classItem.class_id}>
                    {classItem.class_name_bn}
                  </option>
                ))}
              </select>

              <select
                value={toYear}
                aria-label={t.destinationSession}
                onChange={(event) => setToYear(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[130px]"
              >
                <option value="">{t.selectSession}</option>
                {destinationYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={
                  !toClass ||
                  !toYear ||
                  !destinationYears.includes(toYear) ||
                  !selectedRows.length ||
                  targetLoading
                }
                onClick={handleTargetPreview}
                className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
              >
                {targetLoading ? t.previewLoading : t.targetPreview}
              </button>

              <button
                type="button"
                disabled={!canExecute}
                onClick={() => setConfirmOpen(true)}
                className="h-9 w-full rounded-md bg-green-600 px-4 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60 sm:w-auto"
              >
                {t.execute}
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">{t.targetHelp}</p>
            {validTarget && (
              <div className="mt-4">
                <h3 className="mb-2 font-semibold">
                  {t.targetPreview} ({validTarget.rows.length})
                </h3>
                <p className="mb-3 text-sm text-gray-500 dark:text-slate-400">{t.previewNotice}</p>
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-left text-sm dark:text-slate-200">
                    <thead>
                      <tr className="border-b dark:border-slate-700">
                        {[
                          t.studentLabel,
                          t.decisionLabel,
                          t.currentDetails,
                          t.destinationDetails,
                        ].map((label) => (
                          <th key={label} className="p-3">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validTarget.rows.map((row) => (
                        <tr key={row.student_id} className="border-b dark:border-slate-700">
                          <td className="p-3">{row.name_bn}</td>
                          <td className="p-3">{t.status[row.status]}</td>
                          <td className="p-3">
                            <div>
                              {row.from_class_name} · {fromYear}
                            </div>
                            <div>
                              {t.rollLabel}: {row.old_roll} · {t.registrationLabel}:{" "}
                              {row.old_registration_no ?? "—"}
                            </div>
                          </td>
                          <td className="p-3">
                            <div>
                              {row.class_name} · {row.academic_year}
                            </div>
                            <div>
                              {t.rollLabel}: {row.roll} · {t.registrationLabel}:{" "}
                              {row.registration_no ?? "—"}
                            </div>
                            {row.status === "TRANSFERRED" && (
                              <div className="mt-1 whitespace-normal text-amber-700 dark:text-amber-400">
                                {t.transferNotice}
                              </div>
                            )}
                            {row.status === "RETAINED" && row.roll !== row.old_roll && (
                              <div className="mt-1 whitespace-normal text-amber-700 dark:text-amber-400">
                                {t.rollChanged}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </fieldset>

      <Modal
        open={confirmOpen}
        title={t.confirmTitle}
        onClose={() => {
          if (!executing) setConfirmOpen(false);
        }}
      >
        <p className="text-sm text-gray-700 dark:text-slate-300">
          {t.confirmBody(
            String(selectedRows.length),
            String(summary.PROMOTED),
            String(summary.RETAINED),
            String(summary.TRANSFERRED),
          )}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={executing}
            onClick={() => setConfirmOpen(false)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {c.cancel}
          </button>
          <button
            type="button"
            disabled={!canExecute}
            onClick={handleExecute}
            className="h-9 rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {executing ? t.executing : t.yesConfirm}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default StudentPromotionPage;
