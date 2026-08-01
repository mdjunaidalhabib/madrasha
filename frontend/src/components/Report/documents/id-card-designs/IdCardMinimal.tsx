import { cellValue, toBanglaDigits } from "../../../../utils/reportUtils";

type Props = {
  row: Record<string, any>;
  madrasaName: string;
};

const IdCardMinimal = ({ row, madrasaName }: Props) => (
  <div className="print-page-break relative flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-lg border border-[#d7e4df] bg-white">
    <div className="h-[2mm] w-full shrink-0 bg-[#1f6f5c]" />

    <div className="flex shrink-0 flex-col items-center gap-[1mm] border-b border-[#e3ebe8] px-[3mm] py-[2.5mm]">
      <div className="flex w-full items-center gap-[1.5mm]">
        <span className="flex h-[5mm] w-[5mm] shrink-0 items-center justify-center rounded-[1mm] bg-[#1f6f5c] text-[7px] font-bold text-white">
          {(madrasaName || "ম").charAt(0)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-[#1c2a26]">
          {madrasaName || "শিক্ষার্থী পরিচয়পত্র"}
        </span>
      </div>
      <span className="w-full text-center text-[6.5px] uppercase tracking-[0.2em] text-[#6f8c83]">
        Student ID Card
      </span>
    </div>

    <div className="mx-auto mt-[3mm] flex h-[18mm] w-[18mm] shrink-0 items-center justify-center overflow-hidden border border-[#1f6f5c] bg-[#f1f6f4] text-[8px] text-[#6f8c83]">
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

    <div className="flex flex-1 flex-col items-center px-[4mm] pb-[1mm] pt-[2.5mm] text-center">
      <h4 className="w-full truncate text-[12px] font-bold text-[#1c2a26]">
        {cellValue(row, "student_name")}
      </h4>

      <div className="mt-[2.5mm] flex w-full flex-col gap-[1.6mm] text-left">
        <div className="flex justify-between gap-[2mm] border-b border-[#e3ebe8] pb-[1mm] text-[8.5px]">
          <span className="shrink-0 font-semibold text-[#6f8c83]">রেজি. নং</span>
          <span className="min-w-0 truncate text-right font-medium text-[#1c2a26]">
            {cellValue(row, "registration_no")}
          </span>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-[#e3ebe8] pb-[1mm] text-[8.5px]">
          <span className="shrink-0 font-semibold text-[#6f8c83]">রোল নং</span>
          <span className="min-w-0 truncate text-right font-medium text-[#1c2a26]">
            {cellValue(row, "roll")}
          </span>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-[#e3ebe8] pb-[1mm] text-[8.5px]">
          <span className="shrink-0 font-semibold text-[#6f8c83]">শ্রেণি</span>
          <span className="min-w-0 truncate text-right font-medium text-[#1c2a26]">
            {cellValue(row, "class_name")}
            {row.division_name ? ` (${cellValue(row, "division_name")})` : ""}
          </span>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-[#e3ebe8] pb-[1mm] text-[8.5px]">
          <span className="shrink-0 font-semibold text-[#6f8c83]">পিতা</span>
          <span className="min-w-0 truncate text-right font-medium text-[#1c2a26]">
            {cellValue(row, "father_name")}
          </span>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-[#e3ebe8] pb-[1mm] text-[8.5px]">
          <span className="shrink-0 font-semibold text-[#6f8c83]">মোবাইল</span>
          <span className="min-w-0 truncate text-right font-medium text-[#1c2a26]">
            {cellValue(row, "guardian_phone")}
          </span>
        </div>
      </div>
    </div>

    <div className="flex shrink-0 items-center justify-between border-t border-[#e3ebe8] px-[3mm] py-[2mm] text-[7.5px] text-[#6f8c83]">
      <span>সেশন {toBanglaDigits(cellValue(row, "academic_year"))}</span>
      <span className="border-t border-[#9db3ac] pt-[0.5mm] text-[#445a53]">অধ্যক্ষের স্বাক্ষর</span>
    </div>
  </div>
);

export default IdCardMinimal;
