import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class AdmissionRepository {
  create(data: Prisma.StudentUncheckedCreateInput) {
    return prisma.student.create({ data });
  }
}

export const admissionRepository = new AdmissionRepository();
