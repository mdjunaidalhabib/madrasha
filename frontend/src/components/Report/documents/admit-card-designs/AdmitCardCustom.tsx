import { cellValue } from "../../../../utils/reportUtils";
import { renderTemplateText } from "../../../../utils/documentTemplates";

type Props = {
  row: Record<string, any>;
  rulesTemplate: string;
  backgroundImage: string;
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2 border-b border-slate-200 pb-1">
    <span className="font-semibold text-slate-600">{label}</span>
    <span className="text-right font-medium text-slate-900">{value}</span>
  </div>
);

const AdmitCardCustom = ({ row, rulesTemplate, backgroundImage }: Props) => (
  <div
    className="print-page-break overflow-hidden rounded-xl border border-slate-300 bg-slate-100 bg-cover bg-center p-5"
    style={{ backgroundImage: `url(${backgroundImage})` }}
  >
    <div className="rounded-lg bg-white/88 p-5">
      <div className="mb-3 text-center">
        <h3 className="text-lg font-bold text-slate-900">প্রবেশপত্র</h3>
        <p className="text-xs text-slate-600">{cellValue(row, "exam_name")}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Field label="নাম" value={cellValue(row, "student_name")} />
        <Field label="পিতা" value={cellValue(row, "father_name")} />
        <Field label="রেজিস্ট্রেশন নম্বর" value={cellValue(row, "registration_no")} />
        <Field label="রোল নম্বর" value={cellValue(row, "roll")} />
        <Field label="শ্রেণি" value={cellValue(row, "class_name")} />
        <Field label="বিভাগ" value={cellValue(row, "division_name")} />
        <Field label="সেশন" value={cellValue(row, "academic_year")} />
      </div>

      <div className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">
        {renderTemplateText(rulesTemplate, row)}
      </div>

      <div className="mt-4 flex justify-between text-xs font-semibold text-slate-700">
        <span>পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর</span>
        <span>প্রধান শিক্ষকের স্বাক্ষর</span>
      </div>
    </div>
  </div>
);

export default AdmitCardCustom;
