import ExcelUpload from "../common/ExcelUpload";
import { useText, commonText, useIsMadrasa } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "./admission.text";

export interface ExcelAdmissionRow {
  name_bn?: string;
  name?: string;
  arabic_name?: string;
  name_en?: string;
  nid?: string;
  gender?: string | number | null;
  dob?: string;
  academic_year?: string | number;
  academic_division?: string | number;
  previous_class?: string | number;
  current_class?: string | number;
  class_id?: string | number;
  guardian_phone?: string | number;
  parent_phone?: string | number;
  father_name?: string;
  father_arabic_name?: string;
  father_name_en?: string;
  father_nid?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_arabic_name?: string;
  mother_name_en?: string;
  mother_nid?: string;
  mother_occupation?: string;
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

interface ClassItem {
  class_id: number;
  class_name_bn: string;
}

export interface BulkAdmissionResultRow {
  row: number;
  action: "create" | "update";
  id: number;
  nid: string | null;
  name: string;
  previousAcademicYear: string | null;
  academicYear: string;
  roll: number;
  registrationNo: number;
  changes: Array<{ field: string; old: unknown; new: unknown }>;
}

export interface BulkAdmissionResultData {
  inserted: number;
  updated: number;
  preview: BulkAdmissionResultRow[];
}

interface BulkAdmissionModalProps {
  open: boolean;
  loading: boolean;
  excelStudents: ExcelAdmissionRow[];
  requiredColumns: string[];
  divisions: DivisionItem[];
  classes: ClassItem[];
  result: BulkAdmissionResultData | null;
  onClose: () => void;
  onDataUpload: (data: ExcelAdmissionRow[]) => void;
  onClear: () => void;
  onSubmit: () => void;
  onDownloadTemplate: () => void;
}

const BulkAdmissionModal = ({
  open,
  loading,
  excelStudents,
  requiredColumns,
  divisions,
  classes,
  result,
  onClose,
  onDataUpload,
  onClear,
  onSubmit,
  onDownloadTemplate,
}: BulkAdmissionModalProps) => {
  const t = useText(admissionText);
  const c = useText(commonText);
  const isMadrasa = useIsMadrasa();
  if (!open) return null;

  const getGenderName = (gender: any) => {
    if (Number(gender) === 1) return t.male;
    if (Number(gender) === 2) return t.female;
    return "-";
  };

  const getDivisionName = (id: any) => {
    const division = divisions.find((d) => d.division_id == id);
    return division?.division_name_bn || id || "-";
  };

  const getClassName = (id: any) => {
    const cls = classes.find((c) => c.class_id == id);
    return cls?.class_name_bn || id || "-";
  };

  // Arabic-name columns are madrasa-only (the cells below are gated the same way).
  const previewColumns = [
    c.serial,
    t.colNameBn,
    ...(isMadrasa ? [t.colArabicName] : []),
    t.colNid,
    t.gender,
    t.colDob,
    c.roll,
    t.session,
    t.colAcademicDivision,
    t.previousClass,
    t.currentClass,
    t.colGuardianPhone,
    c.fatherName,
    ...(isMadrasa ? [t.colFatherArabicName] : []),
    t.fatherNid,
    t.fatherOccupation,
    c.motherName,
    t.motherNid,
    t.motherOccupation,
    t.colDivision,
    t.colDistrict,
    t.colThana,
    t.village,
    c.photo,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t.bulkTitle}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t.bulkSubtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            ×
          </button>
        </div>

        <div className="max-h-[82vh] overflow-y-auto p-6">
          {result && (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {t.bulkDone}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t.newAdmissions}{" "}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">{result.inserted}</span> | {t.sessionUpdates}{" "}
                    <span className="font-semibold text-amber-700 dark:text-amber-400">{result.updated}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {t.uploadAnother}
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-[700px] w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                          {c.serial}
                        </th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                          {c.name}
                        </th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                          {t.registration}
                        </th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                          {t.colNid}
                        </th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                          {t.state}
                        </th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                          {t.session}
                        </th>
                        <th className="whitespace-nowrap border-b px-3 py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                          {c.roll}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {result.preview.map((row) => (
                        <tr key={row.row} className="border-b transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                          <td className="whitespace-nowrap px-3 py-3">{row.row}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                            {row.name || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700 dark:text-slate-300">
                            {row.registrationNo || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">{row.nid || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {row.action === "update" ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                                {t.sessionUpdateBadge}
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                                {t.newAdmissionBadge}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {row.action === "update" && row.previousAcademicYear ? (
                              <>
                                <span className="text-slate-400 line-through dark:text-slate-500">
                                  {row.previousAcademicYear}
                                </span>{" "}
                                → <span className="font-semibold">{row.academicYear}</span>
                              </>
                            ) : (
                              <span className="font-semibold">{row.academicYear}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-blue-700 dark:text-blue-400">
                            {row.roll}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!result && excelStudents.length === 0 && (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t.uploadExcelSheet}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.requiredFieldsHint}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.genderHint}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.idHint}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onDownloadTemplate}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  {t.downloadTemplate}
                </button>
              </div>

              <ExcelUpload<ExcelAdmissionRow>
                buttonText={t.uploadAdmissionExcel}
                onDataUpload={onDataUpload}
                disabled={loading}
                requiredColumns={requiredColumns}
              />
            </>
          )}

          {!result && excelStudents.length > 0 && (
            <div>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.previewStudents}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t.studentsFound(String(excelStudents.length))}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  {t.clearUploaded}
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-[1800px] w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                      <tr>
                        {previewColumns.map((head) => (
                          <th
                            key={head}
                            className="whitespace-nowrap border-b px-3 py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300"
                          >
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {excelStudents.map((student, index) => {
                        const currentClassId = student.class_id || student.current_class;

                        return (
                          <tr key={index} className="border-b transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                            <td className="whitespace-nowrap px-3 py-3">{index + 1}</td>

                            <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                              {student.name_bn || student.name || "-"}
                            </td>

                            {isMadrasa && (
                              <td className="whitespace-nowrap px-3 py-3">
                                {student.arabic_name || "-"}
                              </td>
                            )}

                            <td className="whitespace-nowrap px-3 py-3">{student.nid || "-"}</td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {getGenderName(student.gender)}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">{student.dob || "-"}</td>

                            <td className="whitespace-nowrap px-3 py-3 font-semibold text-blue-700">
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                                {t.auto}
                              </span>
                            </td>

                            <td className="whitespace-nowrap px-3 py-3 font-semibold text-amber-700">
                              {student.academic_year || "-"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {getDivisionName(student.academic_division)}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {getClassName(student.previous_class)}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {getClassName(currentClassId)}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {student.guardian_phone || student.parent_phone || "-"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {student.father_name || "-"}
                            </td>

                            {isMadrasa && (
                              <td className="whitespace-nowrap px-3 py-3">
                                {student.father_arabic_name || "-"}
                              </td>
                            )}

                            <td className="whitespace-nowrap px-3 py-3">
                              {student.father_nid || "-"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {student.father_occupation || "-"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {student.mother_name || "-"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {student.mother_nid || "-"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {student.mother_occupation || "-"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {student.division || "-"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {student.district || "-"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">{student.thana || "-"}</td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {student.village || "-"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              {student.image ? t.uploaded : "-"}
                            </td>
                          </tr>
                        );
                      })}
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
                {loading ? t.submitting : t.submitAll}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkAdmissionModal;
