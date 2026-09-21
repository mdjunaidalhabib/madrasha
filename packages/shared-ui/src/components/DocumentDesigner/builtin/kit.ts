import type { CSSProperties } from "react";
import type { DocumentLayer, LayerType } from "../types";

/**
 * ছোট একটি "লেয়ার বিল্ডার" - বিল্ট-ইন ডিজাইনগুলো (আইডি কার্ড, প্রবেশপত্র,
 * সনদ ...) হাতে লেয়ার JSON না লিখে এই হেল্পার দিয়ে সাজায়। প্রতিটি ডিজাইন
 * `createKit()` দিয়ে নিজের আলাদা কিট নেয়, ফলে লেয়ার id গুলো ডিজাইনের ভেতরে
 * ইউনিক থাকে এবং রেন্ডার দ্বারা একই ক্রমে তৈরি হয়।
 *
 * সব মান design-time px (Canvas-এর সাথে একই একক) - 1mm ≈ 3.78px।
 */

export type Align = "left" | "center" | "right";
export type VAlign = "top" | "center" | "bottom";

export type TextOpts = {
  size?: number;
  color?: string;
  bold?: boolean;
  align?: Align;
  valign?: VAlign;
  /** true হলে একাধিক লাইনে ভাঙবে; না হলে এক লাইনে থাকবে। */
  wrap?: boolean;
  lineHeight?: number;
  /** letter-spacing (px) */
  spacing?: number;
  /** flex না হয়ে সাধারণ block (অনুচ্ছেদ/justify টেক্সটের জন্য)। */
  block?: boolean;
  style?: CSSProperties;
};

export type BoxOpts = {
  stroke?: string;
  strokeWidth?: number;
  radius?: number | string;
  rotation?: number;
  style?: CSSProperties;
};

const JUSTIFY: Record<Align, CSSProperties["justifyContent"]> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

const ALIGN_ITEMS: Record<VAlign, CSSProperties["alignItems"]> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

export const createKit = () => {
  let counter = 0;

  const base = (
    type: LayerType,
    x: number,
    y: number,
    width: number,
    height: number,
    content: unknown,
    style?: CSSProperties,
    rotation = 0,
  ): DocumentLayer => ({
    id: `${type}-${++counter}`,
    type,
    x,
    y,
    width,
    height,
    rotation,
    visible: true,
    locked: false,
    content,
    style,
  });

  /** {{token}} সহ বা সাধারণ লেখা। */
  const text = (template: string, x: number, y: number, w: number, h: number, o: TextOpts = {}) => {
    const align = o.align ?? "center";
    const style: CSSProperties = {
      fontSize: o.size ?? 12,
      color: o.color ?? "#111827",
      fontWeight: o.bold ? 700 : 400,
      lineHeight: o.lineHeight ?? 1.25,
      textAlign: align,
      letterSpacing: o.spacing,
      whiteSpace: o.wrap ? "pre-line" : "nowrap",
      ...(o.block
        ? { display: "block" }
        : {
            display: "flex",
            alignItems: ALIGN_ITEMS[o.valign ?? "center"],
            justifyContent: JUSTIFY[align],
          }),
      ...o.style,
    };
    return base("text", x, y, w, h, { template }, style);
  };

  const rect = (x: number, y: number, w: number, h: number, fill: string, o: BoxOpts = {}) =>
    base(
      "shape",
      x,
      y,
      w,
      h,
      { shape: "rectangle", fill, stroke: o.stroke, strokeWidth: o.strokeWidth },
      { borderRadius: o.radius, ...o.style },
      o.rotation ?? 0,
    );

  const circle = (x: number, y: number, size: number, fill: string, o: BoxOpts = {}) =>
    base(
      "shape",
      x,
      y,
      size,
      size,
      { shape: "circle", fill, stroke: o.stroke, strokeWidth: o.strokeWidth },
      o.style,
      o.rotation ?? 0,
    );

  /** অনুভূমিক রেখা। */
  const line = (x: number, y: number, w: number, color: string, thickness = 1) =>
    base("shape", x, y, w, thickness, { shape: "line", stroke: color, strokeWidth: thickness });

  /** উল্লম্ব রেখা। */
  const vline = (x: number, y: number, h: number, color: string, thickness = 1) =>
    base("shape", x, y, thickness, h, { shape: "rectangle", fill: color });

  /** ৪৫° ঘোরানো বর্গ (অলংকার)। */
  const diamond = (cx: number, cy: number, size: number, color: string) =>
    rect(cx - size / 2, cy - size / 2, size, size, color, { rotation: 45 });

  const photo = (field: string, x: number, y: number, w: number, h: number, style?: CSSProperties) =>
    base("photo", x, y, w, h, { field, fit: "cover", alt: "ছবি" }, { background: "#ffffff", ...style });

  const logo = (x: number, y: number, size: number, style?: CSSProperties) =>
    base("logo", x, y, size, size, { field: "madrasa_logo", fit: "contain", alt: "" }, style);

  /** স্বাক্ষরের ছবি (স্বচ্ছ/সাদা জমিনে) - ছবি না থাকলে ফাঁকা থাকে, কোনো প্লেসহোল্ডার লেখা আসে না। */
  const signature = (field: string, x: number, y: number, w: number, h: number) =>
    base("signature", x, y, w, h, { field, fit: "contain", alt: "" });

  const qr = (field: string, x: number, y: number, size: number, style?: CSSProperties) =>
    base("qrcode", x, y, size, size, { field }, style);

  return { text, rect, circle, line, vline, diamond, photo, logo, signature, qr };
};

export type Kit = ReturnType<typeof createKit>;
