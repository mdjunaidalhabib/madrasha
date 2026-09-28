import { BarChart3 } from "lucide-react";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { examPanelText } from "./examPanel.text";
import { GENERAL_FAIL_GRADE } from "./failGrade";
import GradeList, { type GradeListConfig, type GradeListProps } from "./GradeList";

export default function GeneralGradeList(props: GradeListProps) {
  const t = useText(examPanelText);
  const config: GradeListConfig = {
    endpoint: "/general-grades",
    title: t.generalGrade,
    icon: <BarChart3 size={18} />,
    namePlaceholder: t.generalGradePlaceholder,
    kind: "general",
    failLabel: GENERAL_FAIL_GRADE,
  };
  return <GradeList config={config} {...props} />;
}
