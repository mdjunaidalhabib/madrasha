import ToggleSection from "./ToggleSection";

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
  if (!groups.length) return null;

  const total = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">Total Classes: {total}</p>

      <ToggleSection title="Classes" groups={groups} selected={classes} setSelected={setClasses} />
    </div>
  );
}
