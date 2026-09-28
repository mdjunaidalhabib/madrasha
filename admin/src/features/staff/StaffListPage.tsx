import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cachedGet } from "../../services/api";
import DataExportPrintActions from "../../components/common/DataExportPrintActions";
import ColumnVisibilityMenu from "../../components/common/ColumnVisibilityMenu";
import { useAuthStore } from "../../store/authStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useColumnVisibility, type ColumnOption } from "../../hooks/useColumnVisibility";
import { commonText, getText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { orNoneText, teacherStaffColumn, teacherStaffColumnLabel, teacherStaffText } from "../teachers/teacherStaff.text";
import { filterPeopleBySearch } from "../../utils/personSearch";

type StaffColumnKey =
  | "registration"
  | "phone"
  | "gender"
  | "designation"
  | "department"
  | "qualification"
  | "nameAr"
  | "nid"
  | "dob"
  | "age"
  | "email"
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

const DEFAULT_VISIBLE_STAFF_COLUMNS: StaffColumnKey[] = [
  "registration",
  "phone",
  "gender",
  "designation",
  "department",
  "qualification",
];

const STAFF_COLUMNS: ColumnOption<StaffColumnKey>[] = [
  teacherStaffColumn("registration"),
  teacherStaffColumn("phone"),
  teacherStaffColumn("gender"),
  teacherStaffColumn("designation"),
  teacherStaffColumn("department"),
  teacherStaffColumn("qualification"),
  teacherStaffColumn("nameAr"),
  teacherStaffColumn("nid"),
  teacherStaffColumn("dob"),
  teacherStaffColumn("age"),
  teacherStaffColumn("email"),
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
const STAFF_COLUMN_KEYS = STAFF_COLUMNS.map((c) => c.key);

const orNone = orNoneText;

type Staff = {
  id: number | string;
  registration_no?: number | string;
  name_bn?: string;
  name?: string;
  phone?: string;
  gender?: number | string;
  designation?: string;
  department?: string;
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

const StaffListPage = () => {
  const navigate = useNavigate();
  const t = useText(teacherStaffText);
  const c = useText(commonText);
  const lang = useLang();
  const madrasaSlug = useAuthStore((s) => s.madrasaSlug) || "";

  const [staffList, setStaffList] = useState<Staff[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedGender, setSelectedGender] = useState("");

  const {
    visible: visibleColumns,
    order: columnOrder,
    toggle: toggleColumn,
    reset: resetColumns,
    move: moveColumn,
  } = useColumnVisibility<StaffColumnKey>(
    `staff-list-columns:${madrasaSlug}`,
    STAFF_COLUMN_KEYS,
    DEFAULT_VISIBLE_STAFF_COLUMNS,
  );

  const normalizeArray = (payload: any) => {
    const data = payload?.data?.data || payload?.data?.result || payload?.data || [];
    return Array.isArray(data) ? data : [];
  };

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await cachedGet("/staff");
      setStaffList(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD STAFF ERROR:", err);
      setStaffList([]);
      setError(getText(teacherStaffText).loadStaffFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const getGenderName = (gender?: number | string) => {
    if (Number(gender) === 1 || gender === "male") return t.male;
    if (Number(gender) === 2 || gender === "female") return t.female;
    return t.none;
  };

  const columnValueGetters: Record<StaffColumnKey, (s: Staff) => string> = {
    registration: (s) => orNone(s.registration_no),
    phone: (s) => orNone(s.phone),
    gender: (s) => getGenderName(s.gender),
    designation: (s) => orNone(s.designation),
    department: (s) => orNone(s.department),
    qualification: (s) => orNone(s.qualification),
    nameAr: (s) => orNone(s.name_ar),
    nid: (s) => orNone(s.nid),
    dob: (s) => orNone(s.dob),
    age: (s) => orNone(s.age),
    email: (s) => orNone(s.email),
    experienceYear: (s) => orNone(s.experience_year),
    experienceMonth: (s) => orNone(s.experience_month),
    joiningDate: (s) => orNone(s.joining_date),
    salary: (s) => orNone(s.salary),
    fatherName: (s) => orNone(s.father_name),
    fatherNameAr: (s) => orNone(s.father_name_ar),
    fatherNid: (s) => orNone(s.father_nid),
    fatherOccupation: (s) => orNone(s.father_occupation),
    motherName: (s) => orNone(s.mother_name),
    motherNid: (s) => orNone(s.mother_nid),
    motherOccupation: (s) => orNone(s.mother_occupation),
    parentPhone: (s) => orNone(s.parent_phone),
    addressDivision: (s) => orNone(s.division),
    district: (s) => orNone(s.district),
    thana: (s) => orNone(s.thana),
    village: (s) => orNone(s.village),
  };

  const orderedVisibleColumns = columnOrder.filter((key) => visibleColumns.has(key));

  const filteredStaff = useMemo(() => {
    const searched = filterPeopleBySearch(staffList, search, (s) => ({
      text: [s.name_bn, s.name, s.designation],
      registrationNo: s.registration_no,
      phones: [s.phone, s.parent_phone],
    }));

    return searched.filter((s) => !selectedGender || String(s.gender) === String(selectedGender));
  }, [staffList, search, selectedGender]);

  const exportStaff = useMemo(() => {
    return filteredStaff.map((s) => ({
      id: s.registration_no || "",
      name: s.name_bn || s.name || t.none,
      phone: s.phone || t.none,
      gender: getGenderName(s.gender),
      designation: s.designation || t.none,
      department: s.department || t.none,
      qualification: s.qualification || t.none,
      salary: s.salary || t.none,
    }));
  }, [filteredStaff, t]);

  const exportColumns = [
    { header: t.fields.registration_no, key: "id" },
    { header: c.name, key: "name" },
    { header: t.fields.mobile, key: "phone" },
    { header: t.fields.gender, key: "gender" },
    { header: t.fields.designation, key: "designation" },
    { header: t.fields.department, key: "department" },
    { header: t.fields.qualification, key: "qualification" },
    { header: t.fields.salary, key: "salary" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">{t.staffList}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t.totalStaff(localizeDigits(filteredStaff.length, lang))}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(`/teacher_staff/staff_admission`)}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              {t.addStaff}
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
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 lg:justify-end">
              <ColumnVisibilityMenu
                columns={STAFF_COLUMNS}
                visible={visibleColumns}
                onToggle={toggleColumn}
                onReset={resetColumns}
                order={columnOrder}
                onMove={moveColumn}
              />

              <DataExportPrintActions
                title={t.staffList}
                fileName="staff-list"
                columns={exportColumns}
                data={exportStaff}
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
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={2 + visibleColumns.size} className="p-6 text-center text-gray-500 dark:text-slate-400">
                        {t.noStaffFound}
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((s) => (
                      <tr key={s.id} className="border-t transition hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        <td className="border p-2.5 dark:border-slate-700">{s.name_bn || s.name || t.none}</td>

                        {orderedVisibleColumns.map((key) => (
                          <td key={key} className="border p-2.5 dark:border-slate-700">
                            {columnValueGetters[key](s)}
                          </td>
                        ))}

                        <td className="border p-2.5 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => navigate(`/teacher_staff/staff/${s.id}`)}
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
    </div>
  );
};

export default StaffListPage;
