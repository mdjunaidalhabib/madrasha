import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import DataExportPrintActions from "../../components/common/DataExportPrintActions";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { logger } from "../../utils/logger";

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
};

const StudentListPage = () => {
  const navigate = useNavigate();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  const [students, setStudents] = useState<Student[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [classLoading, setClassLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(
    String(new Date().getFullYear()),
  );

  const ACADEMIC_YEARS = ["2022", "2023", "2024", "2025", "2026", "2027"];

  const normalizeArray = (payload: any) => {
    const data =
      payload?.data?.data ||
      payload?.data?.students ||
      payload?.data?.result ||
      payload?.data ||
      [];

    return Array.isArray(data) ? data : [];
  };

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/students");
      setStudents(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD STUDENTS ERROR:", err);
      setStudents([]);
      setError("ছাত্র তালিকা লোড করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDivisions = useCallback(async () => {
    try {
      const res = await api.get("/madrasa-divisions");
      setDivisions(normalizeArray(res));
    } catch (err) {
      logger.error("DIVISION LOAD ERROR:", err);
      setDivisions([]);
    }
  }, []);

  const loadClassesByDivision = async (divisionId: string) => {
    setSelectedClass("");

    if (!divisionId) {
      setClasses([]);
      return;
    }

    try {
      setClassLoading(true);
      const res = await api.get(`/madrasa-classes?division_id=${divisionId}`);
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

      const matchAcademicYear =
        !selectedAcademicYear || String(student.academic_year) === String(selectedAcademicYear);

      return matchSearch && matchDivision && matchClass && matchAcademicYear;
    });
  }, [students, search, selectedDivision, selectedClass, selectedAcademicYear]);

  const exportStudents = useMemo(() => {
    return filteredStudents.map((student, index) => ({
      serial: index + 1,
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
    { header: "ক্রমিক", key: "serial" },
    { header: "রেজিস্ট্রেশন নম্বর", key: "registrationNumber" },
    { header: "রোল নম্বর", key: "roll" },
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

              {/* শিক্ষাবর্ষ ফিল্টার */}
              <select
                value={selectedAcademicYear}
                onChange={(event) => setSelectedAcademicYear(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[130px]"
              >
                <option value="">সব শিক্ষাবর্ষ</option>
                {ACADEMIC_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
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

            <div className="flex shrink-0 justify-start lg:justify-end">
              <DataExportPrintActions
                title="ছাত্র তালিকা"
                fileName="student-list"
                columns={exportColumns}
                data={exportStudents}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
            লোড হচ্ছে...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
            কোন ছাত্র পাওয়া যায়নি
          </div>
        ) : (
          <>
            {/* Mobile / tablet: card list (below md) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <p className="text-base font-semibold text-gray-800">
                        {student.name_bn || student.name || "নেই"}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">রেজিস্ট্রেশন: {student.id}</p>
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
                      <th className="border p-2.5">রেজিস্ট্রেশন নম্বর</th>
                      <th className="border p-2.5">রোল নম্বর</th>
                      <th className="border p-2.5">নাম</th>
                      <th className="border p-2.5">বাবার নাম</th>
                      <th className="border p-2.5">ফোন</th>
                      <th className="border p-2.5">শিক্ষাবর্ষ</th>
                      <th className="border p-2.5">বিভাগ</th>
                      <th className="border p-2.5">বর্তমান শ্রেণি</th>
                      <th className="border p-2.5">একশন</th>
                    </tr>
                  </thead>

                  <tbody className="text-sm">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="border-t transition hover:bg-gray-50">
                        <td className="border p-2.5">{student.id}</td>

                        <td className="border p-2.5">{student.roll || "নেই"}</td>

                        <td className="border p-2.5">{student.name_bn || student.name || "নেই"}</td>

                        <td className="border p-2.5">{student.father_name || "নেই"}</td>

                        <td className="border p-2.5">{student.guardian_phone || "নেই"}</td>

                        <td className="border p-2.5">{student.academic_year || "নেই"}</td>

                        <td className="border p-2.5">{getDivisionName(student.division_id)}</td>

                        <td className="border p-2.5">
                          {getClassName(
                            student.class_id,
                            student.current_class || student.class_name || student.class,
                          )}
                        </td>

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
          </>
        )}
      </div>
    </div>
  );
};

export default StudentListPage;
