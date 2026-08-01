import { cellValue, toBanglaDigits } from "../../../../utils/reportUtils";

type Props = {
  row: Record<string, any>;
  madrasaName: string;
};

const IdCardArch = ({ row, madrasaName }: Props) => (
  <div className="print-page-break flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-lg border-2 border-[#1e5c3f] bg-[#f3ecd8] p-[1.2mm]">
    <div className="flex flex-1 flex-col overflow-hidden rounded-[4px] border border-[#cdb96f]">
      <div className="shrink-0 bg-[#1e5c3f] px-[3mm] py-[2mm] text-center">
        <p className="truncate text-[11px] font-bold leading-tight text-[#f3ecd8]">
          {madrasaName || "শিক্ষার্থী পরিচয়পত্র"}
        </p>
        <p className="mt-[0.5mm] text-[6.5px] uppercase tracking-[0.2em] text-[#cdb96f]">
          Student Identity Card
        </p>
      </div>

      <div className="mx-auto mt-[3mm] flex h-[19mm] w-[16mm] shrink-0 items-center justify-center overflow-hidden rounded-[8mm_8mm_1mm_1mm] border-2 border-[#1e5c3f] bg-[#e8dfc4] text-[7.5px] text-[#6b7a5e]">
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

      <span className="mx-auto mt-[1.5mm] shrink-0 rounded-full bg-[#e3d9b3] px-[2.5mm] py-[0.3mm] text-[7.5px] font-bold text-[#1e5c3f]">
        রোল {cellValue(row, "roll")}
      </span>

      <div className="flex flex-1 flex-col items-center px-[3.5mm] pb-[1mm] pt-[2mm] text-center">
        <h4 className="w-full truncate text-[11.5px] font-bold text-[#1e3a2c]">
          {cellValue(row, "student_name")}
        </h4>

        <div className="mt-[2mm] flex w-full flex-col gap-[1.4mm]">
          <div className="flex justify-between gap-[2mm] border-b border-dotted border-[#cdb96f] pb-[0.8mm] text-[8px] text-[#3c4f42]">
            <span className="shrink-0 font-bold text-[#6b5a2e]">রেজি. নং</span>
            <span className="min-w-0 truncate">{cellValue(row, "registration_no")}</span>
          </div>
          <div className="flex justify-between gap-[2mm] border-b border-dotted border-[#cdb96f] pb-[0.8mm] text-[8px] text-[#3c4f42]">
            <span className="shrink-0 font-bold text-[#6b5a2e]">শ্রেণি</span>
            <span className="min-w-0 truncate">
              {cellValue(row, "class_name")}
              {row.division_name ? ` (${cellValue(row, "division_name")})` : ""}
            </span>
          </div>
          <div className="flex justify-between gap-[2mm] border-b border-dotted border-[#cdb96f] pb-[0.8mm] text-[8px] text-[#3c4f42]">
            <span className="shrink-0 font-bold text-[#6b5a2e]">পিতা</span>
            <span className="min-w-0 truncate">{cellValue(row, "father_name")}</span>
          </div>
          <div className="flex justify-between gap-[2mm] border-b border-dotted border-[#cdb96f] pb-[0.8mm] text-[8px] text-[#3c4f42]">
            <span className="shrink-0 font-bold text-[#6b5a2e]">মোবাইল</span>
            <span className="min-w-0 truncate">{cellValue(row, "guardian_phone")}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between px-[3mm] py-[1.5mm] text-[7px] text-[#1e5c3f]">
        <span>সেশন {toBanglaDigits(cellValue(row, "academic_year"))}</span>
        <span className="border-t border-[#6b5a2e] pt-[0.4mm] italic">অধ্যক্ষের স্বাক্ষর</span>
      </div>
    </div>
  </div>
);

export default IdCardArch;
