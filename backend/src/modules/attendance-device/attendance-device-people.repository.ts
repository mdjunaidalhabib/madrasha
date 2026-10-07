import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { tenantClassName, tenantClassNameSelect } from "../../shared/utils/tenant-name.util";
import { PersonType } from "./attendance-device.constants";

/**
 * Generic person (student / teacher / staff) access for the device module:
 * K40 user maps (PIN + card), eligibility, PIN allocation inputs. Every query
 * is scoped by madrasaId.
 */

export interface PersonRef {
  type: PersonType;
  id: number;
}

/** One person, normalised across the three tables. */
export interface Person {
  type: PersonType;
  id: number;
  nameBn: string;
  nameEn: string | null;
  image: string | null;
  roll: number | null;
  registrationNo: number | null;
  classId: number | null;
  className: string | null;
  /** Raw class relation (students) - used by the SMS {class} token. */
  classRef: Parameters<typeof tenantClassName>[0];
  designation: string | null;
  guardianPhone: string | null;
  eligible: boolean;
}

export const studentPersonSelect = (madrasaId: number) =>
  ({
    id: true,
    nameBn: true,
    nameEn: true,
    image: true,
    roll: true,
    registrationNo: true,
    classId: true,
    classRef: { select: tenantClassNameSelect(madrasaId) },
    guardianPhone: true,
    isActive: true,
    deletedAt: true,
    admissionStatus: true,
  }) satisfies Prisma.StudentSelect;

export const staffPersonSelect = {
  id: true,
  nameBn: true,
  nameEn: true,
  image: true,
  registrationNo: true,
  designation: true,
  isActive: true,
  deletedAt: true,
} as const;

type StudentPersonRow = Prisma.StudentGetPayload<{ select: ReturnType<typeof studentPersonSelect> }>;
type StaffPersonRow = {
  id: number;
  nameBn: string;
  nameEn: string | null;
  image: string | null;
  registrationNo: number;
  designation: string | null;
  isActive: number | null;
  deletedAt: Date | null;
};

export const isEligibleStudentRow = (s: { isActive: number; deletedAt: Date | null; admissionStatus: string }) =>
  s.isActive === 1 && s.deletedAt === null && s.admissionStatus === "APPROVED";

/** Teachers/staff: isActive NULL counts as active (column is nullable, default 1). */
export const isEligibleStaffRow = (s: { isActive: number | null; deletedAt: Date | null }) =>
  s.isActive !== 0 && s.deletedAt === null;

export const studentToPerson = (s: StudentPersonRow): Person => ({
  type: "STUDENT",
  id: s.id,
  nameBn: s.nameBn,
  nameEn: s.nameEn ?? null,
  image: s.image ?? null,
  roll: s.roll ?? null,
  registrationNo: s.registrationNo ?? null,
  classId: s.classId ?? null,
  className: tenantClassName(s.classRef),
  classRef: s.classRef,
  designation: null,
  guardianPhone: s.guardianPhone ?? null,
  eligible: isEligibleStudentRow(s),
});

export const staffToPerson = (type: "TEACHER" | "STAFF", s: StaffPersonRow): Person => ({
  type,
  id: s.id,
  nameBn: s.nameBn,
  nameEn: s.nameEn ?? null,
  image: s.image ?? null,
  roll: null,
  registrationNo: s.registrationNo ?? null,
  classId: null,
  className: null,
  classRef: null,
  designation: s.designation ?? null,
  guardianPhone: null,
  eligible: isEligibleStaffRow(s),
});

/** Prisma where for "eligible" people of each table. */
export const eligibleStudentWhere = { isActive: 1, deletedAt: null, admissionStatus: "APPROVED" } as const;
export const eligibleStaffWhere: Prisma.TeacherWhereInput & Prisma.StaffWhereInput = {
  deletedAt: null,
  OR: [{ isActive: null }, { isActive: { not: 0 } }],
};

/** Column of AttendanceDeviceUserMap / AttendanceDeviceLog holding the person id. */
export const personColumn = (type: PersonType) =>
  type === "STUDENT" ? "studentId" : type === "TEACHER" ? "teacherId" : "staffId";

/** studentId/teacherId/staffId columns for a person (exactly one set, as the DB check requires). */
export const personIdColumns = (ref: PersonRef) => ({
  studentId: ref.type === "STUDENT" ? ref.id : null,
  teacherId: ref.type === "TEACHER" ? ref.id : null,
  staffId: ref.type === "STAFF" ? ref.id : null,
});

export const personMapWhere = (madrasaId: number, ref: PersonRef) => ({ madrasaId, [personColumn(ref.type)]: ref.id });

const mapPersonSelect = (madrasaId: number) =>
  ({
    id: true,
    deviceUserId: true,
    previousDeviceUserId: true,
    attendeeType: true,
    studentId: true,
    teacherId: true,
    staffId: true,
    cardNumber: true,
    autoAssigned: true,
    student: { select: studentPersonSelect(madrasaId) },
    teacher: { select: staffPersonSelect },
    staff: { select: staffPersonSelect },
  }) satisfies Prisma.AttendanceDeviceUserMapSelect;

export interface MapWithPerson {
  id: number;
  deviceUserId: string;
  /** PIN before a convert-pins run (punches under it still resolve here). */
  previousDeviceUserId: string | null;
  cardNumber: string | null;
  autoAssigned: boolean;
  person: Person | null;
}

type RawMap = {
  id: number;
  deviceUserId: string;
  previousDeviceUserId?: string | null;
  attendeeType?: PersonType | null;
  studentId?: number | null;
  teacherId?: number | null;
  staffId?: number | null;
  cardNumber?: string | null;
  autoAssigned?: boolean | null;
  student?: StudentPersonRow | null;
  teacher?: StaffPersonRow | null;
  staff?: StaffPersonRow | null;
};

export const toMapWithPerson = (m: RawMap): MapWithPerson => {
  let person: Person | null = null;
  if (m.student) person = studentToPerson(m.student);
  else if (m.teacher) person = staffToPerson("TEACHER", m.teacher);
  else if (m.staff) person = staffToPerson("STAFF", m.staff);
  return {
    id: m.id,
    deviceUserId: m.deviceUserId,
    previousDeviceUserId: m.previousDeviceUserId ?? null,
    cardNumber: m.cardNumber ?? null,
    autoAssigned: !!m.autoAssigned,
    person,
  };
};

export class AttendanceDevicePeopleRepository {
  /* ================= persons ================= */

  async findPerson(madrasaId: number, ref: PersonRef): Promise<Person | null> {
    if (ref.type === "STUDENT") {
      const s = await prisma.student.findFirst({
        where: { id: ref.id, madrasaId },
        select: studentPersonSelect(madrasaId),
      });
      return s ? studentToPerson(s) : null;
    }
    const delegate = ref.type === "TEACHER" ? prisma.teacher : prisma.staff;
    const row = await (delegate as typeof prisma.teacher).findFirst({
      where: { id: ref.id, madrasaId },
      select: staffPersonSelect,
    });
    return row ? staffToPerson(ref.type, row) : null;
  }

  /** Several students at once (manual-mark SMS). */
  async findStudents(madrasaId: number, ids: number[]): Promise<Person[]> {
    if (ids.length === 0) return [];
    const rows = await prisma.student.findMany({
      where: { madrasaId, id: { in: ids } },
      select: studentPersonSelect(madrasaId),
    });
    return rows.map(studentToPerson);
  }

  /** Eligible people of a type (optionally one class) that have no map row yet. */
  async findEligibleWithoutMap(
    madrasaId: number,
    type: PersonType,
    classId?: number | null,
  ): Promise<{ id: number; registrationNo: number | null }[]> {
    if (type === "STUDENT") {
      const rows = await prisma.student.findMany({
        where: {
          madrasaId,
          ...eligibleStudentWhere,
          ...(classId ? { classId } : {}),
          attendanceDeviceMaps: { none: {} },
        },
        select: { id: true, registrationNo: true },
        orderBy: [{ classId: "asc" }, { roll: "asc" }, { id: "asc" }],
      });
      return rows.map((r) => ({ id: r.id, registrationNo: r.registrationNo ?? null }));
    }
    const delegate = (type === "TEACHER" ? prisma.teacher : prisma.staff) as typeof prisma.teacher;
    const rows = await delegate.findMany({
      where: { madrasaId, ...eligibleStaffWhere, attendanceDeviceMaps: { none: {} } },
      select: { id: true, registrationNo: true },
      orderBy: [{ registrationNo: "asc" }, { id: "asc" }],
    });
    return rows.map((r) => ({ id: r.id, registrationNo: r.registrationNo ?? null }));
  }

  /** Paginated, filtered people list joined with their map row (admin cards page). */
  async listPeople(
    madrasaId: number,
    q: { type: PersonType; classId?: number; search?: string; hasCard?: boolean; attendeeId?: number; page: number; limit: number },
  ): Promise<{ rows: { person: Person; map: { deviceUserId: string; cardNumber: string | null; autoAssigned: boolean } | null }[]; total: number }> {
    const mapFilter =
      q.hasCard === true
        ? { attendanceDeviceMaps: { some: { cardNumber: { not: null } } } }
        : q.hasCard === false
          ? { attendanceDeviceMaps: { none: { cardNumber: { not: null } } } }
          : {};
    const numeric = q.search && /^\d{1,9}$/.test(q.search) ? Number(q.search) : null;
    const skip = (q.page - 1) * q.limit;
    const mapSelect = { select: { deviceUserId: true, cardNumber: true, autoAssigned: true }, take: 1 };

    if (q.type === "STUDENT") {
      const and: Prisma.StudentWhereInput[] = [];
      if (q.search) {
        const or: Prisma.StudentWhereInput[] = [
          { nameBn: { contains: q.search, mode: "insensitive" } },
          { nameEn: { contains: q.search, mode: "insensitive" } },
          { attendanceDeviceMaps: { some: { OR: [{ deviceUserId: q.search }, { cardNumber: q.search }] } } },
        ];
        if (numeric !== null) or.push({ roll: numeric }, { registrationNo: numeric });
        and.push({ OR: or });
      }
      const where: Prisma.StudentWhereInput = {
        madrasaId,
        ...eligibleStudentWhere,
        ...(q.classId ? { classId: q.classId } : {}),
        ...(q.attendeeId ? { id: q.attendeeId } : {}),
        ...mapFilter,
        ...(and.length ? { AND: and } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.student.findMany({
          where,
          select: { ...studentPersonSelect(madrasaId), attendanceDeviceMaps: mapSelect },
          orderBy: [{ classId: "asc" }, { roll: "asc" }, { id: "asc" }],
          skip,
          take: q.limit,
        }),
        prisma.student.count({ where }),
      ]);
      return {
        rows: rows.map((r) => ({ person: studentToPerson(r), map: r.attendanceDeviceMaps[0] ?? null })),
        total,
      };
    }

    const and: Prisma.TeacherWhereInput[] = [{ OR: eligibleStaffWhere.OR }];
    if (q.search) {
      const or: Prisma.TeacherWhereInput[] = [
        { nameBn: { contains: q.search, mode: "insensitive" } },
        { nameEn: { contains: q.search, mode: "insensitive" } },
        { phone: { contains: q.search } },
        { attendanceDeviceMaps: { some: { OR: [{ deviceUserId: q.search }, { cardNumber: q.search }] } } },
      ];
      if (numeric !== null) or.push({ registrationNo: numeric });
      and.push({ OR: or });
    }
    const where: Prisma.TeacherWhereInput = {
      madrasaId,
      deletedAt: null,
      ...(q.attendeeId ? { id: q.attendeeId } : {}),
      ...mapFilter,
      AND: and,
    };
    const delegate = (q.type === "TEACHER" ? prisma.teacher : prisma.staff) as typeof prisma.teacher;
    const [rows, total] = await Promise.all([
      delegate.findMany({
        where,
        select: { ...staffPersonSelect, attendanceDeviceMaps: mapSelect },
        orderBy: [{ registrationNo: "asc" }, { id: "asc" }],
        skip,
        take: q.limit,
      }),
      delegate.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({
        person: staffToPerson(q.type as "TEACHER" | "STAFF", r),
        map: r.attendanceDeviceMaps[0] ?? null,
      })),
      total,
    };
  }

  /* ================= maps ================= */

  async findMapByPerson(madrasaId: number, ref: PersonRef) {
    return prisma.attendanceDeviceUserMap.findFirst({ where: personMapWhere(madrasaId, ref) });
  }

  async findMapByCard(madrasaId: number, cardNumber: string): Promise<MapWithPerson | null> {
    const m = await prisma.attendanceDeviceUserMap.findFirst({
      where: { madrasaId, cardNumber },
      select: mapPersonSelect(madrasaId),
    });
    return m ? toMapWithPerson(m as RawMap) : null;
  }

  /** The map holding this PIN as its current PIN, else as its previous PIN. */
  async findMapByDeviceUserId(madrasaId: number, deviceUserId: string): Promise<MapWithPerson | null> {
    const select = mapPersonSelect(madrasaId);
    const m =
      (await prisma.attendanceDeviceUserMap.findFirst({ where: { madrasaId, deviceUserId }, select })) ??
      (await prisma.attendanceDeviceUserMap.findFirst({
        where: { madrasaId, previousDeviceUserId: deviceUserId },
        orderBy: { id: "asc" },
        select,
      }));
    return m ? toMapWithPerson(m as RawMap) : null;
  }

  /** Maps whose current OR previous PIN is one of `deviceUserIds` (the caller prefers current-PIN matches). */
  async findMapsByDeviceUserIds(madrasaId: number, deviceUserIds: string[]): Promise<MapWithPerson[]> {
    const rows = await prisma.attendanceDeviceUserMap.findMany({
      where: {
        madrasaId,
        OR: [{ deviceUserId: { in: deviceUserIds } }, { previousDeviceUserId: { in: deviceUserIds } }],
      },
      select: mapPersonSelect(madrasaId),
      orderBy: { id: "asc" },
    });
    return rows.map((m) => toMapWithPerson(m as RawMap));
  }

  /** Every map row of the madrasa with its person (eligibility filtered by the caller). */
  async listAllMaps(madrasaId: number, type?: PersonType): Promise<MapWithPerson[]> {
    const rows = await prisma.attendanceDeviceUserMap.findMany({
      where: { madrasaId, ...(type ? { attendeeType: type } : {}) },
      select: mapPersonSelect(madrasaId),
      orderBy: { id: "asc" },
    });
    return rows.map((m) => toMapWithPerson(m as RawMap));
  }

  /** All deviceUserIds already taken in this madrasa: every map row's current
   * and previous PIN + every unmapped id the K40 has sent (a K40 user the
   * system does not know yet). `exceptMapId` leaves one row's own PINs out. */
  async findTakenDeviceUserIds(madrasaId: number, exceptMapId?: number): Promise<Set<string>> {
    const [maps, logs] = await Promise.all([
      prisma.attendanceDeviceUserMap.findMany({
        where: { madrasaId },
        select: { id: true, deviceUserId: true, previousDeviceUserId: true },
      }),
      prisma.attendanceDeviceLog.findMany({
        where: { madrasaId, studentId: null, teacherId: null, staffId: null },
        select: { deviceUserId: true },
        distinct: ["deviceUserId"],
      }),
    ]);
    const taken = new Set(logs.map((l) => l.deviceUserId));
    for (const m of maps) {
      if (m.id === exceptMapId) continue;
      taken.add(m.deviceUserId);
      if (m.previousDeviceUserId) taken.add(m.previousDeviceUserId);
    }
    return taken;
  }

  /** Auto-assigned map rows (convert-pins candidates) with the person's registration number. */
  async listAutoAssignedMaps(madrasaId: number, type?: PersonType) {
    const regSelect = { select: { registrationNo: true } };
    return prisma.attendanceDeviceUserMap.findMany({
      where: { madrasaId, autoAssigned: true, ...(type ? { attendeeType: type } : {}) },
      select: {
        id: true,
        attendeeType: true,
        deviceUserId: true,
        previousDeviceUserId: true,
        student: regSelect,
        teacher: regSelect,
        staff: regSelect,
      },
      orderBy: { id: "asc" },
    });
  }

  movePin(madrasaId: number, mapId: number, deviceUserId: string, previousDeviceUserId: string) {
    return prisma.attendanceDeviceUserMap.updateMany({
      where: { id: mapId, madrasaId, autoAssigned: true },
      data: { deviceUserId, previousDeviceUserId },
    });
  }

  /** Highest registration numbers (for the PIN-range overlap warnings). */
  async maxRegistrationNos(madrasaId: number) {
    const [s, t, f] = await Promise.all([
      prisma.student.aggregate({ where: { madrasaId, deletedAt: null }, _max: { registrationNo: true } }),
      prisma.teacher.aggregate({ where: { madrasaId, deletedAt: null }, _max: { registrationNo: true } }),
      prisma.staff.aggregate({ where: { madrasaId, deletedAt: null }, _max: { registrationNo: true } }),
    ]);
    return {
      student: s._max.registrationNo ?? null,
      teacher: t._max.registrationNo ?? null,
      staff: f._max.registrationNo ?? null,
    };
  }

  createMap(data: Prisma.AttendanceDeviceUserMapUncheckedCreateInput) {
    return prisma.attendanceDeviceUserMap.create({ data });
  }

  createMaps(data: Prisma.AttendanceDeviceUserMapCreateManyInput[]) {
    return prisma.attendanceDeviceUserMap.createMany({ data, skipDuplicates: true });
  }

  updateMapCard(madrasaId: number, mapId: number, cardNumber: string | null) {
    return prisma.attendanceDeviceUserMap.updateMany({ where: { id: mapId, madrasaId }, data: { cardNumber } });
  }

  deleteMapByPerson(madrasaId: number, ref: PersonRef) {
    return prisma.attendanceDeviceUserMap.deleteMany({ where: personMapWhere(madrasaId, ref) });
  }
}

export const attendanceDevicePeopleRepository = new AttendanceDevicePeopleRepository();
