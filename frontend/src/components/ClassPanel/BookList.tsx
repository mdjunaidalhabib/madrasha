import React from "react";

export default function BookList({
  books = [],
  selectedBooks = [],
  setSelectedBooks,
}: any) {
  const toggleBook = (id: number) => {
    if (selectedBooks.includes(id)) {
      setSelectedBooks(selectedBooks.filter((b: number) => b !== id));
    } else {
      setSelectedBooks([...selectedBooks, id]);
    }
  };

  if (!Array.isArray(books)) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-gray-700">বই নির্বাচন করুন</h2>
        {books.length > 0 && (
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            {selectedBooks.length} / {books.length} নির্বাচিত
          </span>
        )}
      </div>

      {books.length === 0 ? (
        <p className="rounded-lg border border-dashed py-6 text-center text-sm text-gray-400">
          কোনো বই পাওয়া যায়নি
        </p>
      ) : (
        <div className="flex max-h-64 flex-wrap content-start gap-2 overflow-y-auto pr-1">
          {books.map((b: any) => {
            const active = selectedBooks.includes(b.book_id);

            return (
              <button
                type="button"
                key={b.book_id}
                onClick={() => toggleBook(b.book_id)}
                title={b.book_name_bn}
                className={`group relative flex w-auto shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition
                  ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                  }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]
                    ${active ? "border-white/80 bg-white/20" : "border-gray-300 group-hover:border-blue-400"}`}
                >
                  {active && "✓"}
                </span>
                <span className="truncate">{b.book_name_bn}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
