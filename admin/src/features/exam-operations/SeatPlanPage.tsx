import { useCallback, useEffect, useMemo, useState } from "react";
import { cachedGet } from "../../services/api";
import { examRoutineApi } from "../../services/phase1Api";
import {
  examRoomApi,
  examSeatApi,
  ExamRoomRow,
  SeatAllocationRow,
  SeatAllocationStrategy,
} from "../../services/examOperationsApi";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import { divisionsForExam, examsForDivision, useClearMismatchedExam } from "../../components/ExamPanel/examDivisionScope";

type Division = { division_id: number; division_name_bn: string };
type ClassItem = { class_id: number; class_name_bn: string };
type Exam = { id: number; name: string; year: string | number; division_ids?: number[] };
type ExamRoutineRow = {
  id: number;
  subject: string;
  examDate: string;
  startTime: string;
  endTime: string;
  class?: { nameBn?: string };
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const STRATEGY_LABELS: Record<SeatAllocationStrategy, string> = {
  SEQUENTIAL: "ক্রমিক",
  ROLL_BASED: "রোল অনুসারে",
  ALTERNATING: "পর্যায়ক্রমিক (মিশ্র)",
  MANUAL: "ম্যানুয়াল",
};

const SeatPlanPage = () => {
  // Route-level guard now accepts exam.seat.read OR exam.seat.manage (see
  // router.tsx) so a view-only role can open this page - hide/disable the
  // allocate/clear/manual-adjust controls for anyone without .manage, since
  // the backend would reject those mutations anyway (this just avoids a
  // confusing "click button, get a 403 toast" experience).
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canManage = hasPermission(user, permissions, "exam.seat.manage");

  const [exams, setExams] = useState<Exam[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [division, setDivision] = useState("");
  const [classId, setClassId] = useState("");
  const [examId, setExamId] = useState("");

  const [routines, setRoutines] = useState<ExamRoutineRow[]>([]);
  const [routineId, setRoutineId] = useState("");

  const [rooms, setRooms] = useState<ExamRoomRow[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [strategy, setStrategy] = useState<SeatAllocationStrategy>("ROLL_BASED");
  const [preserveManual, setPreserveManual] = useState(true);

  const [seats, setSeats] = useState<SeatAllocationRow[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [clearing, setClearing] = useState(false);

  // বিভাগভিত্তিক পরীক্ষা: drop the exam if the picked division isn't one it's held for.
  useClearMismatchedExam(exams, examId, division, () => setExamId(""));

  useEffect(() => {
    (async () => {
      try {
        const [examRes, divisionRes, roomRes] = await Promise.all([
          cachedGet("/exams", { params: { active_only: true } }),
          cachedGet("/madrasa-divisions"),
          examRoomApi.list(true),
        ]);
        setExams(normalizeArray(examRes));
        setDivisions(normalizeArray(divisionRes));
        setRooms(normalizeArray(roomRes));
      } catch (err) {
        logger.error("SEAT PLAN INIT LOAD ERROR:", err);
        useToastStore.getState().show("পরীক্ষা/বিভাগ/রুমের তালিকা লোড করতে সমস্যা হয়েছে", "error");
      }
    })();
  }, []);

  const loadClasses = async (divisionId: string) => {
    setClassId("");
    if (!divisionId) {
      setClasses([]);
      return;
    }
    try {
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      setClasses(normalizeArray(res));
    } catch (err) {
      logger.error("SEAT PLAN CLASS LOAD ERROR:", err);
      setClasses([]);
    }
  };

  const loadRoutines = useCallback(async () => {
    if (!examId || !classId) {
      setRoutines([]);
      return;
    }
    try {
      const res = await examRoutineApi.list({ exam_id: Number(examId), class_id: Number(classId) });
      setRoutines(normalizeArray(res));
    } catch (err) {
      logger.error("SEAT PLAN ROUTINE LOAD ERROR:", err);
      setRoutines([]);
    }
  }, [examId, classId]);

  useEffect(() => {
    loadRoutines();
    setRoutineId("");
  }, [loadRoutines]);

  const loadSeats = useCallback(async () => {
    if (!routineId) {
      setSeats([]);
      return;
    }
    try {
      setLoadingSeats(true);
      const res = await examSeatApi.listByRoutine(Number(routineId));
      setSeats(normalizeArray(res));
    } catch (err) {
      logger.error("SEAT PLAN LIST LOAD ERROR:", err);
      setSeats([]);
    } finally {
      setLoadingSeats(false);
    }
  }, [routineId]);

  useEffect(() => {
    loadSeats();
  }, [loadSeats]);

  const toggleRoom = (roomId: number) => {
    setSelectedRoomIds((prev) => (prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]));
  };

  const handleAutoAllocate = async () => {
    if (!routineId || !selectedRoomIds.length) {
      useToastStore.getState().show("পরীক্ষার সময়সূচি ও অন্তত একটি রুম নির্বাচন করুন", "error");
      return;
    }
    try {
      setAllocating(true);
      const res = await examSeatApi.autoAllocate({
        exam_routine_id: Number(routineId),
        room_ids: selectedRoomIds,
        strategy,
        preserve_manual_overrides: preserveManual,
      });
      useToastStore.getState().show(`${res?.data?.data?.allocated ?? 0}টি আসন বণ্টন করা হয়েছে`, "success");
      loadSeats();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "আসন বণ্টন করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setAllocating(false);
    }
  };

  const handleClear = async () => {
    if (!routineId || clearing) return;
    try {
      setClearing(true);
      await examSeatApi.clear(Number(routineId));
      useToastStore.getState().show("আসন বণ্টন মুছে ফেলা হয়েছে", "success");
      loadSeats();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setClearing(false);
    }
  };

  const handleManualUpdate = async (seat: SeatAllocationRow, roomId: number, seatNo: string) => {
    try {
      await examSeatApi.manualAdjust(seat.id, { room_id: roomId, seat_no: seatNo });
      useToastStore.getState().show("আসন আপডেট করা হয়েছে", "success");
      loadSeats();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "আপডেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  const seatsByRoom = useMemo(() => {
    const groups = new Map<number, SeatAllocationRow[]>();
    for (const seat of seats) {
      const list = groups.get(seat.roomId) || [];
      list.push(seat);
      groups.set(seat.roomId, list);
    }
    return groups;
  }, [seats]);

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">সিট প্ল্যান</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">পরীক্ষার আসন বিন্যাস স্বয়ংক্রিয়ভাবে বণ্টন করুন বা ম্যানুয়ালি সমন্বয় করুন</p>
        </div>

        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[180px]"
            >
              <option value="">পরীক্ষা নির্বাচন করুন</option>
              {examsForDivision(exams, division).map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} — {exam.year}
                </option>
              ))}
            </select>
            <select
              value={division}
              onChange={(e) => {
                setDivision(e.target.value);
                loadClasses(e.target.value);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            >
              <option value="">বিভাগ নির্বাচন করুন</option>
              {divisionsForExam(
                divisions,
                exams.find((e) => String(e.id) === examId),
              ).map((d) => (
                <option key={d.division_id} value={d.division_id}>
                  {d.division_name_bn}
                </option>
              ))}
            </select>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={!division}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            >
              <option value="">শ্রেণি নির্বাচন করুন</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name_bn}
                </option>
              ))}
            </select>
            <select
              value={routineId}
              onChange={(e) => setRoutineId(e.target.value)}
              disabled={!routines.length}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[220px]"
            >
              <option value="">সময়সূচি (বিষয়/তারিখ) নির্বাচন করুন</option>
              {routines.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.subject} — {String(r.examDate).slice(0, 10)} ({r.startTime}-{r.endTime})
                </option>
              ))}
            </select>
          </div>
        </div>

        {routineId && canManage && (
          <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">স্বয়ংক্রিয় বণ্টন</h2>
            <div className="mb-3 flex flex-wrap gap-3">
              {rooms.map((room) => (
                <label key={room.id} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedRoomIds.includes(room.id)}
                    onChange={() => toggleRoom(room.id)}
                  />
                  {room.name} ({room.capacity})
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as SeatAllocationStrategy)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[180px]"
              >
                <option value="SEQUENTIAL">{STRATEGY_LABELS.SEQUENTIAL}</option>
                <option value="ROLL_BASED">{STRATEGY_LABELS.ROLL_BASED}</option>
                <option value="ALTERNATING">{STRATEGY_LABELS.ALTERNATING}</option>
              </select>
              <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300">
                <input type="checkbox" checked={preserveManual} onChange={(e) => setPreserveManual(e.target.checked)} />
                ম্যানুয়াল পরিবর্তনগুলো রাখুন
              </label>
              <button
                type="button"
                disabled={allocating}
                onClick={handleAutoAllocate}
                className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
              >
                স্বয়ংক্রিয় বণ্টন করুন
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={handleClear}
                className="h-9 w-full rounded-md border border-red-300 bg-red-50 px-4 text-sm font-medium text-red-700 disabled:opacity-60 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 sm:w-auto"
              >
                সব মুছুন
              </button>
            </div>
          </div>
        )}

        {routineId && (
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">বর্তমান আসন বিন্যাস</h2>
            {loadingSeats ? (
              <SkeletonList items={6} />
            ) : seats.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">এখনো কোনো আসন বণ্টন করা হয়নি</div>
            ) : (
              <div className="flex flex-col gap-4">
                {Array.from(seatsByRoom.entries()).map(([roomId, roomSeats]) => (
                  <div key={roomId}>
                    <h3 className="mb-2 text-xs font-semibold text-gray-600 dark:text-slate-400">
                      {roomSeats[0]?.room?.name || `রুম #${roomId}`}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {roomSeats
                        .slice()
                        .sort((a, b) => Number(a.seatNo) - Number(b.seatNo) || a.seatNo.localeCompare(b.seatNo))
                        .map((seat) => (
                          <div
                            key={seat.id}
                            className={`rounded-md border p-2 text-center text-xs ${
                              seat.isManualOverride
                                ? "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
                                : "border-gray-200 dark:border-slate-700"
                            }`}
                          >
                            <div className="font-semibold text-gray-800 dark:text-slate-100">আসন {seat.seatNo}</div>
                            <div className="text-gray-500 dark:text-slate-400">প্রার্থী #{seat.examCandidateId}</div>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newSeatNo = window.prompt("নতুন আসন নম্বর দিন", seat.seatNo);
                                  if (newSeatNo && newSeatNo.trim() && newSeatNo !== seat.seatNo) {
                                    handleManualUpdate(seat, seat.roomId, newSeatNo.trim());
                                  }
                                }}
                                className="mt-1 text-blue-600 hover:underline dark:text-blue-400"
                              >
                                পরিবর্তন
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SeatPlanPage;
