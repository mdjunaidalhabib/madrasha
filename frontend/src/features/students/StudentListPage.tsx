import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import DataExportPrintActions from "../../components/common/DataExportPrintActions";
import ColumnVisibilityMenu from "../../components/common/ColumnVisibilityMenu";
import BulkUpdateModal from "../../components/students/BulkUpdateModal";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { logger } from "../../utils/logger";
import { SkeletonTable } from "../../components/ui/Skeleton";
import { StudentFullRecord } from "../../types/student";
import { useConfirmStore } from "../../store/confirmStore";
import { useToastStore } from "../../store/toastStore";
import { toBanglaDigits } from "../../utils/reportUtils";
import { type Session } from "../../services/sessionApi";
import { useColumnVisibility, type ColumnOption } from "../../hooks/useColumnVisibility";

type StudentColumnKey =
  | "roll"
  | "registration"
  | "fatherName"
  | "phone"
  | "academicYear"
  | "division"
  | "currentClass"
  | "status";

const STUDENT_COLUMNS: ColumnOption<StudentColumnKey>[] = [
  { key: "roll", label: "রোল নম্বর" },
  { key: "registration", label: "রেজিস্ট্রেশন নম্বর" },
  { key: "fatherName", label: "বাবার নাম" },
  { key: "phone", label: "ফোন" },
  { key: "academicYear", label: "শিক্ষাবর্ষ" },
  { key: "division", label: "বিভাগ" },
  { key: "currentClass", label: "বর্তমান শ্রেণি" },
  { key: "status", label: "স্ট্যাটাস" },
];
const STUDENT_COLUMN_KEYS = STUDENT_COLUMNS.map((c) => c.key);

type Division = {
  division_id: number;
  division_name_bn: string;
};

type ClassItem = {
  class_id: number;
  class_name_bn: string;
};

type Student = {
  id: number | string;
  registration_no?: number | string | null;
  name_bn?: string;
  name?: string;
  father_name?: string;
  roll?: number | string;
  guardian_phone?: string;
  division_id?: number | string;
  class_id?: number | string;
  academic_year?: string;
  current_class?: string;
  class_name?: string;
  class?: string;
  is_active?: number;
};

const StudentListPage = () => {
  const navigate = useNavigate();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  const [students, setStudents] = useState<Student[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Starts true — the initial student fetch waits on the session lookup
  // (selectedSessionId === null) before firing, so the skeleton should stay
  // up through that gap instead of flashing "কোন ছাত্র পাওয়া যায়নি".
  const [loading, setLoading] = useState(true);
  const [classLoading, setClassLoading] = useState(false);
  const [error, setError] = useState("");
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  // Defaults to the madrasa's current session so the list opens scoped to
  // "এই বছরের ছাত্র" instead of dumping every session's students (promoted,
  // passed-out, transferred) into one huge table. "" = সব সেশন (no filter).
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    visible: visibleColumns,
    toggle: toggleColumn,
    reset: resetColumns,
    isVisible: isColumnVisible,
  } = useColumnVisibility<StudentColumnKey>(`student-list-columns:${madrasaSlug}`, STUDENT_COLUMN_KEYS);

  const normalizeArray = (payload: any) => {
    const data =
      payload?.data?.data ||
      payload?.data?.students ||
      payload?.data?.result ||
      payload?.data ||
      [];

    return Array.isArray(data) ? data : [];
  };

  // Waits for selectedSessionId to be resolved (null = sessions still
  // loading) so the very first fetch is already session-scoped instead of
  // pulling every student and then narrowing client-side.
  const loadStudents = useCallback(async () => {
    if (selectedSessionId === null) return;
    try {
      setLoading(true);
      setError("");

      const res = await cachedGet(selectedSessionId ? `/students?session_id=${selectedSessionId}` : "/students");
      setStudents(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD STUDENTS ERROR:", err);
      setStudents([]);
      setError("ছাত্র তালিকা লোড করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

  const loadDivisions = useCallback(async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      setDivisions(normalizeArray(res));
    } catch (err) {
      logger.error("DIVISION LOAD ERROR:", err);
      setDivisions([]);
    }
  }, []);

  // All sessions (not just active ones) so the office can still switch back
  // to a past session's roster; defaults the filter to whichever session is
  // marked current, or "সব সেশন" (no filter) if none is.
  useEffect(() => {
    (async () => {
      try {
        const res = await cachedGet("/sessions");
        const list = normalizeArray(res) as unknown as Session[];
        setSessions(list);
        const current = list.find((s) => s.isCurrent);
        setSelectedSessionId(current ? String(current.id) : "");
      } catch (err) {
        logger.error("LOAD SESSIONS ERROR:", err);
        setSessions([]);
        setSelectedSessionId("");
      }
    })();
  }, []);

  const loadClassesByDivision = async (divisionId: string) => {
    setSelectedClass("");

    if (!divisionId) {
      setClasses([]);
      return;
    }

    try {
      setClassLoading(true);
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      setClasses(normalizeArray(res));
    } catch (err) {
      logger.error("CLASS LOAD ERROR:", err);
      setClasses([]);
    } finally {
      setClassLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
    loadDivisions();
  }, [loadStudents, loadDivisions]);

  const getDivisionName = useCallback(
    (divisionId?: number | string) => {
      const division = divisions.find((item) => String(item.division_id) === String(divisionId));
      return division?.division_name_bn || "নেই";
    },
    [divisions],
  );

  const getClassName = useCallback(
    (classId?: number | string, fallback?: string) => {
      const classItem = classes.find((item) => String(item.class_id) === String(classId));
      return classItem?.class_name_bn || fallback || "নেই";
    },
    [classes],
  );

  const filteredStudents = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return students.filter((student) => {
      const studentId = String(student.id || "").toLowerCase();
      const registrationNo = String(student.registration_no || "").toLowerCase();
      const studentName = String(student.name_bn || student.name || "").toLowerCase();
      const studentRoll = String(student.roll || "").toLowerCase();

      const matchSearch =
        !searchText ||
        studentId.includes(searchText) ||
        registrationNo.includes(searchText) ||
        studentRoll.includes(searchText) ||
        studentName.includes(searchText);

      const matchDivision =
        !selectedDivision || String(student.division_id) === String(selectedDivision);

      const matchClass = !selectedClass || String(student.class_id) === String(selectedClass);

      return matchSearch && matchDivision && matchClass;
    });
  }, [students, search, selectedDivision, selectedClass]);

  // ফিল্টার বদলালে আগের সিলেকশন (অন্য ভিউয়ের) যেন থেকে না যায়।
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, selectedDivision, selectedClass, selectedSessionId]);

  // ফিল্টার বা পেজ সাইজ বদলালে ১ নম্বর পাতায় ফিরে যাবে, নাহলে ফিল্টার করার পর
  // খালি পাতায় আটকে থাকতে পারে।
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedDivision, selectedClass, selectedSessionId, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));

  // ফলাফল সংখ্যা কমে গেলে (যেমন বাল্ক ডিলিট) বর্তমান পাতা সীমার বাইরে চলে
  // যেতে পারে — শেষ বৈধ পাতায় নামিয়ে আনা হয়।
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedStudents = useMemo(
    () => filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredStudents, currentPage, pageSize],
  );

  const rangeStart = filteredStudents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filteredStudents.length);

  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((student) => selectedIds.has(String(student.id)));

  const toggleSelectAll = () => {
    setSelectedIds(
      allFilteredSelected ? new Set() : new Set(filteredStudents.map((s) => String(s.id))),
    );
  };

  const toggleSelectOne = (id: string | number) => {
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const statusBadge = (isActive?: number) => {
    const expelled = Number(isActive) === 0;
    return (
      <span
        className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          expelled
            ? "border-red-300 bg-red-100 text-red-700"
            : "border-green-300 bg-green-100 text-green-700"
        }`}
      >
        {expelled ? "বহিষ্কৃত" : "সক্রিয়"}
      </span>
    );
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    useConfirmStore.getState().show({
      title: "নির্বাচিত শিক্ষার্থীদের ট্র্যাশে পাঠাবেন?",
      message: `${toBanglaDigits(ids.length)} জন শিক্ষার্থীকে ট্র্যাশে সরাতে চান? পরে প্রয়োজনে ট্র্যাশ থেকে ফিরিয়ে আনা যাবে।`,
      confirmText: "ট্র্যাশে পাঠান",
      danger: true,
      onConfirm: async () => {
        try {
          setBulkBusy(true);
          await api.delete("/students/bulk", { data: { ids: ids.map(Number) } });
          useToastStore.getState().show("ট্র্যাশে পাঠানো হয়েছে", "success");
          setStudents((prev) => prev.filter((s) => !selectedIds.has(String(s.id))));
          setSelectedIds(new Set());
        } catch (err) {
          logger.error("BULK DELETE STUDENTS ERROR:", err);
          useToastStore.getState().show("মুছে ফেলা যায়নি", "error");
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  const exportStudents = useMemo(() => {
    return filteredStudents.map((student) => ({
      registrationNumber: student.registration_no || "নেই",
      roll: student.roll || "নেই",
      name: student.name_bn || student.name || "নেই",
      fatherName: student.father_name || "নেই",
      phone: student.guardian_phone || "নেই",
      academicYear: student.academic_year || "নেই",
      division: getDivisionName(student.division_id),
      currentClass: getClassName(
        student.class_id,
        student.current_class || student.class_name || student.class,
      ),
    }));
  }, [filteredStudents, getDivisionName, getClassName]);

  const exportColumns = [
    { header: "রোল নম্বর", key: "roll" },
    { header: "রেজিস্ট্রেশন নম্বর", key: "registrationNumber" },
    { header: "নাম", key: "name" },
    { header: "বাবার নাম", key: "fatherName" },
    { header: "ফোন", key: "phone" },
    { header: "শিক্ষাবর্ষ", key: "academicYear" },
    { header: "বিভাগ", key: "division" },
    { header: "বর্তমান শ্রেণি", key: "currentClass" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">ছাত্র তালিকা</h1>
            <p className="mt-1 text-sm text-gray-500">মোট ছাত্র: {filteredStudents.length} জন</p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`${adminBase}/students/new_admission`)}
            className="h-10 w-full rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 md:w-auto"
          >
            + নতুন ছাত্র ভর্তি
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <input
                type="text"
                placeholder="রেজিস্ট্রেশন, রোল বা নাম দিয়ে সার্চ করুন"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="col-span-full h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[240px]"
              />

              {/* সেশন ফিল্টার — ডিফল্টে চলমান সেশন নির্বাচিত থাকে */}
              <select
                value={selectedSessionId ?? ""}
                onChange={(event) => setSelectedSessionId(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[160px]"
              >
                <option value="">সব সেশন</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isCurrent ? " (চলমান)" : ""}
                  </option>
                ))}
              </select>

              <select
                value={selectedDivision}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedDivision(value);
                  loadClassesByDivision(value);
                }}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[160px]"
              >
                <option value="">সব বিভাগ</option>

                {divisions.map((division) => (
                  <option key={division.division_id} value={division.division_id}>
                    {division.division_name_bn}
                  </option>
                ))}
              </select>

              <select
                value={selectedClass}
                onChange={(event) => setSelectedClass(event.target.value)}
                disabled={!selectedDivision || classLoading}
                className="col-span-full h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 sm:col-auto sm:w-[180px]"
              >
                <option value="">
                  {classLoading
                    ? "শ্রেণি লোড হচ্ছে..."
                    : selectedDivision
                      ? "সব শ্রেণি"
                      : "আগে বিভাগ নির্বাচন করুন"}
                </option>

                {classes.map((classItem) => (
                  <option key={classItem.class_id} value={classItem.class_id}>
                    {classItem.class_name_bn}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => setBulkUpdateOpen(true)}
                className="h-9 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
              >
                বাল্ক আপডেট
              </button>

              <ColumnVisibilityMenu
                columns={STUDENT_COLUMNS}
                visible={visibleColumns}
                onToggle={toggleColumn}
                onReset={resetColumns}
              />

              <DataExportPrintActions
                title="ছাত্র তালিকা"
                fileName="student-list"
                columns={exportColumns}
                data={exportStudents}
              />
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-700">
              {toBanglaDigits(selectedIds.size)} জন নির্বাচিত হয়েছে
            </p>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkBusy}
              className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {bulkBusy ? "পাঠানো হচ্ছে..." : "ট্র্যাশে পাঠান"}
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <SkeletonTable rows={8} columns={3 + visibleColumns.size} />
        ) : filteredStudents.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
            কোন ছাত্র পাওয়া যায়নি
          </div>
        ) : (
          <>
            {/* Mobile / tablet: card list (below md) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
              {paginatedStudents.map((student) => (
                <div
                  key={student.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(String(student.id))}
                        onChange={() => toggleSelectOne(student.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                      />
                      <div>
                        <p className="text-base font-semibold text-gray-800">
                          {student.name_bn || student.name || "নেই"}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          রেজিস্ট্রেশন: {student.registration_no || "নেই"}
                        </p>
                        <div className="mt-1">{statusBadge(student.is_active)}</div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      রোল {student.roll || "নেই"}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-gray-400">বাবার নাম</dt>
                      <dd className="text-gray-700">{student.father_name || "নেই"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">ফোন</dt>
                      <dd className="text-gray-700">{student.guardian_phone || "নেই"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">শিক্ষাবর্ষ</dt>
                      <dd className="text-gray-700">{student.academic_year || "নেই"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">বিভাগ</dt>
                      <dd className="text-gray-700">{getDivisionName(student.division_id)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-gray-400">বর্তমান শ্রেণি</dt>
                      <dd className="text-gray-700">
                        {getClassName(
                          student.class_id,
                          student.current_class || student.class_name || student.class,
                        )}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() => navigate(`${adminBase}/students/${student.id}`)}
                    className="mt-4 w-full rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                  >
                    দেখুন
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop / large tablet: table (md and up) */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-center">
                  <thead className="bg-blue-800 text-sm text-white">
                    <tr>
                      <th className="border p-2.5">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </th>
                      {isColumnVisible("roll") && <th className="border p-2.5">রোল নম্বর</th>}
                      {isColumnVisible("registration") && (
                        <th className="border p-2.5">রেজিস্ট্রেশন নম্বর</th>
                      )}
                      <th className="border p-2.5">নাম</th>
                      {isColumnVisible("fatherName") && <th className="border p-2.5">বাবার নাম</th>}
                      {isColumnVisible("phone") && <th className="border p-2.5">ফোন</th>}
                      {isColumnVisible("academicYear") && (
                        <th className="border p-2.5">শিক্ষাবর্ষ</th>
                      )}
                      {isColumnVisible("division") && <th className="border p-2.5">বিভাগ</th>}
                      {isColumnVisible("currentClass") && (
                        <th className="border p-2.5">বর্তমান শ্রেণি</th>
                      )}
                      {isColumnVisible("status") && <th className="border p-2.5">স্ট্যাটাস</th>}
                      <th className="border p-2.5">একশন</th>
                    </tr>
                  </thead>

                  <tbody className="text-sm">
                    {paginatedStudents.map((student) => (
                      <tr key={student.id} className="border-t transition hover:bg-gray-50">
                        <td className="border p-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(String(student.id))}
                            onChange={() => toggleSelectOne(student.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </td>

                        {isColumnVisible("roll") && (
                          <td className="border p-2.5">{student.roll || "নেই"}</td>
                        )}

                        {isColumnVisible("registration") && (
                          <td className="border p-2.5">{student.registration_no || "নেই"}</td>
                        )}

                        <td className="border p-2.5">{student.name_bn || student.name || "নেই"}</td>

                        {isColumnVisible("fatherName") && (
                          <td className="border p-2.5">{student.father_name || "নেই"}</td>
                        )}

                        {isColumnVisible("phone") && (
                          <td className="border p-2.5">{student.guardian_phone || "নেই"}</td>
                        )}

                        {isColumnVisible("academicYear") && (
                          <td className="border p-2.5">{student.academic_year || "নেই"}</td>
                        )}

                        {isColumnVisible("division") && (
                          <td className="border p-2.5">{getDivisionName(student.division_id)}</td>
                        )}

                        {isColumnVisible("currentClass") && (
                          <td className="border p-2.5">
                            {getClassName(
                              student.class_id,
                              student.current_class || student.class_name || student.class,
                            )}
                          </td>
                        )}

                        {isColumnVisible("status") && (
                          <td className="border p-2.5">{statusBadge(student.is_active)}</td>
                        )}

                        <td className="border p-2.5">
                          <button
                            type="button"
                            onClick={() => navigate(`${adminBase}/students/${student.id}`)}
                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-green-700"
                          >
                            দেখুন
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination — ২০/৫০/১০০ জন করে পাতায় দেখায়, বাকিরা Prev/Next দিয়ে */}
            <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm sm:flex-row">
              <div className="flex items-center gap-2 text-xs text-gray-500 sm:text-sm">
                <span>
                  দেখাচ্ছে {toBanglaDigits(rangeStart)}–{toBanglaDigits(rangeEnd)}, মোট{" "}
                  {toBanglaDigits(filteredStudents.length)} জন
                </span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-8 rounded-md border border-gray-300 px-2 text-xs outline-none sm:text-sm"
                >
                  {[20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      পাতায় {toBanglaDigits(size)} জন
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 sm:text-sm"
                >
                  আগের
                </button>
                <span className="text-xs text-gray-600 sm:text-sm">
                  পাতা {toBanglaDigits(currentPage)} / {toBanglaDigits(totalPages)}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 sm:text-sm"
                >
                  পরের
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <BulkUpdateModal
        open={bulkUpdateOpen}
        students={filteredStudents as unknown as StudentFullRecord[]}
        divisions={divisions}
        classes={classes}
        onClose={() => setBulkUpdateOpen(false)}
        onSuccess={loadStudents}
      />
    </div>
  );
};

export default StudentListPage;
