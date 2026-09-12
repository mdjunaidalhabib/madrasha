import { z } from "zod";

const idSchema = z.coerce.number().int().positive();
const idParamsSchema = z.object({ id: idSchema });

// strategy enum mirrors SeatAllocationStrategy; seat_no length caps at
// SeatAllocation.seatNo's @db.VarChar(20) (prisma/models/exam-operations.prisma).
export const autoAllocateSeatsSchema = z.object({
  body: z.object({
    exam_routine_id: idSchema,
    room_ids: z.array(idSchema).min(1),
    strategy: z.enum(["SEQUENTIAL", "ROLL_BASED", "ALTERNATING", "MANUAL"]).optional(),
    preserve_manual_overrides: z.boolean().optional(),
  }),
});

export const manualAdjustSeatSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    room_id: idSchema,
    seat_no: z.string().trim().min(1).max(20),
    row_no: z.coerce.number().int().optional(),
    column_no: z.coerce.number().int().optional(),
  }),
});

export const clearSeatAllocationsSchema = z.object({
  body: z.object({
    exam_routine_id: idSchema,
  }),
});
