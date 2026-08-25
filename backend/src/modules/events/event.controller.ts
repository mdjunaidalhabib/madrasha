import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { TenantNotFoundInRequestError } from "../../shared/errors";
import { eventService } from "./event.service";

const getMadrasaId = (req: Request): number => {
  const madrasaId = req.tenant?.madrasa_id;
  if (!madrasaId) throw new TenantNotFoundInRequestError();
  return Number(madrasaId);
};

const respondError = (res: Response, error: unknown, logTag: string, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: fallbackMessage });
};

export const listEvents = async (req: Request, res: Response) => {
  try {
    const data = await eventService.list(getMadrasaId(req));
    res.json({ data });
  } catch (err) {
    respondError(res, err, "listEvents ERROR:", "Failed to load events");
  }
};

export const createEvent = async (req: Request, res: Response) => {
  try {
    const row = await eventService.create(getMadrasaId(req), req.body);
    res.status(HttpStatus.CREATED).json({ message: "ইভেন্ট তৈরি হয়েছে", id: row.id });
  } catch (err) {
    respondError(res, err, "createEvent ERROR:", "Failed to create event");
  }
};

export const updateEvent = async (req: Request, res: Response) => {
  try {
    await eventService.update(Number(req.params.id), getMadrasaId(req), req.body);
    res.json({ message: "ইভেন্ট আপডেট হয়েছে" });
  } catch (err) {
    respondError(res, err, "updateEvent ERROR:", "Failed to update event");
  }
};

export const deleteEvent = async (req: Request, res: Response) => {
  try {
    await eventService.delete(Number(req.params.id), getMadrasaId(req));
    res.json({ message: "ইভেন্ট মুছে ফেলা হয়েছে" });
  } catch (err) {
    respondError(res, err, "deleteEvent ERROR:", "Failed to delete event");
  }
};
