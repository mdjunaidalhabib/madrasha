import { printCell } from "../../printFormat";
import { usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText } from "../../report.text";
import { renderTemplateText } from "@madrasha/shared-ui/src/utils/documentTemplates";

type Props = {
  row: Record<string, any>;
  rulesTemplate: string;
  backgroundImage: string;
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2 border-b border-slate-200 pb-1">
    <span className="font-semibold text-slate-600">{label}</span>
    <span className="text-end font-medium text-slate-900">{value}</span>
  </div>
);

const AdmitCardCustom = ({ row, rulesTemplate, backgroundImage }: Props) => {
  const t = usePrintText(reportText);
  return (
  <div
    className="print-page-break overflow-hidden rounded-xl border border-slate-300 bg-slate-100 bg-cover bg-center p-5"
    style={{ backgroundImage: `url(${backgroundImage})` }}
  >
    <div className="rounded-lg bg-white/88 p-5">
      <div className="mb-3 text-center">
        <h3 className="text-lg font-bold text-slate-900">{t.title.admitCard}</h3>
        <p className="text-xs text-slate-600">{printCell(row, "exam_name")}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Field label={t.col.name} value={printCell(row, "student_name")} />
        <Field label={t.col.father} value={printCell(row, "father_name")} />
        <Field label={t.col.regNoFull} value={printCell(row, "registration_no")} />
        <Field label={t.col.rollNo} value={printCell(row, "roll")} />
        <Field label={t.col.class} value={printCell(row, "class_name")} />
        <Field label={t.col.division} value={printCell(row, "division_name")} />
        <Field label={t.col.sessionShort} value={printCell(row, "academic_year")} />
      </div>

      <div className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">
        {renderTemplateText(rulesTemplate, row)}
      </div>

      <div className="mt-4 flex justify-between text-xs font-semibold text-slate-700">
        <span>{t.sign.examController}</span>
        <span>{t.sign.head}</span>
      </div>
    </div>
  </div>
);
};

export default AdmitCardCustom;
