import { idParamSchema } from "../../shared/validators";

/**
 * Route param validation only, same reasoning as student.validation.ts -
 * request bodies (layers JSON, template meta) are validated inside
 * document-templates.service.ts instead of a generic zod schema, since the
 * layer shape is expected to evolve alongside the frontend designer.
 */
export const documentTemplateIdParamSchema = idParamSchema;
