export { renderLayer, layerPositionStyle } from "./renderLayer";
export type { RenderLayerOptions } from "./renderLayer";

/**
 * Re-exported so existing token-substitution consumers (e.g. `LetterDocument`)
 * can depend on the designer engine instead of reaching into `utils/` directly.
 * The implementation is unchanged — this only moves the import path, which is
 * what lets Talimat's admin-editable templates and the Report engine share a
 * single rendering entry point going forward.
 */
export { renderTemplateText } from "../../../utils/documentTemplates";
