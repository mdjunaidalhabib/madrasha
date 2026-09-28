import { useText } from "@madrasha/shared-ui/src/i18n";
import ToggleSection from "./ToggleSection";
import { createMadrasaText } from "./createMadrasa.text";

type Item = {
  key: string;
  label: string;
  group_name?: string;
};

type Props = {
  items: Item[];
  modules: string[];
  setModules: React.Dispatch<React.SetStateAction<string[]>>;
};

export default function ModulesSection({ items, modules, setModules }: Props) {
  const t = useText(createMadrasaText);
  return (
    <ToggleSection
      title={t.modules}
      items={items || []}
      selected={modules}
      setSelected={setModules}
    />
  );
}
