import { cellValue, toBanglaDigits } from "../../../../utils/reportUtils";

type Props = {
  row: Record<string, any>;
  backgroundImage: string;
};

const IdCardCustom = ({ row, backgroundImage }: Props) => (
  <div
    className="print-page-break relative flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-xl border border-slate-300 bg-slate-100 bg-cover bg-center"
    style={{ backgroundImage: `url(${backgroundImage})` }}
  >
    <div className="mt-auto flex flex-col items-center bg-white/92 px-[4mm] pb-[2mm] pt-[9mm] text-center">
      <div className="absolute left-1/2 top-[20mm] flex h-[16mm] w-[16mm] -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-50 text-[8px] text-slate-400 shadow">
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

      <h4 className="w-full truncate text-[12px] font-bold text-slate-900">
        {cellValue(row, "student_name")}
      </h4>

      <div className="mt-[2mm] flex w-full flex-col gap-[1.4mm]">
        <div className="flex justify-between gap-[2mm] border-b border-slate-200 pb-[0.8mm] text-[8px] text-slate-600">
          <span className="shrink-0 font-semibold">রেজি. নং</span>
          <span className="min-w-0 truncate font-medium text-slate-900">
            {cellValue(row, "registration_no")}
          </span>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-slate-200 pb-[0.8mm] text-[8px] text-slate-600">
          <span className="shrink-0 font-semibold">রোল নং</span>
          <span className="min-w-0 truncate font-medium text-slate-900">{cellValue(row, "roll")}</span>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-slate-200 pb-[0.8mm] text-[8px] text-slate-600">
          <span className="shrink-0 font-semibold">শ্রেণি</span>
          <span className="min-w-0 truncate font-medium text-slate-900">
            {cellValue(row, "class_name")}
            {row.division_name ? ` (${cellValue(row, "division_name")})` : ""}
          </span>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-slate-200 pb-[0.8mm] text-[8px] text-slate-600">
          <span className="shrink-0 font-semibold">পিতা</span>
          <span className="min-w-0 truncate font-medium text-slate-900">
            {cellValue(row, "father_name")}
          </span>
        </div>
        <div className="flex justify-between gap-[2mm] border-b border-slate-200 pb-[0.8mm] text-[8px] text-slate-600">
          <span className="shrink-0 font-semibold">মোবাইল</span>
          <span className="min-w-0 truncate font-medium text-slate-900">
            {cellValue(row, "guardian_phone")}
          </span>
        </div>
      </div>

      <div className="mt-[1.5mm] flex w-full items-center justify-between text-[7px] text-slate-500">
        <span>সেশন {toBanglaDigits(cellValue(row, "academic_year"))}</span>
        <span className="border-t border-slate-400 pt-[0.4mm] text-slate-600">অধ্যক্ষের স্বাক্ষর</span>
      </div>
    </div>
  </div>
);

export default IdCardCustom;
