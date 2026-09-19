import { MADRASA_FAIL_GRADE } from "./failGrade";
import GradeList, { type GradeListConfig, type GradeListProps } from "./GradeList";

const CONFIG: GradeListConfig = {
  endpoint: "/madrasa-grades",
  title: "মাদরাসা গ্রেড",
  icon: <span className="text-base leading-none">🕌</span>,
  namePlaceholder: "গ্রেড (যেমনঃ মুমতায)",
  kind: "madrasa",
  failLabel: MADRASA_FAIL_GRADE,
};

export default function MadrasaGradeList(props: GradeListProps) {
  return <GradeList config={CONFIG} {...props} />;
}
