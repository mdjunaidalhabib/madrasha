import { localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import ToggleSection from "./ToggleSection";
import { createMadrasaText } from "./createMadrasa.text";

type Item = {
  key: string;
  label: string;
};

type Group = {
  title: string;
  items: Item[];
};

type Props = {
  groups: Group[];
  classes: string[];
  setClasses: React.Dispatch<React.SetStateAction<string[]>>;
};

export default function ClassesSection({ groups, classes, setClasses }: Props) {
  const t = useText(createMadrasaText);
  const lang = useLang();
  if (!groups.length) return null;

  const total = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2 dark:text-slate-400">{t.totalClasses(localizeDigits(total, lang))}</p>

      <ToggleSection title={t.classes} groups={groups} selected={classes} setSelected={setClasses} />
    </div>
  );
}
