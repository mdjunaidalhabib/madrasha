import { useEffect } from "react";
import { cellValue } from "../../utils/reportUtils";
import { useDocumentTemplateStore } from "../../store/documentTemplateStore";
import { DEFAULT_ADMIT_CARD_RULES, renderTemplateText } from "../../utils/documentTemplates";

type AdmitCardGridProps = {
  rows: Record<string, any>[];
};

const AdmitCardGrid = ({ rows }: AdmitCardGridProps) => {
  const templates = useDocumentTemplateStore((s) => s.templates);
  const fetchTemplates = useDocumentTemplateStore((s) => s.fetchTemplates);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const rulesTemplate = templates?.admit_card_rules || DEFAULT_ADMIT_CARD_RULES;

  return (
    <div className="report-admit-card-grid grid gap-4">
      {rows.map((row, index) => (
        <div
          key={`admit-card-${row.id || index}`}
          className="print-page-break rounded-xl border-2 border-slate-800 bg-white p-5"
        >
          <div className="text-center">
            <p className="text-xs text-slate-500">بسم الله الرحمن الرحيم</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">প্রবেশপত্র</h3>
            <p className="text-xs text-slate-500">{cellValue(row, "exam_name")}</p>
          </div>

          {/* Student data fields are always fixed to the real record — never editable text */}
          <div className="mt-4 space-y-1 text-sm text-slate-700">
            <p>
              <b>নাম:</b> {cellValue(row, "student_name")}
            </p>
            <p>
              <b>পিতা:</b> {cellValue(row, "father_name")}
            </p>
            <p>
              <b>রেজিস্ট্রেশন নম্বর:</b> {cellValue(row, "registration_no")}
            </p>
            <p>
              <b>রোল নম্বর:</b> {cellValue(row, "roll")}
            </p>
            <p>
              <b>শ্রেণি:</b> {cellValue(row, "class_name")}
            </p>
            <p>
              <b>বিভাগ:</b> {cellValue(row, "division_name")}
            </p>
            <p>
              <b>সেশন:</b> {cellValue(row, "academic_year")}
            </p>
          </div>

          {/* Rules/notice text is admin-editable via Document Template settings */}
          <div className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">
            {renderTemplateText(rulesTemplate, row)}
          </div>

          <div className="mt-8 flex justify-between text-xs text-slate-600">
            <span>পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর</span>
            <span>প্রধান শিক্ষকের স্বাক্ষর</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdmitCardGrid;
