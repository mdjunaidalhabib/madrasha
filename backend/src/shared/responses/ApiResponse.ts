import { Response } from "express";
import { HttpStatus } from "../constants/http-status";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Every controller in the codebase already returns some flavor of
 * `{ success, message, data, ...extra }`. These helpers standardize
 * that shape going forward WITHOUT changing the existing wire format:
 * `extra` lets a handler keep returning legacy top-level fields
 * (e.g. `studentId`, `affectedRows`, `token`) alongside the standard
 * envelope so existing frontend code keeps working untouched.
 */
export class ApiResponse {
  static success<T>(
    res: Response,
    options: {
      data?: T;
      message?: string;
      statusCode?: number;
      extra?: object;
    } = {},
  ) {
    const { data, message, statusCode = HttpStatus.OK, extra } = options;
    return res.status(statusCode).json({
      success: true,
      ...(message !== undefined ? { message } : {}),
      ...(data !== undefined ? { data } : {}),
      ...(extra || {}),
    });
  }

  static created<T>(res: Response, data?: T, message = "Created successfully") {
    return this.success(res, { data, message, statusCode: HttpStatus.CREATED });
  }

  static message(res: Response, message: string, statusCode: number = HttpStatus.OK) {
    return res.status(statusCode).json({ success: true, message });
  }

  static paginated<T>(res: Response, data: T[], pagination: PaginationMeta, message?: string) {
    return res.status(HttpStatus.OK).json({
      success: true,
      ...(message !== undefined ? { message } : {}),
      data,
      pagination,
    });
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    details?: unknown,
  ) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(details !== undefined ? { errors: details } : {}),
    });
  }

  /**
   * For the small number of endpoints (currently only /auth/*) whose
   * existing contract does NOT use the `{ success, ... }` envelope at
   * all - the frontend only ever reads specific top-level fields
   * (e.g. `token`, `user`, `message`). Sends the raw payload as-is so
   * that contract is preserved exactly.
   */
  static raw<T extends Record<string, unknown>>(
    res: Response,
    payload: T,
    statusCode: number = HttpStatus.OK,
  ) {
    return res.status(statusCode).json(payload);
  }
}
