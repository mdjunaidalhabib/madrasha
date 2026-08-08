import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import EditableCanvas from "../../../components/DocumentDesigner/EditableCanvas";
import LayerPanel from "../../../components/DocumentDesigner/panels/LayerPanel";
import PropertyInspector from "../../../components/DocumentDesigner/panels/PropertyInspector";
import Toolbar from "../../../components/DocumentDesigner/Toolbar";
import { useDesignerState } from "../../../components/DocumentDesigner/useDesignerState";
import { FIELD_BINDINGS } from "../../../components/DocumentDesigner/fieldBindings";
import { DOCUMENT_TYPE_LABELS_BN, type BackendDocumentType } from "../../../components/DocumentDesigner/documentTypeMap";
import {
  getSystemTemplate,
  saveSystemDraft,
  publishSystemTemplate,
  uploadSystemTemplateBackground,
} from "../../../services/superAdminDocumentTemplateApi";
import { SkeletonCard } from "../../../components/ui/Skeleton";
import Button from "../../../components/ui/Button";

// No real tenant exists at the platform level, so the designer previews
// against realistic sample data instead (spec: "Show realistic sample data
// when designing... must NOT be permanently stored as actual student data").
const SAMPLE_ROW: Record<string, any> = {
  student_name: "Md Abdullah",
  father_name: "আব্দুল করিম",
  mother_name: "রহিমা বেগম",
  roll: "১৫",
  registration_no: "১০৪৫",
  class_name: "হিফজ",
  division_name: "হিফজ",
  academic_year: "২০২৬",
  guardian_phone: "০১৭xxxxxxxx",
  exam_name: "বার্ষিক পরীক্ষা",
  exam_year: "২০২৬",
  image: "",
};

export default function SuperAdminDocumentTemplateEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const templateId = Number(id);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [type, setType] = useState<BackendDocumentType | null>(null);

  const designer = useDesignerState({ width: 400, height: 600, background: undefined, layers: [], selectedLayerId: null });

  useEffect(() => {
    if (!templateId) return;
    (async () => {
      setLoading(true);
      try {
        const detail = await getSystemTemplate(templateId);
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
        setType(detail.type);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  if (!templateId) return <div className="p-6 text-sm text-rose-600">অবৈধ ঠিকানা</div>;
  if (loading) return <SkeletonCard lines={8} />;
  if (notFound || !type) return <div className="p-6 text-sm text-rose-600">টেমপ্লেট পাওয়া যায়নি</div>;

  const selectedLayer = designer.state.layers.find((l) => l.id === designer.state.selectedLayerId) || null;
  const fieldBindings = FIELD_BINDINGS[type];

  const handleSaveDraft = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const detail = await saveSystemDraft(templateId, {
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
      await saveSystemDraft(templateId, {
        width: designer.state.width,
        height: designer.state.height,
        background: designer.state.background || null,
        layers: designer.state.layers,
      });
      const detail = await publishSystemTemplate(templateId);
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
        onClick={() => navigate("/super-admin/document-templates")}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={15} /> Back to Document Templates
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
          const result = await uploadSystemTemplateBackground(dataUrl);
          return result.url;
        }}
        onSaveDraft={handleSaveDraft}
        saving={saving}
        onPublish={handlePublish}
        publishing={publishing}
        isPublished={isPublished}
        saveError={saveError}
      />

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        Editing a <b>{DOCUMENT_TYPE_LABELS_BN[type]}</b> system template. Preview uses sample data — never
        real student data.
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
            row={SAMPLE_ROW}
            selectedLayerId={designer.state.selectedLayerId}
            onSelectLayer={designer.selectLayer}
            onChangeLayer={designer.updateLayer}
            zoom={zoom}
            className="mx-auto shadow-lg"
          />
        </div>

        <PropertyInspector
          layer={selectedLayer}
          fieldBindings={fieldBindings}
          onChange={(patch) => {
            if (selectedLayer) designer.updateLayer(selectedLayer.id, patch);
          }}
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={() => navigate("/super-admin/document-templates")}>
          Done — back to list
        </Button>
      </div>
    </div>
  );
}
