import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { cachedGet } from "../../services/api";

/**
 * ছাত্রের প্রোফাইল URL-এ গ্লোবাল DB id (সব মাদরাসা মিলিয়ে বড় সংখ্যা) না দেখিয়ে
 * মাদরাসার নিজস্ব রেজিস্ট্রেশন নম্বর দেখানো হয়: `/students/1045`।
 * যাদের রেজি. নং এখনো নেই (পেন্ডিং/বাতিল আবেদন) তাদের জন্য `a-<id>`।
 */
export const studentRef = (s: {
  id: number | string;
  registration_no?: number | string | null;
  registrationNo?: number | string | null;
}): string => {
  const reg = s.registration_no ?? s.registrationNo;
  return reg != null && reg !== "" ? String(reg) : `a-${s.id}`;
};

/**
 * ছাত্রের পেজের URL (REST-style):
 * - `""` (ডিফল্ট) → প্রোফাইল `/students/1045`
 * - `"/edit"` → এডিট পেজ `/students/1045/edit`
 * - `` `/${tab}` `` → প্রোফাইলের নির্দিষ্ট ট্যাব, যেমন `/students/1045/fees`
 */
export const studentPath = (
  s: Parameters<typeof studentRef>[0],
  suffix: "" | "/edit" | `/${string}` = "",
) => `/students/${studentRef(s)}${suffix}`;

/** URL-এর `:id` প্যারাম (রেজি. নং বা `a-<id>`) থেকে আসল student id বের করে। */
export const useStudentIdParam = (): string | undefined => {
  const { id: ref } = useParams();
  const [id, setId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setId(undefined);
    if (!ref) return;

    const applicant = /^a-(\d+)$/.exec(ref);
    if (applicant) {
      setId(applicant[1]);
      return;
    }

    let cancelled = false;
    cachedGet(`/students/by-registration/${encodeURIComponent(ref)}`)
      .then((res) => {
        if (!cancelled && res.data?.data?.id) setId(String(res.data.data.id));
      })
      .catch(() => {
        if (!cancelled) useToastStore.getState().show("এই রেজিস্ট্রেশন নম্বরে কোনো ছাত্র পাওয়া যায়নি", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  return id;
};
