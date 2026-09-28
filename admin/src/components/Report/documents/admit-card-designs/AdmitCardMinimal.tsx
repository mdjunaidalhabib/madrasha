import { printCell } from "../../printFormat";
import { usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText } from "../../report.text";
import { renderTemplateText } from "@madrasha/shared-ui/src/utils/documentTemplates";

type Props = {
  row: Record<string, any>;
  madrasaName: string;
  rulesTemplate: string;
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2 border-b border-slate-200 pb-1">
    <span className="font-semibold text-[#6f8c83]">{label}</span>
    <span className="text-end font-medium text-[#1c2a26]">{value}</span>
  </div>
);

const AdmitCardMinimal = ({ row, madrasaName, rulesTemplate }: Props) => {
  const t = usePrintText(reportText);
  return (
  <div className="print-page-break overflow-hidden rounded-lg border border-[#d7e4df] bg-white">
    <div className="h-1.5 w-full bg-[#1f6f5c]" />

    <div className="flex items-center justify-between border-b border-[#e3ebe8] px-5 py-3">
      <div>
        <span className="text-sm font-bold text-[#1c2a26]">{madrasaName || t.title.admitCard}</span>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#6f8c83]">Admit Card</p>
      </div>
      <span className="text-xs font-semibold text-[#1f6f5c]">{printCell(row, "exam_name")}</span>
    </div>

    <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-5 text-sm">
      <Field label={t.col.name} value={printCell(row, "student_name")} />
      <Field label={t.col.father} value={printCell(row, "father_name")} />
      <Field label={t.col.regNoFull} value={printCell(row, "registration_no")} />
      <Field label={t.col.rollNo} value={printCell(row, "roll")} />
      <Field label={t.col.class} value={printCell(row, "class_name")} />
      <Field label={t.col.division} value={printCell(row, "division_name")} />
      <Field label={t.col.sessionShort} value={printCell(row, "academic_year")} />
    </div>

    <div className="mx-5 mb-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">
      {renderTemplateText(rulesTemplate, row)}
    </div>

    <div className="flex justify-between border-t border-[#e3ebe8] px-5 py-3 text-xs font-semibold text-[#445a53]">
      <span>{t.sign.examController}</span>
      <span>{t.sign.head}</span>
    </div>
  </div>
);
};

export default AdmitCardMinimal;
