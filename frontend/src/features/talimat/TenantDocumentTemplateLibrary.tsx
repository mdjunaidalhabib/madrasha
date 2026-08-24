import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Star, Copy, Pencil, Trash2, Plus, CheckCircle2, History, RotateCcw, Loader2 } from "lucide-react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { SkeletonCard } from "../../components/ui/Skeleton";
import DocumentPreview from "../../components/DocumentDesigner/DocumentPreview";
import CreateTemplateModal from "../../components/DocumentDesigner/CreateTemplateModal";
import {
  DOCUMENT_TYPE_TO_KIND,
  documentTypeToUrlSlug,
  type BackendDocumentType,
} from "../../components/DocumentDesigner/documentTypeMap";
import type { DocumentKind } from "../../components/DocumentDesigner/types";
import {
  listTemplates,
  getTemplate,
  getEffectiveDefault,
  getPreviewData,
  createTemplate,
  cloneTemplate,
  deleteTemplate,
  setTenantDefault,
  listTemplateVersions,
  restoreTemplateVersion,
  type TemplateDetailDto,
  type TemplateListItemDto,
  type TemplateVersionDto,
  type TemplateVersionListItemDto,
} from "../../services/documentTemplateLibraryApi";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { useConfirmStore } from "../../store/confirmStore";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { hasPermission } from "../../utils/permissions";

// Previews are fit into this box (aspect-ratio preserved) instead of a fixed
// scale, so every document type — a tiny ID card or a full A4 page — reads
// clearly at a consistent, larger card size.
const THUMB_MAX_WIDTH = 300;
const THUMB_MAX_HEIGHT = 380;

/** Scales a document preview to fit its own rendered box, tracked live via
 * ResizeObserver instead of the fixed THUMB_MAX_WIDTH constant - grid
 * columns narrower than that (small screens, 2-3 columns) used to force the
 * thumbnail to its full 300px width regardless of the card's actual space,
 * so it visually spilled into the next card. Capped at THUMB_MAX_WIDTH so
 * it never grows past the original design size on wide screens either. */
function TemplateThumb({
  version,
  kind,
  row,
}: {
  version: TemplateVersionDto;
  kind: DocumentKind;
  row: Record<string, any>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(THUMB_MAX_WIDTH);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setBoxWidth(el.clientWidth);
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const scale = Math.min(boxWidth / version.width, THUMB_MAX_HEIGHT / version.height);

  return (
    <div
      ref={boxRef}
      className="mx-auto mb-3 flex w-full items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50"
      style={{ maxWidth: THUMB_MAX_WIDTH, height: THUMB_MAX_HEIGHT }}
    >
      <div style={{ width: version.width * scale, height: version.height * scale, overflow: "hidden" }}>
        <DocumentPreview
          layout={{
            id: kind,
            kind,
            width: version.width,
            height: version.height,
            background: version.background || undefined,
            layers: version.layers,
          }}
          row={row}
          zoom={scale}
        />
      </div>
    </div>
  );
}

export default function TenantDocumentTemplateLibrary({
  type,
  title,
}: {
  type: BackendDocumentType;
  title: string;
}) {
  const { madrasaSlug = "" } = useParams();
  const navigate = useNavigate();
  const adminBase = getTenantAdminBase(madrasaSlug);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canManage = hasPermission(user, permissions, "document_templates.manage");
  const showConfirm = useConfirmStore((s) => s.show);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TemplateListItemDto[]>([]);
  const [details, setDetails] = useState<Record<number, TemplateDetailDto>>({});
  const [previewRow, setPreviewRow] = useState<Record<string, any> | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<"clone" | "default" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [historyFor, setHistoryFor] = useState<TemplateListItemDto | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // Triggers lazy legacy-design migration on first visit, so a tenant
      // who never opened this page still sees their existing design here.
      await getEffectiveDefault(type).catch(() => null);

      const list = await listTemplates(type);
      setItems(list);

      if (list.length) {
        const [detailEntries, row] = await Promise.all([
          Promise.all(list.map((item) => getTemplate(item.id).then((d) => [item.id, d] as const))),
          getPreviewData(list[0].id).catch(() => null),
        ]);
        setDetails(Object.fromEntries(detailEntries));
        setPreviewRow(row);
      }
    } catch {
      setError("টেমপ্লেট তালিকা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const openInDesigner = (id: number) => navigate(`${adminBase}/talimat/settings/documents/${documentTypeToUrlSlug(type)}/${id}/edit`);

  const handleCreate = async (name: string) => {
    setBusyId(-1);
    setCreateError("");
    try {
      const detail = await createTemplate({ type, name });
      openInDesigner(detail.id);
      setCreateOpen(false);
      useToastStore.getState().show("নতুন টেমপ্লেট তৈরি হয়েছে", "success");
    } catch {
      setCreateError("নতুন টেমপ্লেট তৈরি করা যায়নি, আবার চেষ্টা করুন");
    } finally {
      setBusyId(null);
    }
  };

  const handleClone = async (item: TemplateListItemDto) => {
    setBusyId(item.id);
    setBusyAction("clone");
    try {
      const detail = await cloneTemplate(item.id, { name: `${item.name} (কপি)` });
      openInDesigner(detail.id);
    } catch {
      setError("কপি করা যায়নি");
      useToastStore.getState().show("কপি করা যায়নি, আবার চেষ্টা করুন", "error");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const handleSetDefault = async (item: TemplateListItemDto) => {
    setBusyId(item.id);
    setBusyAction("default");
    try {
      await setTenantDefault(type, item.id);
      await load();
      useToastStore.getState().show("ডিফল্ট নির্ধারণ করা হয়েছে", "success");
    } catch {
      setError("ডিফল্ট নির্ধারণ করা যায়নি");
      useToastStore.getState().show("ডিফল্ট নির্ধারণ করা যায়নি, আবার চেষ্টা করুন", "error");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const handleDelete = (item: TemplateListItemDto) => {
    showConfirm({
      title: "টেমপ্লেট মুছে ফেলবেন?",
      message: `"${item.name}" টেমপ্লেটটি স্থায়ীভাবে মুছে যাবে — এই কাজটি ফিরিয়ে নেওয়া যাবে না।`,
      confirmText: "মুছে ফেলুন",
      danger: true,
      onConfirm: async () => {
        setBusyId(item.id);
        setBusyAction("delete");
        try {
          await deleteTemplate(item.id);
          await load();
          useToastStore.getState().show("টেমপ্লেট মুছে ফেলা হয়েছে", "success");
        } catch {
          setError("মুছে ফেলা যায়নি — এটি সম্ভবত বর্তমান ডিফল্ট হিসেবে ব্যবহৃত হচ্ছে");
          useToastStore.getState().show("মুছে ফেলা যায়নি — এটি সম্ভবত বর্তমান ডিফল্ট হিসেবে ব্যবহৃত হচ্ছে", "error");
        } finally {
          setBusyId(null);
          setBusyAction(null);
        }
      },
    });
  };

  if (loading) return <SkeletonCard lines={6} />;

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title} — টেমপ্লেট লাইব্রেরি</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">সিস্টেম টেমপ্লেট ব্যবহার করুন, কপি করে নিজের মতো সাজান, অথবা নিজের টেমপ্লেট তৈরি করুন</p>
        </div>
        {canManage && (
          <Button
            type="button"
            onClick={() => {
              setCreateError("");
              setCreateOpen(true);
            }}
          >
            <Plus size={15} className="mr-1.5" /> নতুন টেমপ্লেট
          </Button>
        )}
      </div>

      {canManage && (
        <CreateTemplateModal
          open={createOpen}
          defaultName={`নতুন ${title}`}
          busy={busyId === -1}
          error={createError}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{error}</div>}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
          কোনো টেমপ্লেট পাওয়া যায়নি। একটি নতুন টেমপ্লেট তৈরি করুন।
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const detail = details[item.id];
            const version = detail?.published || detail?.draft;
            const isTenantOwned = item.scope === "TENANT";

            return (
              <div key={item.id} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                {/* Thumbnail swatch intentionally stays light — it's the paper backdrop behind an actual document render, same as the report print-preview-wrap. */}
                {version ? (
                  <TemplateThumb version={version} kind={DOCUMENT_TYPE_TO_KIND[type]} row={previewRow || {}} />
                ) : (
                  <div
                    className="mx-auto mb-3 w-full rounded-lg border border-slate-100 bg-slate-50"
                    style={{ maxWidth: THUMB_MAX_WIDTH, height: THUMB_MAX_HEIGHT }}
                  />
                )}

                <div className="mb-2 flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                  {item.is_tenant_default && (
                    <span title="আপনার ডিফল্ট" className="text-amber-500">
                      <CheckCircle2 size={14} />
                    </span>
                  )}
                </div>
                <div className="mb-3 flex flex-wrap gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      item.scope === "SYSTEM"
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                    }`}
                  >
                    {item.scope === "SYSTEM" ? "সিস্টেম" : "আমার টেমপ্লেট"}
                  </span>
                  {!item.is_published && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      খসড়া
                    </span>
                  )}
                  {item.is_system_default && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                      সিস্টেম ডিফল্ট
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {isTenantOwned && (
                    <button
                      type="button"
                      onClick={() => openInDesigner(item.id)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Pencil size={12} /> এডিট
                    </button>
                  )}
                  {isTenantOwned && (
                    <button
                      type="button"
                      onClick={() => setHistoryFor(item)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <History size={12} /> সংস্করণ ইতিহাস
                    </button>
                  )}
                  {canManage && !isTenantOwned && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleClone(item)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {busyId === item.id && busyAction === "clone" ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Copy size={12} />
                      )}{" "}
                      {busyId === item.id && busyAction === "clone" ? "কপি হচ্ছে..." : "কপি করুন"}
                    </button>
                  )}
                  {canManage && !item.is_tenant_default && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleSetDefault(item)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {busyId === item.id && busyAction === "default" ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Star size={12} />
                      )}{" "}
                      {busyId === item.id && busyAction === "default" ? "সেট হচ্ছে..." : "ডিফল্ট করুন"}
                    </button>
                  )}
                  {canManage && isTenantOwned && !item.is_tenant_default && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleDelete(item)}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/50 dark:hover:bg-rose-950/40"
                    >
                      {busyId === item.id && busyAction === "delete" ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}{" "}
                      {busyId === item.id && busyAction === "delete" ? "মুছে ফেলা হচ্ছে..." : "মুছুন"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {historyFor && (
        <VersionHistoryModal
          template={historyFor}
          canManage={canManage}
          onClose={() => setHistoryFor(null)}
          onRestored={load}
        />
      )}
    </section>
  );
}

/** Lists a template's version history (draft + every immutable published
 * snapshot) and lets a manager restore an old version's content into the
 * CURRENT draft - restoring never deletes/overwrites the published
 * version, it only seeds the draft for further editing/re-publishing. */
function VersionHistoryModal({
  template,
  canManage,
  onClose,
  onRestored,
}: {
  template: TemplateListItemDto;
  canManage: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<TemplateVersionListItemDto[]>([]);
  const [error, setError] = useState("");
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const showConfirm = useConfirmStore((s) => s.show);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        setVersions(await listTemplateVersions(template.id));
      } catch {
        setError("সংস্করণ তালিকা লোড করা যায়নি");
      } finally {
        setLoading(false);
      }
    })();
  }, [template.id]);

  const handleRestore = (version: TemplateVersionListItemDto) => {
    showConfirm({
      title: "সংস্করণ পুনরুদ্ধার করুন?",
      message: `সংস্করণ ${version.version_no} এর বিষয়বস্তু বর্তমান খসড়ায় কপি হবে। প্রকাশিত সংস্করণ অপরিবর্তিত থাকবে — পরিবর্তন কার্যকর করতে আবার "প্রকাশ করুন" চাপতে হবে।`,
      confirmText: "পুনরুদ্ধার করুন",
      onConfirm: async () => {
        setRestoringId(version.id);
        try {
          await restoreTemplateVersion(template.id, version.id);
          onRestored();
          onClose();
          useToastStore.getState().show("সংস্করণ খসড়ায় পুনরুদ্ধার হয়েছে", "success");
        } catch {
          setError("পুনরুদ্ধার করা যায়নি, আবার চেষ্টা করুন");
          useToastStore.getState().show("পুনরুদ্ধার করা যায়নি, আবার চেষ্টা করুন", "error");
        } finally {
          setRestoringId(null);
        }
      },
    });
  };

  return (
    <Modal open title={`সংস্করণ ইতিহাস — ${template.name}`} onClose={onClose} maxWidthClassName="max-w-lg">
      {loading ? (
        <SkeletonCard lines={4} />
      ) : error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{error}</div>
      ) : versions.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">কোনো সংস্করণ পাওয়া যায়নি</div>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
            >
              <div className="text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-200">v{v.version_no}</span>{" "}
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    v.status === "PUBLISHED"
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {v.status === "PUBLISHED" ? "প্রকাশিত" : "খসড়া"}
                </span>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {v.published_at
                    ? `প্রকাশ: ${new Date(v.published_at).toLocaleDateString("bn-BD")}`
                    : `তৈরি: ${new Date(v.created_at).toLocaleDateString("bn-BD")}`}
                </div>
              </div>
              {canManage && v.status === "PUBLISHED" && (
                <button
                  type="button"
                  disabled={restoringId === v.id}
                  onClick={() => handleRestore(v)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {restoringId === v.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RotateCcw size={12} />
                  )}{" "}
                  {restoringId === v.id ? "পুনরুদ্ধার হচ্ছে..." : "পুনরুদ্ধার"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
