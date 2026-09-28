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
  <div className="flex justify-between gap-2 border-b border-dotted border-[#cbb98a] pb-1">
    <span className="text-[#55432c]">{label}</span>
    <b className="text-end text-[#7a1f2b]">{value}</b>
  </div>
);

const AdmitCardClassic = ({ row, madrasaName, rulesTemplate }: Props) => {
  const t = usePrintText(reportText);
  return (
  <div className="print-page-break overflow-hidden rounded-xl border border-[#d8cba3] bg-[#f7f2e6]">
    <div className="bg-gradient-to-r from-[#8a2632] to-[#6c1d27] px-5 py-3 text-center text-white">
      <p className="text-[10px] text-[#e9c98f]">بسم الله الرحمن الرحيم</p>
      {madrasaName && <p className="mt-0.5 text-xs font-semibold text-[#fbf1de]">{madrasaName}</p>}
      <h3 className="mt-1 text-lg font-bold">{t.title.admitCard}</h3>
      <p className="text-xs text-[#e9c98f]">{printCell(row, "exam_name")}</p>
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

    <div className="mx-5 mb-4 whitespace-pre-line rounded-lg border border-[#cbb98a] bg-white/70 p-3 text-xs leading-6 text-[#55432c]">
      {renderTemplateText(rulesTemplate, row)}
    </div>

    <div className="flex justify-between border-t border-[#cbb98a] bg-[#f1e7cf] px-5 py-3 text-xs font-semibold text-[#55432c]">
      <span>{t.sign.examController}</span>
      <span>{t.sign.head}</span>
    </div>
  </div>
);
};

export default AdmitCardClassic;
