import type { WebsiteThemeKey } from "./themes";

/** Decorative layout samples shared by both theme pickers. */
export default function WebsiteThemePreview({ themeKey, accent }: { themeKey: WebsiteThemeKey; accent: string }) {
  const heritage = themeKey === "heritage";
  const campus = themeKey === "campus";
  const editorial = themeKey === "editorial";
  const rounded = campus || themeKey === "modern";
  return (
    <div aria-hidden="true" className="flex h-full min-h-[76px] flex-col gap-1.5 p-2" style={{ background: heritage ? "#f7f1e5" : campus ? "#edf5f8" : "#fff" }}>
      <div className={`flex items-center gap-1 border-b px-1 py-1 ${rounded ? "rounded-full bg-white" : ""}`} style={{ borderColor: heritage ? "#c6aa71" : "#d6dce2", justifyContent: heritage ? "center" : "start" }}>
        <span className={`h-2 w-2 ${editorial ? "" : "rounded-full"}`} style={{ background: accent }} />
        <span className="h-1 w-8 bg-slate-400" />
        {!heritage && <span className="ms-auto h-1 w-6 bg-slate-200" />}
      </div>
      <div className="flex min-h-0 flex-1 gap-1.5">
        {editorial && <div className="w-1/4 border-y border-slate-500 bg-slate-100" />}
        <div className="flex flex-1 flex-col gap-1">
          <div className="min-h-4 flex-1" style={{ background: accent, opacity: 0.8, borderRadius: heritage ? "45% 45% 0 0 / 65% 65% 0 0" : campus ? "2px 18px 2px 18px" : rounded ? "9px" : "1px" }} />
          <div className="flex gap-1">
            {[0, 1, 2].map((item) => <span key={item} className={`h-3 flex-1 border ${rounded ? "rounded-md" : ""}`} style={{ background: heritage ? "#fffcf5" : "#f1f5f9", borderColor: heritage ? "#c6aa71" : "#cbd5e1", boxShadow: campus ? "1px 2px 0 #cbd5e1" : "none" }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
