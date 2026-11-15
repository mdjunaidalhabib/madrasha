import { BulkImportWizard, BulkImportStatus, type BulkImportColumn } from "../common/BulkImport";
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

  const field = (
    key: keyof ExcelAdmissionRow,
    label: string,
  ): BulkImportColumn<ExcelAdmissionRow> => ({
    key,
    label,
    render: (row) => row[key] || "-",
  });
  const columns: BulkImportColumn<ExcelAdmissionRow>[] = [
    { key: "serial", label: c.serial, render: (_, index) => index + 1 },
    {
      key: "name",
      label: t.colNameBn,
      render: (row) => row.name_bn || row.name || "-",
      emphasis: true,
    },
    ...(isMadrasa ? [field("arabic_name", t.colArabicName)] : []),
    field("nid", t.colNid),
    { key: "gender", label: t.gender, render: (row) => getGenderName(row.gender) },
    field("dob", t.colDob),
    field("academic_year", t.session),
    {
      key: "academic_division",
      label: t.colAcademicDivision,
      render: (row) => getDivisionName(row.academic_division),
    },
    {
      key: "previous_class",
      label: t.previousClass,
      render: (row) => getClassName(row.previous_class),
    },
    {
      key: "current_class",
      label: t.currentClass,
      render: (row) => getClassName(row.class_id || row.current_class),
    },
    {
      key: "guardian_phone",
      label: t.colGuardianPhone,
      render: (row) => row.guardian_phone || row.parent_phone || "-",
    },
    field("father_name", c.fatherName),
    ...(isMadrasa ? [field("father_arabic_name", t.colFatherArabicName)] : []),
    field("father_nid", t.fatherNid),
    field("father_occupation", t.fatherOccupation),
    field("mother_name", c.motherName),
    field("mother_nid", t.motherNid),
    field("mother_occupation", t.motherOccupation),
    field("division", t.colDivision),
    field("district", t.colDistrict),
    field("thana", t.colThana),
    field("village", t.village),
    { key: "image", label: c.photo, render: (row) => (row.image ? t.uploaded : "-") },
  ];
  const resultColumns: BulkImportColumn<BulkAdmissionResultRow>[] = [
    { key: "serial", label: c.serial, render: (row) => row.row },
    { key: "name", label: c.name, render: (row) => row.name || "-", emphasis: true },
    { key: "nid", label: t.colNid, render: (row) => row.nid || "-" },
    {
      key: "state",
      label: t.state,
      render: (row) => (
        <BulkImportStatus updated={row.action === "update"}>
          {row.action === "update" ? t.sessionUpdateBadge : t.newAdmissionBadge}
        </BulkImportStatus>
      ),
    },
    {
      key: "year",
      label: t.session,
      render: (row) =>
        row.action === "update" && row.previousAcademicYear ? (
          <>
            <del>{row.previousAcademicYear}</del>
            {" → "}
            {row.academicYear}
          </>
        ) : (
          row.academicYear
        ),
    },
  ];
  return (
    <BulkImportWizard
      open={open}
      loading={loading}
      title={t.bulkTitle}
      subtitle={t.bulkSubtitle}
      rows={excelStudents}
      columns={columns}
      previewTitle={t.previewStudents}
      previewSubtitle={t.studentsFound(localizeDigits(excelStudents.length, lang))}
      clearLabel={t.clearUploaded}
      submitLabel={loading ? t.submitting : t.submitAll}
      upload={{
        templateLabel: t.stepTemplate,
        uploadLabel: t.stepUpload,
        hints: [t.requiredFieldsHint, t.genderHint, t.idHint],
        downloadLabel: t.downloadTemplate,
        buttonText: t.uploadAdmissionExcel,
        requiredColumns,
      }}
      result={
        result
          ? {
              title: t.bulkDone,
              inserted: result.inserted,
              updated: result.updated,
              insertedLabel: t.newAdmissions,
              updatedLabel: t.sessionUpdates,
              notice: t.bulkAwaitingApproval,
              uploadAnotherLabel: t.uploadAnother,
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
};

export default BulkAdmissionModal;
