import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCheck,
  ClipboardList,
  Clock3,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Card, { CardHeader } from "@madrasha/shared-ui/src/components/ui/Card";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import api, { cachedGet } from "../../services/api";
import { teacherAssignmentText } from "./teacherAssignment.text";
import TeacherAssignmentCard, { type Assignment } from "./TeacherAssignmentCard";

type Teacher = { id: number; name_bn: string };
type Division = { division_id: number; division_name_bn: string };
type Class = { class_id: number; class_name_bn: string; division_id: number };
type Book = { book_id: number; book_name_bn: string; class_id: number };
type Catalog = { classes: Class[]; books: Book[] };
const selectStyle =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export default function TeacherAssignmentPanel() {
  const t = useText(teacherAssignmentText);
  const lang = useLang();
  const n = (value: number) => localizeDigits(value, lang);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ classes: [], books: [] });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [classId, setClassId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [bookQuery, setBookQuery] = useState("");
  const [form, setForm] = useState({
    teacherId: "",
    divisionId: "",
    classId: "",
    bookIds: [] as number[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [teacherRes, divisionRes, assignmentRes, catalogRes] = await Promise.all([
        cachedGet("/teachers"),
        cachedGet("/madrasa-divisions"),
        cachedGet("/teacher-assignments/all"),
        cachedGet<Catalog>("/teacher-assignments/catalog"),
      ]);
      setTeachers(teacherRes.data?.data || []);
      setDivisions(divisionRes.data || []);
      setAssignments(assignmentRes.data?.data || []);
      setCatalog(catalogRes.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const classMap = useMemo(
    () => new Map(catalog.classes.map((c) => [c.class_id, c])),
    [catalog.classes],
  );
  const assignedIds = new Set(assignments.flatMap((a) => a.books.map((b) => Number(b.book_id))));
  const teacherIds = new Set(assignments.map((a) => Number(a.teacher_id)));
  const matchesClass = (id: number) =>
    (!classId || id === Number(classId)) &&
    (!divisionId || classMap.get(id)?.division_id === Number(divisionId));
  const search = query.trim().toLocaleLowerCase();
  const matchesSearch = (...values: (string | undefined)[]) =>
    !search || values.some((v) => v?.toLocaleLowerCase().includes(search));
  const scopedBooks = catalog.books.filter((b) => matchesClass(b.class_id));
  const pendingBooks = scopedBooks.filter((b) => !assignedIds.has(b.book_id));
  const visiblePending = pendingBooks.filter((b) =>
    matchesSearch(b.book_name_bn, classMap.get(b.class_id)?.class_name_bn),
  );
  const groupedPending = catalog.classes
    .map((c) => ({ ...c, books: visiblePending.filter((b) => b.class_id === c.class_id) }))
    .filter((c) => c.books.length);
  const visibleAssignments = assignments.filter(
    (a) =>
      matchesClass(a.class_id) &&
      matchesSearch(
        a.teacher_name,
        classMap.get(a.class_id)?.class_name_bn,
        ...a.books.map((b) => b.book_name_bn),
      ),
  );
  const availableTeachers = teachers.filter(
    (teacher) =>
      !teacherIds.has(Number(teacher.id)) || Number(teacher.id) === editing?.[0]?.teacher_id,
  );
  const assignmentsByTeacher = new Map<number, Assignment[]>();
  visibleAssignments.forEach((assignment) => {
    assignmentsByTeacher.set(assignment.teacher_id, [
      ...(assignmentsByTeacher.get(assignment.teacher_id) || []),
      assignment,
    ]);
  });
  const selectedTeacher = teachers.find((teacher) => Number(teacher.id) === Number(form.teacherId));
  const editBooks =
    editing?.flatMap((assignment) => assignment.books.map((b) => Number(b.book_id))) || [];
  const availableBooks = catalog.books.filter(
    (b) =>
      b.class_id === Number(form.classId) &&
      (!assignedIds.has(b.book_id) || editBooks.includes(b.book_id)),
  );
  const selectableBooks = availableBooks.filter((b) =>
    b.book_name_bn.toLocaleLowerCase().includes(bookQuery.trim().toLocaleLowerCase()),
  );
  // Keep existing selections visible when a subject has left the active catalogue.
  const selectedBooks = form.bookIds
    .map(
      (id) =>
        catalog.books.find((b) => b.book_id === id) ||
        (() => {
          const assignment = editing?.find((group) =>
            group.books.some((b) => Number(b.book_id) === id),
          );
          const book = assignment?.books.find((b) => Number(b.book_id) === id);
          return book && assignment ? { ...book, class_id: assignment.class_id } : undefined;
        })(),
    )
    .filter((b): b is Book => Boolean(b));

  const openCreate = (targetClassId = classId, bookId?: number) => {
    setEditing(null);
    setSaveError(false);
    setBookQuery("");
    const target = classMap.get(Number(targetClassId));
    setForm({
      teacherId: "",
      divisionId: target ? String(target.division_id) : divisionId,
      classId: target ? String(target.class_id) : "",
      bookIds: bookId ? [bookId] : [],
    });
    setModalOpen(true);
  };
  const openEdit = (assignment: Assignment) => {
    const teacherAssignments = assignments.filter(
      (group) => group.teacher_id === assignment.teacher_id,
    );
    setEditing(teacherAssignments);
    setSaveError(false);
    setBookQuery("");
    setForm({
      teacherId: String(assignment.teacher_id),
      divisionId: String(classMap.get(assignment.class_id)?.division_id || ""),
      classId: String(assignment.class_id),
      bookIds: teacherAssignments.flatMap((group) => group.books.map((b) => Number(b.book_id))),
    });
    setModalOpen(true);
  };
  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };
  const toggleBook = (id: number) =>
    setForm((prev) => ({
      ...prev,
      bookIds: prev.bookIds.includes(id)
        ? prev.bookIds.filter((bookId) => bookId !== id)
        : [...prev.bookIds, id],
    }));

  const save = async () => {
    if (saving || !form.teacherId || !selectedBooks.length) return;
    setSaving(true);
    setSaveError(false);
    try {
      const teacherId = Number(form.teacherId);
      const groups = new Map<number, Book[]>();
      selectedBooks.forEach((book) =>
        groups.set(book.class_id, [...(groups.get(book.class_id) || []), book]),
      );
      const payload = {
        teacher_id: teacherId,
        assignments: [...groups].map(([class_id, books]) => ({
          class_id,
          book_ids: books.map((book) => book.book_id),
        })),
      };
      if (editing) await api.put("/teacher-assignments/batch", payload);
      else await api.post("/teacher-assignments/batch", payload);
      // A failed refresh after a successful write must not invite a duplicate save.
      const next: Assignment[] = [...groups].map(([classId, books]) => ({
        teacher_id: teacherId,
        teacher_name: selectedTeacher?.name_bn || editing?.[0]?.teacher_name || "",
        class_id: classId,
        books,
      }));
      setAssignments((prev) => [...prev.filter((a) => a.teacher_id !== teacherId), ...next]);
      setModalOpen(false);
      useToastStore.getState().push("success", t.saved);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };
  const removeAssignment = (assignment: Assignment) =>
    useConfirmStore.getState().show({
      title: t.remove,
      message: t.deleteTeacherHint(assignment.teacher_name),
      confirmText: t.remove,
      danger: true,
      onConfirm: async () => {
        await api.post("/teacher-assignments/delete-teacher", {
          teacher_id: assignment.teacher_id,
        });
        setAssignments((prev) => prev.filter((a) => a.teacher_id !== assignment.teacher_id));
        useToastStore.getState().push("success", t.deleted);
      },
    });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Button
            onClick={() => openCreate()}
            disabled={loading || loadError || !catalog.books.length}
            className="gap-2"
          >
            <Plus size={17} />
            {t.newAssignment}
          </Button>
        }
      />
      {loadError ? (
        <Card>
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>{t.loadError}</p>
            <Button variant="secondary" onClick={() => void load()}>
              {t.retry}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatTile
              label={t.totalBooks}
              value={scopedBooks.length}
              icon={<BookOpen size={20} />}
              tone="indigo"
              loading={loading}
            />
            <StatTile
              label={t.assigned}
              value={scopedBooks.length - pendingBooks.length}
              icon={<CheckCheck size={20} />}
              tone="emerald"
              loading={loading}
            />
            <StatTile
              label={t.pending}
              value={pendingBooks.length}
              icon={<Clock3 size={20} />}
              tone="amber"
              loading={loading}
            />
            <StatTile
              label={t.totalTeachers}
              value={teachers.length}
              icon={<Users size={20} />}
              tone="slate"
              loading={loading}
            />
            <StatTile
              label={t.assignedTeachers}
              value={
                new Set(
                  assignments.filter((a) => matchesClass(a.class_id)).map((a) => a.teacher_id),
                ).size
              }
              icon={<Users size={20} />}
              tone="blue"
              loading={loading}
            />
          </div>
          <Card padding="sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_200px]">
              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute start-3 top-3 text-slate-400"
                />
                <Input
                  aria-label={t.search}
                  placeholder={t.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="ps-10"
                />
              </div>
              <select
                aria-label={t.division}
                className={selectStyle}
                value={divisionId}
                onChange={(e) => {
                  setDivisionId(e.target.value);
                  setClassId("");
                }}
              >
                <option value="">{t.allDivisions}</option>
                {divisions.map((d) => (
                  <option key={d.division_id} value={d.division_id}>
                    {d.division_name_bn}
                  </option>
                ))}
              </select>
              <select
                aria-label={t.class}
                className={selectStyle}
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">{t.allClasses}</option>
                {catalog.classes
                  .filter((c) => !divisionId || c.division_id === Number(divisionId))
                  .map((c) => (
                    <option key={c.class_id} value={c.class_id}>
                      {c.class_name_bn}
                    </option>
                  ))}
              </select>
            </div>
          </Card>
          {loading ? (
            <div
              role="status"
              className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700"
            >
              {t.loading}
            </div>
          ) : (
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <section className="min-w-0 space-y-4" aria-label={t.assignments}>
                <div className="flex items-center gap-2">
                  <ClipboardList size={19} className="text-indigo-500" />
                  <h2 className="font-semibold">{t.assignments}</h2>
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-xs dark:bg-slate-800">
                    {n(assignmentsByTeacher.size)}
                  </span>
                </div>
                {!visibleAssignments.length && (
                  <Card>
                    <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      {assignments.length ? t.noResults : t.noAssignments}
                    </p>
                  </Card>
                )}
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  {[...assignmentsByTeacher].map(([teacherId, teacherAssignments]) => (
                    <TeacherAssignmentCard
                      key={teacherId}
                      assignments={teacherAssignments}
                      classes={classMap}
                      divisions={divisions}
                      onEdit={openEdit}
                      onRemove={removeAssignment}
                    />
                  ))}
                </div>
              </section>
              <Card className="border-amber-200/80 dark:border-amber-900/60">
                <CardHeader
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <Clock3 size={18} className="text-amber-600 dark:text-amber-400" />
                      {t.pendingTitle}
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        {n(visiblePending.length)}
                      </span>
                    </span>
                  }
                  subtitle={t.pendingHint}
                />
                {!groupedPending.length ? (
                  <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    {!scopedBooks.length
                      ? t.noCatalog
                      : pendingBooks.length
                        ? t.noResults
                        : t.allAssigned}
                  </div>
                ) : (
                  <div className="max-h-[650px] space-y-5 overflow-y-auto pe-1">
                    {groupedPending.map((c) => (
                      <div key={c.class_id}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">
                            {c.class_name_bn}{" "}
                            <span className="ms-1 text-xs font-normal text-slate-500">
                              ({n(c.books.length)})
                            </span>
                          </h3>
                          <Button
                            variant="ghost"
                            className="gap-1 px-2 py-1 text-xs"
                            onClick={() => openCreate(String(c.class_id))}
                          >
                            <Plus size={14} />
                            {t.assignNow}
                          </Button>
                        </div>
                        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                          {c.books.map((book) => (
                            <li
                              key={book.book_id}
                              className="flex items-start gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300"
                            >
                              <BookOpen size={15} className="mt-0.5 shrink-0 text-slate-400" />
                              <span className="break-words">{book.book_name_bn}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        title={editing ? t.edit : t.newAssignment}
        onClose={closeModal}
        hideCloseButton={saving}
        maxWidthClassName="max-w-5xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset
            disabled={saving}
            className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
          >
            <div className="min-w-0 space-y-5">
              <label className="block space-y-2 text-sm font-medium">
                <span>{t.teacher}</span>
                <select
                  autoFocus
                  required
                  disabled={Boolean(editing) || saving}
                  className={selectStyle}
                  value={form.teacherId}
                  onChange={(e) => setForm((prev) => ({ ...prev, teacherId: e.target.value }))}
                >
                  <option value="">{t.selectTeacher}</option>
                  {availableTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name_bn}
                    </option>
                  ))}
                </select>
              </label>
              {!availableTeachers.length && (
                <p className="text-sm text-amber-700 dark:text-amber-400">{t.noTeachers}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2 text-sm font-medium">
                  <span>{t.division}</span>
                  <select
                    disabled={saving}
                    className={selectStyle}
                    value={form.divisionId}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        divisionId: e.target.value,
                        classId: "",
                      }));
                      setBookQuery("");
                    }}
                  >
                    <option value="">{t.selectDivision}</option>
                    {divisions.map((d) => (
                      <option key={d.division_id} value={d.division_id}>
                        {d.division_name_bn}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2 text-sm font-medium">
                  <span>{t.class}</span>
                  <select
                    disabled={!form.divisionId || saving}
                    className={selectStyle}
                    value={form.classId}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, classId: e.target.value }));
                      setBookQuery("");
                    }}
                  >
                    <option value="">{t.selectClass}</option>
                    {catalog.classes
                      .filter((c) => c.division_id === Number(form.divisionId))
                      .map((c) => (
                        <option key={c.class_id} value={c.class_id}>
                          {c.class_name_bn}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {t.classHint}
              </p>
              <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{t.selectBooks}</h3>
                  {selectableBooks.length > 0 && (
                    <button
                      type="button"
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          bookIds: [
                            ...new Set([...prev.bookIds, ...selectableBooks.map((b) => b.book_id)]),
                          ],
                        }))
                      }
                    >
                      {t.selectAll}
                    </button>
                  )}
                </div>
                {form.classId && (
                  <Input
                    aria-label={t.searchBooks}
                    placeholder={t.searchBooks}
                    value={bookQuery}
                    onChange={(e) => setBookQuery(e.target.value)}
                  />
                )}
                {!form.classId || !selectableBooks.length ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {!form.classId
                      ? t.chooseClass
                      : availableBooks.length
                        ? t.noResults
                        : t.noBooks}
                  </p>
                ) : (
                  <div className="grid max-h-80 gap-2 overflow-y-auto pe-1 sm:grid-cols-2">
                    {selectableBooks.map((b) => {
                      const active = form.bookIds.includes(b.book_id);
                      return (
                        <label
                          key={b.book_id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${active ? "border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200" : "border-slate-200 hover:border-indigo-300 dark:border-slate-700 dark:hover:border-indigo-500"}`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleBook(b.book_id)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
                          />
                          <span className="break-words">{b.book_name_bn}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <aside
              className="min-w-0 self-start rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20"
              aria-label={t.review}
            >
              <div className="mb-3 flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <ClipboardList size={18} />
                <h3 className="font-semibold">{t.review}</h3>
              </div>
              <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {t.reviewHint}
              </p>
              <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                <p className="text-xs text-slate-500">{t.teacher}</p>
                <p className="mt-1 break-words font-semibold">
                  {selectedTeacher?.name_bn || editing?.[0]?.teacher_name || t.noTeacher}
                </p>
              </div>
              <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                <h4 className="font-semibold">
                  {t.selected}{" "}
                  <span
                    aria-live="polite"
                    className="ms-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200"
                  >
                    {n(form.bookIds.length)}
                  </span>
                </h4>
                {form.bookIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, bookIds: [] }))}
                    className="text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400"
                  >
                    {t.clear}
                  </button>
                )}
              </div>
              {!selectedBooks.length ? (
                <p className="py-5 text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {t.noSelection}
                </p>
              ) : (
                <ol className="max-h-72 space-y-2 overflow-y-auto pe-1">
                  {selectedBooks.map((b, index) => (
                    <li
                      key={b.book_id}
                      className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-sm dark:bg-slate-900"
                    >
                      <span className="mt-0.5 text-xs text-indigo-500">{n(index + 1)}.</span>
                      <div className="min-w-0 flex-1 break-words">
                        <p>{b.book_name_bn}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {[
                            divisions.find(
                              (d) => d.division_id === classMap.get(b.class_id)?.division_id,
                            )?.division_name_bn,
                            classMap.get(b.class_id)?.class_name_bn,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleBook(Number(b.book_id))}
                        aria-label={`${t.removeBook}: ${b.book_name_bn}`}
                        className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800"
                      >
                        <X size={15} />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          </fieldset>
          {saveError && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
            >
              {t.saveError}
            </p>
          )}
          <div className="sticky -bottom-4 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-white py-4 dark:border-slate-800 dark:bg-slate-900">
            <Button type="button" variant="secondary" disabled={saving} onClick={closeModal}>
              {t.cancel}
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.teacherId || !form.bookIds.length}
              className="gap-2"
            >
              <Check size={17} />
              {saving ? t.saving : t.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
