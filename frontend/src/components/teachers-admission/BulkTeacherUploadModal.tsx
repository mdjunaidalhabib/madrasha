import ExcelUpload from "../common/ExcelUpload";

export interface ExcelTeacherRow {
  name_bn?: string;
  name?: string;
  name_ar?: string;
  nid?: string;
  gender?: string | number | null;
  dob?: string;
  age?: string | number;
  phone?: string | number;
  email?: string;
  designation?: string;
  academic_division?: string | number;
  qualification?: string;
  experience_year?: string | number;
  experience_month?: string | number;
  joining_date?: string;
  salary?: string | number;
  father_name?: string;
  father_name_ar?: string;
  father_nid?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_nid?: string;
  mother_occupation?: string;
  parent_phone?: string | number;
  division?: string;
  district?: string;
  thana?: string;
  village?: string;
  image?: string;
}

interface DivisionItem {
  division_id: number;
  division_name_bn: string;
}

interface BulkTeacherUploadModalProps {
  open: boolean;
  loading: boolean;
  excelTeachers: ExcelTeacherRow[];
  requiredColumns: string[];
  onClose: () => void;
  onDataUpload: (data: ExcelTeacherRow[]) => void;
  onClear: () => void;
  onSubmit: () => void;
  onDownloadTemplate: () => void;
  divisions: DivisionItem[];
}

const BulkTeacherUploadModal = ({
  open,
  loading,
  excelTeachers,
  requiredColumns,
  onClose,
  onDataUpload,
  onClear,
  onSubmit,
  onDownloadTemplate,
  divisions,
}: BulkTeacherUploadModalProps) => {
  if (!open) return null;

  const getGenderName = (gender: any) => {
    if (Number(gender) === 1) return "পুরুষ";
    if (Number(gender) === 2) return "মহিলা";
    return "-";
  };

  const getDivisionName = (id: any) => {
    const division = divisions.find((d) => d.division_id == id);
    return division?.division_name_bn || id || "-";
  };

  const previewColumns = [
    "SL",
    "Name BN",
    "Arabic Name",
    "NID",
    "Gender",
    "DOB",
    "Age",
    "Phone",
    "Email",
    "Designation",
    "Academic Division",
    "Qualification",
    "Experience Year",
    "Experience Month",
    "Joining Date",
    "Salary",
    "Father Name",
    "Father Arabic Name",
    "Father NID",
    "Father Occupation",
    "Mother Name",
    "Mother NID",
    "Mother Occupation",
    "Parent Phone",
    "Division",
    "District",
    "Thana",
    "Village",
    "Image",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Bulk Teacher Upload</h2>
            <p className="text-sm text-slate-500">Excel file upload করে একসাথে teacher add করুন</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            ×
          </button>
        </div>

        <div className="max-h-[82vh] overflow-y-auto p-6">
          {excelTeachers.length === 0 && (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">Upload Excel Sheet</h3>
                  <p className="text-xs text-slate-500">
                    Required fields template-এ red color এবং * mark থাকবে
                  </p>
                  <p className="text-xs text-slate-500">Gender: 1 = পুরুষ, 2 = মহিলা</p>
                  <p className="text-xs text-slate-500">
                    Required columns: name_bn, academic_division
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onDownloadTemplate}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  Download Template
                </button>
              </div>

              <ExcelUpload<ExcelTeacherRow>
                buttonText="Upload Teacher Excel"
                onDataUpload={onDataUpload}
                disabled={loading}
                requiredColumns={requiredColumns}
              />
            </>
          )}

          {excelTeachers.length > 0 && (
            <div>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Preview Teachers</h3>
                  <p className="text-sm text-slate-500">
                    Total {excelTeachers.length} teacher found
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Clear Uploaded Data
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-[2200px] w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100">
                      <tr>
                        {previewColumns.map((head) => (
                          <th
                            key={head}
                            className="whitespace-nowrap border-b px-3 py-3 text-left font-bold text-slate-700"
                          >
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {excelTeachers.map((teacher, index) => (
                        <tr key={index} className="border-b transition hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-3">{index + 1}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">
                            {teacher.name_bn || teacher.name || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">{teacher.name_ar || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{teacher.nid || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {getGenderName(teacher.gender)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">{teacher.dob || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{teacher.age || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{teacher.phone || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{teacher.email || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.designation || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {getDivisionName(teacher.academic_division)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.qualification || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.experience_year || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.experience_month || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.joining_date || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">{teacher.salary || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.father_name || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.father_name_ar || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.father_nid || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.father_occupation || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.mother_name || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.mother_nid || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.mother_occupation || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.parent_phone || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">{teacher.division || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{teacher.district || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{teacher.thana || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{teacher.village || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {teacher.image ? "Uploaded" : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                type="button"
                onClick={onSubmit}
                disabled={loading}
                className="mt-5 w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {loading ? "Submitting..." : "Submit All Teachers"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkTeacherUploadModal;
