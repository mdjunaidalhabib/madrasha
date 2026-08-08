import { cellValue, formatMeritRank, toBanglaDigits } from "../../../../utils/reportUtils";

type Props = {
  row: Record<string, any>;
  madrasaName: string;
};

const BookLabelMinimal = ({ row, madrasaName }: Props) => (
  <div className="print-page-break relative flex h-[58mm] w-[92mm] flex-col overflow-hidden rounded-lg border border-[#d7e4df] bg-white">
    <div className="h-[2mm] w-full shrink-0 bg-[#1f6f5c]" />

    <div className="flex shrink-0 items-center gap-[2mm] border-b border-[#e3ebe8] px-[4mm] py-[2mm]">
      <span className="flex h-[6mm] w-[6mm] shrink-0 items-center justify-center rounded-[1mm] bg-[#1f6f5c] text-[8px] font-bold text-white">
        {(madrasaName || "ম").charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-bold text-[#1c2a26]">
          {madrasaName || "মেধা পুরস্কার"}
        </p>
        <p className="text-[6px] uppercase tracking-[0.2em] text-[#6f8c83]">Merit Prize</p>
      </div>
      <div className="flex h-[9mm] w-[9mm] shrink-0 flex-col items-center justify-center rounded-full border-2 border-[#1f6f5c] text-[#1f6f5c]">
        <span className="text-[9px] font-extrabold leading-none">{formatMeritRank(row.rank_no)}</span>
      </div>
    </div>

    <div className="flex flex-1 flex-col items-center justify-center px-[4mm] text-center">
      <h4 className="w-full truncate text-[13.5px] font-bold text-[#1c2a26]">
        {cellValue(row, "student_name")}
      </h4>
      <p className="mt-[1mm] truncate text-[7.5px] text-[#6f8c83]">
        {cellValue(row, "class_name")}
        {row.division_name ? ` (${cellValue(row, "division_name")})` : ""} • রোল {cellValue(row, "roll")}
      </p>
      {row.madrasa_grade && (
        <span className="mt-[1.2mm] inline-block rounded-full border border-[#1f6f5c] px-[2.5mm] py-[0.3mm] text-[6.5px] font-semibold text-[#1f6f5c]">
          গ্রেড: {cellValue(row, "madrasa_grade")}
        </span>
      )}
    </div>

    <div className="flex shrink-0 items-center justify-between border-t border-[#e3ebe8] px-[3mm] py-[1.8mm] text-[6.5px] text-[#6f8c83]">
      <span>
        {cellValue(row, "exam_name")}
        {row.exam_year ? ` ${toBanglaDigits(row.exam_year)}` : ""}
      </span>
      <span className="border-t border-[#9db3ac] pt-[0.4mm] text-[#445a53]">অধ্যক্ষের স্বাক্ষর</span>
    </div>
  </div>
);

export default BookLabelMinimal;
