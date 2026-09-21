import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { getDefaultBuiltinDesign } from "@madrasha/shared-ui/src/components/DocumentDesigner/builtin/registry";
import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import LetterDocument from "./engine/LetterDocument";
import { useBrandingStore } from "../../../store/brandingStore";
import { DEFAULT_ADMIT_CARD_RULES } from "@madrasha/shared-ui/src/utils/documentTemplates";
import {
  PageGeometryContext,
  usePageContentBoxMm,
  usePageSheetMm,
} from "../pagination/PageGeometryContext";
import { PX_TO_MM, computePaperSplit, computeSingleScale } from "./engine/cardSheetLayout";

type AdmitCardRulesPageProps = {
  rows: Record<string, any>[];
};

const GUIDE = "0.25mm dashed #b8b8b8";

// প্রবেশপত্রের ডিফল্ট ডিজাইনের (admitCardDesigns.ts "plain") হুবহু একই অবস্থান ও মাপ - কার্ডের ভেতরের px।
const FRAME_INSET_PX = 4;
const FRAME_STROKE_PX = 2;
const LOGO = { x: 24, y: 18, size: 56 };
const NAME = { x: 92, y: 16, h: 32, fontSize: 24 };
const ADDRESS = { x: 92, y: 50, h: 20, fontSize: 12.5 };
/** লেখার অংশ শুরু হয় হেডারের নিচ থেকে। */
const BODY_TOP_PX = 84;
const SIDE_PX = 36;
/** নিচে স্বাক্ষরের সারি (উচ্চতা ও নিচ থেকে দূরত্ব, px) - লেখা আঁটানোর হিসাব থেকে বাদ যায়। */
const SIGNATURE_ROW_PX = 40;
const SIGNATURE_BOTTOM_PX = 22;

/** প্রবেশপত্রের মতোই: বাঁয়ে লোগো, মাঝে মাদরাসার নাম (২৪px, বোল্ড) ও তার নিচে ঠিকানা (১২.৫px)। */
const RulesHeader = ({ width }: { width: number }) => {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const textBox = (top: number, height: number): CSSProperties => ({
    position: "absolute",
    left: NAME.x,
    top,
    width: width - NAME.x * 2,
    height,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  });

  return (
    <>
      {branding?.report_logo && (
        <img
          src={branding.report_logo}
          alt=""
          style={{
            position: "absolute",
            left: LOGO.x,
            top: LOGO.y,
            width: LOGO.size,
            height: LOGO.size,
            objectFit: "contain",
          }}
        />
      )}
      <div
        style={{
          ...textBox(NAME.y, NAME.h),
          fontSize: NAME.fontSize,
          fontWeight: 700,
          color: "#000",
        }}
      >
        {branding?.name}
      </div>
      <div
        style={{ ...textBox(ADDRESS.y, ADDRESS.h), fontSize: ADDRESS.fontSize, color: "#374151" }}
      >
        {branding?.address}
      </div>
    </>
  );
};

/**
 * কার্ডের মাপের (px) বক্সে কনটেন্ট আঁটায়: স্বাভাবিক মাপে বেশি লম্বা হলে ছোট (স্কেল) করে,
 * নিয়মাবলী যত বড়ই হোক বক্স ছাপিয়ে কেটে যায় না। বর্ডার ও হেডার প্রবেশপত্রের ডিফল্ট ডিজাইনের
 * মতোই; স্বাক্ষরের সারি (footer) সবসময় বক্সের একদম নিচে বসে।
 */
const FitToBox = ({
  width,
  height,
  footer,
  children,
}: {
  width: number;
  height: number;
  footer: ReactNode;
  children: ReactNode;
}) => {
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const contentWidth = width - SIDE_PX * 2;
  const contentHeight = height - BODY_TOP_PX - SIGNATURE_ROW_PX - SIGNATURE_BOTTOM_PX;

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const fit = () => {
      let next = 1;
      for (let step = 0; step < 40; step += 1) {
        // স্কেল k হলে কনটেন্ট width/k চওড়া করে আঁকা হয় - তাই ছোট করলে লাইন-র‍্যাপও বদলায়।
        el.style.width = `${contentWidth / next}px`;
        if (el.scrollHeight * next <= contentHeight || next <= 0.3) break;
        next = Math.max(0.3, next - 0.02);
      }
      setScale(next);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [contentWidth, contentHeight]);

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        color: "#000",
        background: "#fff",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: FRAME_INSET_PX,
          border: `${FRAME_STROKE_PX}px solid #111827`,
          boxSizing: "border-box",
        }}
      />
      <RulesHeader width={width} />
      <div
        style={{
          position: "absolute",
          left: SIDE_PX,
          top: BODY_TOP_PX,
          width: contentWidth,
          height: contentHeight,
          overflow: "hidden",
        }}
      >
        <div ref={innerRef} style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: SIDE_PX,
          width: contentWidth,
          bottom: SIGNATURE_BOTTOM_PX,
          height: SIGNATURE_ROW_PX,
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        {footer}
      </div>
    </div>
  );
};

/**
 * পরীক্ষার নিয়মাবলী - প্রবেশপত্রের সমান মাপে ও একই শিট-বিন্যাসে: পোর্ট্রেট কাগজে (A4/A5)
 * উপর-নিচ ২টি, ল্যান্ডস্কেপে ১টি; A4 ল্যান্ডস্কেপে দুই A5 অর্ধেক × ২টি (PaginatedReportPreview
 * পাতা দ্বিগুণ করে)। মাঝে কাগজ-জোড়া ডটেড কাটার-রেখা, প্রতিটির চার পাশে সমান ফাঁকা।
 * শব্দ/টোকেন সবই অ্যাডমিন-সম্পাদনযোগ্য admit_card_rules টেমপ্লেট থেকে।
 */
const AdmitCardRulesPage = ({ rows }: AdmitCardRulesPageProps) => {
  const template = useDocumentTemplate("admit_card_rules", DEFAULT_ADMIT_CARD_RULES);
  const geometry = useContext(PageGeometryContext);
  const box = usePageContentBoxMm();
  const sheet = usePageSheetMm();
  const row = rows[0] || {};

  if (!geometry || !box || !sheet) return null;

  // প্রবেশপত্রের ডিফল্ট ডিজাইনের মাপই নিয়মাবলী কার্ডের মাপ (১৯০ × ১৩২ মিমি)।
  const base = getDefaultBuiltinDesign("ADMIT_CARD");
  const cardWidthPx = base?.width ?? 718;
  const cardHeightPx = base?.height ?? 499;
  const cardWidthMm = cardWidthPx * PX_TO_MM;
  const cardHeightMm = cardHeightPx * PX_TO_MM;
  const perPage = geometry.orientation === "portrait" ? 2 : 1;

  const card = (scale: number) => (
    <div
      style={{
        width: cardWidthPx * scale,
        height: cardHeightPx * scale,
        overflow: "hidden",
        flex: "none",
      }}
    >
      <div
        style={{
          width: cardWidthPx,
          height: cardHeightPx,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <FitToBox
          width={cardWidthPx}
          height={cardHeightPx}
          footer={
            <div className="flex w-full justify-between text-base font-semibold text-black">
              <span>পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর</span>
              <span>প্রধান শিক্ষকের স্বাক্ষর</span>
            </div>
          }
        >
          {/* সবসময় সাধারণ ডিজাইন: চিঠির ফ্রেম/বিসমিল্লাহ নেই, সব লেখা কালো; LetterDocument-এর নিজস্ব লেটারহেড লুকানো (হেডার FitToBox-এ, প্রবেশপত্রের মতো) */}
          <div className="[&_*]:!border-transparent [&_*]:!text-black [&_.border-b-2]:!hidden">
            <LetterDocument
              row={row}
              heading="পরীক্ষার নিয়মাবলী"
              headingClassName="mb-3 text-center text-[26px] font-bold text-black"
              bodyClassName="whitespace-pre-line text-xl leading-8 text-black"
              template={template}
              design="plain"
              footer={null}
            />
          </div>
        </FitToBox>
      </div>
    </div>
  );

  if (perPage === 1) {
    const scale = computeSingleScale(box.width, box.height, cardWidthMm, cardHeightMm);
    return (
      <div
        className="report-card-sheet"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: `${box.width}mm`,
          height: `${box.height}mm`,
        }}
      >
        {card(scale)}
      </div>
    );
  }

  const split = computePaperSplit(
    sheet.paperWidth,
    sheet.paperHeight,
    cardWidthMm,
    cardHeightMm,
    perPage,
    sheet.margin,
  );
  const scaledWidthMm = cardWidthMm * split.scale;
  const scaledHeightMm = cardHeightMm * split.scale;

  return (
    <div
      className="report-card-sheet"
      style={{ position: "relative", width: `${box.width}mm`, height: `${box.height}mm` }}
    >
      {Array.from({ length: split.cols * split.rows }, (_, index) => {
        const left =
          ((index % split.cols) + 0.5) * split.pieceWidthMm - scaledWidthMm / 2 - sheet.offsetLeft;
        const top =
          (Math.floor(index / split.cols) + 0.5) * split.pieceHeightMm -
          scaledHeightMm / 2 -
          sheet.offsetTop;
        return (
          <div
            key={index}
            className="print-page-break"
            style={{ position: "absolute", left: `${left}mm`, top: `${top}mm` }}
          >
            {card(split.scale)}
          </div>
        );
      })}
      {Array.from({ length: split.cols - 1 }, (_, i) => (
        <div
          key={`v${i}`}
          aria-hidden
          style={{
            position: "absolute",
            top: `${-sheet.offsetTop}mm`,
            height: `${sheet.paperHeight}mm`,
            left: `${(i + 1) * split.pieceWidthMm - sheet.offsetLeft}mm`,
            borderLeft: GUIDE,
          }}
        />
      ))}
      {Array.from({ length: split.rows - 1 }, (_, i) => (
        <div
          key={`h${i}`}
          aria-hidden
          style={{
            position: "absolute",
            left: `${-sheet.offsetLeft}mm`,
            width: `${sheet.paperWidth}mm`,
            top: `${(i + 1) * split.pieceHeightMm - sheet.offsetTop}mm`,
            borderTop: GUIDE,
          }}
        />
      ))}
    </div>
  );
};

export default AdmitCardRulesPage;
