import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImageOff, Images } from "lucide-react";
import { CameraCaptureModal, fileToPortraitDataUrl } from "../../components/photo/PhotoPicker";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import PhotoCard from "./photo-manager/PhotoCard";
import SeriesCaptureModal from "./photo-manager/SeriesCaptureModal";
import BulkPhotoUploadModal from "./photo-manager/BulkPhotoUploadModal";
import { usePeopleDirectory } from "./photo-manager/usePeopleDirectory";
import {
  PeopleFilterBar,
  PeopleNotices,
  PeopleTabs,
  ProgressSummary,
  SegmentedFilter,
} from "./photo-manager/PeopleToolbar";
import {
  hasPhoto,
  savePersonPhoto,
  type CardStatus,
  type PhotoPerson,
  type PhotoTab,
} from "./photo-manager/photoManager";

type PhotoFilter = "" | "missing" | "has";

const PAGE_CHUNK = 60;

/**
 * ছবি আপলোড - a page whose only job is setting photos. Filter by বিভাগ/শ্রেণি,
 * upload or capture per card (saved immediately, only the photo field),
 * run a camera series over everyone still missing a photo, or drop a folder
 * of files named by রেজি. নং / রোল.
 */
export default function StudentPhotoManagerPage() {
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("");
  const dir = usePeopleDirectory({ photo: photoFilter });
  const { tab, scoped, searched, loading, tabCanEdit, updatePeople } = dir;

  // Initial ?photo= from the URL (read once).
  const initialPhoto = dir.initialParam("photo");
  useEffect(() => {
    if (initialPhoto === "missing" || initialPhoto === "has") setPhotoFilter(initialPhoto);
  }, [initialPhoto]);

  const [statuses, setStatuses] = useState<Record<string, CardStatus>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_CHUNK);
  const [cameraFor, setCameraFor] = useState<PhotoPerson | null>(null);
  const [seriesQueue, setSeriesQueue] = useState<PhotoPerson[] | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const savedTimers = useRef<Record<string, number>>({});

  const filtered = useMemo(() => {
    // A card that was just saved stays put (with its ✓ badge) until its status
    // clears, instead of vanishing from "ছবি নেই" the instant it gets a photo.
    const touched = (p: PhotoPerson) => Boolean(statuses[`${tab}:${p.id}`]);
    if (photoFilter === "missing") return searched.filter((p) => !hasPhoto(p) || touched(p));
    if (photoFilter === "has") return searched.filter((p) => hasPhoto(p) || touched(p));
    return searched;
  }, [searched, photoFilter, statuses, tab]);

  const total = scoped.length;
  const withPhoto = scoped.filter(hasPhoto).length;
  const missingList = useMemo(() => filtered.filter((p) => !hasPhoto(p)), [filtered]);

  useEffect(() => setVisibleCount(PAGE_CHUNK), [tab, dir.division, dir.classId, dir.search, photoFilter]);

  useEffect(() => {
    const timers = savedTimers.current;
    return () => Object.values(timers).forEach((t) => window.clearTimeout(t));
  }, []);

  /* ---------------- saving ---------------- */

  const setStatus = (key: string, status: CardStatus | undefined) =>
    setStatuses((prev) => {
      const next = { ...prev };
      if (status) next[key] = status;
      else delete next[key];
      return next;
    });

  /** Saves (or with null, removes) one person's photo; resolves true on success. */
  const savePhoto = useCallback(
    async (t: PhotoTab, person: PhotoPerson, dataUrl: string | null): Promise<boolean> => {
      const key = `${t}:${person.id}`;
      const previous = person.image;
      const patch = (image: string | null) => updatePeople(t, (p) => (p.id === person.id ? { ...p, image } : p));
      window.clearTimeout(savedTimers.current[key]);
      setStatus(key, "saving");
      if (dataUrl) patch(dataUrl); // instant preview
      try {
        patch(await savePersonPhoto(t, person.id, dataUrl));
        setStatus(key, "saved");
        savedTimers.current[key] = window.setTimeout(() => setStatus(key, undefined), 2500);
        return true;
      } catch (err) {
        logger.error("SAVE PHOTO ERROR:", err);
        patch(previous);
        setStatus(key, "error");
        useToastStore.getState().show(`${person.name} — ছবি সংরক্ষণ করা যায়নি`, "error");
        return false;
      }
    },
    [updatePeople],
  );

  const handleFile = useCallback(
    async (person: PhotoPerson, file: File) => {
      try {
        await savePhoto(tab, person, await fileToPortraitDataUrl(file));
      } catch (err) {
        logger.error("PHOTO READ ERROR:", err);
        useToastStore.getState().show("ছবিটি পড়া যায়নি — অন্য একটি ফাইল দিন", "error");
      }
    },
    [savePhoto, tab],
  );

  const handleRemove = useCallback(
    (person: PhotoPerson) => {
      useConfirmStore.getState().show({
        title: "ছবি মুছবেন?",
        message: `${person.name}-এর ছবি মুছে ফেলা হবে।`,
        confirmText: "মুছুন",
        danger: true,
        onConfirm: async () => {
          await savePhoto(tab, person, null);
        },
      });
    },
    [savePhoto, tab],
  );

  const handleCamera = useCallback((person: PhotoPerson) => setCameraFor(person), []);
  const onSeriesCapture = useCallback((p: PhotoPerson, url: string) => savePhoto(tab, p, url), [savePhoto, tab]);

  /* ---------------- render ---------------- */

  return (
    <div className="flex min-h-full flex-col bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">ছবি আপলোড</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              শুধু ছবি যোগ/পরিবর্তন — প্রতিটি ছবি সঙ্গে সঙ্গে সংরক্ষিত হয়।
            </p>
          </div>
          {tabCanEdit && (
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                disabled={loading || total === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Images className="h-4 w-4 text-emerald-600" /> একসাথে আপলোড
              </button>
              <button
                type="button"
                onClick={() => setSeriesQueue(missingList)}
                disabled={loading || missingList.length === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                title="তালিকায় যাদের ছবি নেই তাদের একে একে ছবি তুলুন"
              >
                <Camera className="h-4 w-4" /> ক্যামেরা সিরিজ মোড
              </button>
            </div>
          )}
        </div>

        <PeopleTabs dir={dir} />

        <ProgressSummary scopeLabel={dir.scopeLabel} total={total} done={withPhoto} doneLabel="ছবি আছে" />

        <PeopleFilterBar
          dir={dir}
          right={
            <SegmentedFilter
              value={photoFilter}
              onChange={setPhotoFilter}
              options={[
                { value: "", label: "সব", count: total },
                { value: "missing", label: "ছবি নেই", count: total - withPhoto },
                { value: "has", label: "ছবি আছে", count: withPhoto },
              ]}
            />
          }
        />

        <PeopleNotices dir={dir} readOnlyText="ছবি পরিবর্তনের অনুমতি আপনার নেই — শুধু দেখতে পারবেন।" />

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <Skeleton className="aspect-[3/4] w-full rounded-none" />
                <div className="space-y-2 p-2.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
            <ImageOff className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <div className="font-semibold text-slate-700 dark:text-slate-200">
              {photoFilter === "missing" && total > 0 ? "সবার ছবি দেওয়া হয়েছে" : "কাউকে পাওয়া যায়নি"}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">ফিল্টার বা সার্চ পরিবর্তন করে দেখুন।</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.slice(0, visibleCount).map((p) => (
                <PhotoCard
                  key={p.id}
                  person={p}
                  status={statuses[`${tab}:${p.id}`]}
                  canEdit={tabCanEdit}
                  onFile={handleFile}
                  onCamera={handleCamera}
                  onRemove={handleRemove}
                />
              ))}
            </div>
            {filtered.length > visibleCount && (
              <div className="flex flex-col items-center gap-1 py-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_CHUNK)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  আরও দেখান
                </button>
                <span className="text-xs text-slate-400">
                  {toBanglaDigits(visibleCount)} / {toBanglaDigits(filtered.length)} দেখানো হচ্ছে
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <CameraCaptureModal
        open={!!cameraFor}
        onClose={() => setCameraFor(null)}
        title={cameraFor ? `${cameraFor.name}${cameraFor.roll ? ` · রোল ${toBanglaDigits(cameraFor.roll)}` : ""}` : undefined}
        onCapture={(dataUrl) => {
          if (cameraFor) savePhoto(tab, cameraFor, dataUrl);
        }}
      />

      <SeriesCaptureModal
        open={!!seriesQueue}
        queue={seriesQueue || []}
        onClose={() => setSeriesQueue(null)}
        onCapture={onSeriesCapture}
      />

      <BulkPhotoUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        scope={scoped}
        allowRoll={tab === "students" && !!dir.classId}
        scopeLabel={dir.scopeLabel}
        onSave={(p, url) => savePhoto(tab, p, url)}
      />
    </div>
  );
}
