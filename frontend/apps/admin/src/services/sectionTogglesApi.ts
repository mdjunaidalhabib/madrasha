import api, { cachedGet } from "./api";

export type SectionTogglesPayload = Record<string, boolean>;

export async function getSectionToggles(): Promise<SectionTogglesPayload> {
  const res = await cachedGet("/settings/section-toggles");
  return res.data?.data || {};
}

export async function saveSectionToggle(key: string, enabled: boolean): Promise<SectionTogglesPayload> {
  const res = await api.put("/settings/section-toggles", { key, enabled });
  return res.data?.data || {};
}
