import { BarChart3 } from "lucide-react";
import { GENERAL_FAIL_GRADE } from "./failGrade";
import GradeList, { type GradeListConfig, type GradeListProps } from "./GradeList";

const CONFIG: GradeListConfig = {
  endpoint: "/general-grades",
  title: "সাধারণ গ্রেড",
  icon: <BarChart3 size={18} />,
  namePlaceholder: "গ্রেড (যেমনঃ A+)",
  kind: "general",
  failLabel: GENERAL_FAIL_GRADE,
};

export default function GeneralGradeList(props: GradeListProps) {
  return <GradeList config={CONFIG} {...props} />;
}
