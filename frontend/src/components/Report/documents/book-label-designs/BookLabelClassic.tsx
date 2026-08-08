import { cellValue, formatMeritRank, toBanglaDigits } from "../../../../utils/reportUtils";

type Props = {
  row: Record<string, any>;
  madrasaName: string;
};

const HEADER_PATTERN =
  "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 8px, transparent 8px 16px), linear-gradient(180deg, #8a2632, #6c1d27)";

const BookLabelClassic = ({ row, madrasaName }: Props) => (
  <div className="print-page-break relative flex h-[58mm] w-[92mm] flex-col overflow-hidden rounded-lg border-2 border-[#8a2632] bg-[#fbf6ea] p-[1.2mm]">
    <div className="flex flex-1 flex-col overflow-hidden rounded-[3px] border border-[#cda85f]">
      <div
        className="flex shrink-0 flex-col items-center px-[4mm] pb-[1.5mm] pt-[2mm]"
        style={{ backgroundImage: HEADER_PATTERN }}
      >
        <p className="text-[6px] leading-none text-[#e9c98f]">بسم الله الرحمن الرحيم</p>
        <p className="mt-[0.7mm] max-w-[76mm] truncate text-[11px] font-bold leading-tight text-[#fbf1de]">
          {madrasaName || "মেধা পুরস্কার"}
        </p>
        <p className="mt-[0.4mm] text-[6.5px] uppercase tracking-[0.2em] text-[#e9c98f]">
          মেধা পুরস্কার সনদ
        </p>
      </div>

      <div className="flex flex-1 items-center gap-[3.5mm] px-[4mm] py-[2mm]">
        <div className="flex h-[16mm] w-[16mm] shrink-0 flex-col items-center justify-center rounded-full border-2 border-[#8a2632] bg-[#fbf1de]">
          <span className="text-[13px] font-extrabold leading-none text-[#7a1f2b]">
            {formatMeritRank(row.rank_no)}
          </span>
          <span className="mt-[0.3mm] text-[5.5px] leading-none text-[#7a1f2b]">স্থান</span>
        </div>

        <div className="min-w-0 flex-1 text-center">
          <h4 className="truncate text-[13.5px] font-extrabold text-[#3d2a1a]">
            {cellValue(row, "student_name")}
          </h4>
          <p className="mt-[1mm] truncate text-[7.5px] text-[#55432c]">
            {cellValue(row, "class_name")}
            {row.division_name ? ` (${cellValue(row, "division_name")})` : ""} • রোল{" "}
            {cellValue(row, "roll")}
          </p>
          {row.madrasa_grade && (
            <span className="mt-[1.2mm] inline-block rounded-full border border-[#cda85f] bg-white px-[2.5mm] py-[0.3mm] text-[6.5px] font-semibold text-[#7a1f2b]">
              গ্রেড: {cellValue(row, "madrasa_grade")}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-dotted border-[#cbb98a] px-[3mm] py-[1.5mm] text-[6.5px] text-[#6a5a3c]">
        <span>
          {cellValue(row, "exam_name")}
          {row.exam_year ? ` ${toBanglaDigits(row.exam_year)}` : ""}
        </span>
        <span className="border-t border-[#8a2632] pt-[0.4mm]">অধ্যক্ষের স্বাক্ষর</span>
      </div>
    </div>
  </div>
);

export default BookLabelClassic;
