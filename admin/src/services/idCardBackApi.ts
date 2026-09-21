import api, { cachedGet } from "./api";

/** আইডি কার্ডের পিছনের পাতার তথ্য। তারিখ ISO "YYYY-MM-DD"। */
export type IdCardBackSettings = {
  issue_date: string | null;
  expiry_date: string | null;
  principal_title: string | null;
  principal_signature: string | null;
  lost_return_text: string | null;
  /** ডিফল্ট পিছনের ডিজাইনের id (বিল্ট-ইন, ঋণাত্মক); null = "সাধারণ পিছন"। */
  default_design_id: number | null;
};

export const EMPTY_ID_CARD_BACK: IdCardBackSettings = {
  issue_date: null,
  expiry_date: null,
  principal_title: null,
  principal_signature: null,
  lost_return_text: null,
  default_design_id: null,
};

export async function getIdCardBack(): Promise<IdCardBackSettings> {
  const res = await cachedGet("/settings/id-card-back");
  return { ...EMPTY_ID_CARD_BACK, ...(res.data?.data || {}) };
}

export async function saveIdCardBack(payload: Partial<IdCardBackSettings>) {
  const res = await api.put("/settings/id-card-back", payload);
  return res.data;
}
