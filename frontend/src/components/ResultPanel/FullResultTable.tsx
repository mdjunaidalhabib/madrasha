"use client";

interface SummaryMark {
  book_id: number;
  book_name: string;
  mark: number;
}

interface Summary {
  result_master_id?: number;
  student_id: number;
  name_bn: string;
  total: number;
  average: number;
  general_grade?: string;
  madrasa_grade?: string;
  status: string;
  rank_no: number;
  publish_status?: string;
  marks?: SummaryMark[];
}

interface Book {
  book_id: number;
  book_name?: string;
  book_name_bn?: string;
  name_bn?: string;
}

interface Props {
  summary: Summary[];
  books: Book[];
  loading?: boolean;
  publishing?: boolean;
  onView?: (student_id: number) => void;
  onEdit?: () => void;
  onEditStudent?: (student_id: number) => void;
  onDelete?: (result_master_id: number) => void;
  onPublish?: () => void;
}

export default function FullResultTable({
  summary,
  books,
  loading = false,
  publishing = false,
  onView,
  onEdit,
  onEditStudent,
  onDelete,
  onPublish,
}: Props) {
  const dataList = Array.isArray(summary) ? summary : [];
  const subjectList = Array.isArray(books) ? books : [];

  const alreadyPublished =
    dataList.length > 0 && dataList[0]?.publish_status === "PUBLISHED";

  const handleDelete = () => {
    const resultMasterId = dataList[0]?.result_master_id;
    if (!resultMasterId || !onDelete) return;

    if (confirm("Are you sure?")) {
      onDelete(resultMasterId);
    }
  };

  const getMark = (student: Summary, bookId: number) => {
    const found = student.marks?.find((m) => m.book_id === bookId);
    return found ? found.mark : "-";
  };

  return (
    <div className="bg-white shadow-md rounded-xl p-4 overflow-auto mt-4">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">📊 Full Result Table</h2>
          {dataList.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Status:{" "}
              <span
                className={`font-semibold ${
                  alreadyPublished ? "text-green-600" : "text-yellow-600"
                }`}
              >
                {alreadyPublished ? "PUBLISHED" : "DRAFT"}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.print()}
            className="bg-gray-700 text-white px-4 py-2 rounded"
          >
            🖨 Print
          </button>

          {onEdit && (
            <button
              onClick={onEdit}
              title="পুরো ক্লাসের নাম্বার একসাথে এডিট করুন"
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              ✏️ Edit Marks (সম্পূর্ণ ক্লাস)
            </button>
          )}

          {onDelete && (
            <button
              onClick={handleDelete}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Delete
            </button>
          )}

          {onPublish && !alreadyPublished && (
            <button
              onClick={onPublish}
              disabled={publishing}
              className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center py-6 text-blue-500">Loading...</div>
      )}

      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-2">ID</th>
            <th className="border px-2 py-2">Name</th>

            {subjectList.map((b) => (
              <th key={b.book_id} className="border px-2 py-2">
                {b.book_name ||
                  b.book_name_bn ||
                  b.name_bn ||
                  `Book ${b.book_id}`}
              </th>
            ))}

            <th className="border px-2 py-2">Total</th>
            <th className="border px-2 py-2">Avg</th>
            <th className="border px-2 py-2">General Grade</th>
            <th className="border px-2 py-2">Madrasa Grade</th>
            <th className="border px-2 py-2">Status</th>
            <th className="border px-2 py-2">Rank</th>
            <th className="border px-2 py-2">Action</th>
          </tr>
        </thead>

        <tbody>
          {dataList.length === 0 ? (
            <tr>
              <td
                colSpan={subjectList.length + 10}
                className="text-center py-10 text-gray-400"
              >
                No Result Found
              </td>
            </tr>
          ) : (
            dataList.map((s) => (
              <tr key={s.student_id} className="hover:bg-gray-50">
                <td className="border px-2 py-2 text-center">{s.student_id}</td>
                <td className="border px-2 py-2">{s.name_bn}</td>

                {subjectList.map((b) => (
                  <td key={b.book_id} className="border px-2 py-2 text-center">
                    {getMark(s, b.book_id)}
                  </td>
                ))}

                <td className="border px-2 py-2 text-blue-600 text-center">
                  {s.total}
                </td>
                <td className="border px-2 py-2 text-green-600 text-center">
                  {Number(s.average).toFixed(2)}
                </td>
                <td className="border px-2 py-2 text-center">
                  {s.general_grade || "-"}
                </td>
                <td className="border px-2 py-2 text-center">
                  {s.madrasa_grade || "-"}
                </td>
                <td className="border px-2 py-2 text-center">{s.status}</td>
                <td className="border px-2 py-2 text-center font-bold">
                  #{s.rank_no}
                </td>

                <td className="border px-2 py-2">
                  <div className="flex gap-2 justify-center">
                    {onView && (
                      <button
                        onClick={() => onView(s.student_id)}
                        className="text-blue-600"
                      >
                        View
                      </button>
                    )}
                    {onEditStudent && (
                      <button
                        onClick={() => onEditStudent(s.student_id)}
                        title="শুধুমাত্র এর নাম্বার এডিট করুন"
                        className="text-indigo-600"
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
