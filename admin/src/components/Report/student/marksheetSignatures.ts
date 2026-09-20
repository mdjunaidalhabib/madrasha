import {
  DEFAULT_MARKSHEET_FIELDS,
  type MarksheetFieldItem,
  type MarksheetSignaturePosition,
} from "../../../services/brandingApi";

export type SignatureKey = "sig_teacher" | "sig_principal";

export const SIGNATURE_KEYS: SignatureKey[] = ["sig_teacher", "sig_principal"];

export const SIGNATURE_LABELS: Record<SignatureKey, string> = {
  sig_teacher: "শ্রেণি শিক্ষকের স্বাক্ষর",
  sig_principal: "মুহতামিমের স্বাক্ষর",
};

export const SIGNATURE_POSITION_LABELS: Record<MarksheetSignaturePosition, string> = {
  left: "বাম",
  center: "মাঝ",
  right: "ডান",
};

export const SIGNATURE_POSITIONS: MarksheetSignaturePosition[] = ["left", "center", "right"];

// Same sides the signatures always printed on before the position setting existed.
const DEFAULT_POSITION: Record<SignatureKey, MarksheetSignaturePosition> = {
  sig_teacher: "left",
  sig_principal: "right",
};

export type SignatureSetting = { key: SignatureKey; visible: boolean; position: MarksheetSignaturePosition };

const isPosition = (value: unknown): value is MarksheetSignaturePosition =>
  value === "left" || value === "center" || value === "right";

/** Effective visibility + side of both signatures (missing = shown at the default side). */
export const getSignatureSettings = (fields: MarksheetFieldItem[] | undefined | null): SignatureSetting[] =>
  SIGNATURE_KEYS.map((key) => {
    const item = fields?.find((f) => f.key === key);
    return {
      key,
      visible: item ? item.visible : true,
      position: isPosition(item?.position) ? item.position : DEFAULT_POSITION[key],
    };
  });

/** Full field list with one signature's visibility/side changed. Moving a
 * signature onto the side the other one already holds swaps them, so the two
 * never end up printed on top of each other. */
export const applySignatureChange = (
  fields: MarksheetFieldItem[] | undefined | null,
  key: SignatureKey,
  change: { visible?: boolean; position?: MarksheetSignaturePosition },
): MarksheetFieldItem[] => {
  const base = fields?.length ? fields : DEFAULT_MARKSHEET_FIELDS;
  const current = getSignatureSettings(base);
  const target = current.find((s) => s.key === key)!;
  const other = current.find((s) => s.key !== key)!;

  const next = new Map<SignatureKey, SignatureSetting>(current.map((s) => [s.key, { ...s }]));
  if (change.visible !== undefined) next.get(key)!.visible = change.visible;
  if (change.position !== undefined && change.position !== target.position) {
    if (other.position === change.position) next.get(other.key)!.position = target.position;
    next.get(key)!.position = change.position;
  }

  const withoutSignatures = base.filter((f) => !SIGNATURE_KEYS.includes(f.key as SignatureKey));
  return [
    ...withoutSignatures,
    ...SIGNATURE_KEYS.map((k) => {
      const s = next.get(k)!;
      return { key: k, visible: s.visible, position: s.position };
    }),
  ];
};
