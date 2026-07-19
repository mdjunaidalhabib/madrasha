interface Division {
  division_id: number;
  division_name_bn: string;
}

interface Exam {
  id: number;
  name: string;
}

interface ClassItem {
  class_id: number;
  class_name_bn: string;
}

interface Props {
  divisions: Division[];
  exams: Exam[];
  classes: ClassItem[];

  divisionId: string;
  examId: string;
  classId: string;

  setDivisionId: (id: string) => void;
  setExamId: (id: string) => void;
  setClassId: (id: string) => void;
}

export default function ResultFilter({
  divisions,
  exams,
  classes,
  divisionId,
  examId,
  classId,
  setDivisionId,
  setExamId,
  setClassId,
}: Props) {
  return (
    <div className="bg-white shadow-md rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {/* DIVISION */}
      <select
        value={divisionId}
        onChange={(e) => {
          setDivisionId(e.target.value);
          setClassId("");
        }}
        className="w-full border p-2.5 sm:p-2 rounded text-base sm:text-sm"
      >
        <option value="">Division</option>
        {divisions.map((d) => (
          <option key={d.division_id} value={d.division_id}>
            {d.division_name_bn}
          </option>
        ))}
      </select>

      {/* EXAM */}
      <select
        value={examId}
        onChange={(e) => setExamId(e.target.value)}
        className="w-full border p-2.5 sm:p-2 rounded text-base sm:text-sm"
      >
        <option value="">Exam</option>
        {exams.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>

      {/* CLASS */}
      <select
        value={classId}
        onChange={(e) => setClassId(e.target.value)}
        disabled={!divisionId}
        className="w-full border p-2.5 sm:p-2 rounded disabled:bg-gray-100 text-base sm:text-sm"
      >
        <option value="">Class</option>
        {classes.map((c) => (
          <option key={c.class_id} value={c.class_id}>
            {c.class_name_bn}
          </option>
        ))}
      </select>
    </div>
  );
}
