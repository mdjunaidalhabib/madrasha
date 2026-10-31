import { BulkImportModal, BulkImportPreview, BulkImportUploadSteps } from "../common/BulkImport";
import {
  useText,
  commonText,
  useIsMadrasa,
  useLang,
  localizeDigits,
} from "@madrasha/shared-ui/src/i18n";
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
  roll: number | null;
  registrationNo: number | null;
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
  const lang = useLang();
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

  // Upload step is a small dialog; it only widens once there's a table to show.
  const isUploadStep = !result && excelStudents.length === 0;

  return (
    <BulkImportModal
      title={t.bulkTitle}
      subtitle={t.bulkSubtitle}
      compact={isUploadStep}
      loading={loading}
      onClose={onClose}
      onSubmit={!result && excelStudents.length > 0 ? onSubmit : undefined}
      submitLabel={loading ? t.submitting : t.submitAll}
    >
      {result && (
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                {t.bulkDone}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t.newAdmissions}{" "}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {result.inserted}
                </span>{" "}
                | {t.sessionUpdates}{" "}
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {result.updated}
                </span>
              </p>
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                {t.bulkAwaitingApproval}
              </p>
            </div>

            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
            >
              {t.uploadAnother}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="max-h-[55dvh] overflow-auto sm:max-h-[420px]">
              <table className="min-w-[560px] w-full text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="whitespace-nowrap border-b px-2.5 py-2 sm:px-3 sm:py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                      {c.serial}
                    </th>
                    <th className="whitespace-nowrap border-b px-2.5 py-2 sm:px-3 sm:py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                      {c.name}
                    </th>
                    <th className="whitespace-nowrap border-b px-2.5 py-2 sm:px-3 sm:py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                      {t.colNid}
                    </th>
                    <th className="whitespace-nowrap border-b px-2.5 py-2 sm:px-3 sm:py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                      {t.state}
                    </th>
                    <th className="whitespace-nowrap border-b px-2.5 py-2 sm:px-3 sm:py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                      {t.session}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {result.preview.map((row) => (
                    <tr
                      key={row.row}
                      className="border-b transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">{row.row}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {row.name || "-"}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                        {row.nid || "-"}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
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
                      <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isUploadStep && (
        <BulkImportUploadSteps<ExcelAdmissionRow>
          templateLabel={t.stepTemplate}
          uploadLabel={t.stepUpload}
          hints={[t.requiredFieldsHint, t.genderHint, t.idHint]}
          downloadLabel={t.downloadTemplate}
          buttonText={t.uploadAdmissionExcel}
          loading={loading}
          requiredColumns={requiredColumns}
          onDownloadTemplate={onDownloadTemplate}
          onDataUpload={onDataUpload}
        />
      )}

      {!result && excelStudents.length > 0 && (
        <BulkImportPreview
          title={t.previewStudents}
          subtitle={t.studentsFound(localizeDigits(excelStudents.length, lang))}
          clearLabel={t.clearUploaded}
          loading={loading}
          onClear={onClear}
        >
          <table className="min-w-[1800px] w-full text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
              <tr>
                {previewColumns.map((head) => (
                  <th
                    key={head}
                    className="whitespace-nowrap border-b px-2.5 py-2 sm:px-3 sm:py-3 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300"
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
                  <tr
                    key={index}
                    className="border-b transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">{index + 1}</td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3 font-normal text-slate-900 dark:text-slate-100">
                      {student.name_bn || student.name || "-"}
                    </td>

                    {isMadrasa && (
                      <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                        {student.arabic_name || "-"}
                      </td>
                    )}

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.nid || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {getGenderName(student.gender)}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.dob || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3 font-semibold text-amber-700">
                      {student.academic_year || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {getDivisionName(student.academic_division)}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {getClassName(student.previous_class)}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {getClassName(currentClassId)}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.guardian_phone || student.parent_phone || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.father_name || "-"}
                    </td>

                    {isMadrasa && (
                      <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                        {student.father_arabic_name || "-"}
                      </td>
                    )}

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.father_nid || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.father_occupation || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.mother_name || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.mother_nid || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.mother_occupation || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.division || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.district || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.thana || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.village || "-"}
                    </td>

                    <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                      {student.image ? t.uploaded : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </BulkImportPreview>
      )}
    </BulkImportModal>
  );
};

export default BulkAdmissionModal;
