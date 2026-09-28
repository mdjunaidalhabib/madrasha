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
  <div className="flex justify-between gap-2 border-b border-dotted border-[#cdb96f] pb-1">
    <span className="font-bold text-[#6b5a2e]">{label}</span>
    <span className="text-end text-[#3c4f42]">{value}</span>
  </div>
);

const AdmitCardArch = ({ row, madrasaName, rulesTemplate }: Props) => {
  const t = usePrintText(reportText);
  return (
  <div className="print-page-break overflow-hidden rounded-lg border-2 border-[#1e5c3f] bg-[#f3ecd8] p-1.5">
    <div className="overflow-hidden rounded-[4px] border border-[#cdb96f]">
      <div className="bg-[#1e5c3f] px-5 py-3 text-center">
        {madrasaName && <p className="truncate text-xs font-bold text-[#f3ecd8]">{madrasaName}</p>}
        <h3 className="mt-0.5 text-lg font-bold text-[#f3ecd8]">{t.title.admitCard}</h3>
        <p className="text-xs text-[#cdb96f]">{printCell(row, "exam_name")}</p>
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

      <div className="mx-5 mb-4 whitespace-pre-line rounded-lg border border-[#cdb96f] bg-white/60 p-3 text-xs leading-6 text-[#3c4f42]">
        {renderTemplateText(rulesTemplate, row)}
      </div>

      <div className="flex justify-between bg-[#1e5c3f] px-5 py-3 text-xs font-semibold text-[#f3ecd8]">
        <span>{t.sign.examController}</span>
        <span>{t.sign.head}</span>
      </div>
    </div>
  </div>
);
};

export default AdmitCardArch;
