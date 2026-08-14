import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Type,
  Image as ImageIcon,
  QrCode,
  Barcode,
  Square,
  UserSquare2,
  PenLine,
} from "lucide-react";
import type { DocumentLayer, LayerType } from "../types";

const LAYER_TYPE_ICON: Record<LayerType, typeof Type> = {
  text: Type,
  image: ImageIcon,
  photo: UserSquare2,
  qrcode: QrCode,
  barcode: Barcode,
  logo: ImageIcon,
  signature: PenLine,
  shape: Square,
};

const LAYER_TYPE_LABEL_BN: Record<LayerType, string> = {
  text: "টেক্সট",
  image: "ছবি",
  photo: "ছবি (ডাইনামিক)",
  qrcode: "কিউআর কোড",
  barcode: "বারকোড",
  logo: "লোগো",
  signature: "স্বাক্ষর",
  shape: "শেপ",
};

const layerSummary = (layer: DocumentLayer): string => {
  const content = layer.content as Record<string, any> | undefined;
  if (layer.type === "text") return content?.template || content?.text || "(খালি)";
  if (content?.field) return `ফিল্ড: ${content.field}`;
  return LAYER_TYPE_LABEL_BN[layer.type];
};

export interface LayerPanelProps {
  layers: DocumentLayer[];
  selectedLayerId: string | null;
  onSelect: (id: string) => void;
  onAddLayer: (type: LayerType) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: "up" | "down" | "front" | "back") => void;
}

const ADD_LAYER_TYPES: LayerType[] = ["text", "photo", "image", "qrcode", "shape"];

const LayerPanel = ({
  layers,
  selectedLayerId,
  onSelect,
  onAddLayer,
  onToggleVisible,
  onToggleLocked,
  onDuplicate,
  onDelete,
  onMove,
}: LayerPanelProps) => {
  // Front-most layer (last in array, per Canvas's render order) shown first.
  const ordered = [...layers].map((layer, index) => ({ layer, index })).reverse();

  return (
    <div className="flex w-64 shrink-0 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-3 dark:border-slate-700">
        <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">এলিমেন্ট যোগ করুন</p>
        <div className="flex flex-wrap gap-1.5">
          {ADD_LAYER_TYPES.map((type) => {
            const Icon = LAYER_TYPE_ICON[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => onAddLayer(type)}
                title={LAYER_TYPE_LABEL_BN[type]}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
              >
                <Icon size={14} />
                {LAYER_TYPE_LABEL_BN[type]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="mb-1 px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">লেয়ার ({layers.length})</p>
        {ordered.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400 dark:text-slate-500">কোনো লেয়ার নেই</p>}
        <ul className="space-y-1">
          {ordered.map(({ layer }) => {
            const Icon = LAYER_TYPE_ICON[layer.type];
            const selected = layer.id === selectedLayerId;
            return (
              <li
                key={layer.id}
                onClick={() => onSelect(layer.id)}
                className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs transition ${
                  selected
                    ? "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40"
                    : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={13} className="shrink-0 text-slate-500 dark:text-slate-400" />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-300">{layerSummary(layer)}</span>
                </div>
                {selected && (
                  <div className="mt-1.5 flex items-center gap-0.5">
                    <button
                      type="button"
                      title="সবচেয়ে সামনে আনুন"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(layer.id, "front");
                      }}
                      className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <ChevronsUp size={13} />
                    </button>
                    <button
                      type="button"
                      title="এক ধাপ সামনে"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(layer.id, "up");
                      }}
                      className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      title="এক ধাপ পেছনে"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(layer.id, "down");
                      }}
                      className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      type="button"
                      title="সবচেয়ে পেছনে পাঠান"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(layer.id, "back");
                      }}
                      className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <ChevronsDown size={13} />
                    </button>
                    <span className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />
                    <button
                      type="button"
                      title={layer.visible === false ? "দেখান" : "লুকান"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisible(layer.id);
                      }}
                      className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      {layer.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button
                      type="button"
                      title={layer.locked ? "আনলক করুন" : "লক করুন"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLocked(layer.id);
                      }}
                      className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
                    </button>
                    <button
                      type="button"
                      title="ডুপ্লিকেট"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(layer.id);
                      }}
                      className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      title="মুছুন"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(layer.id);
                      }}
                      className="rounded p-1 text-rose-600 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default LayerPanel;
