import { cellValue, toBanglaDigits } from "../../../../utils/reportUtils";

type Props = {
  row: Record<string, any>;
  madrasaName: string;
};

const HEADER_PATTERN =
  "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 8px, transparent 8px 16px), linear-gradient(180deg, #8a2632, #6c1d27)";

const IdCardClassic = ({ row, madrasaName }: Props) => (
  <div className="print-page-break relative flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-xl border border-[#d8cba3] bg-[#f7f2e6]">
    <div
      className="relative flex shrink-0 flex-col items-center pt-[3mm]"
      style={{ height: "28.5mm", backgroundImage: HEADER_PATTERN }}
    >
      <p className="text-[7px] leading-none text-[#e9c98f]">بسم الله الرحمن الرحيم</p>
      <p className="mt-[1.5mm] truncate px-[3mm] text-center text-[12px] font-bold leading-tight text-[#fbf1de]">
        {madrasaName || "শিক্ষার্থী পরিচয়পত্র"}
      </p>
      <p className="mt-[1mm] text-[7px] uppercase tracking-[0.22em] text-[#e9c98f]">
        Student ID Card
      </p>
    </div>

    <div className="absolute left-1/2 top-[19.5mm] -translate-x-1/2 rounded-full bg-[#f7f2e6] p-[1mm]">
      <div className="flex h-[18mm] w-[18mm] items-center justify-center overflow-hidden rounded-full border-2 border-[#cda85f] bg-[#efe6cd] text-[8px] text-[#8a7a52]">
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
    </div>

    <div className="flex flex-1 flex-col items-center px-[4mm] pb-[1mm] pt-[13mm] text-center">
      <h4 className="w-full truncate text-[12.5px] font-bold text-[#3d2a1a]">
        {cellValue(row, "student_name")}
      </h4>

      <div className="mt-[2.5mm] flex w-full flex-col gap-[1.6mm]">
        <div className="flex justify-between gap-[2mm] border-b border-dotted border-[#cbb98a] pb-[1mm] text-[8.5px] text-[#55432c]">
          <span className="shrink-0">রেজি. নং</span>
          <b className="min-w-0 truncate font-bold text-[#7a1f2b]">
            {cellValue(row, "registration_no")}
          </b>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-dotted border-[#cbb98a] pb-[1mm] text-[8.5px] text-[#55432c]">
          <span className="shrink-0">রোল নং</span>
          <b className="min-w-0 truncate font-bold text-[#7a1f2b]">{cellValue(row, "roll")}</b>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-dotted border-[#cbb98a] pb-[1mm] text-[8.5px] text-[#55432c]">
          <span className="shrink-0">শ্রেণি</span>
          <b className="min-w-0 truncate font-bold text-[#7a1f2b]">
            {cellValue(row, "class_name")}
            {row.division_name ? ` (${cellValue(row, "division_name")})` : ""}
          </b>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-dotted border-[#cbb98a] pb-[1mm] text-[8.5px] text-[#55432c]">
          <span className="shrink-0">পিতা</span>
          <b className="min-w-0 truncate font-bold text-[#7a1f2b]">{cellValue(row, "father_name")}</b>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-dotted border-[#cbb98a] pb-[1mm] text-[8.5px] text-[#55432c]">
          <span className="shrink-0">মোবাইল</span>
          <b className="min-w-0 truncate font-bold text-[#7a1f2b]">
            {cellValue(row, "guardian_phone")}
          </b>
        </div>
      </div>
    </div>

    <div
      className="flex shrink-0 items-center justify-between px-[3mm] text-[7.5px] text-[#f1dcb8]"
      style={{ height: "10mm", background: "linear-gradient(180deg, #6c1d27, #571620)" }}
    >
      <span>সেশন {toBanglaDigits(cellValue(row, "academic_year"))}</span>
      <span className="border-t border-[#e9c98f] pt-[0.5mm]">অধ্যক্ষের স্বাক্ষর</span>
    </div>
  </div>
);

export default IdCardClassic;
