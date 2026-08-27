import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cachedGet } from "../../services/api";
import { logger } from "../../utils/logger";
import { normalizeBanglaDigits, toBanglaDigits } from "../../utils/reportUtils";
import { filterPeopleBySearch } from "../../utils/personSearch";

export type QuickNavRecord = {
  id: number | string;
  name_bn?: string | null;
  name?: string | null;
  registration_no?: number | string | null;
  roll?: number | string | null;
  is_active?: number | null;
  [key: string]: unknown;
};

type Props = {
  /**
   * যেখান থেকে তালিকা আসবে। `null` = প্রোফাইল এখনো লোড হয়নি বলে এন্ডপয়েন্ট
   * জানা যায়নি, তাই ফেচও হবে না (নাহলে আগে ভুল স্কোপে একবার কল হতো)।
   */
  endpoint: string | null;
  currentId: string | number;
  /** id থেকে প্রোফাইল রুট বানায় */
  profilePath: (id: string | number) => string;
  placeholder: string;
  ariaLabel: string;
  /** ড্রপডাউনের দ্বিতীয় লাইন — খালি অংশগুলো বাদ পড়ে */
  metaParts: (record: QuickNavRecord) => (string | null | undefined | false)[];
  /** নাম/রেজিস্ট্রেশনের বাইরে বাড়তি যেসব টেক্সট ফিল্ডে (designation, class ইত্যাদি) সার্চ মিলবে */
  extraSearchFields?: (record: QuickNavRecord) => (string | number | null | undefined)[];
  /** ফোন/মোবাইল ফিল্ড - আলাদা রাখা হয়েছে কারণ এগুলো stricter নিয়মে মেলে (দেখুন personSearch.ts) */
  phoneFields?: (record: QuickNavRecord) => (string | number | null | undefined)[];
};

const MAX_SUGGESTIONS = 8;

const recordName = (record: QuickNavRecord) => record.name_bn || record.name || "নাম নেই";

/**
 * সংখ্যা হিসেবে পড়া যায় এমন মান, নাহলে `null`। সরাসরি `Number()` করলে
 * `Number(null) === 0` হয়ে যেত, ফলে রোল/রেজিস্ট্রেশন খালি থাকা রেকর্ড "০"
 * ধরে সবার আগে চলে আসত।
 */
const numericValue = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(normalizeBanglaDigits(String(value)));
  return Number.isFinite(parsed) ? parsed : null;
};

// মান না থাকলে (null) রেকর্ডটা তালিকার শেষে যায়।
const compareNumeric = (a: number | null, b: number | null) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
};

/**
 * সিরিয়াল রেজিস্ট্রেশন নম্বর ধরে — রেজিস্ট্রেশন ভর্তির সময় একবারই বসে ও আর
 * বদলায় না, তাই আগের/পরের ক্রম প্রতিবার একই থাকে। রোল দিয়ে সাজালে সেশন
 * ট্রান্সফার বা রোল আপডেটের পর ক্রম বদলে যেত। রেজিস্ট্রেশন না থাকলে রোল,
 * তাও না থাকলে নামের ক্রম — আর সেসব রেকর্ড তালিকার শেষে যায়।
 */
const compareRecords = (a: QuickNavRecord, b: QuickNavRecord) => {
  const byRegistration = compareNumeric(
    numericValue(a.registration_no),
    numericValue(b.registration_no),
  );
  if (byRegistration !== 0) return byRegistration;

  const byRoll = compareNumeric(numericValue(a.roll), numericValue(b.roll));
  if (byRoll !== 0) return byRoll;

  return recordName(a).localeCompare(recordName(b), "bn");
};

/**
 * প্রোফাইল পেজ থেকে আরেকজনের প্রোফাইলে সরাসরি যাওয়ার কুইক সার্চ +
 * আগের/পরের নেভিগেশন। ছাত্র ও শিক্ষক — দুই প্রোফাইলেই একই কম্পোনেন্ট, শুধু
 * এন্ডপয়েন্ট আর ড্রপডাউনে কোন তথ্য দেখাবে সেটুকু আলাদা। তালিকা একবারই আনা
 * হয় (cachedGet), তাই সার্চের সময় প্রতি কীস্ট্রোকে নেটওয়ার্ক কল হয় না।
 */
const ProfileQuickNav = ({
  endpoint,
  currentId,
  profilePath,
  placeholder,
  ariaLabel,
  metaParts,
  extraSearchFields,
  phoneFields,
}: Props) => {
  const navigate = useNavigate();

  const [records, setRecords] = useState<QuickNavRecord[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!endpoint) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await cachedGet(endpoint);
        const payload: any = res.data;
        const data = payload?.data?.data || payload?.data || [];

        if (!cancelled) setRecords(Array.isArray(data) ? data : []);
      } catch (err) {
        logger.error("QUICK NAV LIST ERROR:", err);
        if (!cancelled) setRecords([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const sortedRecords = useMemo(() => [...records].sort(compareRecords), [records]);

  const currentIndex = useMemo(
    () => sortedRecords.findIndex((record) => String(record.id) === String(currentId)),
    [sortedRecords, currentId],
  );

  const previousRecord = currentIndex > 0 ? sortedRecords[currentIndex - 1] : null;
  const nextRecord =
    currentIndex >= 0 && currentIndex < sortedRecords.length - 1
      ? sortedRecords[currentIndex + 1]
      : null;

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];

    const candidates = sortedRecords.filter((record) => String(record.id) !== String(currentId));

    return filterPeopleBySearch(candidates, query, (record) => ({
      text: [recordName(record), ...(extraSearchFields?.(record) ?? [])],
      registrationNo: record.registration_no,
      phones: phoneFields?.(record) ?? [],
    })).slice(0, MAX_SUGGESTIONS);
  }, [sortedRecords, query, currentId, extraSearchFields, phoneFields]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // কীবোর্ডে নিচে নামলে হাইলাইট করা সাজেশন যেন স্ক্রলের বাইরে না থাকে।
  useEffect(() => {
    if (open) optionRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  // বাইরে ক্লিক করলে ড্রপডাউন বন্ধ হবে।
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const goToRecord = useCallback(
    (id?: number | string | null) => {
      if (id === null || id === undefined) return;
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
      navigate(profilePath(id));
    },
    [navigate, profilePath],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      goToRecord(suggestions[highlight]?.id);
    }
  };

  const navButtonClass =
    "group flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 " +
    "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 " +
    "hover:text-blue-600 hover:shadow-md hover:shadow-blue-500/15 active:translate-y-0 active:scale-95 " +
    "disabled:pointer-events-none disabled:opacity-30 " +
    "dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 " +
    "dark:hover:text-blue-400 dark:hover:shadow-blue-500/10";

  return (
    <div className="mb-4 flex items-center gap-2">
      <div ref={wrapperRef} className="relative min-w-0 flex-1 sm:max-w-sm">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls="profile-quick-nav-list"
          aria-autocomplete="list"
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="peer h-8 w-full rounded-full border border-gray-200 bg-gray-50/80 pl-8 pr-8 text-[13px] text-gray-800 outline-none transition-all duration-200 ease-out placeholder:text-gray-400 hover:border-gray-300 hover:bg-white focus:border-blue-400 focus:bg-white focus:shadow-sm focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:focus:border-blue-500/60 dark:focus:bg-slate-800 dark:focus:ring-blue-500/15"
        />

        {/* input-এর পরে বসানো, যাতে peer-focus দিয়ে ফোকাসে আইকনটাও রঙ বদলায় */}
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors duration-200 peer-focus:text-blue-500 dark:text-slate-500 dark:peer-focus:text-blue-400"
        />

        {query !== "" && (
          <button
            type="button"
            aria-label="সার্চ মুছুন"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-all duration-200 hover:bg-gray-200 hover:text-gray-700 active:scale-90 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <X size={12} />
          </button>
        )}

        {open && query.trim() !== "" && (
          <ul
            id="profile-quick-nav-list"
            role="listbox"
            className="quick-nav-pop absolute z-20 mt-1.5 max-h-80 w-full overflow-y-auto overflow-x-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl shadow-gray-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/40"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-2.5 text-[13px] text-gray-500 dark:text-slate-400">
                কিছু পাওয়া যায়নি
              </li>
            ) : (
              suggestions.map((record, index) => {
                const active = index === highlight;
                const meta = metaParts(record).filter(Boolean) as string[];

                return (
                  <li key={record.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => goToRecord(record.id)}
                      className={`group relative flex w-full items-center gap-3 py-2 pl-4 pr-3 text-left transition-all duration-200 ease-out ${
                        active
                          ? "bg-gradient-to-r from-blue-50 via-blue-50/50 to-transparent dark:from-blue-500/10 dark:via-blue-500/5"
                          : "hover:bg-gray-50/70 dark:hover:bg-slate-700/30"
                      }`}
                    >
                      {/* বাঁ পাশের অ্যাকসেন্ট বার — হাইলাইট হলে উপর-নিচে খুলে আসে */}
                      <span
                        className={`absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-500 transition-transform duration-200 ease-out dark:bg-blue-400 ${
                          active ? "scale-y-100" : "scale-y-0"
                        }`}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-gray-800 dark:text-slate-100">
                          {recordName(record)}
                          {Number(record.is_active) === 0 && (
                            <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-px text-[11px] font-normal text-red-600 dark:bg-red-950/40 dark:text-red-400">
                              বহিষ্কৃত
                            </span>
                          )}
                        </p>

                        {/* ১২px-এর নিচে নামানো যাবে না — বাংলা ১ মিলিয়ে যায় */}
                        {meta.length > 0 && (
                          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-slate-400">
                            {meta.map((part, partIndex) => (
                              <span key={part}>
                                {partIndex > 0 && (
                                  <span className="mx-1.5 text-gray-300 dark:text-slate-600">
                                    •
                                  </span>
                                )}
                                {part}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>

                      <ChevronRight
                        size={14}
                        className={`shrink-0 text-blue-500 transition-all duration-200 ease-out dark:text-blue-400 ${
                          active ? "translate-x-0 opacity-100" : "-translate-x-1.5 opacity-0"
                        }`}
                      />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          disabled={!previousRecord}
          onClick={() => goToRecord(previousRecord?.id)}
          aria-label="আগের প্রোফাইল"
          title={previousRecord ? `আগের: ${recordName(previousRecord)}` : "আগের কেউ নেই"}
          className={navButtonClass}
        >
          <ChevronLeft
            size={16}
            className="transition-transform duration-200 group-hover:-translate-x-0.5"
          />
        </button>

        {/* Hind Siliguri-তে বাংলা ১-এর স্ট্রোক খুব সরু — ছোট ফন্ট-সাইজে (১১px)
            আর হালকা ওয়েটে অ্যান্টি-অ্যালিয়াসিংয়েই অর্ধেক মিলিয়ে যায়, দেখতে
            কাটা লাগে (index.css-এও একই সমস্যার নোট আছে)। তাই এখানে ১৩px +
            semibold, আর `tabular-nums`/`leading-none` বাদ — ও দুটো ল্যাটিন
            অঙ্কের জন্য, বাংলায় গ্লিফ আরও চেপে যায়। */}
        {currentIndex >= 0 && sortedRecords.length > 0 && (
          <span className="flex h-8 shrink-0 items-center whitespace-nowrap rounded-full bg-gray-100 px-2.5 text-[13px] font-semibold text-gray-600 dark:bg-slate-800 dark:text-slate-400">
            {toBanglaDigits(currentIndex + 1)}
            <span className="mx-1 font-normal text-gray-300 dark:text-slate-600">/</span>
            {toBanglaDigits(sortedRecords.length)}
          </span>
        )}

        <button
          type="button"
          disabled={!nextRecord}
          onClick={() => goToRecord(nextRecord?.id)}
          aria-label="পরের প্রোফাইল"
          title={nextRecord ? `পরের: ${recordName(nextRecord)}` : "পরের কেউ নেই"}
          className={navButtonClass}
        >
          <ChevronRight
            size={16}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </button>
      </div>
    </div>
  );
};

export default ProfileQuickNav;
