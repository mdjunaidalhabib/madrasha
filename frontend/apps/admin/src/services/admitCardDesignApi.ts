import api, { cachedGet } from "./api";

export type AdmitCardDesignKey = "classic" | "minimal" | "arch" | "custom";

export type AdmitCardDesignPayload = {
  admit_card_design?: AdmitCardDesignKey;
  admit_card_background_image?: string | null;
};

export type AdmitCardDesignResponse = {
  admit_card_design: AdmitCardDesignKey;
  admit_card_background_image: string | null;
};

export async function getAdmitCardDesign(): Promise<AdmitCardDesignResponse> {
  const res = await cachedGet("/settings/admit-card-design");
  return res.data?.data || { admit_card_design: "classic", admit_card_background_image: null };
}

export async function saveAdmitCardDesign(payload: AdmitCardDesignPayload) {
  const res = await api.put("/settings/admit-card-design", payload);
  return res.data;
}
