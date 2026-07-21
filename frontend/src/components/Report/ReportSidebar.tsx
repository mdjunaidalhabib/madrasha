import { ReportMenuItem } from "../../../src/features/reports/types";

type ReportSidebarProps = {
  reports: ReportMenuItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

type ReportSection = {
  title?: string;
  items: ReportMenuItem[];
};

const ReportSidebar = ({ reports, activeKey, onChange }: ReportSidebarProps) => {
  const sections = reports.reduce<ReportSection[]>((acc, item) => {
    const title = item.groupTitle;
    const current = acc.find((section) => section.title === title);
    if (current) current.items.push(item);
    else acc.push({ title, items: [item] });
    return acc;
  }, []);

  return (
    <aside className="report-sidebar no-print self-start rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-4">
      <div className="mb-2 rounded-lg bg-blue-800 px-3 py-2 text-white">
        <h2 className="text-base font-bold">রিপোর্ট সমূহ</h2>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:block lg:space-y-2">
        {sections.map((section, sectionIndex) => (
          <div key={section.title || `general-${sectionIndex}`}>
            {section.title && (
              <div className="mb-1 mt-2 border-y border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[15px] font-semibold text-slate-800">
                {section.title}
              </div>
            )}

            <div className="space-y-1">
              {section.items.map((item) => {
                const active = item.key === activeKey;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onChange(item.key)}
                    className={`flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-base transition ${
                      section.title ? "pl-4" : ""
                    } ${
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
          </div>
        ))}
      </div>
    </aside>
  );
};

export default ReportSidebar;
