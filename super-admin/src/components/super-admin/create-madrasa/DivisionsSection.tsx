import { useText } from "@madrasha/shared-ui/src/i18n";
import ToggleSection from "./ToggleSection";
import { createMadrasaText } from "./createMadrasa.text";

type Item = {
  key: string;
  label: string;
};

type Props = {
  items: Item[];
  divisions: string[];
  setDivisions: React.Dispatch<React.SetStateAction<string[]>>;
};

export default function DivisionsSection({ items, divisions, setDivisions }: Props) {
  const t = useText(createMadrasaText);
  return (
    <ToggleSection
      title={t.divisions}
      items={items}
      selected={divisions}
      setSelected={setDivisions}
    />
  );
}
