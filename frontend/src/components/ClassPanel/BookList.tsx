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
      <h2 className="mb-3 font-medium text-gray-700">বই নির্বাচন করুন</h2>

      {books.length === 0 ? (
        <p className="text-gray-400">কোনো বই পাওয়া যায়নি</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {books.map((b: any) => {
            const active = selectedBooks.includes(b.book_id);

            return (
              <div
                key={b.book_id}
                onClick={() => toggleBook(b.book_id)}
                className={`cursor-pointer border rounded-lg px-3 py-2 text-sm transition
                  ${
                    active
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white hover:bg-gray-100"
                  }`}
              >
                {b.book_name_bn}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
