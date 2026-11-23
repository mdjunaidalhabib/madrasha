import { useText } from "@madrasha/shared-ui/src/i18n";
import { reportsText } from "../../features/reports/reports.text";

type Props = {
  value: 1 | 2;
  onChange: (value: 1 | 2) => void;
};

export default function PageColumnSelector({ value, onChange }: Props) {
  const t = useText(reportsText).shell;
  return (
    <label className="w-full sm:w-auto">
      <span className="sr-only">{t.pageLayout}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value === "2" ? 2 : 1)}
        className="h-8 w-full min-w-[88px] rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-blue-900/40 sm:w-auto"
      >
        <option value="1">{t.oneColumn}</option>
        <option value="2">{t.twoColumns}</option>
      </select>
    </label>
  );
}
