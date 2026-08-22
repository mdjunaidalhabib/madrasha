import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import DataExportPrintActions from "../../components/common/DataExportPrintActions";
import ColumnVisibilityMenu from "../../components/common/ColumnVisibilityMenu";
import BulkUpdateModal from "../../components/teachers/BulkUpdateModal";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { logger } from "../../utils/logger";
import { SkeletonTable } from "../../components/ui/Skeleton";
import { TeacherFullRecord } from "../../types/teacher";
import { useColumnVisibility, type ColumnOption } from "../../hooks/useColumnVisibility";

type TeacherColumnKey =
  | "registration"
  | "phone"
  | "gender"
  | "designation"
  | "academicDivision"
  | "qualification"
  | "nameAr"
  | "nid"
  | "dob"
  | "age"
  | "email"
  | "department"
  | "experienceYear"
  | "experienceMonth"
  | "joiningDate"
  | "salary"
  | "fatherName"
  | "fatherNameAr"
  | "fatherNid"
  | "fatherOccupation"
  | "motherName"
  | "motherNid"
  | "motherOccupation"
  | "parentPhone"
  | "addressDivision"
  | "district"
  | "thana"
  | "village";

// এই কয়টা কলাম ডিফল্টে দেখানো হয় (আগের আচরণ অপরিবর্তিত রাখতে) — বাকি সব
// কলাম "কলাম" মেনু থেকে ব্যবহারকারী নিজের প্রয়োজন মতো চালু করে নিতে পারবে।
const DEFAULT_VISIBLE_TEACHER_COLUMNS: TeacherColumnKey[] = [
  "registration",
  "phone",
  "gender",
  "designation",
  "academicDivision",
  "qualification",
];

const TEACHER_COLUMNS: ColumnOption<TeacherColumnKey>[] = [
  { key: "registration", label: "রেজিস্ট্রেশন নং" },
  { key: "phone", label: "মোবাইল" },
  { key: "gender", label: "লিঙ্গ" },
  { key: "designation", label: "পদবি" },
  { key: "academicDivision", label: "একাডেমিক বিভাগ" },
  { key: "qualification", label: "যোগ্যতা" },
  { key: "nameAr", label: "আরবি নাম" },
  { key: "nid", label: "এনআইডি" },
  { key: "dob", label: "জন্ম তারিখ" },
  { key: "age", label: "বয়স" },
  { key: "email", label: "ইমেইল" },
  { key: "department", label: "বিভাগ (পদ)" },
  { key: "experienceYear", label: "অভিজ্ঞতা (বছর)" },
  { key: "experienceMonth", label: "অভিজ্ঞতা (মাস)" },
  { key: "joiningDate", label: "যোগদানের তারিখ" },
  { key: "salary", label: "বেতন" },
  { key: "fatherName", label: "বাবার নাম" },
  { key: "fatherNameAr", label: "বাবার আরবি নাম" },
  { key: "fatherNid", label: "বাবার এনআইডি" },
  { key: "fatherOccupation", label: "বাবার পেশা" },
  { key: "motherName", label: "মায়ের নাম" },
  { key: "motherNid", label: "মায়ের এনআইডি" },
  { key: "motherOccupation", label: "মায়ের পেশা" },
  { key: "parentPhone", label: "অভিভাবকের ফোন" },
  { key: "addressDivision", label: "বিভাগ (ঠিকানা)" },
  { key: "district", label: "জেলা" },
  { key: "thana", label: "থানা" },
  { key: "village", label: "গ্রাম" },
];
const TEACHER_COLUMN_KEYS = TEACHER_COLUMNS.map((c) => c.key);
const TEACHER_COLUMN_LABEL_MAP = new Map(TEACHER_COLUMNS.map((c) => [c.key, c.label]));

const orNone = (v: unknown) => (v === null || v === undefined || v === "" ? "নেই" : String(v));

type Division = {
  division_id: number | string;
  division_name_bn: string;
};

type Teacher = {
  id: number | string;
  registration_no?: number | string;
  name_bn?: string;
  name?: string;
  phone?: string;
  gender?: number | string;
  designation?: string;
  academic_division?: number | string;
  division_id?: number | string;
  department?: number | string;
  qualification?: string;
  salary?: number | string;
  name_ar?: string | null;
  nid?: string | null;
  dob?: string | null;
  age?: number | string | null;
  email?: string | null;
  experience_year?: number | string | null;
  experience_month?: number | string | null;
  joining_date?: string | null;
  father_name?: string | null;
  father_name_ar?: string | null;
  father_nid?: string | null;
  father_occupation?: string | null;
  mother_name?: string | null;
  mother_nid?: string | null;
  mother_occupation?: string | null;
  parent_phone?: string | null;
  division?: string | null;
  district?: string | null;
  thana?: string | null;
  village?: string | null;
};

const TeacherListPage = () => {
  const navigate = useNavigate();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedAcademicDivision, setSelectedAcademicDivision] = useState("");

  const {
    visible: visibleColumns,
    order: columnOrder,
    toggle: toggleColumn,
    reset: resetColumns,
    move: moveColumn,
  } = useColumnVisibility<TeacherColumnKey>(
    `teacher-list-columns:${madrasaSlug}`,
    TEACHER_COLUMN_KEYS,
    DEFAULT_VISIBLE_TEACHER_COLUMNS,
  );

  const normalizeArray = (payload: any) => {
    const data =
      payload?.data?.data ||
      payload?.data?.teachers ||
      payload?.data?.result ||
      payload?.data ||
      [];

    return Array.isArray(data) ? data : [];
  };

  const loadTeachers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await cachedGet("/teachers");
      setTeachers(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD TEACHERS ERROR:", err);
      setTeachers([]);
      setError("শিক্ষক তালিকা লোড করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDivisions = useCallback(async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      setDivisions(normalizeArray(res));
    } catch (err) {
      logger.error("DIVISION LOAD ERROR:", err);
      setDivisions([]);
    }
  }, []);

  useEffect(() => {
    loadTeachers();
    loadDivisions();
  }, [loadTeachers, loadDivisions]);

  const getGenderName = (gender?: number | string) => {
    if (Number(gender) === 1 || gender === "male") return "পুরুষ";
    if (Number(gender) === 2 || gender === "female") return "মহিলা";
    return "নেই";
  };

  const getAcademicDivisionId = (teacher: Teacher) =>
    teacher.academic_division || teacher.division_id || teacher.department || "";

  const getDivisionName = useCallback(
    (divisionId?: number | string) => {
      const division = divisions.find((item) => String(item.division_id) === String(divisionId));

      return division?.division_name_bn || divisionId || "নেই";
    },
    [divisions],
  );

  // প্রতিটা টগল-করা কলামের প্লেইন টেক্সট মান বের করার ফাংশন — টেবিলের সেলে
  // ব্যবহার হয়, রিঅর্ডার করা ক্রম অনুযায়ী।
  const columnValueGetters: Record<TeacherColumnKey, (t: Teacher) => string> = {
    registration: (t) => orNone(t.registration_no),
    phone: (t) => orNone(t.phone),
    gender: (t) => getGenderName(t.gender),
    designation: (t) => orNone(t.designation),
    academicDivision: (t) => String(getDivisionName(getAcademicDivisionId(t))),
    qualification: (t) => orNone(t.qualification),
    nameAr: (t) => orNone(t.name_ar),
    nid: (t) => orNone(t.nid),
    dob: (t) => orNone(t.dob),
    age: (t) => orNone(t.age),
    email: (t) => orNone(t.email),
    department: (t) => orNone(t.department),
    experienceYear: (t) => orNone(t.experience_year),
    experienceMonth: (t) => orNone(t.experience_month),
    joiningDate: (t) => orNone(t.joining_date),
    salary: (t) => orNone(t.salary),
    fatherName: (t) => orNone(t.father_name),
    fatherNameAr: (t) => orNone(t.father_name_ar),
    fatherNid: (t) => orNone(t.father_nid),
    fatherOccupation: (t) => orNone(t.father_occupation),
    motherName: (t) => orNone(t.mother_name),
    motherNid: (t) => orNone(t.mother_nid),
    motherOccupation: (t) => orNone(t.mother_occupation),
    parentPhone: (t) => orNone(t.parent_phone),
    addressDivision: (t) => orNone(t.division),
    district: (t) => orNone(t.district),
    thana: (t) => orNone(t.thana),
    village: (t) => orNone(t.village),
  };

  // দৃশ্যমান কলামগুলো ব্যবহারকারীর ঠিক করা ক্রমে — টেবিলের হেডার/সেল এই ক্রমেই বসে।
  const orderedVisibleColumns = columnOrder.filter((key) => visibleColumns.has(key));

  const filteredTeachers = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return teachers.filter((teacher) => {
      const registrationNo = String(teacher.registration_no || "").toLowerCase();
      const name = String(teacher.name_bn || teacher.name || "").toLowerCase();
      const phone = String(teacher.phone || "").toLowerCase();
      const designation = String(teacher.designation || "").toLowerCase();

      const matchSearch =
        !searchText ||
        registrationNo.includes(searchText) ||
        name.includes(searchText) ||
        phone.includes(searchText) ||
        designation.includes(searchText);

      const matchGender = !selectedGender || String(teacher.gender) === String(selectedGender);

      const matchAcademicDivision =
        !selectedAcademicDivision ||
        String(getAcademicDivisionId(teacher)) === String(selectedAcademicDivision);

      return matchSearch && matchGender && matchAcademicDivision;
    });
  }, [teachers, search, selectedGender, selectedAcademicDivision]);

  const exportTeachers = useMemo(() => {
    return filteredTeachers.map((teacher) => ({
      id: teacher.registration_no || "",
      name: teacher.name_bn || teacher.name || "নেই",
      phone: teacher.phone || "নেই",
      gender: getGenderName(teacher.gender),
      designation: teacher.designation || "নেই",
      academicDivision: getDivisionName(getAcademicDivisionId(teacher)),
      qualification: teacher.qualification || "নেই",
      salary: teacher.salary || "নেই",
    }));
  }, [filteredTeachers, getDivisionName]);

  const exportColumns = [
    { header: "রেজিস্ট্রেশন নং", key: "id" },
    { header: "নাম", key: "name" },
    { header: "মোবাইল", key: "phone" },
    { header: "লিঙ্গ", key: "gender" },
    { header: "পদবি", key: "designation" },
    { header: "একাডেমিক বিভাগ", key: "academicDivision" },
    { header: "যোগ্যতা", key: "qualification" },
    { header: "বেতন", key: "salary" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">শিক্ষক তালিকা</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">মোট শিক্ষক: {filteredTeachers.length} জন</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(`${adminBase}/ihtemam/teacher_admission`)}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              + নতুন শিক্ষক যোগ করুন
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="ID, নাম, ফোন বা পদবি দিয়ে সার্চ করুন"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[260px]"
              />

              <select
                value={selectedGender}
                onChange={(event) => setSelectedGender(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[150px]"
              >
                <option value="">সব লিঙ্গ</option>
                <option value="1">পুরুষ</option>
                <option value="2">মহিলা</option>
              </select>

              <select
                value={selectedAcademicDivision}
                onChange={(event) => setSelectedAcademicDivision(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[210px]"
              >
                <option value="">সব একাডেমিক বিভাগ</option>

                {divisions.map((division) => (
                  <option key={division.division_id} value={division.division_id}>
                    {division.division_name_bn}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => setBulkUpdateOpen(true)}
                className="h-9 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/40"
              >
                বাল্ক আপডেট
              </button>

              <ColumnVisibilityMenu
                columns={TEACHER_COLUMNS}
                visible={visibleColumns}
                onToggle={toggleColumn}
                onReset={resetColumns}
                order={columnOrder}
                onMove={moveColumn}
              />

              <DataExportPrintActions
                title="শিক্ষক তালিকা"
                fileName="teacher-list"
                columns={exportColumns}
                data={exportTeachers}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {loading ? (
            <SkeletonTable rows={8} columns={2 + visibleColumns.size} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] border-collapse text-center">
                <thead className="bg-blue-800 text-sm text-white">
                  <tr>
                    <th className="border p-2.5 dark:border-slate-700">নাম</th>
                    {orderedVisibleColumns.map((key) => (
                      <th key={key} className="border p-2.5 dark:border-slate-700">
                        {TEACHER_COLUMN_LABEL_MAP.get(key)}
                      </th>
                    ))}
                    <th className="border p-2.5 dark:border-slate-700">একশন</th>
                  </tr>
                </thead>

                <tbody className="text-sm">
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={2 + visibleColumns.size} className="p-6 text-center text-gray-500 dark:text-slate-400">
                        কোন শিক্ষক পাওয়া যায়নি
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((teacher) => (
                      <tr key={teacher.id} className="border-t transition hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        <td className="border p-2.5 dark:border-slate-700">{teacher.name_bn || teacher.name || "নেই"}</td>

                        {orderedVisibleColumns.map((key) => (
                          <td key={key} className="border p-2.5 dark:border-slate-700">
                            {columnValueGetters[key](teacher)}
                          </td>
                        ))}

                        <td className="border p-2.5 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => navigate(`${adminBase}/ihtemam/${teacher.id}`)}
                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-green-700"
                          >
                            দেখুন
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <BulkUpdateModal
        open={bulkUpdateOpen}
        teachers={filteredTeachers as unknown as TeacherFullRecord[]}
        divisions={divisions}
        onClose={() => setBulkUpdateOpen(false)}
        onSuccess={loadTeachers}
      />
    </div>
  );
};

export default TeacherListPage;
