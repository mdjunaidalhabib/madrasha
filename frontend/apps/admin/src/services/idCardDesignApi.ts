import api, { cachedGet } from "./api";

export type IdCardDesignKey = "classic" | "minimal" | "arch" | "custom";

export type IdCardDesignPayload = {
  id_card_design?: IdCardDesignKey;
  id_card_background_image?: string | null;
};

export type IdCardDesignResponse = {
  id_card_design: IdCardDesignKey;
  id_card_background_image: string | null;
};

export async function getIdCardDesign(): Promise<IdCardDesignResponse> {
  const res = await cachedGet("/settings/id-card-design");
  return res.data?.data || { id_card_design: "classic", id_card_background_image: null };
}

export async function saveIdCardDesign(payload: IdCardDesignPayload) {
  const res = await api.put("/settings/id-card-design", payload);
  return res.data;
}
