import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import EditableCanvas from "../../components/DocumentDesigner/EditableCanvas";
import LayerPanel from "../../components/DocumentDesigner/panels/LayerPanel";
import PropertyInspector from "../../components/DocumentDesigner/panels/PropertyInspector";
import Toolbar from "../../components/DocumentDesigner/Toolbar";
import { useDesignerState } from "../../components/DocumentDesigner/useDesignerState";
import { FIELD_BINDINGS } from "../../components/DocumentDesigner/fieldBindings";
import { urlSlugToDocumentType, DOCUMENT_TYPE_LABELS_BN } from "../../components/DocumentDesigner/documentTypeMap";
import { getTemplate, getPreviewData, saveDraft, publishTemplate } from "../../services/documentTemplateLibraryApi";
import { uploadApi } from "../../services/phase4Api";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { SkeletonCard } from "../../components/ui/Skeleton";
import Button from "../../components/ui/Button";

export default function TenantDocumentDesignerPage() {
  const { madrasaSlug = "", type: typeSlug = "", id } = useParams();
  const navigate = useNavigate();
  const templateId = Number(id);
  const type = urlSlugToDocumentType(typeSlug);
  const adminBase = getTenantAdminBase(madrasaSlug);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [previewRow, setPreviewRow] = useState<Record<string, any> | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveError, setSaveError] = useState("");

  const designer = useDesignerState({ width: 400, height: 600, background: undefined, layers: [], selectedLayerId: null });

  useEffect(() => {
    if (!templateId) return;
    (async () => {
      setLoading(true);
      try {
        const [detail, row] = await Promise.all([getTemplate(templateId), getPreviewData(templateId)]);
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
  if (notFound) return <div className="p-6 text-sm text-rose-600">টেমপ্লেট পাওয়া যায়নি</div>;

  const selectedLayer = designer.state.layers.find((l) => l.id === designer.state.selectedLayerId) || null;
  const fieldBindings = FIELD_BINDINGS[type];

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
    } catch {
      setSaveError("সেভ করা যায়নি, আবার চেষ্টা করুন");
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
    } catch {
      setSaveError("প্রকাশ করা যায়নি, আবার চেষ্টা করুন");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => navigate(`${adminBase}/talimat/documents`)}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={15} /> ডকুমেন্ট টেমপ্লেট তালিকায় ফিরে যান
      </button>

      <Toolbar
        name={name}
        onChangeName={setName}
        zoom={zoom}
        onChangeZoom={setZoom}
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
        saveError={saveError}
      />

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        <span>{DOCUMENT_TYPE_LABELS_BN[type]} টেমপ্লেট এডিট করছেন</span>
        {!name.trim() && <span className="text-amber-600">টেমপ্লেটের একটি নাম দিন</span>}
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
            row={previewRow || undefined}
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

      {!previewRow && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          প্রিভিউ দেখানোর জন্য কোনো সক্রিয় শিক্ষার্থীর তথ্য পাওয়া যায়নি — অন্তত একজন শিক্ষার্থী যোগ করলে
          এখানে প্রকৃত তথ্য দিয়ে প্রিভিউ দেখা যাবে।
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(`${adminBase}/talimat/documents`)}
        >
          সম্পন্ন — তালিকায় ফিরে যান
        </Button>
      </div>
    </div>
  );
}
