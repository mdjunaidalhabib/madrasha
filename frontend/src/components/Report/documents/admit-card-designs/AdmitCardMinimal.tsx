import { cellValue } from "../../../../utils/reportUtils";
import { renderTemplateText } from "../../../../utils/documentTemplates";

type Props = {
  row: Record<string, any>;
  madrasaName: string;
  rulesTemplate: string;
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2 border-b border-slate-200 pb-1">
    <span className="font-semibold text-[#6f8c83]">{label}</span>
    <span className="text-right font-medium text-[#1c2a26]">{value}</span>
  </div>
);

const AdmitCardMinimal = ({ row, madrasaName, rulesTemplate }: Props) => (
  <div className="print-page-break overflow-hidden rounded-lg border border-[#d7e4df] bg-white">
    <div className="h-1.5 w-full bg-[#1f6f5c]" />

    <div className="flex items-center justify-between border-b border-[#e3ebe8] px-5 py-3">
      <div>
        <span className="text-sm font-bold text-[#1c2a26]">{madrasaName || "প্রবেশপত্র"}</span>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#6f8c83]">Admit Card</p>
      </div>
      <span className="text-xs font-semibold text-[#1f6f5c]">{cellValue(row, "exam_name")}</span>
    </div>

    <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-5 text-sm">
      <Field label="নাম" value={cellValue(row, "student_name")} />
      <Field label="পিতা" value={cellValue(row, "father_name")} />
      <Field label="রেজিস্ট্রেশন নম্বর" value={cellValue(row, "registration_no")} />
      <Field label="রোল নম্বর" value={cellValue(row, "roll")} />
      <Field label="শ্রেণি" value={cellValue(row, "class_name")} />
      <Field label="বিভাগ" value={cellValue(row, "division_name")} />
      <Field label="সেশন" value={cellValue(row, "academic_year")} />
    </div>

    <div className="mx-5 mb-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">
      {renderTemplateText(rulesTemplate, row)}
    </div>

    <div className="flex justify-between border-t border-[#e3ebe8] px-5 py-3 text-xs font-semibold text-[#445a53]">
      <span>পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর</span>
      <span>প্রধান শিক্ষকের স্বাক্ষর</span>
    </div>
  </div>
);

export default AdmitCardMinimal;
