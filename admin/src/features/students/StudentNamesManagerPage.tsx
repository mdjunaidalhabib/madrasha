import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { AlertCircle, Check, CheckCircle2, FileDown, FileUp, Keyboard, Languages, Loader2, Pencil, Save, Undo2 } from "lucide-react";
import { useText, getText, useLang, useIsMadrasa, localizeDigits, getLang } from "@madrasha/shared-ui/src/i18n";
import { namesManagerText } from "./StudentNamesManagerPage.text";
import { peopleToolsText } from "./photo-manager/peopleTools.text";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { filterByScript } from "@madrasha/shared-ui/src/components/ui/ScriptInput";
import { usePeopleDirectory } from "./photo-manager/usePeopleDirectory";
import { downloadNamesTemplate, langOfField, parseNamesFile } from "./photo-manager/namesExcel";
import {
  PeopleFilterBar,
  PeopleNotices,
  PeopleTabs,
  ProgressSummary,
  SegmentedFilter,
} from "./photo-manager/PeopleToolbar";
import type { CardStatus, DirectoryPerson, PeopleTab } from "./photo-manager/photoManager";
import {
  ARABIC_FONT_STACK,
  NAME_LANGS,
  cleanName,
  nameField,
  saveNameChanges,
  savedValue,
  titleCaseEnglish,
  type NameChange,
  type NameLang,
  type NameOwner,
} from "./photo-manager/names";

type Completeness = "" | "incomplete" | "complete";
type Drafts = Record<string, Record<string, string>>;

const CHUNK = 100;
const rowKey = (tab: PeopleTab, id: number) => `${tab}:${id}`;

function useIsNarrow() {
  const query = "(max-width: 767px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

/* ------------------------------------------------------------------ */
/*  Cells / rows                                                       */
/* ------------------------------------------------------------------ */

type CellHandlers = {
  onChange: (rowIdx: number, lang: NameLang, value: string) => void;
  onBlurLang: (rowIdx: number, lang: NameLang, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, col: number) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>, rowIdx: number, col: number) => void;
  register: (rowIdx: number, col: number, el: HTMLInputElement | null) => void;
};

type RowProps = {
  rowIdx: number;
  person: DirectoryPerson;
  owner: NameOwner;
  values: [string, string, string];
  dirty: [boolean, boolean, boolean];
  bnError: boolean;
  status?: CardStatus;
  canEdit: boolean;
  handlers: CellHandlers;
  layout: "table" | "card";
  idLabel: string;
  /** Arabic name column is madrasa-only (values are kept, just not shown). */
  showArabic: boolean;
};

const cellInputClass = (dirty: boolean, error: boolean, layout: "table" | "card") =>
  `w-full rounded-lg border text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 ${
    layout === "table" ? "h-10 px-3" : "h-11 px-3"
  } ${
    error
      ? "border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30"
      : dirty
        ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20"
        : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500"
  }`;

function StatusIcon({ status, bnError }: { status?: CardStatus; bnError: boolean }) {
  const t = useText(namesManagerText);
  if (bnError) return <AlertCircle className="h-4 w-4 text-rose-500" aria-label={t.bnRequired} />;
  if (status === "saving") return <Loader2 className="h-4 w-4 animate-spin text-slate-400" />;
  if (status === "saved") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "error") return <AlertCircle className="h-4 w-4 text-rose-600" />;
  return null;
}

/** values/dirty arrays are rebuilt every render - compare their contents. */
function rowPropsEqual(a: RowProps, b: RowProps) {
  return (
    a.rowIdx === b.rowIdx &&
    a.person === b.person &&
    a.owner === b.owner &&
    a.bnError === b.bnError &&
    a.status === b.status &&
    a.canEdit === b.canEdit &&
    a.handlers === b.handlers &&
    a.layout === b.layout &&
    a.idLabel === b.idLabel &&
    a.showArabic === b.showArabic &&
    a.values.every((v, i) => v === b.values[i]) &&
    a.dirty.every((v, i) => v === b.dirty[i])
  );
}

const NameRow = memo(function NameRow({
  rowIdx,
  person,
  owner,
  values,
  dirty,
  bnError,
  status,
  canEdit,
  handlers,
  layout,
  idLabel,
  showArabic,
}: RowProps) {
  const t = useText(namesManagerText);
  const pt = useText(peopleToolsText);
  const inputs = NAME_LANGS.map((lang, col) => {
    const isAr = lang === "ar";
    if (isAr && !showArabic) return null;
    // Read mode: plain text - the grid only becomes inputs after "এডিট করুন".
    if (!canEdit)
      return (
        <div
          key={lang}
          dir={isAr ? "rtl" : "ltr"}
          lang={isAr ? "ar" : lang === "en" ? "en" : "bn"}
          style={isAr ? { fontFamily: ARABIC_FONT_STACK, fontSize: "1rem" } : undefined}
          className={`flex items-center break-words text-sm ${layout === "table" ? "min-h-10 px-3" : "min-h-8"} ${
            values[col] ? "text-slate-800 dark:text-slate-100" : "text-slate-300 dark:text-slate-600"
          }`}
        >
          {values[col] || "—"}
        </div>
      );
    return (
      <input
        key={lang}
        ref={(el) => handlers.register(rowIdx, col, el)}
        value={values[col]}
        disabled={!canEdit || status === "saving"}
        onChange={(e) => handlers.onChange(rowIdx, lang, e.target.value)}
        onBlur={(e) => handlers.onBlurLang(rowIdx, lang, e.target.value)}
        onKeyDown={(e) => handlers.onKeyDown(e, rowIdx, col)}
        onPaste={(e) => handlers.onPaste(e, rowIdx, col)}
        dir={isAr ? "rtl" : "ltr"}
        lang={isAr ? "ar" : lang === "en" ? "en" : "bn"}
        spellCheck={false}
        autoComplete="off"
        placeholder={
          isAr ? "الاسم بالعربية" : lang === "en" ? "Name in English" : layout === "card" ? pt.langs[lang] : t.placeholderBn
        }
        aria-label={`${person.name} — ${pt.langs[lang]}`}
        style={isAr ? { fontFamily: ARABIC_FONT_STACK, fontSize: "1rem" } : undefined}
        className={cellInputClass(dirty[col], col === 0 && bnError, layout)}
      />
    );
  });

  const rowTone =
    status === "error"
      ? "bg-rose-50/60 dark:bg-rose-950/20"
      : status === "saved"
        ? "bg-emerald-50/60 dark:bg-emerald-950/20"
        : "";

  if (layout === "card") {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${rowTone}`}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{person.name}</div>
            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {idLabel}
              {person.subtitle && ` · ${person.subtitle}`}
              {owner !== "self" && t.ownerNameSuffix(pt.ownerName[owner])}
            </div>
          </div>
          <StatusIcon status={status} bnError={bnError} />
        </div>
        <div className="space-y-2">
          {inputs.map((input, i) => input && (
            <label key={NAME_LANGS[i]} className="block">
              <span className="mb-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {pt.langs[NAME_LANGS[i]]}
                {owner === "self" && i === 0 && <span className="text-rose-500"> *</span>}
              </span>
              {input}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <tr className={`border-t border-slate-100 dark:border-slate-800 ${rowTone}`}>
      <td className="px-4 py-2 align-middle">
        <div className="max-w-[15rem] truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={person.name}>
          {person.name || "—"}
        </div>
        <div className="mt-0.5 flex max-w-[15rem] items-center gap-1.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
          {person.subtitle && (
            <span className="truncate rounded bg-slate-100 px-1.5 py-px font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {person.subtitle}
            </span>
          )}
          <span className="whitespace-nowrap">{idLabel}</span>
        </div>
      </td>
      {inputs.map((input, i) => input && (
        <td key={NAME_LANGS[i]} className="px-2 py-2 align-middle">
          {input}
        </td>
      ))}
      <td className="w-8 px-2 text-center align-middle">
        <StatusIcon status={status} bnError={bnError} />
      </td>
    </tr>
  );
}, rowPropsEqual);

let lastScriptWarn = 0;

/** Throttled toast when a keystroke/paste in the wrong script is dropped. */
function warnScript(lang: NameLang) {
  const now = Date.now();
  if (now - lastScriptWarn < 2500) return;
  lastScriptWarn = now;
  useToastStore.getState().show(getText(namesManagerText).scriptWarning[lang], "info");
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

/**
 * নাম (৩ ভাষা) - spreadsheet-style grid for the বাংলা / আরবি / English name
 * trio of each student (or their father/mother), teacher or staff member.
 * Enter/↓ walks down a column, Tab across; a multi-line paste from Excel
 * fills downward. Edits are drafts until "সব সেভ করুন" / Ctrl+S.
 */
export default function StudentNamesManagerPage() {
  const t = useText(namesManagerText);
  const pt = useText(peopleToolsText);
  const lang = useLang();
  const isMadrasa = useIsMadrasa();
  const toBanglaDigits = (v: string | number) => localizeDigits(v, lang);
  // Columns a non-madrasa never fills (Arabic) don't count toward completeness / paste.
  const shownLangs = useMemo(() => (isMadrasa ? NAME_LANGS : NAME_LANGS.filter((l) => l !== "ar")), [isMadrasa]);
  const [owner, setOwner] = useState<NameOwner>("self");
  const [completeness, setCompleteness] = useState<Completeness>("");
  const dir = usePeopleDirectory({ who: owner === "self" ? "" : owner, status: completeness });
  const { tab, scoped, searched, loading, tabCanEdit, updatePeople } = dir;
  const narrow = useIsNarrow();

  const initialWho = dir.initialParam("who");
  const initialStatus = dir.initialParam("status");
  useEffect(() => {
    if (initialWho === "father" || initialWho === "mother") setOwner(initialWho);
    if (initialStatus === "incomplete" || initialStatus === "complete") setCompleteness(initialStatus);
  }, [initialWho, initialStatus]);

  const [drafts, setDrafts] = useState<Drafts>({});
  const [statuses, setStatuses] = useState<Record<string, CardStatus>>({});
  const [saving, setSaving] = useState(false);
  // Opens read-only; the pencil button switches the whole grid to inputs.
  const [editing, setEditing] = useState(false);
  const editable = tabCanEdit && editing;
  const [visibleCount, setVisibleCount] = useState(CHUNK);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const savedTimers = useRef<Record<string, number>>({});

  const fields = useMemo(
    () => NAME_LANGS.map((lang) => nameField(tab, owner, lang)) as [string, string, string],
    [tab, owner],
  );

  const valueOf = useCallback(
    (p: DirectoryPerson, field: string) => drafts[rowKey(tab, p.id)]?.[field] ?? savedValue(p, field),
    [drafts, tab],
  );

  const isComplete = useCallback(
    (p: DirectoryPerson) =>
      fields.every((f, i) => !shownLangs.includes(NAME_LANGS[i]) || cleanName(savedValue(p, f)) !== ""),
    [fields, shownLangs],
  );

  const filtered = useMemo(() => {
    // Rows being edited/just saved stay visible until their state clears.
    const touched = (p: DirectoryPerson) => Boolean(drafts[rowKey(tab, p.id)] || statuses[rowKey(tab, p.id)]);
    if (completeness === "incomplete") return searched.filter((p) => !isComplete(p) || touched(p));
    if (completeness === "complete") return searched.filter((p) => isComplete(p) || touched(p));
    return searched;
  }, [searched, completeness, isComplete, drafts, statuses, tab]);

  const total = scoped.length;
  const completeCount = useMemo(() => scoped.filter(isComplete).length, [scoped, isComplete]);

  useEffect(() => setVisibleCount(CHUNK), [tab, dir.division, dir.classId, dir.search, completeness, owner]);

  /* ---------------- drafts ---------------- */

  const dirtyKeys = Object.keys(drafts);
  const dirtyCount = dirtyKeys.length;
  // Drafts may belong to rows now hidden by বিভাগ/শ্রেণি/search - resolve against the whole tab.
  const personByKey = useMemo(() => new Map(dir.all.map((p) => [rowKey(tab, p.id), p])), [dir.all, tab]);

  const applyEdits = useCallback(
    (edits: { person: DirectoryPerson; field: string; value: string }[]) =>
      setDrafts((prev) => {
        const next = { ...prev };
        for (const { person, field, value } of edits) {
          const key = rowKey(tab, person.id);
          const row = { ...(next[key] || {}) };
          if (value === savedValue(person, field)) {
            delete row[field];
          } else {
            row[field] = value;
          }
          if (Object.keys(row).length) next[key] = row;
          else delete next[key];
        }
        return next;
      }),
    [tab],
  );

  /* ---------------- Excel template ---------------- */

  const excelInput = useRef<HTMLInputElement>(null);
  const [excelBusy, setExcelBusy] = useState(false);

  const downloadTemplate = async () => {
    if (!filtered.length) return useToastStore.getState().show(t.nothingToDownload, "error");
    setExcelBusy(true);
    try {
      await downloadNamesTemplate(tab, filtered, dir.scopeLabel);
    } finally {
      setExcelBusy(false);
    }
  };

  // Imported values land as drafts (highlighted), so they're reviewed and
  // saved through the same "সব সেভ করুন" flow as typed edits.
  const importExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExcelBusy(true);
    try {
      const rows = await parseNamesFile(file, tab);
      const byId = new Map(dir.all.map((p) => [p.id, p]));
      const edits: { person: DirectoryPerson; field: string; value: string }[] = [];
      let unknown = 0;
      let dropped = 0;
      for (const row of rows) {
        const person = byId.get(row.id);
        // ID + রেজি. must agree - guards against an edited/unprotected ID column.
        if (!person || (row.regNo && person.regNo && row.regNo !== String(person.regNo))) {
          unknown++;
          continue;
        }
        for (const [field, raw] of Object.entries(row.fields)) {
          const lang = langOfField(tab, field);
          if (!lang) continue;
          const scripted = filterByScript(raw, lang);
          if (scripted !== raw) dropped++;
          const value = lang === "en" ? titleCaseEnglish(scripted) : cleanName(scripted);
          if (value && value !== savedValue(person, field)) edits.push({ person, field, value });
        }
      }
      applyEdits(edits);
      if (edits.length) setEditing(true); // imported drafts must be reviewable
      const people = new Set(edits.map((x) => x.person.id)).size;
      const extra = [
        unknown ? t.rowsUnmatched(toBanglaDigits(unknown)) : "",
        dropped ? t.wrongScriptDropped(toBanglaDigits(dropped)) : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const suffix = extra ? ` (${extra})` : "";
      useToastStore
        .getState()
        .show(
          edits.length
            ? t.importedNames(toBanglaDigits(people), toBanglaDigits(edits.length), suffix)
            : t.noNewChanges(suffix),
          edits.length ? "success" : "info",
        );
    } catch (err: any) {
      useToastStore.getState().show(err?.message || t.excelReadFailed, "error");
    } finally {
      setExcelBusy(false);
    }
  };

  /* ---------------- keyboard / paste ---------------- */

  const focusCell = useCallback(
    (rowIdx: number, col: number) => {
      if (rowIdx < 0 || rowIdx >= filtered.length) return;
      const go = () => {
        const el = inputRefs.current.get(`${rowIdx}:${col}`);
        if (el) {
          el.focus();
          el.select();
        }
      };
      if (rowIdx >= visibleCount) {
        setVisibleCount((c) => Math.max(c, rowIdx + CHUNK));
        window.setTimeout(go, 0);
      } else go();
    },
    [filtered.length, visibleCount],
  );

  // Handlers read the latest state through a ref so they stay referentially
  // stable - otherwise every keystroke would re-render every memoized row.
  const live = useRef({ filtered, tab, owner, visibleCount, applyEdits, focusCell, shownLangs });
  live.current = { filtered, tab, owner, visibleCount, applyEdits, focusCell, shownLangs };

  const handlers: CellHandlers = useMemo(
    () => ({
      register: (rowIdx, col, el) => {
        const key = `${rowIdx}:${col}`;
        if (el) inputRefs.current.set(key, el);
        else inputRefs.current.delete(key);
      },
      onChange: (rowIdx, lang, raw) => {
        const { filtered, tab, owner, applyEdits } = live.current;
        const person = filtered[rowIdx];
        if (!person) return;
        // Same per-script lock as the admission form (ScriptInput): each
        // column only accepts its own language.
        const value = filterByScript(raw, lang);
        if (value !== raw) warnScript(lang);
        applyEdits([{ person, field: nameField(tab, owner, lang), value }]);
      },
      onBlurLang: (rowIdx, lang, value) => {
        const { filtered, tab, owner, applyEdits } = live.current;
        const person = filtered[rowIdx];
        if (!person) return;
        const field = nameField(tab, owner, lang);
        const tidy = lang === "en" ? titleCaseEnglish(value) : cleanName(value);
        if (tidy !== value) applyEdits([{ person, field, value: tidy }]);
      },
      onKeyDown: (e, rowIdx, col) => {
        if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const up = e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey);
          live.current.focusCell(rowIdx + (up ? -1 : 1), col);
        }
      },
      onPaste: (e, rowIdx, col) => {
        const text = e.clipboardData.getData("text");
        if (!/[\n\t]/.test(text)) return; // single value: normal paste
        e.preventDefault();
        const { filtered, tab, owner, applyEdits, visibleCount, shownLangs } = live.current;
        const startCol = shownLangs.indexOf(NAME_LANGS[col]);
        const lines = text.replace(/\r/g, "").split("\n");
        if (lines[lines.length - 1] === "") lines.pop();
        const edits: { person: DirectoryPerson; field: string; value: string }[] = [];
        lines.forEach((line, i) => {
          const person = filtered[rowIdx + i];
          if (!person) return;
          line.split("\t").forEach((cell, j) => {
            const lang = shownLangs[startCol + j];
            if (!lang) return;
            const scripted = filterByScript(cell, lang);
            if (scripted !== cell) warnScript(lang);
            const value = lang === "en" ? titleCaseEnglish(scripted) : cleanName(scripted);
            edits.push({ person, field: nameField(tab, owner, lang), value });
          });
        });
        applyEdits(edits);
        const last = Math.min(rowIdx + lines.length, filtered.length) - 1;
        if (last >= visibleCount) setVisibleCount(last + 1);
        useToastStore
          .getState()
          .show(getText(namesManagerText).pastedRows(localizeDigits(Math.min(lines.length, filtered.length - rowIdx), getLang())), "success");
      },
    }),
    [],
  );

  /* ---------------- save / discard ---------------- */

  const setStatus = (key: string, status: CardStatus | undefined) =>
    setStatuses((prev) => {
      const next = { ...prev };
      if (status) next[key] = status;
      else delete next[key];
      return next;
    });

  const saveAll = useCallback(async () => {
    if (saving || !dirtyCount) return;
    const changes: NameChange[] = [];
    let invalid = 0;
    let firstInvalid: DirectoryPerson | null = null;

    for (const [key, row] of Object.entries(drafts)) {
      const person = personByKey.get(key);
      if (!person) continue; // (tab switch is locked while dirty, so this is only a vanished row)
      const out: Record<string, string> = {};
      for (const [field, value] of Object.entries(row)) {
        const clean = cleanName(value);
        if (clean !== cleanName(savedValue(person, field))) out[field] = clean;
      }
      if ("name_bn" in out && !out.name_bn) {
        invalid++;
        firstInvalid ??= person;
        continue;
      }
      if (Object.keys(out).length) changes.push({ tab, id: person.id, fields: out });
      else setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    if (invalid) {
      useToastStore
        .getState()
        .show(t.bnEmpty(toBanglaDigits(invalid)), "error");
      if (firstInvalid) {
        const idx = filtered.indexOf(firstInvalid);
        if (idx >= 0 && owner === "self") focusCell(idx, 0);
      }
    }
    if (!changes.length) return;

    setSaving(true);
    changes.forEach((c) => {
      window.clearTimeout(savedTimers.current[rowKey(c.tab, c.id)]);
      setStatus(rowKey(c.tab, c.id), "saving");
    });

    let ok = 0;
    const errors = new Set<string>();
    await saveNameChanges(changes, (c, success, message) => {
      const key = rowKey(c.tab, c.id);
      if (success) {
        ok++;
        updatePeople(c.tab, (p) =>
          p.id === c.id
            ? {
                ...p,
                raw: { ...p.raw, ...Object.fromEntries(Object.entries(c.fields).map(([k, v]) => [k, v || null])) },
                name: c.fields.name_bn || p.name,
              }
            : p,
        );
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setStatus(key, "saved");
        savedTimers.current[key] = window.setTimeout(() => setStatus(key, undefined), 2500);
      } else {
        setStatus(key, "error");
        if (message) errors.add(String(message));
      }
    });
    setSaving(false);

    const failed = changes.length - ok;
    useToastStore
      .getState()
      .show(
        failed
          ? t.savedFailed(toBanglaDigits(ok), toBanglaDigits(failed), errors.size ? ` (${[...errors][0]})` : "")
          : t.savedAll(toBanglaDigits(ok)),
        failed ? "error" : "success",
      );
  }, [saving, dirtyCount, drafts, personByKey, tab, filtered, owner, focusCell, updatePeople, t]);

  const discardAll = () =>
    useConfirmStore.getState().show({
      title: t.discardTitle,
      message: t.discardMessage(toBanglaDigits(dirtyCount)),
      confirmText: t.discardConfirm,
      danger: true,
      onConfirm: () => {
        setDrafts({});
        setStatuses({});
      },
    });

  // Ctrl/Cmd+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveAll]);

  // Unsaved-changes guards: tab close/reload + in-app navigation.
  useEffect(() => {
    if (!dirtyCount) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyCount]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirtyCount > 0 && currentLocation.pathname !== nextLocation.pathname,
  );
  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;
  // Keyed on the state only, so the dialog opens once per blocked navigation.
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    useConfirmStore.getState().show({
      title: getText(namesManagerText).leaveTitle,
      message: getText(namesManagerText).leaveMessage,
      confirmText: getText(namesManagerText).leaveConfirm,
      danger: true,
      onConfirm: () => blockerRef.current.proceed?.(),
      onCancel: () => blockerRef.current.reset?.(),
    });
  }, [blocker.state]);

  useEffect(() => {
    const timers = savedTimers.current;
    return () => Object.values(timers).forEach((t) => window.clearTimeout(t));
  }, []);

  /* ---------------- render ---------------- */

  const visible = filtered.slice(0, visibleCount);
  const layout = narrow ? "card" : "table";
  const idLabelOf = (p: DirectoryPerson) =>
    tab === "students"
      ? p.roll
        ? t.roll(toBanglaDigits(p.roll))
        : p.regNo
          ? t.reg(toBanglaDigits(p.regNo))
          : "—"
      : p.regNo
        ? t.reg(toBanglaDigits(p.regNo))
        : "—";

  const rows = visible.map((p, rowIdx) => {
    const key = rowKey(tab, p.id);
    const draft = drafts[key];
    const values = fields.map((f) => valueOf(p, f)) as [string, string, string];
    const dirty = fields.map((f) => draft?.[f] !== undefined) as [boolean, boolean, boolean];
    return (
      <NameRow
        key={p.id}
        rowIdx={rowIdx}
        person={p}
        owner={owner}
        values={values}
        dirty={dirty}
        bnError={owner === "self" && dirty[0] && cleanName(values[0]) === ""}
        status={statuses[key]}
        canEdit={editable}
        handlers={handlers}
        layout={layout}
        idLabel={idLabelOf(p)}
        showArabic={isMadrasa}
      />
    );
  });

  return (
    <div className="flex min-h-full flex-col bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">
              <Languages className="h-6 w-6 text-emerald-600" /> {isMadrasa ? t.title : t.titleBilingual}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {isMadrasa ? t.subtitle : t.subtitleBilingual}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedFilter
              value={owner}
              onChange={(v) => setOwner(v)}
              options={(["self", "father", "mother"] as NameOwner[]).map((o) => ({
                value: o,
                label: o === "self" ? pt.tabs[tab] : pt.owners[o],
              }))}
            />
            <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={downloadTemplate}
                disabled={excelBusy || loading}
                title={t.templateTitle}
                className="inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileDown className="h-4 w-4 text-emerald-600" /> {t.downloadTemplate}
              </button>
              <button
                type="button"
                onClick={() => excelInput.current?.click()}
                disabled={excelBusy || loading || !tabCanEdit || saving}
                className="inline-flex h-10 items-center gap-1.5 border-s border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {excelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4 text-blue-600" />}
                {t.uploadExcel}
              </button>
            </div>
            {tabCanEdit &&
              (editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={dirtyCount > 0 || saving}
                  title={dirtyCount > 0 ? t.saveOrDiscardFirst : t.stopEditing}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Check className="h-4 w-4 text-emerald-600" /> {t.done}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={loading}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4" /> {t.edit}
                </button>
              ))}
            <input ref={excelInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={importExcel} />
          </div>
        </div>

        <PeopleTabs dir={dir} disabled={dirtyCount > 0 || saving} />

        <ProgressSummary
          scopeLabel={`${dir.scopeLabel} · ${pt.ownerName[owner]}`}
          total={total}
          done={completeCount}
          doneLabel={isMadrasa ? t.allLangsDone : t.allLangsDoneBilingual}
          remainingLabel={t.incomplete}
        />

        <PeopleFilterBar
          dir={dir}
          right={
            <SegmentedFilter
              value={completeness}
              onChange={setCompleteness}
              options={[
                { value: "", label: t.all, count: total },
                { value: "incomplete", label: t.incomplete, count: total - completeCount },
                { value: "complete", label: t.complete, count: completeCount },
              ]}
            />
          }
        />

        <PeopleNotices dir={dir} readOnlyText={t.readOnly} />

        {!narrow && editable && !loading && filtered.length > 0 && (
          <div className="-mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Keyboard className="h-3.5 w-3.5" /> {t.keyboardHint}
            </span>
            <span>{t.pasteHint}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
            <Languages className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <div className="font-semibold text-slate-700 dark:text-slate-200">
              {completeness === "incomplete" && total > 0 ? t.everyoneComplete : t.noneFound}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.tryChangingFilter}</p>
          </div>
        ) : narrow ? (
          <div className="space-y-3">{rows}</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-start text-xs font-semibold text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="w-60 px-4 py-2.5">
                    {pt.tabs[tab]}
                    <span className="font-normal text-slate-400">
                      {" "}
                      · {tab === "students" ? t.classAndRoll : t.designationAndReg}
                    </span>
                  </th>
                  <th className="px-3 py-2.5">
                    {pt.langs.bn}
                    {owner === "self" && <span className="text-rose-500"> *</span>}
                  </th>
                  {isMadrasa && (
                    <th className="px-3 py-2.5 text-end" dir="rtl">
                      {pt.langs.ar} <span style={{ fontFamily: ARABIC_FONT_STACK }}>(الاسم)</span>
                    </th>
                  )}
                  <th className="px-3 py-2.5">{pt.langs.en}</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        )}

        {filtered.length > visibleCount && (
          <div className="flex flex-col items-center gap-1 py-1">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + CHUNK)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t.showMore}
            </button>
            <span className="text-xs text-slate-400">
              {t.showingOf(toBanglaDigits(visibleCount), toBanglaDigits(filtered.length))}
            </span>
          </div>
        )}

        {/* Sticky save bar */}
        {(dirtyCount > 0 || saving) && (
          <div className="sticky bottom-3 z-20 mt-auto">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:border-amber-900/60 dark:bg-slate-900/95">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                {t.changesN(toBanglaDigits(dirtyCount))}
                <span className="hidden text-xs font-normal text-slate-400 sm:inline">· Ctrl+S</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={discardAll}
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Undo2 className="h-4 w-4" /> {t.discard}
                </button>
                <button
                  type="button"
                  onClick={saveAll}
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t.saveAll}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
