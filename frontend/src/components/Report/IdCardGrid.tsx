import { cellValue } from "../../utils/reportUtils";

type IdCardGridProps = {
  rows: Record<string, any>[];
};

const IdCardGrid = ({ rows }: IdCardGridProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, index) => (
        <div
          key={`id-card-${row.id || index}`}
          className="print-page-break rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{cellValue(row, "student_name")}</h3>
              <p className="text-xs text-slate-500">Student ID Card</p>
            </div>

            <div className="flex h-20 w-16 items-center justify-center rounded border border-dashed text-xs text-slate-400">
              ছবি
            </div>
          </div>

          <div className="space-y-1 text-sm text-slate-700">
            <p>
              <b>আইডি:</b> {cellValue(row, "id")}
            </p>
            <p>
              <b>শ্রেণি:</b> {cellValue(row, "class_name")}
            </p>
            <p>
              <b>বিভাগ:</b> {cellValue(row, "division_name")}
            </p>
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
