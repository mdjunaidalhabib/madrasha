import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { commonText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { teacherStaffText } from "../../features/teachers/teacherStaff.text";

interface Props {
  label: string;
  year: string;
  month: string;
  onChange: (year: string, month: string) => void;
}

const ExperiencePicker: React.FC<Props> = ({
  label,
  year,
  month,
  onChange,
}) => {
  const t = useText(teacherStaffText);
  const c = useText(commonText);
  const lang = useLang();
  const num = (v: string | number) => localizeDigits(v, lang);
  const [openField, setOpenField] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const years = Array.from({ length: 31 }, (_, i) => i);
  const months = Array.from({ length: 12 }, (_, i) => i);

  /* 👉 DISPLAY TEXT */
  const display = year || month ? t.yearsMonths(num(year || 0), num(month || 0)) : "";

  /* CLOSE DROPDOWN */
  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpenField(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="flex flex-col">
      {/* 🔥 Label + Display */}
      <label className="text-sm font-medium text-gray-600 mb-1 flex justify-between dark:text-slate-400">
        <span>{label}</span>
        {display && (
          <span className="text-green-600 text-xs font-semibold dark:text-green-400">
            {display}
          </span>
        )}
      </label>

      <div className="flex gap-2">
        {/* YEAR */}
        <div className="w-full relative">
          <div
            onClick={() => setOpenField(openField === "year" ? null : "year")}
            className="border rounded-lg px-3 py-2 bg-white cursor-pointer flex justify-between dark:border-slate-700 dark:bg-slate-800"
          >
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">{t.year}</p>
              <p className="text-sm font-semibold dark:text-slate-100">{year ? num(year) : c.select}</p>
            </div>
            <ChevronDown
              size={18}
              className={`transition ${
                openField === "year" ? "rotate-180" : ""
              }`}
            />
          </div>

          {openField === "year" && (
            <div className="absolute z-20 mt-2 w-full max-h-60 overflow-y-auto bg-white border rounded-lg shadow-lg dark:bg-slate-800 dark:border-slate-700">
              {years.map((y) => (
                <div
                  key={y}
                  onClick={() => {
                    onChange(String(y), month);
                    setOpenField(null);
                  }}
                  className="px-3 py-2 hover:bg-green-50 cursor-pointer dark:text-slate-200 dark:hover:bg-green-950/40"
                >
                  {num(y)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MONTH */}
        <div className="w-full relative">
          <div
            onClick={() => setOpenField(openField === "month" ? null : "month")}
            className="border rounded-lg px-3 py-2 bg-white cursor-pointer flex justify-between dark:border-slate-700 dark:bg-slate-800"
          >
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">{t.month}</p>
              <p className="text-sm font-semibold dark:text-slate-100">{month ? num(month) : c.select}</p>
            </div>
            <ChevronDown
              size={18}
              className={`transition ${
                openField === "month" ? "rotate-180" : ""
              }`}
            />
          </div>

          {openField === "month" && (
            <div className="absolute z-20 mt-2 w-full max-h-60 overflow-y-auto bg-white border rounded-lg shadow-lg dark:bg-slate-800 dark:border-slate-700">
              {months.map((m) => (
                <div
                  key={m}
                  onClick={() => {
                    onChange(year, String(m));
                    setOpenField(null);
                  }}
                  className="px-3 py-2 hover:bg-green-50 cursor-pointer dark:text-slate-200 dark:hover:bg-green-950/40"
                >
                  {num(m)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExperiencePicker;
