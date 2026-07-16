import { ReportMenuItem } from "../../../src/features/reports/types";

type ReportSidebarProps = {
  reports: ReportMenuItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

const ReportSidebar = ({ reports, activeKey, onChange }: ReportSidebarProps) => {
  return (
    <aside className="no-print self-start rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="mb-2 rounded-lg bg-blue-800 px-3 py-2 text-white">
        <h2 className="text-base font-bold">রিপোর্ট সমূহ</h2>
      </div>

      <div className="space-y-1">
        {reports.map((item) => {
          const active = item.key === activeKey;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-base transition ${
                active
                  ? "border-blue-700 bg-blue-50 text-blue-900"
                  : "border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="truncate font-medium">{item.title}</span>
              <span className={active ? "text-blue-700" : "text-slate-300"}>›</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default ReportSidebar;
