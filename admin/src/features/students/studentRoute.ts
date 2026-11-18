import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { getText } from "@madrasha/shared-ui/src/i18n";
import { studentsText } from "./students.text";
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
export const useStudentRoute = () => {
  const { id: ref } = useParams();
  const [result, setResult] = useState<{ ref?: string; id?: string; resolved: boolean }>({ resolved: false });

  useEffect(() => {
    setResult({ ref, resolved: false });
    if (!ref) {
      setResult({ ref, resolved: true });
      return;
    }

    const applicant = /^a-(\d+)$/.exec(ref);
    if (applicant) {
      setResult({ ref, id: applicant[1], resolved: true });
      return;
    }

    let cancelled = false;
    cachedGet(`/students/by-registration/${encodeURIComponent(ref)}`)
      .then((res) => {
        if (!cancelled) setResult({ ref, id: res.data?.data?.id ? String(res.data.data.id) : undefined, resolved: true });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ ref, resolved: true });
          useToastStore.getState().show(getText(studentsText).regNotFound, "error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  return result.ref === ref ? result : { ref, id: undefined, resolved: false };
};

export const useStudentIdParam = (): string | undefined => useStudentRoute().id;
