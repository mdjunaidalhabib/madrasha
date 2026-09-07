import ImageElement from "./ImageElement";
import type { DocumentElementProps, ImageLayerContent } from "../types";

/** Semantic alias for an institution logo image. */
const LogoElement = (props: DocumentElementProps<ImageLayerContent>) => <ImageElement {...props} />;

export default LogoElement;
