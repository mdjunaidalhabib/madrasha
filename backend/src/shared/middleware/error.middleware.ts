import { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../logger/logger";
import { ApiError } from "../errors/ApiError";
import { HttpStatus } from "../constants/http-status";
import { ApiResponse } from "../responses/ApiResponse";

/**
 * @deprecated Prefer the specific classes in shared/errors (NotFoundError,
 * UnauthorizedError, ValidationError, ...). Kept as an alias of ApiError
 * so any pre-existing `new AppError(message, statusCode)` call site keeps
 * working unchanged.
 */
export class AppError extends ApiError {}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, HttpStatus.NOT_FOUND));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Zod validation errors that reach here (rather than going through the
  // `validate` middleware) still get a consistent 422 response.
  if (err instanceof ZodError) {
    return ApiResponse.error(res, "Validation failed", HttpStatus.UNPROCESSABLE_ENTITY, err.flatten());
  }

  const statusCode: number = err.statusCode || err.status || HttpStatus.INTERNAL_SERVER_ERROR;

  if (statusCode >= 500) {
    logger.error("Unhandled error", err);
  }

  // NOTE: intentionally always forwards `err.message` verbatim (even for
  // unexpected 500s) rather than masking it behind a generic message -
  // every original controller in this codebase did `res.status(500).json({
  // success:false, message: error.message })`, so hiding it here would be
  // an (unrequested) change to the response contract. Revisit this once
  // that's addressed deliberately, module by module, with product sign-off.
  return ApiResponse.error(
    res,
    err.message || "Internal server error",
    statusCode,
    err instanceof ApiError ? err.details : undefined,
  );
};
