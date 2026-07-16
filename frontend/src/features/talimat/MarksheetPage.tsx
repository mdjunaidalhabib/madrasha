import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../services/api";

export default function MarksheetPage() {
  const { student_id } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await api.get(`/talimat/marksheet/${student_id}`);
      setData(res.data);
    })();
  }, [student_id]);

  if (!data) return <div>Loading...</div>;

  return (
    <div className="p-6 print:p-0">
      <div className="bg-white shadow p-8 max-w-3xl mx-auto print:shadow-none" id="marksheet">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">মাদ্রাসা ফলাফল পত্র</h1>
          <p>Student ID: {student_id}</p>
        </div>

        <table className="w-full border border-collapse mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">বিষয়</th>
              <th className="border p-2 text-center">নম্বর</th>
            </tr>
          </thead>
          <tbody>
            {data.subjects.map((s: any, i: number) => (
              <tr key={i}>
                <td className="border p-2">{s.subject}</td>
                <td className="border p-2 text-center">{s.marks}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mb-6">
          <p><b>Total:</b> {data.total}</p>
          <p><b>Average:</b> {Number(data.average).toFixed(2)}</p>
          <p><b>Grade:</b> {data.grade}</p>
        </div>

        <div className="flex justify-between mt-10">
          <div>
            <div className="border-t w-40"></div>
            <p className="text-sm mt-2">শিক্ষক স্বাক্ষর</p>
          </div>
          <div>
            <div className="border-t w-40"></div>
            <p className="text-sm mt-2">মুহতামিম</p>
          </div>
        </div>
      </div>

      <div className="text-center mt-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Print
        </button>
      </div>
    </div>
  );
}
