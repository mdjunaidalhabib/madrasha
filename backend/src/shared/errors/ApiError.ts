import { HttpStatus } from "../constants/http-status";

/**
 * Base class for all operational errors thrown intentionally from
 * services/repositories/controllers. The centralized error middleware
 * (shared/middleware/error.middleware.ts) knows how to translate any
 * ApiError into the standard `{ success: false, message }` response.
 *
 * `isOperational` distinguishes expected errors (bad input, not found,
 * unauthorized, ...) from programming bugs/unexpected exceptions -
 * only the latter get logged as `error` level and have their details
 * hidden from the client.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}
