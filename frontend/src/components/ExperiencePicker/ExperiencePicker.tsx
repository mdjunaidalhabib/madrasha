import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

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
  const [openField, setOpenField] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const years = Array.from({ length: 31 }, (_, i) => i);
  const months = Array.from({ length: 12 }, (_, i) => i);

  /* 👉 DISPLAY TEXT */
  const display = year || month ? `${year || 0} বছর ${month || 0} মাস` : "";

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
      <label className="text-sm font-medium text-gray-600 mb-1 flex justify-between">
        <span>{label}</span>
        {display && (
          <span className="text-green-600 text-xs font-semibold">
            {display}
          </span>
        )}
      </label>

      <div className="flex gap-2">
        {/* YEAR */}
        <div className="w-full relative">
          <div
            onClick={() => setOpenField(openField === "year" ? null : "year")}
            className="border rounded-lg px-3 py-2 bg-white cursor-pointer flex justify-between"
          >
            <div>
              <p className="text-xs text-gray-500">বছর</p>
              <p className="text-sm font-semibold">{year || "Select"}</p>
            </div>
            <ChevronDown
              size={18}
              className={`transition ${
                openField === "year" ? "rotate-180" : ""
              }`}
            />
          </div>

          {openField === "year" && (
            <div className="absolute z-20 mt-2 w-full max-h-60 overflow-y-auto bg-white border rounded-lg shadow-lg">
              {years.map((y) => (
                <div
                  key={y}
                  onClick={() => {
                    onChange(String(y), month);
                    setOpenField(null);
                  }}
                  className="px-3 py-2 hover:bg-green-50 cursor-pointer"
                >
                  {y}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MONTH */}
        <div className="w-full relative">
          <div
            onClick={() => setOpenField(openField === "month" ? null : "month")}
            className="border rounded-lg px-3 py-2 bg-white cursor-pointer flex justify-between"
          >
            <div>
              <p className="text-xs text-gray-500">মাস</p>
              <p className="text-sm font-semibold">{month || "Select"}</p>
            </div>
            <ChevronDown
              size={18}
              className={`transition ${
                openField === "month" ? "rotate-180" : ""
              }`}
            />
          </div>

          {openField === "month" && (
            <div className="absolute z-20 mt-2 w-full max-h-60 overflow-y-auto bg-white border rounded-lg shadow-lg">
              {months.map((m) => (
                <div
                  key={m}
                  onClick={() => {
                    onChange(year, String(m));
                    setOpenField(null);
                  }}
                  className="px-3 py-2 hover:bg-green-50 cursor-pointer"
                >
                  {m}
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
