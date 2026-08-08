import { CanvasBackgroundJson, DocumentLayerJson } from "./document-templates.types";
import { DEFAULT_CANVAS_SIZE_PX } from "./document-templates.constants";

/**
 * Translates the 4 legacy hardcoded presets (classic/minimal/arch/custom -
 * see frontend/src/components/Report/documents/id-card-designs/*.tsx and
 * admit-card-designs/*.tsx) into real DocumentLayer[] arrays, so both the
 * one-time SYSTEM starter-template seed (prisma/seed.ts) and the
 * lazy-migration-on-read path (legacy-template-migration.service.ts) can
 * produce a template that looks like what the tenant already had, without
 * duplicating the same layer array four times over. Field bindings mirror
 * the real columns selected in reports.repository.ts
 * (findStudentIdCards/findStudentAdmitCards) exactly.
 */

type PresetKey = "classic" | "minimal" | "arch" | "custom";

const PRESET_COLORS: Record<PresetKey, { bg: string; heading: string; accent: string; text: string }> = {
  classic: { bg: "#f7f2e6", heading: "#6c1d27", accent: "#cda85f", text: "#3d2a1a" },
  minimal: { bg: "#ffffff", heading: "#1f2937", accent: "#9ca3af", text: "#111827" },
  arch: { bg: "#f4f7fb", heading: "#1d4ed8", accent: "#93c5fd", text: "#1e293b" },
  custom: { bg: "#f1f5f9", heading: "#334155", accent: "#94a3b8", text: "#0f172a" },
};

const textLayer = (
  id: string,
  template: string,
  x: number,
  y: number,
  width: number,
  height: number,
  overrides: Record<string, unknown> = {},
): DocumentLayerJson => ({
  id,
  type: "text",
  x,
  y,
  width,
  height,
  rotation: 0,
  visible: true,
  locked: false,
  content: { template },
  style: { fontSize: 10, textAlign: "center", ...overrides },
});

export function buildIdCardLayers(preset: PresetKey, backgroundImage?: string | null): DocumentLayerJson[] {
  const colors = PRESET_COLORS[preset];
  const { width } = DEFAULT_CANVAS_SIZE_PX.ID_CARD;

  const photo: DocumentLayerJson = {
    id: "photo",
    type: "photo",
    x: (width - 68) / 2,
    y: 22,
    width: 68,
    height: 68,
    rotation: 0,
    visible: true,
    locked: false,
    content: { field: "image", fit: "cover" },
    style: { borderRadius: "50%", border: `2px solid ${colors.accent}`, background: "#fff" },
  };

  return [
    photo,
    textLayer("student_name", "{{student_name}}", 8, 96, width - 16, 18, {
      fontWeight: 700,
      fontSize: 13,
      color: colors.text,
    }),
    textLayer("registration_no", "রেজি. নং: {{registration_no}}", 8, 120, width - 16, 13, {
      color: colors.text,
    }),
    textLayer("roll", "রোল: {{roll}}", 8, 136, width - 16, 13, { color: colors.text }),
    textLayer("class_name", "শ্রেণি: {{class_name}}", 8, 152, width - 16, 13, { color: colors.text }),
    textLayer("father_name", "পিতা: {{father_name}}", 8, 168, width - 16, 13, { color: colors.text }),
    textLayer("guardian_phone", "মোবাইল: {{guardian_phone}}", 8, 184, width - 16, 13, {
      color: colors.text,
    }),
    {
      id: "qrcode",
      type: "qrcode",
      x: width - 48,
      y: 268,
      width: 40,
      height: 40,
      rotation: 0,
      visible: true,
      locked: false,
      content: { field: "registration_no" },
    },
    textLayer("academic_year", "সেশন {{academic_year}}", 8, 278, 110, 12, {
      textAlign: "left",
      fontSize: 8,
      color: colors.heading,
    }),
  ];
}

export function buildIdCardBackground(preset: PresetKey, backgroundImage?: string | null): CanvasBackgroundJson {
  if (preset === "custom" && backgroundImage) return { image: backgroundImage, fit: "cover" };
  return { color: PRESET_COLORS[preset].bg };
}

export function buildAdmitCardLayers(preset: PresetKey): DocumentLayerJson[] {
  const colors = PRESET_COLORS[preset];
  const { width } = DEFAULT_CANVAS_SIZE_PX.ADMIT_CARD;

  const photo: DocumentLayerJson = {
    id: "photo",
    type: "photo",
    x: 40,
    y: 140,
    width: 110,
    height: 130,
    rotation: 0,
    visible: true,
    locked: false,
    content: { field: "image", fit: "cover" },
    style: { border: `2px solid ${colors.accent}`, background: "#fff" },
  };

  return [
    textLayer("heading", "প্রবেশপত্র", 0, 36, width, 36, {
      fontSize: 22,
      fontWeight: 700,
      color: colors.heading,
    }),
    textLayer("exam", "{{exam_name}} - {{exam_year}}", 0, 84, width, 22, {
      fontSize: 13,
      color: colors.text,
    }),
    photo,
    textLayer("student_name", "নাম: {{student_name}}", 170, 150, width - 190, 20, {
      textAlign: "left",
      fontSize: 13,
      fontWeight: 700,
      color: colors.text,
    }),
    textLayer("father_name", "পিতার নাম: {{father_name}}", 170, 180, width - 190, 18, {
      textAlign: "left",
      color: colors.text,
    }),
    textLayer("class_name", "শ্রেণি: {{class_name}}", 170, 208, width - 190, 18, {
      textAlign: "left",
      color: colors.text,
    }),
    textLayer("roll", "রোল: {{roll}}", 170, 236, width - 190, 18, { textAlign: "left", color: colors.text }),
    textLayer("registration_no", "রেজিস্ট্রেশন: {{registration_no}}", 170, 264, width - 190, 18, {
      textAlign: "left",
      color: colors.text,
    }),
    {
      id: "qrcode",
      type: "qrcode",
      x: width - 120,
      y: 150,
      width: 90,
      height: 90,
      rotation: 0,
      visible: true,
      locked: false,
      content: { field: "registration_no" },
    },
    textLayer("signature", "পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর", width - 220, 700, 180, 30, {
      fontSize: 10,
      color: colors.text,
    }),
  ];
}

export function buildAdmitCardBackground(preset: PresetKey, backgroundImage?: string | null): CanvasBackgroundJson {
  if (preset === "custom" && backgroundImage) return { image: backgroundImage, fit: "cover" };
  return { color: PRESET_COLORS[preset].bg };
}

export const isKnownPreset = (value: unknown): value is PresetKey =>
  value === "classic" || value === "minimal" || value === "arch" || value === "custom";

export type { PresetKey };
