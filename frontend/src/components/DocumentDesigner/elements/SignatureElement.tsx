import ImageElement from "./ImageElement";
import type { DocumentElementProps, ImageLayerContent } from "../types";

/** Semantic alias for a signature image (e.g. principal/exam controller). */
const SignatureElement = (props: DocumentElementProps<ImageLayerContent>) => <ImageElement {...props} />;

export default SignatureElement;
