import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, BookOpen, X } from "lucide-react";
import { libraryBookApi, libraryCategoryApi } from "../../services/phase2Api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { commonText, formatNumber, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { libraryText } from "./library.text";

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
  const lang = useLang();
  const t = useText(libraryText).catalog;
  const c = useText(commonText);
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
      useToastStore.getState().show(t.categoryAdded, "success");
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
      useToastStore.getState().show(t.categoryUpdated, "success");
      setEditingCategory(null);
      loadCategories();
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (category: LibraryCategory) => {
    if (!window.confirm(t.confirmDeleteCategory(category.name))) return;
    await libraryCategoryApi.remove(category.id);
    useToastStore.getState().show(t.categoryDeleted, "success");
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
      useToastStore.getState().show(t.titleRequired, "error");
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
        useToastStore.getState().show(t.bookUpdated, "success");
      } else {
        await libraryBookApi.create(payload);
        useToastStore.getState().show(t.bookAdded, "success");
      }
      setBookModalOpen(false);
      loadBooks();
    } finally {
      setSavingBook(false);
    }
  };

  const handleDeleteBook = async (book: LibraryBook) => {
    if (!window.confirm(t.confirmDeleteBook(book.title))) return;
    try {
      await libraryBookApi.remove(book.id);
      useToastStore.getState().show(t.bookDeleted, "success");
      loadBooks();
    } catch {
      // global axios interceptor already shows the server's friendly error
      // (e.g. "loan history exists, deactivate instead")
    }
  };

  const toggleBookActive = async (book: LibraryBook) => {
    await libraryBookApi.update(book.id, { is_active: !book.isActive });
    useToastStore.getState().show(book.isActive ? t.bookDeactivated : t.bookActivated, "success");
    loadBooks();
  };

  const categoryOptions = useMemo(() => categories, [categories]);

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">{t.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* Categories panel */}
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-300">{t.categories}</h2>
            <div className="mb-3 flex gap-1.5">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                placeholder={t.newCategory}
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
                className={`rounded-md px-2 py-1.5 text-start text-xs font-medium transition ${
                  !categoryFilter ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" : "text-gray-600 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {t.allBooks}
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
                        className="flex-1 truncate text-start font-medium"
                      >
                        {cat.name}
                      </button>
                      <span className="hidden shrink-0 gap-1 group-hover:flex">
                        <button
                          type="button"
                          title={t.edit}
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
                          title={t.delete}
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
                <Search size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="h-9 w-full rounded-md border border-gray-300 ps-8 pe-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <button
                type="button"
                onClick={openCreateBookModal}
                className="flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus size={15} />
                {t.newBook}
              </button>
            </div>

            {booksLoading ? (
              <SkeletonList items={4} />
            ) : books.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
                <BookOpen size={28} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                {t.noBooks}
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
                            {t.inactive}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                        {book.isbn ? `ISBN: ${book.isbn} · ` : ""}
                        {book.shelfLocation ? t.shelf(book.shelfLocation) : ""}
                        {t.copies}{" "}
                        <span className={book.copiesAvailable > 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-rose-600 dark:text-rose-400"}>
                          {formatNumber(book.copiesAvailable, lang)}/{formatNumber(book.copiesTotal, lang)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleBookActive(book)}
                        className="flex h-7 items-center rounded-md border border-gray-200 px-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {book.isActive ? t.deactivate : t.activate}
                      </button>
                      <button
                        type="button"
                        title={t.edit}
                        onClick={() => openEditBookModal(book)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        title={t.delete}
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
        title={editingBook ? t.editBookTitle : t.addBookTitle}
        onClose={() => setBookModalOpen(false)}
        maxWidthClassName="max-w-lg"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{t.bookName}</label>
            <input
              type="text"
              value={bookForm.title}
              onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{t.author}</label>
            <input
              type="text"
              value={bookForm.author}
              onChange={(e) => setBookForm((f) => ({ ...f, author: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{t.publisher}</label>
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
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{t.shelfLocation}</label>
            <input
              type="text"
              value={bookForm.shelf_location}
              onChange={(e) => setBookForm((f) => ({ ...f, shelf_location: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{t.category}</label>
            <select
              value={bookForm.category_id}
              onChange={(e) => setBookForm((f) => ({ ...f, category_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{c.select}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{t.totalCopies}</label>
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
            {c.cancel}
          </button>
          <button
            type="button"
            disabled={savingBook}
            onClick={handleSaveBook}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {savingBook ? c.saving : c.save}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default LibraryCatalogPage;
