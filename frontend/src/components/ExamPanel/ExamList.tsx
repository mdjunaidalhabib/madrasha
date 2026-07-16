import { useState } from "react";
import api from "../../services/api";

interface ExamListProps {
  exams: Array<{ id: string | number; name: string; year: string }>;
  reload: () => void;
}

export default function ExamList({ exams, reload }: ExamListProps) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");

const addExam = async () => {
  if (!name || !year) return alert("Required");

  try {
    await api.post("/exams", { name, year });
    setName("");
    setYear("");
    reload();
  } catch {
    alert("Failed");
  }
};
  const deleteExam = async (id: string | number) => {
    await api.delete(`/exams/${id}`);
    reload();
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md space-y-4">
      <h2 className="text-xl font-semibold text-gray-700">📘 Exams</h2>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="border rounded-lg px-3 py-2 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Exam Name"
        />
        <input
          className="border rounded-lg px-3 py-2 w-full sm:w-32"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Year"
        />
        <button
          onClick={addExam}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg sm:py-0"
        >
          Add
        </button>
      </div>

      <div className="space-y-2">
        {exams.map((e) => (
          <div
            key={e.id}
            className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg"
          >
            <span>
              {e.name} ({e.year})
            </span>
            <button
              onClick={() => deleteExam(e.id)}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
