/**
 * Minimal in-memory fake of the slice of Prisma the attendance-device module
 * uses. Enforces the same unique keys as the real schema so duplicate /
 * idempotency behaviour is exercised (NULLs are distinct, as in SQL), and
 * `$transaction` rolls back every table when the callback throws (so
 * "attendance write fails" really means the log row is gone too).
 */

type Row = Record<string, any>;

export interface FakeDb {
  attendanceDevice: Row[];
  attendanceDeviceUserMap: Row[];
  attendanceDeviceLog: Row[];
  attendanceDeviceEnrollment: Row[];
  attendanceDeviceSettings: Row[];
  attendanceHoliday: Row[];
  notificationSetting: Row[];
  student: Row[];
  teacher: Row[];
  staff: Row[];
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
  attendanceDeviceEnrollment: [],
  attendanceDeviceSettings: [],
  attendanceHoliday: [],
  notificationSetting: [],
  student: [],
  teacher: [],
  staff: [],
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

const norm = (v: any) => (v === undefined ? null : v);
const eq = (a: any, b: any) =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : norm(a) === norm(b);
const val = (v: any) => (v instanceof Date ? v.getTime() : v);

const OPS = ["in", "not", "lt", "lte", "gt", "gte"];

/** person table -> FK column on attendance_device_user_maps (relation filter support). */
const mapFkOf: Record<string, string> = { student: "studentId", teacher: "teacherId", staff: "staffId" };

const matches = (row: Row, where: Row = {}, tableName?: string): boolean =>
  Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((c) => matches(row, c, tableName));
    if (key === "AND") return (cond as Row[]).every((c) => matches(row, c, tableName));
    if (key === "attendanceDeviceMaps" && tableName && mapFkOf[tableName]) {
      const fk = mapFkOf[tableName];
      const own = db.attendanceDeviceUserMap.filter((m) => m[fk] === row.id && m.madrasaId === row.madrasaId);
      if (cond.some) return own.some((m) => matches(m, cond.some));
      if (cond.none) return !own.some((m) => matches(m, cond.none));
      return true;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if (Object.keys(cond).some((k) => OPS.includes(k))) {
        const v = row[key];
        if ("in" in cond && !(cond.in as any[]).some((x) => eq(x, v))) return false;
        if ("not" in cond && eq(cond.not, v)) return false;
        if (cond.lt !== undefined && !(v !== null && v !== undefined && val(v) < val(cond.lt))) return false;
        if (cond.lte !== undefined && !(v !== null && v !== undefined && val(v) <= val(cond.lte))) return false;
        if (cond.gt !== undefined && !(v !== null && v !== undefined && val(v) > val(cond.gt))) return false;
        if (cond.gte !== undefined && !(v !== null && v !== undefined && val(v) >= val(cond.gte))) return false;
        return true;
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
    ["madrasaId", "teacherId"],
    ["madrasaId", "staffId"],
    ["madrasaId", "cardNumber"],
  ],
  attendanceDevice: [["madrasaId", "deviceCode"], ["apiKeyHash"]],
  attendanceDeviceSettings: [["madrasaId"]],
  attendanceHoliday: [["madrasaId", "date"]],
};

const conflicts = (table: string, candidate: Row, self?: Row) =>
  (uniqueKeys[table] || []).some(
    (cols) =>
      cols.every((c) => candidate[c] !== null && candidate[c] !== undefined) &&
      (db[table as keyof FakeDb] as Row[]).some((r) => r !== self && cols.every((c) => eq(r[c], candidate[c]))),
  );

/** Relation name -> (table, foreign key on this row). */
const relations: Record<string, [keyof FakeDb, string]> = {
  student: ["student", "studentId"],
  teacher: ["teacher", "teacherId"],
  staff: ["staff", "staffId"],
  device: ["attendanceDevice", "deviceId"],
};

const project = (row: Row, select?: Row): Row => {
  if (!select) return { ...row };
  const out: Row = {};
  for (const [k, v] of Object.entries(select)) {
    if (!v) continue;
    if (relations[k] && typeof v === "object") {
      const [tableName, fk] = relations[k];
      const target = (db[tableName] as Row[]).find((r) => r.id === row[fk]);
      out[k] = target ? project(target, (v as Row).select) : null;
    } else out[k] = row[k];
  }
  return out;
};

const sortRows = (rows: Row[], orderBy?: Row | Row[]) => {
  if (!orderBy) return rows;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const o of orders) {
      const [k, dir] = Object.entries(o)[0] as [string, string];
      const av = val(a[k]);
      const bv = val(b[k]);
      if (av === bv) continue;
      const cmp = av === null || av === undefined ? -1 : bv === null || bv === undefined ? 1 : av < bv ? -1 : 1;
      return dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
};

const table = (name: keyof FakeDb) => {
  const rows = () => db[name] as Row[];
  const findAll = (args: Row = {}) => {
    let found = sortRows(rows().filter((row) => matches(row, args.where, name)), args.orderBy);
    if (args.skip) found = found.slice(args.skip);
    if (args.take) found = found.slice(0, args.take);
    return found;
  };
  const api = {
    findFirst: async (args: Row = {}) => {
      const r = findAll(args)[0];
      return r ? project(r, args.select) : null;
    },
    findMany: async (args: Row = {}) => findAll(args).map((r) => project(r, args.select)),
    findUnique: async (args: Row) => {
      const r = rows().find((row) => matches(row, args.where));
      return r ? project(r, args.select) : null;
    },
    count: async (args: Row = {}) => rows().filter((row) => matches(row, args.where, name)).length,
    /** Only `_max` (all the code under test uses). */
    aggregate: async (args: Row = {}) => {
      const hit = rows().filter((row) => matches(row, args.where, name));
      const _max: Row = {};
      for (const key of Object.keys(args._max ?? {})) {
        const values = hit.map((r) => r[key]).filter((v) => v !== null && v !== undefined);
        _max[key] = values.length ? values.reduce((a, b) => (b > a ? b : a)) : null;
      }
      return { _max };
    },
    create: async (args: Row) => {
      if (conflicts(name, args.data)) throw uniqueViolation();
      const row = { id: db.seq++, createdAt: new Date(), updatedAt: new Date(), ...args.data };
      rows().push(row);
      return project(row, args.select);
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
      if (conflicts(name, { ...row, ...args.data }, row)) throw uniqueViolation();
      Object.assign(row, args.data);
      return project(row, args.select);
    },
    updateMany: async (args: Row) => {
      const hit = rows().filter((r) => matches(r, args.where));
      for (const r of hit) if (conflicts(name, { ...r, ...args.data }, r)) throw uniqueViolation();
      hit.forEach((r) => Object.assign(r, args.data));
      return { count: hit.length };
    },
    upsert: async (args: Row) => {
      const row = rows().find((r) => matches(r, args.where));
      if (row) {
        Object.assign(row, args.update);
        return { ...row };
      }
      return api.create({ data: args.create });
    },
    deleteMany: async (args: Row = {}) => {
      const keep = rows().filter((r) => !matches(r, args.where));
      const count = rows().length - keep.length;
      rows().splice(0, rows().length, ...keep);
      return { count };
    },
  };
  return api;
};

const attendanceTable = table("attendance");

export const fakePrisma: any = {
  attendanceDevice: table("attendanceDevice"),
  attendanceDeviceUserMap: table("attendanceDeviceUserMap"),
  attendanceDeviceLog: table("attendanceDeviceLog"),
  attendanceDeviceEnrollment: table("attendanceDeviceEnrollment"),
  attendanceDeviceSettings: table("attendanceDeviceSettings"),
  attendanceHoliday: table("attendanceHoliday"),
  notificationSetting: table("notificationSetting"),
  student: table("student"),
  teacher: table("teacher"),
  staff: table("staff"),
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
