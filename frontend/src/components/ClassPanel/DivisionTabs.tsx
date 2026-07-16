import React from "react";

export default function DivisionTabs({
  divisions,
  divisionId,
  setDivisionId,
}: any) {
  return (
    <div>
      <h2 className="mb-2 font-medium">Divisions</h2>
      <div className="flex gap-2 flex-wrap">
        {divisions.map((d: any) => (
          <button
            key={d.division_id}
            onClick={() => setDivisionId(String(d.division_id))}
            className={`px-3 py-2 border rounded ${
              divisionId === String(d.division_id)
                ? "bg-blue-500 text-white"
                : "bg-white"
            }`}
          >
            {d.division_name_bn}
          </button>
        ))}
      </div>
    </div>
  );
}
