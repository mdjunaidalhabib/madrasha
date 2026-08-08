import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Star, Copy, Pencil, Trash2, Plus, CheckCircle2 } from "lucide-react";
import Button from "../../components/ui/Button";
import { SkeletonCard } from "../../components/ui/Skeleton";
import DocumentPreview from "../../components/DocumentDesigner/DocumentPreview";
import CreateTemplateModal from "../../components/DocumentDesigner/CreateTemplateModal";
import {
  DOCUMENT_TYPE_TO_KIND,
  documentTypeToUrlSlug,
  type BackendDocumentType,
} from "../../components/DocumentDesigner/documentTypeMap";
import {
  listTemplates,
  getTemplate,
  getEffectiveDefault,
  getPreviewData,
  createTemplate,
  cloneTemplate,
  deleteTemplate,
  setTenantDefault,
  type TemplateDetailDto,
  type TemplateListItemDto,
} from "../../services/documentTemplateLibraryApi";
import { getTenantAdminBase } from "../../utils/tenantSlug";

// Previews are fit into this box (aspect-ratio preserved) instead of a fixed
// scale, so every document type — a tiny ID card or a full A4 page — reads
// clearly at a consistent, larger card size.
const THUMB_MAX_WIDTH = 300;
const THUMB_MAX_HEIGHT = 380;
const thumbScale = (width: number, height: number) => Math.min(THUMB_MAX_WIDTH / width, THUMB_MAX_HEIGHT / height);

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

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TemplateListItemDto[]>([]);
  const [details, setDetails] = useState<Record<number, TemplateDetailDto>>({});
  const [previewRow, setPreviewRow] = useState<Record<string, any> | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");

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

  const openInDesigner = (id: number) => navigate(`${adminBase}/talimat/documents/${documentTypeToUrlSlug(type)}/${id}/edit`);

  const handleCreate = async (name: string) => {
    setBusyId(-1);
    setCreateError("");
    try {
      const detail = await createTemplate({ type, name });
      openInDesigner(detail.id);
      setCreateOpen(false);
    } catch {
      setCreateError("নতুন টেমপ্লেট তৈরি করা যায়নি, আবার চেষ্টা করুন");
    } finally {
      setBusyId(null);
    }
  };

  const handleClone = async (item: TemplateListItemDto) => {
    setBusyId(item.id);
    try {
      const detail = await cloneTemplate(item.id, { name: `${item.name} (কপি)` });
      openInDesigner(detail.id);
    } catch {
      setError("কপি করা যায়নি");
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (item: TemplateListItemDto) => {
    setBusyId(item.id);
    try {
      await setTenantDefault(type, item.id);
      await load();
    } catch {
      setError("ডিফল্ট নির্ধারণ করা যায়নি");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: TemplateListItemDto) => {
    if (!window.confirm(`"${item.name}" টেমপ্লেটটি মুছে ফেলতে চান?`)) return;
    setBusyId(item.id);
    try {
      await deleteTemplate(item.id);
      await load();
    } catch {
      setError("মুছে ফেলা যায়নি — এটি সম্ভবত বর্তমান ডিফল্ট হিসেবে ব্যবহৃত হচ্ছে");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <SkeletonCard lines={6} />;

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title} — টেমপ্লেট লাইব্রেরি</h2>
          <p className="text-xs text-slate-500">সিস্টেম টেমপ্লেট ব্যবহার করুন, কাস্টমাইজ করুন, অথবা নিজের টেমপ্লেট তৈরি করুন</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setCreateError("");
            setCreateOpen(true);
          }}
        >
          <Plus size={15} className="mr-1.5" /> নতুন টেমপ্লেট
        </Button>
      </div>

      <CreateTemplateModal
        open={createOpen}
        defaultName={`নতুন ${title}`}
        busy={busyId === -1}
        error={createError}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          কোনো টেমপ্লেট পাওয়া যায়নি। একটি নতুন টেমপ্লেট তৈরি করুন।
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const detail = details[item.id];
            const version = detail?.published || detail?.draft;
            const isTenantOwned = item.scope === "TENANT";
            const scale = version ? thumbScale(version.width, version.height) : 1;

            return (
              <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                <div
                  className="mx-auto mb-3 flex items-center justify-center rounded-lg border border-slate-100 bg-slate-50"
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
                        row={previewRow || {}}
                        zoom={scale}
                      />
                    </div>
                  )}
                </div>

                <div className="mb-2 flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                  {item.is_tenant_default && (
                    <span title="আপনার ডিফল্ট" className="text-amber-500">
                      <CheckCircle2 size={14} />
                    </span>
                  )}
                </div>
                <div className="mb-3 flex flex-wrap gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      item.scope === "SYSTEM" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {item.scope === "SYSTEM" ? "সিস্টেম" : "আমার টেমপ্লেট"}
                  </span>
                  {!item.is_published && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      খসড়া
                    </span>
                  )}
                  {item.is_system_default && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                      সিস্টেম ডিফল্ট
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {isTenantOwned && (
                    <button
                      type="button"
                      onClick={() => openInDesigner(item.id)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil size={12} /> এডিট
                    </button>
                  )}
                  {!isTenantOwned && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleClone(item)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <Copy size={12} /> কাস্টমাইজ করুন
                    </button>
                  )}
                  {!item.is_tenant_default && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleSetDefault(item)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <Star size={12} /> ডিফল্ট করুন
                    </button>
                  )}
                  {isTenantOwned && !item.is_tenant_default && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleDelete(item)}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={12} /> মুছুন
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
