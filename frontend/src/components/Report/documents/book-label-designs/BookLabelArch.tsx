import { cellValue, formatMeritRank, toBanglaDigits } from "../../../../utils/reportUtils";

type Props = {
  row: Record<string, any>;
  madrasaName: string;
};

const BookLabelArch = ({ row, madrasaName }: Props) => (
  <div className="print-page-break flex h-[58mm] w-[92mm] flex-col overflow-hidden rounded-lg border-2 border-[#1e5c3f] bg-[#f3ecd8] p-[1.2mm]">
    <div className="flex flex-1 flex-col overflow-hidden rounded-[4px] border border-[#cdb96f]">
      <div className="shrink-0 bg-[#1e5c3f] px-[4mm] py-[2mm] text-center">
        <p className="truncate text-[11px] font-bold leading-tight text-[#f3ecd8]">
          {madrasaName || "মেধা পুরস্কার"}
        </p>
        <p className="mt-[0.5mm] text-[6.5px] uppercase tracking-[0.2em] text-[#cdb96f]">
          Merit Prize Award
        </p>
      </div>

      <div className="flex flex-1 items-center gap-[3.5mm] px-[4mm] py-[2mm]">
        <div className="flex h-[16mm] w-[14mm] shrink-0 flex-col items-center justify-center rounded-[7mm_7mm_1mm_1mm] border-2 border-[#1e5c3f] bg-[#e8dfc4]">
          <span className="text-[12px] font-extrabold leading-none text-[#1e5c3f]">
            {formatMeritRank(row.rank_no)}
          </span>
          <span className="mt-[0.3mm] text-[5.5px] leading-none text-[#1e5c3f]">স্থান</span>
        </div>

        <div className="min-w-0 flex-1 text-center">
          <h4 className="truncate text-[13px] font-bold text-[#1e3a2c]">
            {cellValue(row, "student_name")}
          </h4>
          <p className="mt-[1mm] truncate text-[7.5px] text-[#3c4f42]">
            {cellValue(row, "class_name")}
            {row.division_name ? ` (${cellValue(row, "division_name")})` : ""} • রোল{" "}
            {cellValue(row, "roll")}
          </p>
          {row.madrasa_grade && (
            <span className="mt-[1.2mm] inline-block rounded-full bg-[#e3d9b3] px-[2.5mm] py-[0.3mm] text-[6.5px] font-bold text-[#1e5c3f]">
              গ্রেড: {cellValue(row, "madrasa_grade")}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between px-[3mm] py-[1.5mm] text-[6.5px] text-[#1e5c3f]">
        <span>
          {cellValue(row, "exam_name")}
          {row.exam_year ? ` ${toBanglaDigits(row.exam_year)}` : ""}
        </span>
        <span className="border-t border-[#6b5a2e] pt-[0.4mm] italic">অধ্যক্ষের স্বাক্ষর</span>
      </div>
    </div>
  </div>
);

export default BookLabelArch;
