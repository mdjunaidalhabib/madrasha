import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import DataExportPrintActions from "../../components/common/DataExportPrintActions";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { logger } from "../../utils/logger";

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
};

const TeacherListPage = () => {
  const navigate = useNavigate();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedAcademicDivision, setSelectedAcademicDivision] = useState("");

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

      const res = await api.get("/teachers");
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
      const res = await api.get("/madrasa-divisions");
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
    return filteredTeachers.map((teacher, index) => ({
      serial: index + 1,
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
    { header: "ক্রমিক", key: "serial" },
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">শিক্ষক তালিকা</h1>
            <p className="mt-1 text-sm text-gray-500">মোট শিক্ষক: {filteredTeachers.length} জন</p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`${adminBase}/ihtemam/teacher_admission`)}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            + নতুন শিক্ষক যোগ করুন
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="ID, নাম, ফোন বা পদবি দিয়ে সার্চ করুন"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[260px]"
              />

              <select
                value={selectedGender}
                onChange={(event) => setSelectedGender(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[150px]"
              >
                <option value="">সব লিঙ্গ</option>
                <option value="1">পুরুষ</option>
                <option value="2">মহিলা</option>
              </select>

              <select
                value={selectedAcademicDivision}
                onChange={(event) => setSelectedAcademicDivision(event.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 sm:w-[210px]"
              >
                <option value="">সব একাডেমিক বিভাগ</option>

                {divisions.map((division) => (
                  <option key={division.division_id} value={division.division_id}>
                    {division.division_name_bn}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex shrink-0 justify-start lg:justify-end">
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
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">লোড হচ্ছে...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] border-collapse text-center">
                <thead className="bg-blue-800 text-sm text-white">
                  <tr>
                    <th className="border p-2.5">রেজিস্ট্রেশন নং</th>
                    <th className="border p-2.5">নাম</th>
                    <th className="border p-2.5">মোবাইল</th>
                    <th className="border p-2.5">লিঙ্গ</th>
                    <th className="border p-2.5">পদবি</th>
                    <th className="border p-2.5">একাডেমিক বিভাগ</th>
                    <th className="border p-2.5">যোগ্যতা</th>
                    <th className="border p-2.5">একশন</th>
                  </tr>
                </thead>

                <tbody className="text-sm">
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-500">
                        কোন শিক্ষক পাওয়া যায়নি
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((teacher) => (
                      <tr key={teacher.id} className="border-t transition hover:bg-gray-50">
                        <td className="border p-2.5">{teacher.registration_no ?? "নেই"}</td>

                        <td className="border p-2.5">{teacher.name_bn || teacher.name || "নেই"}</td>

                        <td className="border p-2.5">{teacher.phone || "নেই"}</td>

                        <td className="border p-2.5">{getGenderName(teacher.gender)}</td>

                        <td className="border p-2.5">{teacher.designation || "নেই"}</td>

                        <td className="border p-2.5">
                          {getDivisionName(getAcademicDivisionId(teacher))}
                        </td>

                        <td className="border p-2.5">{teacher.qualification || "নেই"}</td>

                        <td className="border p-2.5">
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
    </div>
  );
};

export default TeacherListPage;
