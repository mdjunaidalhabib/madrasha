import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import EditableCanvas from "../../components/DocumentDesigner/EditableCanvas";
import LayerPanel from "../../components/DocumentDesigner/panels/LayerPanel";
import PropertyInspector from "../../components/DocumentDesigner/panels/PropertyInspector";
import Toolbar from "../../components/DocumentDesigner/Toolbar";
import DemoDataModal from "../../components/DocumentDesigner/DemoDataModal";
import { useDesignerState } from "../../components/DocumentDesigner/useDesignerState";
import { FIELD_BINDINGS } from "../../components/DocumentDesigner/fieldBindings";
import { urlSlugToDocumentType, DOCUMENT_TYPE_LABELS_BN } from "../../components/DocumentDesigner/documentTypeMap";
import { getTemplate, getPreviewData, saveDraft, publishTemplate } from "../../services/documentTemplateLibraryApi";
import { uploadApi } from "../../services/phase4Api";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { SkeletonCard } from "../../components/ui/Skeleton";
import Button from "../../components/ui/Button";
import { useToastStore } from "../../store/toastStore";
import type { TemplateVersionDto } from "../../services/documentTemplateLibraryApi";

/** Normalized content fingerprint used to tell whether the live editor
 * state actually differs from a given version - order-independent JSON key
 * ordering isn't a concern here since both sides always originate from the
 * same load/save round-trip shape. */
const contentSnapshot = (v: {
  width: number;
  height: number;
  background: TemplateVersionDto["background"];
  layers: TemplateVersionDto["layers"];
}) => JSON.stringify({ width: v.width, height: v.height, background: v.background || null, layers: v.layers });

export default function TenantDocumentDesignerPage() {
  const { madrasaSlug = "", type: typeSlug = "", id } = useParams();
  const navigate = useNavigate();
  const templateId = Number(id);
  const type = urlSlugToDocumentType(typeSlug);
  const adminBase = getTenantAdminBase(madrasaSlug);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [readOnlySystem, setReadOnlySystem] = useState(false);
  const [name, setName] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [previewRow, setPreviewRow] = useState<Record<string, any> | null>(null);
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, any>>({});
  const [demoDataOpen, setDemoDataOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveError, setSaveError] = useState("");
  // Snapshot of the last-published version's content, so "পুনঃপ্রকাশ করুন" can
  // stay disabled until the live editor state actually differs from what's
  // already published - null means nothing has ever been published yet.
  const [publishedSnapshot, setPublishedSnapshot] = useState<string | null>(null);

  const designer = useDesignerState({ width: 400, height: 600, background: undefined, layers: [], selectedLayerId: null });

  useEffect(() => {
    if (!templateId) return;
    (async () => {
      setLoading(true);
      try {
        const [detail, row] = await Promise.all([getTemplate(templateId), getPreviewData(templateId)]);
        // Super Admin's SYSTEM templates are read-only here - a tenant can
        // only view/customize (clone into their own copy) them, never edit
        // the shared original in place. The library page already hides the
        // এডিট button for these, this guards a direct URL visit too.
        if (detail.scope !== "TENANT") {
          setReadOnlySystem(true);
          return;
        }
        const version = detail.draft || detail.published;
        designer.load({
          width: version?.width || 400,
          height: version?.height || 600,
          background: version?.background || undefined,
          layers: version?.layers || [],
          selectedLayerId: null,
        });
        setName(detail.name);
        setIsPublished(detail.is_published);
        setPublishedSnapshot(detail.published ? contentSnapshot(detail.published) : null);
        setPreviewRow(row);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  if (!type || !templateId) {
    return <div className="p-6 text-sm text-rose-600">অবৈধ ঠিকানা</div>;
  }

  if (loading) return <SkeletonCard lines={8} />;

  if (notFound || readOnlySystem) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-rose-600">
          {readOnlySystem
            ? "এটি সুপার অ্যাডমিনের সিস্টেম টেমপ্লেট — এখান থেকে সরাসরি এডিট করা যাবে না। টেমপ্লেট লাইব্রেরি থেকে \"কপি করুন\" চেপে নিজের একটি কপি তৈরি করুন।"
            : "টেমপ্লেট পাওয়া যায়নি"}
        </p>
        <button
          type="button"
          onClick={() => navigate(`${adminBase}/talimat/settings/documents`)}
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft size={15} /> ডকুমেন্ট টেমপ্লেট তালিকায় ফিরে যান
        </button>
      </div>
    );
  }

  const selectedLayer = designer.state.layers.find((l) => l.id === designer.state.selectedLayerId) || null;
  const fieldBindings = FIELD_BINDINGS[type];
  const effectiveRow = { ...(previewRow || {}), ...previewOverrides };
  const hasPreviewOverrides = Object.keys(previewOverrides).length > 0;
  const hasChanges =
    publishedSnapshot === null ||
    contentSnapshot({
      width: designer.state.width,
      height: designer.state.height,
      background: designer.state.background || null,
      layers: designer.state.layers,
    }) !== publishedSnapshot;

  const handleSaveDraft = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const detail = await saveDraft(templateId, {
        width: designer.state.width,
        height: designer.state.height,
        background: designer.state.background || null,
        layers: designer.state.layers,
      });
      setIsPublished(detail.is_published);
      useToastStore.getState().show("খসড়া সেভ হয়েছে", "success");
    } catch {
      setSaveError("সেভ করা যায়নি, আবার চেষ্টা করুন");
      useToastStore.getState().show("সেভ করা যায়নি, আবার চেষ্টা করুন", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setSaveError("");
    try {
      await saveDraft(templateId, {
        width: designer.state.width,
        height: designer.state.height,
        background: designer.state.background || null,
        layers: designer.state.layers,
      });
      const detail = await publishTemplate(templateId);
      setIsPublished(detail.is_published);
      setPublishedSnapshot(detail.published ? contentSnapshot(detail.published) : null);
      useToastStore.getState().show("টেমপ্লেট প্রকাশ হয়েছে", "success");
    } catch {
      setSaveError("প্রকাশ করা যায়নি, আবার চেষ্টা করুন");
      useToastStore.getState().show("প্রকাশ করা যায়নি, আবার চেষ্টা করুন", "error");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => navigate(`${adminBase}/talimat/settings/documents`)}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft size={15} /> ডকুমেন্ট টেমপ্লেট তালিকায় ফিরে যান
      </button>

      <Toolbar
        name={name}
        onChangeName={setName}
        zoom={zoom}
        onChangeZoom={setZoom}
        width={designer.state.width}
        height={designer.state.height}
        onChangeSize={designer.setCanvasSize}
        background={designer.state.background}
        onChangeBackground={designer.setBackground}
        onUploadBackgroundImage={async (file) => {
          const dataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const res = await uploadApi.uploadImage(dataUrl, "document-templates");
          return res.data.data.uploaded ? res.data.data.url! : dataUrl;
        }}
        onSaveDraft={handleSaveDraft}
        saving={saving}
        onPublish={handlePublish}
        publishing={publishing}
        isPublished={isPublished}
        hasChanges={hasChanges}
        saveError={saveError}
      />

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span>{DOCUMENT_TYPE_LABELS_BN[type]} টেমপ্লেট এডিট করছেন</span>
          {!name.trim() && <span className="text-amber-600 dark:text-amber-400">টেমপ্লেটের একটি নাম দিন</span>}
        </div>
        <button
          type="button"
          onClick={() => setDemoDataOpen(true)}
          className="font-medium text-blue-600 underline dark:text-blue-400"
        >
          ডেমো ডেটা এডিট করুন{hasPreviewOverrides ? " (পরিবর্তিত)" : ""}
        </button>
      </div>

      <div className="flex items-start gap-4 overflow-x-auto pb-6">
        <LayerPanel
          layers={designer.state.layers}
          selectedLayerId={designer.state.selectedLayerId}
          onSelect={designer.selectLayer}
          onAddLayer={designer.addLayer}
          onToggleVisible={designer.toggleVisible}
          onToggleLocked={designer.toggleLocked}
          onDuplicate={designer.duplicateLayer}
          onDelete={designer.deleteLayer}
          onMove={designer.moveLayer}
        />

        <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-8">
          <EditableCanvas
            width={designer.state.width}
            height={designer.state.height}
            background={designer.state.background}
            layers={designer.state.layers}
            row={effectiveRow}
            selectedLayerId={designer.state.selectedLayerId}
            onSelectLayer={designer.selectLayer}
            onChangeLayer={designer.updateLayer}
            zoom={zoom}
            className="mx-auto shadow-lg"
          />
        </div>

        <PropertyInspector layer={selectedLayer} fieldBindings={fieldBindings} onChange={(patch) => {
          if (selectedLayer) designer.updateLayer(selectedLayer.id, patch);
        }} />
      </div>

      {!previewRow && !hasPreviewOverrides && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          প্রিভিউ দেখানোর জন্য কোনো সক্রিয় শিক্ষার্থীর তথ্য পাওয়া যায়নি — অন্তত একজন শিক্ষার্থী যোগ করলে এখানে প্রকৃত তথ্য
          দিয়ে প্রিভিউ দেখা যাবে, অথবা "ডেমো ডেটা এডিট করুন" থেকে নিজের মতো নমুনা তথ্য বসিয়ে দেখুন।
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(`${adminBase}/talimat/settings/documents`)}
        >
          সম্পন্ন — তালিকায় ফিরে যান
        </Button>
      </div>

      <DemoDataModal
        open={demoDataOpen}
        onClose={() => setDemoDataOpen(false)}
        fields={fieldBindings}
        row={effectiveRow}
        onChangeField={(field, value) => setPreviewOverrides((prev) => ({ ...prev, [field]: value }))}
        onReset={() => setPreviewOverrides({})}
        hasOverrides={hasPreviewOverrides}
      />
    </div>
  );
}
