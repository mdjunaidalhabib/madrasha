import api, { cachedGet } from "./api";

export type LetterDesignKey = "classic" | "minimal" | "arch" | "custom";

export type LetterDesignPayload = {
  letter_design?: LetterDesignKey;
  letter_background_image?: string | null;
};

export type LetterDesignResponse = {
  letter_design: LetterDesignKey;
  letter_background_image: string | null;
};

export async function getLetterDesign(): Promise<LetterDesignResponse> {
  const res = await cachedGet("/settings/letter-design");
  return res.data?.data || { letter_design: "classic", letter_background_image: null };
}

export async function saveLetterDesign(payload: LetterDesignPayload) {
  const res = await api.put("/settings/letter-design", payload);
  return res.data;
}
