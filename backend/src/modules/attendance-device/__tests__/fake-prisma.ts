/**
 * Minimal in-memory fake of the slice of Prisma the attendance-device module
 * uses. Enforces the same unique keys as the real schema so duplicate /
 * idempotency behaviour is exercised, and `$transaction` rolls back every
 * table when the callback throws (so "attendance write fails" really means
 * the log row is gone too).
 */

type Row = Record<string, any>;

export interface FakeDb {
  attendanceDevice: Row[];
  attendanceDeviceUserMap: Row[];
  attendanceDeviceLog: Row[];
  notificationSetting: Row[];
  student: Row[];
  attendance: Row[];
  smsQueue: Row[];
  madrasa: Row[];
  seq: number;
  failAttendanceCreate: boolean;
}

export const db: FakeDb = {
  attendanceDevice: [],
  attendanceDeviceUserMap: [],
  attendanceDeviceLog: [],
  notificationSetting: [],
  student: [],
  attendance: [],
  smsQueue: [],
  madrasa: [],
  seq: 1,
  failAttendanceCreate: false,
};

export const resetDb = () => {
  for (const k of Object.keys(db) as (keyof FakeDb)[]) {
    if (Array.isArray(db[k])) (db[k] as Row[]).length = 0;
  }
  db.seq = 1;
  db.failAttendanceCreate = false;
};

const eq = (a: any, b: any) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b);

const matches = (row: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((c) => matches(row, c));
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) return (cond.in as any[]).some((v) => eq(v, row[key]));
      if ("lt" in cond || "gte" in cond) {
        return (
          (cond.gte === undefined || row[key] >= cond.gte) && (cond.lt === undefined || row[key] < cond.lt)
        );
      }
      // compound unique key, e.g. { madrasaId_deviceUserId: {...} }
      if (key.includes("_")) return matches(row, cond);
    }
    return eq(row[key], cond);
  });

const uniqueViolation = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

const uniqueKeys: Record<string, string[][]> = {
  attendanceDeviceLog: [
    ["madrasaId", "deviceId", "eventId"],
    ["madrasaId", "deviceId", "deviceUserId", "punchedAt"],
  ],
  attendance: [["madrasaId", "attendeeType", "attendeeId", "date"]],
  smsQueue: [["dedupeKey"]],
  attendanceDeviceUserMap: [
    ["madrasaId", "deviceUserId"],
    ["madrasaId", "studentId"],
  ],
  attendanceDevice: [["madrasaId", "deviceCode"], ["apiKeyHash"]],
};

const conflicts = (table: string, candidate: Row) =>
  (uniqueKeys[table] || []).some((cols) =>
    (db[table as keyof FakeDb] as Row[]).some((r) => cols.every((c) => eq(r[c], candidate[c]))),
  );

const project = (row: Row, select?: Row): Row => {
  if (!select) return { ...row };
  const out: Row = {};
  for (const [k, v] of Object.entries(select)) {
    if (!v) continue;
    if (k === "student" && typeof v === "object") {
      const s = db.student.find((st) => st.id === row.studentId);
      out.student = s ? project(s, (v as Row).select) : null;
    } else out[k] = row[k];
  }
  return out;
};

const table = (name: keyof FakeDb) => {
  const rows = () => db[name] as Row[];
  return {
    findFirst: async (args: Row = {}) => {
      const r = rows().find((row) => matches(row, args.where));
      return r ? project(r, args.select) : null;
    },
    findMany: async (args: Row = {}) => rows().filter((row) => matches(row, args.where)).map((r) => project(r, args.select)),
    findUnique: async (args: Row) => {
      const r = rows().find((row) => matches(row, args.where));
      return r ? project(r, args.select) : null;
    },
    create: async (args: Row) => {
      if (conflicts(name, args.data)) throw uniqueViolation();
      const row = { id: db.seq++, createdAt: new Date(), ...args.data };
      rows().push(row);
      return { ...row };
    },
    createMany: async (args: Row) => {
      let count = 0;
      for (const data of args.data as Row[]) {
        if (conflicts(name, data)) {
          if (args.skipDuplicates) continue;
          throw uniqueViolation();
        }
        rows().push({ id: db.seq++, createdAt: new Date(), receivedAt: new Date(), ...data });
        count++;
      }
      return { count };
    },
    update: async (args: Row) => {
      const row = rows().find((r) => matches(r, args.where));
      if (!row) throw new Error("Record not found");
      Object.assign(row, args.data);
      return { ...row };
    },
    updateMany: async (args: Row) => {
      const hit = rows().filter((r) => matches(r, args.where));
      hit.forEach((r) => Object.assign(r, args.data));
      return { count: hit.length };
    },
    deleteMany: async (args: Row = {}) => {
      const keep = rows().filter((r) => !matches(r, args.where));
      const count = rows().length - keep.length;
      rows().splice(0, rows().length, ...keep);
      return { count };
    },
  };
};

const attendanceTable = table("attendance");

export const fakePrisma: any = {
  attendanceDevice: table("attendanceDevice"),
  attendanceDeviceUserMap: table("attendanceDeviceUserMap"),
  attendanceDeviceLog: table("attendanceDeviceLog"),
  notificationSetting: table("notificationSetting"),
  student: table("student"),
  smsQueue: table("smsQueue"),
  madrasa: {
    findUnique: async (args: Row) => {
      const r = db.madrasa.find((m) => m.id === args.where.id);
      return r ? project(r, args.select) : null;
    },
  },
  attendance: {
    ...attendanceTable,
    create: async (args: Row) => {
      if (db.failAttendanceCreate) throw new Error("simulated attendance write failure");
      return attendanceTable.create(args);
    },
  },
  $transaction: async (fn: (tx: any) => Promise<any>) => {
    const before: Record<string, Row[]> = {};
    for (const k of Object.keys(db)) if (Array.isArray((db as any)[k])) before[k] = (db as any)[k].map((r: Row) => ({ ...r }));
    try {
      return await fn(fakePrisma);
    } catch (err) {
      for (const [k, saved] of Object.entries(before)) {
        (db as any)[k].splice(0, (db as any)[k].length, ...saved);
      }
      throw err;
    }
  },
};
