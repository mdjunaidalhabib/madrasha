import { BulkImportModal, BulkImportPreview, BulkImportUploadSteps } from "../common/BulkImport";
import { commonText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { teacherStaffText } from "../../features/teachers/teacherStaff.text";

export interface ExcelTeacherRow {
  name_bn?: string;
  name?: string;
  name_ar?: string;
  name_en?: string;
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
  father_name_en?: string;
  father_nid?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_name_ar?: string;
  mother_name_en?: string;
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
  const t = useText(teacherStaffText);
  const c = useText(commonText);
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

  const f = t.fields;
  const previewColumns = [
    c.serial,
    t.nameBnShort,
    f.name_ar,
    f.nid,
    f.gender,
    f.dob,
    f.age,
    f.phone,
    f.email,
    f.designation,
    f.academic_division,
    f.qualification,
    f.experience_year,
    f.experience_month,
    f.joining_date,
    f.salary,
    f.father_name,
    f.father_name_ar,
    f.father_nid,
    f.father_occupation,
    f.mother_name,
    f.mother_nid,
    f.mother_occupation,
    f.parent_phone,
    f.division,
    f.district,
    f.thana,
    f.village,
    f.image,
  ];

  return (
    <BulkImportModal
      title={t.bulkTeacherUpload}
      subtitle={t.bulkTeacherUploadHint}
      compact={excelTeachers.length === 0}
      loading={loading}
      onClose={onClose}
      onSubmit={excelTeachers.length > 0 ? onSubmit : undefined}
      submitLabel={loading ? t.submitting : t.submitAllTeachers}
    >
      {excelTeachers.length === 0 && (
        <BulkImportUploadSteps<ExcelTeacherRow>
          templateLabel={t.stepTemplate}
          uploadLabel={t.stepUpload}
          hints={[t.requiredFieldsHint, t.genderHint(t.male, t.female), t.requiredColumnsHint]}
          downloadLabel={t.downloadTemplate}
          buttonText={t.uploadTeacherExcel}
          loading={loading}
          requiredColumns={requiredColumns}
          onDownloadTemplate={onDownloadTemplate}
          onDataUpload={onDataUpload}
        />
      )}

      {excelTeachers.length > 0 && (
        <BulkImportPreview
          title={t.previewTeachers}
          subtitle={t.totalFound(localizeDigits(excelTeachers.length, lang))}
          clearLabel={t.clearUploaded}
          loading={loading}
          onClear={onClear}
        >
          <table className="min-w-[2200px] w-full text-xs sm:text-sm">
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
              {excelTeachers.map((teacher, index) => (
                <tr
                  key={index}
                  className="border-b transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">{index + 1}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3 font-semibold text-slate-900 dark:text-slate-100">
                    {teacher.name_bn || teacher.name || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.name_ar || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.nid || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {getGenderName(teacher.gender)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.dob || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.age || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.phone || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.email || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.designation || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {getDivisionName(teacher.academic_division)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.qualification || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.experience_year || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.experience_month || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.joining_date || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.salary || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.father_name || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.father_name_ar || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.father_nid || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.father_occupation || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.mother_name || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.mother_nid || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.mother_occupation || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.parent_phone || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.division || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.district || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.thana || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.village || "-"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 sm:px-3 sm:py-3">
                    {teacher.image ? t.uploaded : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </BulkImportPreview>
      )}
    </BulkImportModal>
  );
};

export default BulkTeacherUploadModal;
