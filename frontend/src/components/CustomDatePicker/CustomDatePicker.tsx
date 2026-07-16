import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  label: string;
  value: string;
  onChange: (date: string) => void;
  isEditMode?: boolean;
}

const CustomDatePicker: React.FC<Props> = ({
  label,
  value,
  onChange,
  isEditMode = true,
}) => {
  const [openField, setOpenField] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  /* =========================
     SAFE DATE PARSE (ISO SAFE)
  ========================= */
  const baseDate = value ? new Date(value) : new Date();

  const selectedYear = baseDate.getUTCFullYear();
  const selectedMonth = baseDate.getUTCMonth() + 1;
  const selectedDay = baseDate.getUTCDate();

  /* =========================
     DAYS IN MONTH
  ========================= */
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  };

  const days = Array.from(
    { length: getDaysInMonth(selectedYear, selectedMonth) },
    (_, i) => i + 1,
  );

  /* =========================
     OUTSIDE CLICK CLOSE
  ========================= */
  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpenField(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* =========================
     BUILD DATE STRING
  ========================= */
  const buildDate = (y: number, m: number, d: number) => {
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  /* =========================
     FORMAT DISPLAY DATE
  ========================= */
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  return (
    <div ref={wrapperRef} className="flex flex-col">
      <label className="text-sm font-medium text-gray-600 mb-1">{label}</label>

      {isEditMode ? (
        <div className="flex gap-2">
          {/* ================= DAY ================= */}
          <div className="w-full relative">
            <div
              onClick={() => setOpenField(openField === "day" ? null : "day")}
              className="border rounded-lg px-3 py-2 bg-white cursor-pointer hover:ring-2 hover:ring-green-400 flex justify-between"
            >
              <div>
                <p className="text-xs text-gray-500">Day</p>
                <p className="text-sm font-semibold">{selectedDay}</p>
              </div>
              <ChevronDown
                size={18}
                className={openField === "day" ? "rotate-180" : ""}
              />
            </div>

            {openField === "day" && (
              <div className="absolute z-20 mt-2 w-full max-h-60 overflow-y-auto bg-white border rounded-lg shadow">
                {days.map((d) => (
                  <div
                    key={d}
                    onClick={() => {
                      onChange(buildDate(selectedYear, selectedMonth, d));
                      setOpenField(null);
                    }}
                    className={`px-3 py-2 text-sm cursor-pointer ${
                      selectedDay === d
                        ? "bg-green-100 font-semibold"
                        : "hover:bg-green-50"
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ================= MONTH ================= */}
          <div className="w-full relative">
            <div
              onClick={() =>
                setOpenField(openField === "month" ? null : "month")
              }
              className="border rounded-lg px-3 py-2 bg-white cursor-pointer hover:ring-2 hover:ring-green-400 flex justify-between"
            >
              <div>
                <p className="text-xs text-gray-500">Month</p>
                <p className="text-sm font-semibold">
                  {months[selectedMonth - 1]}
                </p>
              </div>
              <ChevronDown
                size={18}
                className={openField === "month" ? "rotate-180" : ""}
              />
            </div>

            {openField === "month" && (
              <div className="absolute z-20 mt-2 w-72 max-w-[85vw] right-0 sm:right-auto grid grid-cols-3 gap-2 bg-white border rounded-lg shadow p-2">
                {months.map((m, i) => (
                  <div
                    key={m}
                    onClick={() => {
                      onChange(buildDate(selectedYear, i + 1, selectedDay));
                      setOpenField(null);
                    }}
                    className={`p-2 text-center text-sm cursor-pointer rounded ${
                      selectedMonth === i + 1
                        ? "bg-green-100 font-semibold"
                        : "hover:bg-green-50"
                    }`}
                  >
                    {m}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ================= YEAR ================= */}
          <div className="w-full relative">
            <div
              onClick={() => setOpenField(openField === "year" ? null : "year")}
              className="border rounded-lg px-3 py-2 bg-white cursor-pointer hover:ring-2 hover:ring-green-400 flex justify-between"
            >
              <div>
                <p className="text-xs text-gray-500">Year</p>
                <p className="text-sm font-semibold">{selectedYear}</p>
              </div>
              <ChevronDown
                size={18}
                className={openField === "year" ? "rotate-180" : ""}
              />
            </div>

            {openField === "year" && (
              <div className="absolute z-20 mt-2 w-full max-h-60 overflow-y-auto bg-white border rounded-lg shadow">
                {years.map((y) => (
                  <div
                    key={y}
                    onClick={() => {
                      onChange(buildDate(y, selectedMonth, selectedDay));
                      setOpenField(null);
                    }}
                    className={`px-3 py-2 text-sm cursor-pointer ${
                      selectedYear === y
                        ? "bg-green-100 font-semibold"
                        : "hover:bg-green-50"
                    }`}
                  >
                    {y}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="border rounded-lg px-3 py-2 bg-gray-100 text-sm">
          {value ? formatDate(value) : "N/A"}
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
