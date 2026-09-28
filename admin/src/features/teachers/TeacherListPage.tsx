import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import DataExportPrintActions from "../../components/common/DataExportPrintActions";
import ColumnVisibilityMenu from "../../components/common/ColumnVisibilityMenu";
import BulkUpdateModal from "../../components/teachers/BulkUpdateModal";
import { useAuthStore } from "../../store/authStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { TeacherFullRecord } from "../../types/teacher";
import { filterPeopleBySearch } from "../../utils/personSearch";
import { useColumnVisibility, type ColumnOption } from "../../hooks/useColumnVisibility";
import { commonText, getText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { orNoneText, teacherStaffColumn, teacherStaffColumnLabel, teacherStaffText } from "./teacherStaff.text";

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
  teacherStaffColumn("registration"),
  teacherStaffColumn("phone"),
  teacherStaffColumn("gender"),
  teacherStaffColumn("designation"),
  teacherStaffColumn("academicDivision"),
  teacherStaffColumn("qualification"),
  teacherStaffColumn("nameAr"),
  teacherStaffColumn("nid"),
  teacherStaffColumn("dob"),
  teacherStaffColumn("age"),
  teacherStaffColumn("email"),
  teacherStaffColumn("department"),
  teacherStaffColumn("experienceYear"),
  teacherStaffColumn("experienceMonth"),
  teacherStaffColumn("joiningDate"),
  teacherStaffColumn("salary"),
  teacherStaffColumn("fatherName"),
  teacherStaffColumn("fatherNameAr"),
  teacherStaffColumn("fatherNid"),
  teacherStaffColumn("fatherOccupation"),
  teacherStaffColumn("motherName"),
  teacherStaffColumn("motherNid"),
  teacherStaffColumn("motherOccupation"),
  teacherStaffColumn("parentPhone"),
  teacherStaffColumn("addressDivision"),
  teacherStaffColumn("district"),
  teacherStaffColumn("thana"),
  teacherStaffColumn("village"),
];
const TEACHER_COLUMN_KEYS = TEACHER_COLUMNS.map((c) => c.key);

const orNone = orNoneText;

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
  const t = useText(teacherStaffText);
  const c = useText(commonText);
  const lang = useLang();
  const madrasaSlug = useAuthStore((s) => s.madrasaSlug) || "";

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
      setError(getText(teacherStaffText).loadTeachersFailed);
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
    if (Number(gender) === 1 || gender === "male") return t.male;
    if (Number(gender) === 2 || gender === "female") return t.female;
    return t.none;
  };

  const getAcademicDivisionId = (teacher: Teacher) =>
    teacher.academic_division || teacher.division_id || teacher.department || "";

  const getDivisionName = useCallback(
    (divisionId?: number | string) => {
      const division = divisions.find((item) => String(item.division_id) === String(divisionId));

      return division?.division_name_bn || divisionId || t.none;
    },
    [divisions, t],
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
    const searched = filterPeopleBySearch(teachers, search, (teacher) => ({
      text: [teacher.name_bn, teacher.name, teacher.designation],
      registrationNo: teacher.registration_no,
      phones: [teacher.phone, teacher.parent_phone],
    }));

    return searched.filter((teacher) => {
      const matchGender = !selectedGender || String(teacher.gender) === String(selectedGender);
      const matchAcademicDivision =
        !selectedAcademicDivision ||
        String(getAcademicDivisionId(teacher)) === String(selectedAcademicDivision);
      return matchGender && matchAcademicDivision;
    });
  }, [teachers, search, selectedGender, selectedAcademicDivision]);

  const exportTeachers = useMemo(() => {
    return filteredTeachers.map((teacher) => ({
      id: teacher.registration_no || "",
      name: teacher.name_bn || teacher.name || t.none,
      phone: teacher.phone || t.none,
      gender: getGenderName(teacher.gender),
      designation: teacher.designation || t.none,
      academicDivision: getDivisionName(getAcademicDivisionId(teacher)),
      qualification: teacher.qualification || t.none,
      salary: teacher.salary || t.none,
    }));
  }, [filteredTeachers, getDivisionName, t]);

  const exportColumns = [
    { header: t.fields.registration_no, key: "id" },
    { header: c.name, key: "name" },
    { header: t.fields.mobile, key: "phone" },
    { header: t.fields.gender, key: "gender" },
    { header: t.fields.designation, key: "designation" },
    { header: t.fields.academic_division, key: "academicDivision" },
    { header: t.fields.qualification, key: "qualification" },
    { header: t.fields.salary, key: "salary" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">{t.teacherList}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t.totalTeachers(localizeDigits(filteredTeachers.length, lang))}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(`/teacher_staff/teacher_admission`)}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              {t.addTeacher}
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder={t.listSearchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[260px]"
              />

              <select
                value={selectedGender}
                onChange={(event) => setSelectedGender(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[150px]"
              >
                <option value="">{t.allGenders}</option>
                <option value="1">{t.male}</option>
                <option value="2">{t.female}</option>
              </select>

              <select
                value={selectedAcademicDivision}
                onChange={(event) => setSelectedAcademicDivision(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[210px]"
              >
                <option value="">{t.allAcademicDivisions}</option>

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
                {t.bulkUpdate}
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
                title={t.teacherList}
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
                    <th className="border p-2.5 dark:border-slate-700">{c.name}</th>
                    {orderedVisibleColumns.map((key) => (
                      <th key={key} className="border p-2.5 dark:border-slate-700">
                        {teacherStaffColumnLabel(key)}
                      </th>
                    ))}
                    <th className="border p-2.5 dark:border-slate-700">{c.actions}</th>
                  </tr>
                </thead>

                <tbody className="text-sm">
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={2 + visibleColumns.size} className="p-6 text-center text-gray-500 dark:text-slate-400">
                        {t.noTeacherFound}
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((teacher) => (
                      <tr key={teacher.id} className="border-t transition hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        <td className="border p-2.5 dark:border-slate-700">{teacher.name_bn || teacher.name || t.none}</td>

                        {orderedVisibleColumns.map((key) => (
                          <td key={key} className="border p-2.5 dark:border-slate-700">
                            {columnValueGetters[key](teacher)}
                          </td>
                        ))}

                        <td className="border p-2.5 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => navigate(`/teacher_staff/teacher/${teacher.id}`)}
                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-green-700"
                          >
                            {c.view}
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
