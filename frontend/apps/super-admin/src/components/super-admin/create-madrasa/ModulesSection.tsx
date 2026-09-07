import ToggleSection from "./ToggleSection";

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
  return (
    <ToggleSection
      title="Modules"
      items={items || []}
      selected={modules}
      setSelected={setModules}
    />
  );
}
