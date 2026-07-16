import { useState } from "react";
import api from "../../services/api";

export default function GeneralGradeList({
  grades,
  reload,
}: {
  grades: any[];
  reload: () => void;
}) {
  const [name, setName] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

const add = async () => {
  if (!name || !min || !max) return alert("All fields required");

  try {
    await api.post("/general-grades", {
      name,
      min_mark: Number(min),
      max_mark: Number(max),
    });

    setName("");
    setMin("");
    setMax("");
    reload();
  } catch {
    alert("Failed");
  }
};

  const del = async (id: string | number) => {
    await api.delete(`/general-grades/${id}`);
    reload();
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-md space-y-4">
      <h2 className="text-lg font-semibold text-gray-700">📊 General Grades</h2>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="border rounded-lg px-2 py-1 w-full"
          placeholder="Grade"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="border rounded-lg px-2 py-1 w-full sm:w-20"
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
          <input
            className="border rounded-lg px-2 py-1 w-full sm:w-20"
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
          <button
            onClick={add}
            className="shrink-0 bg-blue-600 text-white px-3 py-1 sm:py-0 rounded-lg"
          >
            Add
          </button>
        </div>
      </div>

      {grades.map((g) => (
        <div
          key={g.id}
          className="flex justify-between bg-gray-50 p-2 rounded-lg"
        >
          <span>
            {g.name} ({g.min_mark}-{g.max_mark})
          </span>
          <button
            onClick={() => del(g.id)}
            className="bg-red-500 text-white px-2 rounded"
          >
            X
          </button>
        </div>
      ))}
    </div>
  );
}
