import { useText } from "@madrasha/shared-ui/src/i18n";
import { examPanelText } from "./examPanel.text";
import { MADRASA_FAIL_GRADE } from "./failGrade";
import GradeList, { type GradeListConfig, type GradeListProps } from "./GradeList";

export default function MadrasaGradeList(props: GradeListProps) {
  const t = useText(examPanelText);
  const config: GradeListConfig = {
    endpoint: "/madrasa-grades",
    title: t.madrasaGrade,
    icon: <span className="text-base leading-none">🕌</span>,
    namePlaceholder: t.madrasaGradePlaceholder,
    kind: "madrasa",
    failLabel: MADRASA_FAIL_GRADE,
  };
  return <GradeList config={config} {...props} />;
}
