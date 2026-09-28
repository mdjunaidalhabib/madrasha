import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Pencil, Trash2, Plus, CheckCircle2 } from "lucide-react";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { SkeletonCard } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import DocumentPreview from "@madrasha/shared-ui/src/components/DocumentDesigner/DocumentPreview";
import CreateTemplateModal from "@madrasha/shared-ui/src/components/DocumentDesigner/CreateTemplateModal";
import {
  DOCUMENT_TYPE_TO_KIND,
  getDocumentTypeLabel,
  type BackendDocumentType,
} from "@madrasha/shared-ui/src/components/DocumentDesigner/documentTypeMap";
import {
  listSystemTemplates,
  getSystemTemplate,
  createSystemTemplate,
  deleteSystemTemplate,
  setSystemDefaultTemplate,
} from "../../../services/superAdminDocumentTemplateApi";
import type { TemplateDetailDto, TemplateListItemDto } from "../../../services/documentTemplateTypes";
import { getText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { documentTemplatesText } from "./documentTemplates.text";

const ALL_TYPES: BackendDocumentType[] = [
  "ID_CARD",
  "ADMIT_CARD",
  "CERTIFICATE",
  "CLEARANCE_CERTIFICATE",
  "TESTIMONIAL",
  "MARKSHEET",
  "FEE_RECEIPT",
  "SALARY_SLIP",
  "BOOK_LABEL",
];

// Previews are fit into this box (aspect-ratio preserved) instead of a fixed
// scale, so every document type — a tiny ID card or a full A4 page — reads
// clearly at a consistent, larger card size.
const THUMB_MAX_WIDTH = 300;
const THUMB_MAX_HEIGHT = 380;
const thumbScale = (width: number, height: number) => Math.min(THUMB_MAX_WIDTH / width, THUMB_MAX_HEIGHT / height);

const PLACEHOLDER_ROW: Record<string, any> = {
  student_name: "Md Abdullah",
  father_name: "আব্দুল করিম",
  roll: "১৫",
  registration_no: "১০৪৫",
  class_name: "হিফজ",
  division_name: "হিফজ",
  academic_year: "২০২৬",
  exam_name: "বার্ষিক পরীক্ষা",
  exam_year: "২০২৬",
};

export default function SuperAdminDocumentTemplatesPage() {
  const navigate = useNavigate();
  const t = useText(documentTemplatesText);
  // Re-render on language switch (document type labels are resolved via getText).
  useLang();
  const [type, setType] = useState<BackendDocumentType>("ID_CARD");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TemplateListItemDto[]>([]);
  const [details, setDetails] = useState<Record<number, TemplateDetailDto>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listSystemTemplates(type);
      setItems(list);
      const detailEntries = await Promise.all(list.map((item) => getSystemTemplate(item.id).then((d) => [item.id, d] as const)));
      setDetails(Object.fromEntries(detailEntries));
    } catch {
      setError(getText(documentTemplatesText).listLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const openInDesigner = (id: number) => navigate(`/document-templates/${id}/edit`);

  const handleCreate = async (name: string) => {
    setBusyId(-1);
    setCreateError("");
    try {
      const detail = await createSystemTemplate({ type, name });
      openInDesigner(detail.id);
      setCreateOpen(false);
    } catch {
      setCreateError(getText(documentTemplatesText).createFailed);
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (item: TemplateListItemDto) => {
    setBusyId(item.id);
    try {
      await setSystemDefaultTemplate(item.id);
      await load();
    } catch {
      setError(getText(documentTemplatesText).setDefaultFailed);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: TemplateListItemDto) => {
    if (!window.confirm(getText(documentTemplatesText).confirmDelete(item.name))) return;
    setBusyId(item.id);
    try {
      await deleteSystemTemplate(item.id);
      await load();
    } catch {
      setError(getText(documentTemplatesText).deleteFailed);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Button
            type="button"
            onClick={() => {
              setCreateError("");
              setCreateOpen(true);
            }}
          >
            <Plus size={15} className="me-1.5" /> {t.newTemplate}
          </Button>
        }
      />

      <CreateTemplateModal
        open={createOpen}
        defaultName={t.newTemplateName(getDocumentTypeLabel(type))}
        busy={busyId === -1}
        error={createError}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <div className="flex flex-wrap gap-2">
        {ALL_TYPES.map((dt) => (
          <button
            key={dt}
            type="button"
            onClick={() => setType(dt)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              type === dt ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-blue-800"
            }`}
          >
            {getDocumentTypeLabel(dt)}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">{error}</div>}

      {loading ? (
        <SkeletonCard lines={6} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {t.empty}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const detail = details[item.id];
            const version = detail?.published || detail?.draft;
            const scale = version ? thumbScale(version.width, version.height) : 1;

            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div
                  className="mx-auto mb-3 flex items-center justify-center rounded-lg border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800"
                  style={{ width: THUMB_MAX_WIDTH, height: THUMB_MAX_HEIGHT }}
                >
                  {version && (
                    <div style={{ width: version.width * scale, height: version.height * scale, overflow: "hidden" }}>
                      <DocumentPreview
                        layout={{
                          id: String(item.id),
                          kind: DOCUMENT_TYPE_TO_KIND[type],
                          width: version.width,
                          height: version.height,
                          background: version.background || undefined,
                          layers: version.layers,
                        }}
                        row={PLACEHOLDER_ROW}
                        zoom={scale}
                      />
                    </div>
                  )}
                </div>

                <div className="mb-2 flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.name}</span>
                  {item.is_system_default && (
                    <span title={t.systemDefault} className="text-amber-500 dark:text-amber-400">
                      <CheckCircle2 size={14} />
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  {!item.is_published && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {t.draft}
                    </span>
                  )}
                  {item.is_published && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      {t.published}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => openInDesigner(item.id)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Pencil size={12} /> {t.edit}
                  </button>
                  {!item.is_system_default && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleSetDefault(item)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Star size={12} /> {t.setDefault}
                    </button>
                  )}
                  {!item.is_system_default && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleDelete(item)}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 size={12} /> {t.delete}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
