import { useState } from "react";
import api from "../../services/api";

export default function MadrasaGradeList({
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
      await api.post("/madrasa-grades", {
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
    await api.delete(`/madrasa-grades/${id}`);
    reload();
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md space-y-5">
      {/* Header */}
      <h2 className="text-xl font-semibold text-gray-800">🕌 Madrasa Grades</h2>

      {/* Input Section */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="Grade (e.g. Mumtaz)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex gap-3">
          <input
            className="border rounded-lg px-3 py-2 w-full sm:w-24 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Min"
            type="number"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />

          <input
            className="border rounded-lg px-3 py-2 w-full sm:w-24 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Max"
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />

          <button
            onClick={add}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:py-0 rounded-lg transition"
          >
            Add
          </button>
        </div>
      </div>

      {/* List Section */}
      <div className="space-y-2">
        {grades.length === 0 && (
          <p className="text-gray-400 text-sm">No grades added yet</p>
        )}

        {grades.map((g) => (
          <div
            key={g.id}
            className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg hover:bg-gray-100 transition"
          >
            <span className="text-gray-700 font-medium">
              {g.name} ({g.min_mark} - {g.max_mark})
            </span>

            <button
              onClick={() => del(g.id)}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm transition"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
