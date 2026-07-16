type Item<T extends string> = {
  key: T;
  label: string;
};

type Group<T extends string> = {
  title: string;
  items: Item<T>[];
};

type Props<T extends string> = {
  title: string;
  items?: Item<T>[];
  groups?: Group<T>[];
  selected: T[];
  setSelected: React.Dispatch<React.SetStateAction<T[]>>;
};

export default function ToggleSection<T extends string>({
  title,
  items = [],
  groups = [],
  selected,
  setSelected,
}: Props<T>) {
  const allItems = groups.length ? groups.flatMap((g) => g.items) : items;

  const isOn = allItems.length > 0 && selected.length === allItems.length;

  const toggleAll = () => {
    if (!allItems.length) return;
    setSelected(isOn ? [] : allItems.map((i) => i.key));
  };

  const toggleOne = (key: T) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  if (!allItems.length) {
    return (
      <div className="border rounded-lg p-4">
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-gray-500 mt-2">No data found</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">{title}</h4>
        <ToggleSwitch checked={isOn} onChange={toggleAll} />
      </div>

      {/* GROUPED */}
      {groups.length > 0 ? (
        groups.map((group) => (
          <div key={group.title}>
            <h5 className="text-sm font-semibold text-gray-600 mb-2">{group.title}</h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.items.map((i) => (
                <label key={i.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(i.key)}
                    onChange={() => toggleOne(i.key)}
                  />
                  <span>{i.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((i) => (
            <label key={i.key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(i.key)}
                onChange={() => toggleOne(i.key)}
              />
              <span>{i.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-12 h-6 flex items-center rounded-full p-1 transition ${
        checked ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
          checked ? "translate-x-6" : ""
        }`}
      />
    </button>
  );
}
