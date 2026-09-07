import ImageElement from "./ImageElement";
import type { DocumentElementProps, ImageLayerContent } from "../types";

/** Semantic alias for a person photo (student/teacher), e.g. on ID cards. */
const PhotoElement = (props: DocumentElementProps<ImageLayerContent>) => <ImageElement {...props} />;

export default PhotoElement;
