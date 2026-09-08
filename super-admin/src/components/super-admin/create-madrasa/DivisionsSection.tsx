import ToggleSection from "./ToggleSection";

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
  return (
    <ToggleSection
      title="Divisions"
      items={items}
      selected={divisions}
      setSelected={setDivisions}
    />
  );
}
