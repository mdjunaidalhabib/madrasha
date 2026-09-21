import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";
import FilterSelect from "../../common/FilterSelect";
import { useNoticeBoardReportStore } from "../../../store/noticeBoardReportStore";

type NoticeBoardPickerProps = {
  selectClassName: string;
  iconClassName: string;
};

/** "নোটিশ বোর্ড" রিপোর্টের উপরের ফিল্টার বারে বসা নোটিশ-বাছাই ড্রপডাউন ও ম্যানেজ লিংক। */
const NoticeBoardPicker = ({ selectClassName, iconClassName }: NoticeBoardPickerProps) => {
  const notices = useNoticeBoardReportStore((s) => s.notices);
  const selectedId = useNoticeBoardReportStore((s) => s.selectedId);
  const setSelectedId = useNoticeBoardReportStore((s) => s.setSelectedId);
  const load = useNoticeBoardReportStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <FilterSelect
        value={selectedId ?? ""}
        onChange={(value) => setSelectedId(value ? Number(value) : null)}
        disabled={!notices?.length}
        wrapperClassName="min-w-[180px] flex-1 sm:w-auto sm:flex-none"
        selectClassName={selectClassName}
        iconClassName={iconClassName}
      >
        {notices === null && <option value="">লোড হচ্ছে...</option>}
        {notices?.length === 0 && <option value="">কোনো নোটিশ নেই</option>}
        {notices?.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title}
          </option>
        ))}
      </FilterSelect>
      <Link
        to="/talimat/settings/notices"
        className="flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-2 text-[13px] font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50"
      >
        <Settings2 className="h-3 w-3" />
        নতুন/এডিট/ডিলিট
      </Link>
    </>
  );
};

export default NoticeBoardPicker;
