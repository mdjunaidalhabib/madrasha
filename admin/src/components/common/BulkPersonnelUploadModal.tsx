import { BulkImportWizard, BulkImportStatus, type BulkImportColumn } from "./BulkImport";
import {
  commonText,
  localizeDigits,
  useLang,
  useText,
  useIsMadrasa,
} from "@madrasha/shared-ui/src/i18n";
import { teacherStaffText } from "../../features/teachers/teacherStaff.text";
import { bulkImportText } from "./bulkImport.text";

export interface ExcelPersonnelRow {
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
  department?: string;
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

export interface BulkPersonnelResultRow {
  row: number;
  id: number;
  action: "create" | "update";
  nid: string | null;
  name: string;
}
export interface BulkPersonnelResult {
  inserted: number;
  updated: number;
  preview: BulkPersonnelResultRow[];
}
interface Props {
  open: boolean;
  loading: boolean;
  kind?: "teacher" | "staff";
  excelTeachers: ExcelPersonnelRow[];
  result: BulkPersonnelResult | null;
  requiredColumns: string[];
  divisions?: { division_id: number; division_name_bn: string }[];
  onClose: () => void;
  onClear: () => void;
  onSubmit: () => void;
  onDataUpload: (rows: ExcelPersonnelRow[]) => void;
  onDownloadTemplate: () => void;
}
export default function BulkPersonnelUploadModal({
  open,
  loading,
  kind = "teacher",
  excelTeachers: rows,
  result,
  requiredColumns,
  divisions = [],
  onClose,
  onClear,
  onSubmit,
  onDataUpload,
  onDownloadTemplate,
}: Props) {
  const t = useText(teacherStaffText);
  const c = useText(commonText);
  const b = useText(bulkImportText);
  const lang = useLang();
  const isMadrasa = useIsMadrasa();
  const staff = kind === "staff";
  const f = t.fields;
  const field = (
    key: keyof ExcelPersonnelRow,
    label: string,
  ): BulkImportColumn<ExcelPersonnelRow> => ({ key, label, render: (row) => row[key] || "-" });
  const columns: BulkImportColumn<ExcelPersonnelRow>[] = [
    { key: "serial", label: c.serial, render: (_, index) => index + 1 },
    {
      key: "name",
      label: t.nameBnShort,
      render: (row) => row.name_bn || row.name || "-",
      emphasis: true,
    },
    ...(isMadrasa ? [field("name_ar", f.name_ar)] : []),
    field("nid", f.nid),
    {
      key: "gender",
      label: f.gender,
      render: (row) =>
        Number(row.gender) === 1 ? t.male : Number(row.gender) === 2 ? t.female : "-",
    },
    field("dob", f.dob),
    field("age", f.age),
    field("phone", f.phone),
    field("email", f.email),
    field("designation", f.designation),
    ...(staff
      ? [field("department", f.department)]
      : [
          {
            key: "academic_division",
            label: f.academic_division,
            render: (row: ExcelPersonnelRow) =>
              divisions.find((d) => d.division_id == row.academic_division)?.division_name_bn ||
              row.academic_division ||
              "-",
          },
        ]),
    field("qualification", f.qualification),
    field("experience_year", f.experience_year),
    field("experience_month", f.experience_month),
    field("joining_date", f.joining_date),
    field("salary", f.salary),
    field("father_name", f.father_name),
    ...(isMadrasa ? [field("father_name_ar", f.father_name_ar)] : []),
    field("father_nid", f.father_nid),
    field("father_occupation", f.father_occupation),
    field("mother_name", f.mother_name),
    field("mother_nid", f.mother_nid),
    field("mother_occupation", f.mother_occupation),
    field("parent_phone", f.parent_phone),
    field("division", f.division),
    field("district", f.district),
    field("thana", f.thana),
    field("village", f.village),
    { key: "image", label: f.image, render: (row) => (row.image ? t.uploaded : "-") },
  ];
  const resultColumns: BulkImportColumn<BulkPersonnelResultRow>[] = [
    { key: "serial", label: c.serial, render: (row) => row.row },
    { key: "name", label: c.name, render: (row) => row.name || "-", emphasis: true },
    { key: "nid", label: f.nid, render: (row) => row.nid || "-" },
    {
      key: "state",
      label: b.state,
      render: (row) => (
        <BulkImportStatus updated={row.action === "update"}>
          {row.action === "update" ? b.updatedBadge : b.createdBadge}
        </BulkImportStatus>
      ),
    },
  ];
  return (
    <BulkImportWizard
      open={open}
      loading={loading}
      title={staff ? b.staffTitle : t.bulkTeacherUpload}
      subtitle={staff ? b.staffSubtitle : t.bulkTeacherUploadHint}
      rows={rows}
      columns={columns}
      previewTitle={staff ? b.staffPreview : t.previewTeachers}
      previewSubtitle={t.totalFound(localizeDigits(rows.length, lang))}
      clearLabel={t.clearUploaded}
      submitLabel={loading ? t.submitting : staff ? b.staffSubmit : t.submitAllTeachers}
      upload={{
        templateLabel: t.stepTemplate,
        uploadLabel: t.stepUpload,
        hints: [
          t.requiredFieldsHint,
          t.genderHint(t.male, t.female),
          ...(staff ? [] : [t.requiredColumnsHint]),
        ],
        downloadLabel: t.downloadTemplate,
        buttonText: staff ? b.staffUpload : t.uploadTeacherExcel,
        requiredColumns,
      }}
      result={
        result
          ? {
              title: b.done,
              inserted: result.inserted,
              updated: result.updated,
              insertedLabel: b.inserted,
              updatedLabel: b.updated,
              uploadAnotherLabel: b.uploadAnother,
              rows: result.preview,
              columns: resultColumns,
            }
          : null
      }
      onClose={onClose}
      onClear={onClear}
      onSubmit={onSubmit}
      onDataUpload={onDataUpload}
      onDownloadTemplate={onDownloadTemplate}
    />
  );
}
