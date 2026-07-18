import { cellValue } from "../../utils/reportUtils";

type IdCardGridProps = {
  rows: Record<string, any>[];
};

const IdCardGrid = ({ rows }: IdCardGridProps) => {
  return (
    <div className="report-id-card-grid grid gap-4">
      {rows.map((row, index) => (
        <div
          key={`id-card-${row.id || index}`}
          className="print-page-break overflow-hidden rounded-xl border-2 border-blue-900 bg-white shadow-sm"
        >
          <div className="bg-blue-900 px-4 py-2 text-center text-white">
            <h3 className="text-base font-bold">শিক্ষার্থী পরিচয়পত্র</h3>
            <p className="text-[10px] uppercase tracking-widest">Student ID Card</p>
          </div>

          <div className="flex gap-4 p-4">
            <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-300 bg-slate-50 text-xs text-slate-400">
              {row.image ? (
                <img
                  src={String(row.image)}
                  alt={String(row.student_name || "Student")}
                  className="h-full w-full object-cover"
                />
              ) : (
                "ছবি"
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="truncate text-lg font-bold text-slate-900">
                {cellValue(row, "student_name")}
              </h4>
              <div className="mt-2 space-y-1 text-xs text-slate-700">
                <p>
                  <b>রেজিস্ট্রেশন:</b> {cellValue(row, "registration_no")}
                </p>
                <p>
                  <b>রোল:</b> {cellValue(row, "roll")}
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
            </div>
          </div>

          <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-700">
            <p>
              <b>অভিভাবক:</b> {cellValue(row, "father_name")}
            </p>
            <p>
              <b>মোবাইল:</b> {cellValue(row, "guardian_phone")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default IdCardGrid;
