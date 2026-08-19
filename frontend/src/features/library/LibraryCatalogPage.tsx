import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, BookOpen, X } from "lucide-react";
import { libraryBookApi, libraryCategoryApi } from "../../services/phase2Api";
import { useToastStore } from "../../store/toastStore";
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";

type LibraryCategory = { id: number; name: string };

type LibraryBook = {
  id: number;
  title: string;
  author?: string | null;
  isbn?: string | null;
  publisher?: string | null;
  shelfLocation?: string | null;
  copiesTotal: number;
  copiesAvailable: number;
  isActive: boolean;
  category?: { id: number; name: string } | null;
};

const emptyBookForm = {
  title: "",
  author: "",
  isbn: "",
  publisher: "",
  shelf_location: "",
  category_id: "",
  copies_total: "1",
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const LibraryCatalogPage = () => {
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [query, setQuery] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<LibraryCategory | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<LibraryBook | null>(null);
  const [bookForm, setBookForm] = useState(emptyBookForm);
  const [savingBook, setSavingBook] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const res = await libraryCategoryApi.list();
      setCategories(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD LIBRARY CATEGORIES ERROR:", err);
      setCategories([]);
    }
  }, []);

  const loadBooks = useCallback(async () => {
    try {
      setBooksLoading(true);
      const res = await libraryBookApi.list({
        category_id: categoryFilter ? Number(categoryFilter) : undefined,
        q: query.trim() || undefined,
      });
      setBooks(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD LIBRARY BOOKS ERROR:", err);
      setBooks([]);
    } finally {
      setBooksLoading(false);
    }
  }, [categoryFilter, query]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const timer = setTimeout(loadBooks, 250);
    return () => clearTimeout(timer);
  }, [loadBooks]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      setSavingCategory(true);
      await libraryCategoryApi.create({ name: newCategoryName.trim() });
      useToastStore.getState().show("ক্যাটাগরি যোগ করা হয়েছে", "success");
      setNewCategoryName("");
      loadCategories();
    } finally {
      setSavingCategory(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCategoryName.trim()) return;
    try {
      setSavingCategory(true);
      await libraryCategoryApi.update(editingCategory.id, { name: editingCategoryName.trim() });
      useToastStore.getState().show("ক্যাটাগরি আপডেট হয়েছে", "success");
      setEditingCategory(null);
      loadCategories();
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (category: LibraryCategory) => {
    if (!window.confirm(`"${category.name}" ক্যাটাগরিটি মুছে ফেলতে চান?`)) return;
    await libraryCategoryApi.remove(category.id);
    useToastStore.getState().show("ক্যাটাগরি মুছে ফেলা হয়েছে", "success");
    loadCategories();
    loadBooks();
  };

  const openCreateBookModal = () => {
    setEditingBook(null);
    setBookForm(emptyBookForm);
    setBookModalOpen(true);
  };

  const openEditBookModal = (book: LibraryBook) => {
    setEditingBook(book);
    setBookForm({
      title: book.title,
      author: book.author || "",
      isbn: book.isbn || "",
      publisher: book.publisher || "",
      shelf_location: book.shelfLocation || "",
      category_id: book.category?.id ? String(book.category.id) : "",
      copies_total: String(book.copiesTotal),
    });
    setBookModalOpen(true);
  };

  const handleSaveBook = async () => {
    if (!bookForm.title.trim()) {
      useToastStore.getState().show("বইয়ের নাম দিন", "error");
      return;
    }
    const payload = {
      title: bookForm.title.trim(),
      author: bookForm.author.trim() || undefined,
      isbn: bookForm.isbn.trim() || undefined,
      publisher: bookForm.publisher.trim() || undefined,
      shelf_location: bookForm.shelf_location.trim() || undefined,
      category_id: bookForm.category_id ? Number(bookForm.category_id) : undefined,
      copies_total: Number(bookForm.copies_total) || 1,
    };

    try {
      setSavingBook(true);
      if (editingBook) {
        await libraryBookApi.update(editingBook.id, payload);
        useToastStore.getState().show("বইয়ের তথ্য আপডেট হয়েছে", "success");
      } else {
        await libraryBookApi.create(payload);
        useToastStore.getState().show("নতুন বই যোগ করা হয়েছে", "success");
      }
      setBookModalOpen(false);
      loadBooks();
    } finally {
      setSavingBook(false);
    }
  };

  const handleDeleteBook = async (book: LibraryBook) => {
    if (!window.confirm(`"${book.title}" বইটি মুছে ফেলতে চান?`)) return;
    try {
      await libraryBookApi.remove(book.id);
      useToastStore.getState().show("বই মুছে ফেলা হয়েছে", "success");
      loadBooks();
    } catch {
      // global axios interceptor already shows the server's friendly error
      // (e.g. "loan history exists, deactivate instead")
    }
  };

  const toggleBookActive = async (book: LibraryBook) => {
    await libraryBookApi.update(book.id, { is_active: !book.isActive });
    useToastStore.getState().show(book.isActive ? "বই নিষ্ক্রিয় করা হয়েছে" : "বই সক্রিয় করা হয়েছে", "success");
    loadBooks();
  };

  const categoryOptions = useMemo(() => categories, [categories]);

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">বই তালিকা</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">লাইব্রেরির বই ও ক্যাটাগরি পরিচালনা করুন</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* Categories panel */}
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-300">ক্যাটাগরি সমূহ</h2>
            <div className="mb-3 flex gap-1.5">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                placeholder="নতুন ক্যাটাগরি"
                className="h-8 flex-1 rounded-md border border-gray-300 px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                disabled={savingCategory || !newCategoryName.trim()}
                onClick={handleCreateCategory}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setCategoryFilter("")}
                className={`rounded-md px-2 py-1.5 text-left text-xs font-medium transition ${
                  !categoryFilter ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" : "text-gray-600 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                সব বই
              </button>
              {categoryOptions.map((cat) => (
                <div
                  key={cat.id}
                  className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition ${
                    categoryFilter === String(cat.id)
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                      : "text-gray-600 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {editingCategory?.id === cat.id ? (
                    <div className="flex flex-1 items-center gap-1">
                      <input
                        autoFocus
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleUpdateCategory()}
                        className="h-6 flex-1 rounded border border-gray-300 px-1.5 text-xs outline-none dark:border-slate-600 dark:bg-slate-900"
                      />
                      <button type="button" onClick={handleUpdateCategory} className="text-green-600">
                        ✓
                      </button>
                      <button type="button" onClick={() => setEditingCategory(null)} className="text-gray-400">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter(String(cat.id))}
                        className="flex-1 truncate text-left font-medium"
                      >
                        {cat.name}
                      </button>
                      <span className="hidden shrink-0 gap-1 group-hover:flex">
                        <button
                          type="button"
                          title="সম্পাদনা"
                          onClick={() => {
                            setEditingCategory(cat);
                            setEditingCategoryName(cat.name);
                          }}
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          title="মুছুন"
                          onClick={() => handleDeleteCategory(cat)}
                          className="text-gray-400 hover:text-rose-600"
                        >
                          <Trash2 size={11} />
                        </button>
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Books panel */}
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="relative w-full sm:w-64">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="নাম, লেখক বা ISBN দিয়ে খুঁজুন"
                  className="h-9 w-full rounded-md border border-gray-300 pl-8 pr-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <button
                type="button"
                onClick={openCreateBookModal}
                className="flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus size={15} />
                নতুন বই
              </button>
            </div>

            {booksLoading ? (
              <SkeletonList items={4} />
            ) : books.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
                <BookOpen size={28} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                কোনো বই পাওয়া যায়নি
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-sm transition ${
                      book.isActive ? "border-gray-100 dark:border-slate-800" : "border-gray-100 opacity-50 dark:border-slate-800"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-gray-800 dark:text-slate-100">{book.title}</span>
                        {book.author && <span className="text-xs text-gray-500 dark:text-slate-400">— {book.author}</span>}
                        {book.category && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                            {book.category.name}
                          </span>
                        )}
                        {!book.isActive && (
                          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                            নিষ্ক্রিয়
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                        {book.isbn ? `ISBN: ${book.isbn} · ` : ""}
                        {book.shelfLocation ? `শেলফ: ${book.shelfLocation} · ` : ""}
                        কপি:{" "}
                        <span className={book.copiesAvailable > 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-rose-600 dark:text-rose-400"}>
                          {book.copiesAvailable}/{book.copiesTotal}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleBookActive(book)}
                        className="flex h-7 items-center rounded-md border border-gray-200 px-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {book.isActive ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                      </button>
                      <button
                        type="button"
                        title="সম্পাদনা"
                        onClick={() => openEditBookModal(book)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        title="মুছুন"
                        onClick={() => handleDeleteBook(book)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-rose-500 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={bookModalOpen}
        title={editingBook ? "বইয়ের তথ্য সম্পাদনা করুন" : "নতুন বই যোগ করুন"}
        onClose={() => setBookModalOpen(false)}
        maxWidthClassName="max-w-lg"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">বইয়ের নাম *</label>
            <input
              type="text"
              value={bookForm.title}
              onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">লেখক</label>
            <input
              type="text"
              value={bookForm.author}
              onChange={(e) => setBookForm((f) => ({ ...f, author: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">প্রকাশক</label>
            <input
              type="text"
              value={bookForm.publisher}
              onChange={(e) => setBookForm((f) => ({ ...f, publisher: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">ISBN</label>
            <input
              type="text"
              value={bookForm.isbn}
              onChange={(e) => setBookForm((f) => ({ ...f, isbn: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">শেলফ লোকেশন</label>
            <input
              type="text"
              value={bookForm.shelf_location}
              onChange={(e) => setBookForm((f) => ({ ...f, shelf_location: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">ক্যাটাগরি</label>
            <select
              value={bookForm.category_id}
              onChange={(e) => setBookForm((f) => ({ ...f, category_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">নির্বাচন করুন</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">মোট কপি সংখ্যা</label>
            <input
              type="number"
              min={1}
              value={bookForm.copies_total}
              onChange={(e) => setBookForm((f) => ({ ...f, copies_total: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setBookModalOpen(false)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={savingBook}
            onClick={handleSaveBook}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {savingBook ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default LibraryCatalogPage;
