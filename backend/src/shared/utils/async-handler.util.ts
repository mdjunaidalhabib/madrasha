import { NextFunction, Request, Response } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/**
 * Wraps an async Express handler so any thrown/rejected error is passed
 * to `next()` and lands in the centralized error middleware, instead of
 * every controller needing its own try/catch block.
 *
 *   router.get("/", asyncHandler(controller.getStudents));
 */
export const asyncHandler =
  (handler: AsyncRequestHandler) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
