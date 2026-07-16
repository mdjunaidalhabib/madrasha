import { RequestHandler } from "express";
import { AnyZodObject, ZodError } from "zod";

export const validate = (schema: AnyZodObject): RequestHandler => {
  return (req, res, next) => {
    try {
      schema.parse({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(422).json({
          success: false,
          message: "Validation failed",
          errors: error.flatten(),
        });
      }
      next(error);
    }
  };
};
