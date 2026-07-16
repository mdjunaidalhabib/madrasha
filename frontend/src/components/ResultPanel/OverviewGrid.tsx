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
  division_id: number;
}

interface StatusItem {
  class_id: number;
  division_id: number;
  exam_id: number;
  result_master_id: number | null;
  publish_status: "DRAFT" | "PUBLISHED" | null;
  total_students: number;
  entered_students: number;
}

interface Props {
  divisions: Division[];
  exams: Exam[];
  classes: ClassItem[];
  statuses: StatusItem[];
  loading?: boolean;
  onSelect: (examId: number, classId: number) => void;
}

const getBadge = (s?: StatusItem) => {
  if (!s) {
    return { label: "⚪ এন্ট্রি হয়নি", classes: "bg-gray-100 text-gray-500 border-gray-300" };
  }
  if (s.publish_status === "PUBLISHED") {
    return { label: "✅ প্রকাশিত", classes: "bg-green-100 text-green-700 border-green-300" };
  }
  if (s.entered_students > 0 && s.total_students > 0 && s.entered_students >= s.total_students) {
    return { label: "🟢 এন্ট্রি সম্পন্ন", classes: "bg-blue-100 text-blue-700 border-blue-300" };
  }
  if (s.entered_students > 0) {
    return {
      label: `🟡 আংশিক (${s.entered_students}/${s.total_students})`,
      classes: "bg-yellow-100 text-yellow-700 border-yellow-300",
    };
  }
  return { label: "⚪ এন্ট্রি হয়নি", classes: "bg-gray-100 text-gray-500 border-gray-300" };
};

export default function OverviewGrid({
  divisions,
  exams,
  classes,
  statuses,
  loading = false,
  onSelect,
}: Props) {
  if (loading) {
    return (
      <div className="bg-white shadow-md rounded-xl p-6 text-center text-blue-500">
        লোড হচ্ছে...
      </div>
    );
  }

  if (exams.length === 0 || divisions.length === 0) {
    return (
      <div className="bg-white shadow-md rounded-xl p-6 text-center text-gray-500">
        কোনো পরীক্ষা বা বিভাগ পাওয়া যায়নি। প্রথমে পরীক্ষা ও বিভাগ যোগ করুন।
      </div>
    );
  }

  const statusMap = new Map<string, StatusItem>();
  statuses.forEach((s) => statusMap.set(`${s.exam_id}-${s.class_id}`, s));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
      {exams.map((exam) => (
        <div key={exam.id} className="bg-white shadow-md rounded-xl p-4">
          <h2 className="text-base font-bold text-gray-800 mb-3">📝 {exam.name}</h2>

          <div className="space-y-4">
            {divisions.map((div) => {
              const divClasses = classes.filter((c) => c.division_id === div.division_id);
              if (divClasses.length === 0) return null;

              return (
                <div key={div.division_id}>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">
                    📂 {div.division_name_bn}
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    {divClasses.map((c) => {
                      const status = statusMap.get(`${exam.id}-${c.class_id}`);
                      const badge = getBadge(status);

                      return (
                        <button
                          key={c.class_id}
                          onClick={() => onSelect(exam.id, c.class_id)}
                          className="text-left border border-gray-200 rounded-lg p-3 transition hover:shadow-md hover:border-blue-300"
                        >
                          <div className="font-medium text-gray-800">{c.class_name_bn}</div>
                          <span
                            className={`inline-block mt-2 text-xs px-2 py-1 rounded-full border ${badge.classes}`}
                          >
                            {badge.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
