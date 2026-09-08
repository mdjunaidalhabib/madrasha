import api, { cachedGet } from "./api";

export type DocumentTemplatePayload = {
  sanad_template?: string | null;
  testimonial_template?: string | null;
  transfer_letter_template?: string | null;
  admit_card_rules?: string | null;
};

export type DocumentTemplateResponse = DocumentTemplatePayload & {
  tokens?: Record<string, string[]>;
};

export async function getDocumentTemplates(): Promise<DocumentTemplateResponse> {
  const res = await cachedGet("/settings/document-templates");
  return res.data?.data || {};
}

export async function saveDocumentTemplates(payload: DocumentTemplatePayload) {
  const res = await api.put("/settings/document-templates", payload);
  return res.data;
}
