import React from "react";

export default function ClassList({ classes, classId, setClassId }: any) {
  return (
    <div>
      <h2 className="mb-2 font-medium dark:text-slate-100">Classes</h2>
      <div className="flex flex-wrap gap-2">
        {classes.map((c: any) => (
          <button
            key={c.class_id}
            onClick={() => setClassId(String(c.class_id))}
            className={`px-3 py-2 border rounded dark:border-slate-700 ${
              classId === String(c.class_id)
                ? "bg-green-500 text-white"
                : "bg-white dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            {c.class_name_bn}
          </button>
        ))}
      </div>
    </div>
  );
}
