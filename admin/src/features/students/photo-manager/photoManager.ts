import api, { clearGetCache } from "../../../services/api";
import type { UploadFolder } from "../../../services/phase4Api";
import { uploadPhoto } from "../../../components/photo/PhotoPicker";
import { normalizeBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";

export type PhotoTab = "students" | "teachers" | "staff";
/** Same tabs on every people tool (ছবি আপলোড, নাম (৩ ভাষা)). */
export type PeopleTab = PhotoTab;

/** One row on the people-tool pages (ছবি আপলোড, নাম (৩ ভাষা)) - a student,
 * teacher or staff member reduced to what the grids need, plus the raw API row. */
export type PhotoPerson = {
  id: number;
  name: string;
  image: string | null;
  regNo: string | null;
  roll: string | null;
  divisionId: string | null;
  classId: string | null;
  /** Second line under the name - class (students) or designation (teachers/staff). */
  subtitle: string;
  /** The untouched API row (name trios etc. for the names page). */
  raw: Record<string, any>;
};
export type DirectoryPerson = PhotoPerson;

export type CardStatus = "saving" | "saved" | "error";

export const TAB_META: Record<
  PhotoTab,
  { label: string; unit: string; folder: UploadFolder; listUrl: string; permission: string }
> = {
  students: { label: "শিক্ষার্থী", unit: "জন", folder: "students", listUrl: "/students", permission: "students.update" },
  teachers: { label: "শিক্ষক", unit: "জন", folder: "teachers", listUrl: "/teachers", permission: "teachers.update" },
  staff: { label: "স্টাফ", unit: "জন", folder: "staff", listUrl: "/staff", permission: "staff.update" },
};

export const hasPhoto = (p: PhotoPerson) => Boolean(p.image && p.image.trim());

const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

export const unwrapList = (payload: any): any[] => {
  const data = payload?.data?.data ?? payload?.data ?? [];
  return Array.isArray(data) ? data : [];
};

export const toStudentPerson = (s: any): PhotoPerson => ({
  id: Number(s.id),
  name: s.name_bn || s.name_en || "নামহীন",
  image: s.image || null,
  regNo: str(s.registration_no),
  roll: str(s.roll),
  divisionId: str(s.division_id),
  classId: str(s.class_id),
  subtitle: s.current_class || "",
  raw: s,
});

export const toStaffPerson = (t: any): PhotoPerson => ({
  id: Number(t.id),
  name: t.name_bn || t.name_en || "নামহীন",
  image: t.image || null,
  regNo: str(t.registration_no),
  roll: null,
  divisionId: str(t.division_id),
  classId: null,
  subtitle: t.designation || t.academic_division_name || "",
  raw: t,
});

/**
 * Uploads a captured/picked data-URI (hosted URL, or the data-URI itself when
 * cloud storage isn't configured) and saves ONLY the photo field. Students
 * use the dedicated PATCH /students/:id/photo; teachers/staff PUTs are
 * already partial updates, so `{ image }` alone touches nothing else.
 * `null` removes the photo. Returns the stored value.
 */
export async function savePersonPhoto(
  tab: PhotoTab,
  id: number,
  dataUrl: string | null,
): Promise<string | null> {
  const image = dataUrl ? await uploadPhoto(dataUrl, TAB_META[tab].folder) : null;

  if (tab === "students") await api.patch(`/students/${id}/photo`, { image });
  else await api.put(`/${tab === "teachers" ? "teachers" : "staff"}/${id}`, { image: image ?? "" });

  // Lists elsewhere (ছাত্র তালিকা, প্রোফাইল, আইডি কার্ড) read through the short GET cache.
  clearGetCache();
  return image;
}

/** First run of digits in a file name ("1045.jpg", "reg-১০৪৫ (2).png" -> "1045"). */
export const fileNumberKey = (fileName: string): string | null => {
  const base = normalizeBanglaDigits(fileName.replace(/\.[^.]+$/, ""));
  const m = base.match(/\d+/);
  return m ? String(Number(m[0])) : null;
};

/** Center-crops a video frame to the same 3:4 480x640 JPEG PhotoPicker produces. */
export function captureVideoFrame(video: HTMLVideoElement, mirror: boolean): string {
  const OUT_W = 480;
  const OUT_H = 640;
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  const ratio = OUT_W / OUT_H;
  let sw = srcW;
  let sh = srcH;
  if (srcW / srcH > ratio) sw = srcH * ratio;
  else sh = srcW / ratio;

  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext("2d")!;
  if (mirror) {
    ctx.translate(OUT_W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, (srcW - sw) / 2, (srcH - sh) / 2, sw, sh, 0, 0, OUT_W, OUT_H);
  return canvas.toDataURL("image/jpeg", 0.88);
}
