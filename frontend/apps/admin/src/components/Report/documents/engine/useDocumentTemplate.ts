import { useEffect } from "react";
import { useDocumentTemplateStore } from "../../../../store/documentTemplateStore";
import type { DocumentTemplatePayload } from "../../../../services/documentTemplateApi";

/**
 * Fetches the shared document templates (once) and returns the resolved
 * template text for a given key, falling back to the provided default when
 * no admin-configured template exists yet.
 *
 * This centralizes the fetch-on-mount + selector logic that was previously
 * duplicated across every letter-style document component.
 */
export function useDocumentTemplate(
  key: keyof DocumentTemplatePayload,
  fallback: string
): string {
  const templates = useDocumentTemplateStore((s) => s.templates);
  const fetchTemplates = useDocumentTemplateStore((s) => s.fetchTemplates);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return templates?.[key] || fallback;
}
