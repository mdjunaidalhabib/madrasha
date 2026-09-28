import { RequestHandler } from "express";
import { AnyZodObject, ZodError } from "zod";
import { t } from "../i18n";
import { localizeZodFlatten } from "../validators/messages";

export const validate = (schema: AnyZodObject): RequestHandler => {
  return (req, res, next) => {
    try {
      schema.parse({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(422).json({
          success: false,
          message: t({ bn: "তথ্য যাচাই ব্যর্থ হয়েছে", en: "Validation failed", ar: "فشل التحقق من البيانات" }),
          errors: localizeZodFlatten(error.flatten()),
        });
      }
      next(error);
    }
  };
};
