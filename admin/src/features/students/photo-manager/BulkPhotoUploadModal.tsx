import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, FolderUp, Images, Loader2, Upload, X } from "lucide-react";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { fileToPortraitDataUrl } from "../../../components/photo/PhotoPicker";
import { fileNumberKey, hasPhoto, type CardStatus, type PhotoPerson } from "./photoManager";

type MatchBy = "reg" | "roll";

type Row = {
  file: File;
  preview: string;
  key: string | null;
  matches: PhotoPerson[];
  /** Another file earlier in the batch already targets the same person. */
  duplicate: boolean;
  include: boolean;
  status?: CardStatus;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** People the file names are matched against (current বিভাগ/শ্রেণি scope). */
  scope: PhotoPerson[];
  /** Roll matching is offered only for students, and is only safe inside one class. */
  allowRoll: boolean;
  scopeLabel: string;
  onSave: (person: PhotoPerson, dataUrl: string) => Promise<boolean>;
};

const CONCURRENCY = 3;

const buildRows = (files: File[], scope: PhotoPerson[], by: MatchBy, previews: string[]): Row[] => {
  const seen = new Set<number>();
  return files.map((file, i) => {
    const key = fileNumberKey(file.name);
    const matches = key
      ? scope.filter((p) => {
          const v = by === "reg" ? p.regNo : p.roll;
          return v != null && String(Number(v)) === key;
        })
      : [];
    const duplicate = matches.length === 1 && seen.has(matches[0].id);
    if (matches.length === 1) seen.add(matches[0].id);
    return { file, preview: previews[i], key, matches, duplicate, include: matches.length === 1 && !duplicate };
  });
};

/**
 * একসাথে অনেক ছবি: files named by রেজি. নং (or রোল, inside one class) are
 * matched to people, previewed for confirmation, then saved one by one.
 */
export default function BulkPhotoUploadModal({ open, onClose, scope, allowRoll, scopeLabel, onSave }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [matchBy, setMatchBy] = useState<MatchBy>("reg");
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [statuses, setStatuses] = useState<Record<number, CardStatus>>({});
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Object URLs for thumbnails - revoked whenever the batch changes / modal closes.
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setOverrides({});
      setStatuses({});
      setMatchBy("reg");
    }
  }, [open]);

  useEffect(() => {
    if (!allowRoll) setMatchBy("reg");
  }, [allowRoll]);

  const rows = useMemo(() => {
    const base = buildRows(files, scope, matchBy, previews);
    return base.map((r, i) => ({
      ...r,
      include: r.matches.length === 1 && !r.duplicate && (overrides[i] ?? true),
      status: statuses[i],
    }));
  }, [files, scope, matchBy, previews, overrides, statuses]);

  const matched = rows.filter((r) => r.matches.length === 1 && !r.duplicate).length;
  const selected = rows.filter((r) => r.include);
  const doneCount = Object.values(statuses).filter((s) => s === "saved").length;
  const failCount = Object.values(statuses).filter((s) => s === "error").length;
  const finished = !running && Object.keys(statuses).length > 0;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...images]);
    setStatuses({});
  };

  const run = async () => {
    const jobs = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.include);
    if (!jobs.length) return;
    setRunning(true);
    let cursor = 0;
    const worker = async () => {
      while (cursor < jobs.length) {
        const { r, i } = jobs[cursor++];
        setStatuses((prev) => ({ ...prev, [i]: "saving" }));
        let ok = false;
        try {
          ok = await onSave(r.matches[0], await fileToPortraitDataUrl(r.file));
        } catch (err) {
          logger.error("BULK PHOTO READ ERROR:", err);
        }
        setStatuses((prev) => ({ ...prev, [i]: ok ? "saved" : "error" }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
    setRunning(false);
  };

  if (!open) return null;

  const pill = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
        : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
    }`;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-slate-900/70 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !running && onClose()}
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Images className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">একসাথে অনেক ছবি আপলোড</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
              ফাইলের নাম = {matchBy === "reg" ? "রেজিস্ট্রেশন নম্বর" : "রোল নম্বর"} (যেমন 1045.jpg) · পরিসর: {scopeLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
            aria-label="বন্ধ করুন"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button type="button" className={pill(matchBy === "reg")} onClick={() => setMatchBy("reg")} disabled={running}>
                রেজি. নং দিয়ে মেলান
              </button>
              {allowRoll && (
                <button type="button" className={pill(matchBy === "roll")} onClick={() => setMatchBy("roll")} disabled={running}>
                  রোল দিয়ে মেলান
                </button>
              )}
            </div>
            {files.length > 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                মোট {toBanglaDigits(files.length)} · মিলেছে{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{toBanglaDigits(matched)}</span> ·
                মেলেনি <span className="font-semibold text-amber-600">{toBanglaDigits(files.length - matched)}</span>
              </div>
            )}
          </div>
          {!allowRoll && (
            <p className="-mt-2 text-[11px] text-slate-400">রোল দিয়ে মেলাতে ওপরের ফিল্টার থেকে একটি শ্রেণি নির্বাচন করুন।</p>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!running) addFiles(e.dataTransfer.files);
            }}
            onClick={() => !running && inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
              dragOver
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
            }`}
          >
            <FolderUp className="h-8 w-8 text-emerald-600" />
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">ছবিগুলো এখানে টেনে আনুন বা ক্লিক করে বাছাই করুন</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">একাধিক JPG/PNG · নামের প্রথম সংখ্যাটি দিয়ে মেলানো হবে</div>
          </div>

          {rows.length > 0 && (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {rows.map((r, i) => {
                const person = r.matches.length === 1 ? r.matches[0] : null;
                const problem = !r.key
                  ? "নামে কোনো সংখ্যা নেই"
                  : r.matches.length === 0
                    ? "কাউকে পাওয়া যায়নি"
                    : r.matches.length > 1
                      ? `${toBanglaDigits(r.matches.length)} জন মিলেছে — শ্রেণি নির্বাচন করুন`
                      : r.duplicate
                        ? "একই জনের জন্য আগে আরেকটি ফাইল আছে"
                        : null;
                return (
                  <div key={`${r.file.name}-${i}`} className="flex items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={r.include}
                      disabled={!!problem || running || !!r.status}
                      onChange={(e) => setOverrides((prev) => ({ ...prev, [i]: e.target.checked }))}
                    />
                    <img src={r.preview} alt="" className="h-12 w-9 shrink-0 rounded-md object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">{r.file.name}</div>
                      {person ? (
                        <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {person.name}
                          <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                            {person.subtitle}
                            {person.roll && ` · রোল ${toBanglaDigits(person.roll)}`}
                            {person.regNo && ` · রেজি. ${toBanglaDigits(person.regNo)}`}
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-amber-600 dark:text-amber-400">{problem}</div>
                      )}
                      {person && !r.duplicate && hasPhoto(person) && !r.status && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400">আগের ছবি প্রতিস্থাপন হবে</div>
                      )}
                    </div>
                    <div className="w-6 shrink-0">
                      {r.status === "saving" && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                      {r.status === "saved" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                      {r.status === "error" && <AlertCircle className="h-5 w-5 text-rose-600" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {finished
              ? `সম্পন্ন: ${toBanglaDigits(doneCount)} টি সংরক্ষিত${failCount ? `, ${toBanglaDigits(failCount)} টি ব্যর্থ` : ""}`
              : running
                ? `সংরক্ষণ হচ্ছে... ${toBanglaDigits(doneCount + failCount)} / ${toBanglaDigits(selected.length)}`
                : `${toBanglaDigits(selected.length)} টি ছবি সংরক্ষণের জন্য নির্বাচিত`}
          </div>
          <div className="flex gap-2">
            {files.length > 0 && !running && (
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setOverrides({});
                  setStatuses({});
                }}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                খালি করুন
              </button>
            )}
            {finished ? (
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                সম্পন্ন
              </button>
            ) : (
              <button
                type="button"
                onClick={run}
                disabled={running || selected.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {toBanglaDigits(selected.length)} টি সংরক্ষণ করুন
              </button>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
