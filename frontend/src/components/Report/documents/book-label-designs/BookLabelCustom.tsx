import { cellValue, formatMeritRank, toBanglaDigits } from "../../../../utils/reportUtils";

type Props = {
  row: Record<string, any>;
  backgroundImage: string;
};

const BookLabelCustom = ({ row, backgroundImage }: Props) => (
  <div
    className="print-page-break relative flex h-[58mm] w-[92mm] flex-col overflow-hidden rounded-lg border border-slate-300 bg-slate-100 bg-cover bg-center"
    style={{ backgroundImage: `url(${backgroundImage})` }}
  >
    <div className="mt-auto flex items-center gap-[3mm] bg-white/92 px-[4mm] py-[2.5mm]">
      <div className="flex h-[13mm] w-[13mm] shrink-0 flex-col items-center justify-center rounded-full border-2 border-slate-700 text-slate-800">
        <span className="text-[10px] font-extrabold leading-none">{formatMeritRank(row.rank_no)}</span>
      </div>

      <div className="min-w-0 flex-1 text-center">
        <h4 className="truncate text-[12.5px] font-bold text-slate-900">
          {cellValue(row, "student_name")}
        </h4>
        <p className="mt-[0.8mm] truncate text-[7px] text-slate-600">
          {cellValue(row, "class_name")}
          {row.division_name ? ` (${cellValue(row, "division_name")})` : ""} • রোল {cellValue(row, "roll")}
          {row.madrasa_grade ? ` • গ্রেড: ${cellValue(row, "madrasa_grade")}` : ""}
        </p>
        <div className="mt-[1mm] flex items-center justify-between text-[6.5px] text-slate-500">
          <span>
            {cellValue(row, "exam_name")}
            {row.exam_year ? ` ${toBanglaDigits(row.exam_year)}` : ""}
          </span>
          <span className="border-t border-slate-400 pt-[0.4mm] text-slate-600">অধ্যক্ষের স্বাক্ষর</span>
        </div>
      </div>
    </div>
  </div>
);

export default BookLabelCustom;
