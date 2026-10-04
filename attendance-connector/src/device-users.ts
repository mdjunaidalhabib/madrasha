/**
 * Device user management: the cloud's desired user list -> K40 user table, plus the async device mutex.
 *
 * Safety rules (see README "Device users"):
 *  - users are created / updated, but only users this connector created itself (recorded in data/user-sync.json)
 *    are ever deleted. Users typed in by hand on the K40 are never removed.
 *  - an existing user is rewritten keeping its uid, privilege, password and group; its card is kept unless the
 *    cloud has a card for that person.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { atomicWriteFile } from './queue';
import type { CloudUser } from './cloud';
import { deviceStoredName, ZKError, type DeviceUser, type UserRecordSize, type ZKClient } from './protocol';

/* ------------------------------------------------------------------ mutex */

/**
 * FIFO async mutex. The K40 accepts one TCP session at a time in practice, so every session (punch fetch,
 * connection test, user sync, enrollment) runs inside deviceLock.run(). Not re-entrant: never nest run() calls.
 */
export class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();
  private held = false;

  get locked(): boolean {
    return this.held;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const prev = this.tail;
    this.tail = prev.then(() => next);
    await prev;
    this.held = true;
    try {
      return await fn();
    } finally {
      this.held = false;
      release();
    }
  }
}

/** Shared by every K40 session of this process. */
export const deviceLock = new AsyncMutex();

/* ------------------------------------------------------------ local state */

export interface UserSyncState {
  /** users_version of the last fully successful sync */
  version?: string;
  /** PINs this connector created on the device (the only ones it may delete) */
  managed: string[];
  /** last user record size seen on the device (used when the device list is empty) */
  recordSize?: UserRecordSize;
  syncedAt?: string;
}

export function userStatePath(dataDir: string): string {
  return path.join(dataDir, 'user-sync.json');
}

export function loadUserState(dataDir: string): UserSyncState {
  try {
    const p = userStatePath(dataDir);
    if (!fs.existsSync(p)) return { managed: [] };
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      version: typeof raw.version === 'string' ? raw.version : undefined,
      managed: Array.isArray(raw.managed) ? raw.managed.map((x: unknown) => String(x)) : [],
      recordSize: raw.recordSize === 72 || raw.recordSize === 28 ? raw.recordSize : undefined,
      syncedAt: typeof raw.syncedAt === 'string' ? raw.syncedAt : undefined,
    };
  } catch {
    // unreadable state: start over WITHOUT a managed list (=> nothing will be deleted), never crash
    return { managed: [] };
  }
}

export function saveUserState(dataDir: string, st: UserSyncState): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const out = { ...st, managed: [...new Set(st.managed)].sort() };
  atomicWriteFile(userStatePath(dataDir), JSON.stringify(out, null, 2));
}

/* ---------------------------------------------------------------- helpers */

/** Cloud card string -> device u32, or undefined when absent / not representable on the device. */
export function cardToU32(card: string | null | undefined): number | undefined {
  if (card === null || card === undefined) return undefined;
  const s = String(card).trim();
  if (!/^[0-9]{1,20}$/.test(s)) return undefined;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 0xffffffff) return undefined;
  return n;
}

/** Record size to WRITE with: config override, else what the device list showed, else remembered, else 72. */
export function resolveRecordSize(
  configured: 'auto' | 72 | 28,
  detected: UserRecordSize | undefined,
  remembered?: UserRecordSize,
): UserRecordSize {
  if (configured !== 'auto') return configured;
  return detected ?? remembered ?? 72;
}

/** Allocates new uids: max existing + 1, wrapping to the smallest free uid if that overflows u16. */
export class UidAllocator {
  private used: Set<number>;
  private next: number;
  constructor(users: Pick<DeviceUser, 'uid'>[]) {
    this.used = new Set(users.map((u) => u.uid));
    this.next = users.reduce((m, u) => Math.max(m, u.uid), 0) + 1;
  }
  take(): number {
    let uid = this.next;
    if (uid > 65534 || this.used.has(uid)) {
      uid = 1;
      while (this.used.has(uid) && uid <= 65534) uid++;
      if (uid > 65534) throw new ZKError('DEVICE_ERROR', 'no free user uid on the device');
    } else this.next = uid + 1;
    this.used.add(uid);
    return uid;
  }
}

/* ------------------------------------------------------------------- plan */

export interface PlannedWrite {
  pin: string;
  uid?: number; // undefined = new user (uid assigned when applied)
  name: string;
  card: number;
  privilege: number;
  password?: string;
  groupId?: string;
  reason: string;
}

/** Rewrite of an existing record (same uid) with a new user id: PIN changed in the cloud (prev_pin -> pin). */
export interface PlannedRename extends PlannedWrite {
  uid: number;
  fromPin: string;
}

export interface UserSyncPlan {
  create: PlannedWrite[];
  update: PlannedWrite[];
  /**
   * prev_pin Q on the device, desired pin P not: same uid rewritten with user id P. Keeps the fingerprint templates
   * (stored per uid on the K40) and avoids a duplicate person.
   */
  rename: PlannedRename[];
  /** managed users no longer desired */
  delete: { pin: string; uid: number; name: string }[];
  /** managed pins already gone from the device (just forgotten) */
  forget: string[];
  skipped: { pin: string; reason: string }[];
  unchanged: number;
}

/** Pure diff between the device list and the desired list. */
export function planUserSync(
  deviceUsers: DeviceUser[],
  desired: CloudUser[],
  managed: Iterable<string>,
  size: UserRecordSize,
): UserSyncPlan {
  const plan: UserSyncPlan = { create: [], update: [], rename: [], delete: [], forget: [], skipped: [], unchanged: 0 };
  const byPin = new Map(deviceUsers.map((u) => [u.userId, u]));
  const wanted = new Set<string>();
  for (const d of desired) {
    const pin = String(d.pin ?? '').trim();
    if (pin) wanted.add(pin);
  }
  /** device user ids already taken over by a rename (each record can be renamed only once) */
  const renamedFrom = new Set<string>();
  for (const d of desired) {
    const pin = String(d.pin ?? '').trim();
    if (!pin) continue;
    if (size === 28 && !/^\d{1,10}$/.test(pin)) {
      plan.skipped.push({ pin, reason: '28-byte device format needs a numeric PIN' });
      continue;
    }
    const name = deviceStoredName(String(d.name ?? ''), size) || pin;
    const cloudCard = cardToU32(d.card);
    if (d.card !== null && d.card !== undefined && cloudCard === undefined) {
      plan.skipped.push({ pin, reason: `card ${d.card} cannot be stored on the device (u32); written without card change` });
    }
    const cur = byPin.get(pin);
    if (!cur) {
      const prev = d.prev_pin === null || d.prev_pin === undefined ? '' : String(d.prev_pin).trim();
      const old = prev && prev !== pin ? byPin.get(prev) : undefined;
      // rename only a record that is not itself somebody's desired pin and not already renamed
      if (old && !wanted.has(prev) && !renamedFrom.has(prev)) {
        renamedFrom.add(prev);
        plan.rename.push({
          pin,
          fromPin: prev,
          uid: old.uid,
          name,
          card: cloudCard ?? old.card, // same card rule as an update
          privilege: old.privilege,
          password: old.password,
          groupId: old.groupId,
          reason: `PIN changed ${prev} -> ${pin}`,
        });
        continue;
      }
      plan.create.push({ pin, name, card: cloudCard ?? 0, privilege: 0, reason: 'missing on device' });
      continue;
    }
    const reasons: string[] = [];
    if (cur.name !== name) reasons.push('name');
    if (cloudCard !== undefined && cloudCard !== cur.card) reasons.push('card');
    if (reasons.length === 0) {
      plan.unchanged++;
      continue;
    }
    plan.update.push({
      pin,
      uid: cur.uid,
      name,
      card: cloudCard ?? cur.card, // keep the device card when the cloud has none
      privilege: cur.privilege,
      password: cur.password,
      groupId: cur.groupId,
      reason: `${reasons.join('+')} differs`,
    });
  }
  for (const pin of managed) {
    if (wanted.has(pin)) continue;
    if (renamedFrom.has(pin)) continue; // the record becomes the new pin; apply drops the old pin from `managed`
    const cur = byPin.get(pin);
    if (cur) plan.delete.push({ pin, uid: cur.uid, name: cur.name });
    else plan.forget.push(pin);
  }
  return plan;
}

/* ------------------------------------------------------------------ apply */

export interface UserSyncResult {
  plan: UserSyncPlan;
  created: number;
  updated: number;
  deleted: number;
  /** records rewritten in place with a new user id (prev_pin -> pin) */
  renamed: number;
  deviceUserCount: number;
  recordSize: UserRecordSize;
  /** first per-user error (sync continues with the others) */
  errors: string[];
}

/**
 * Apply the plan on an already connected client (deletes, updates, renames, creates - in that order, so a freed
 * user id can be reused). Mutates state.managed as users are created / renamed / deleted, so the
 * caller must save state even when this throws half-way.
 */
export async function applyUserSync(
  client: ZKClient,
  deviceUsers: DeviceUser[],
  plan: UserSyncPlan,
  size: UserRecordSize,
  state: UserSyncState,
): Promise<UserSyncResult> {
  const managed = new Set(state.managed);
  const alloc = new UidAllocator(deviceUsers);
  const res: UserSyncResult = { plan, created: 0, updated: 0, deleted: 0, renamed: 0, deviceUserCount: deviceUsers.length, recordSize: size, errors: [] };
  const commit = () => (state.managed = [...managed]);
  let failure: unknown;
  try {
    for (const pin of plan.forget) managed.delete(pin);
    for (const d of plan.delete) {
      await client.deleteUser(d.uid);
      managed.delete(d.pin);
      res.deleted++;
      res.deviceUserCount--;
    }
    for (const w of plan.update) {
      try {
        await client.setUser({ uid: w.uid!, userId: w.pin, name: w.name, privilege: w.privilege, password: w.password, card: w.card, groupId: w.groupId }, size);
        res.updated++;
      } catch (e) {
        if (!(e instanceof ZKError) || e.code !== 'DEVICE_ERROR') throw e;
        res.errors.push(`pin ${w.pin}: ${e.message}`);
      }
    }
    for (const w of plan.rename) {
      try {
        // same uid, new user id: the K40 keeps the fingerprint templates stored under that uid
        await client.setUser({ uid: w.uid, userId: w.pin, name: w.name, privilege: w.privilege, password: w.password, card: w.card, groupId: w.groupId }, size);
        managed.add(w.pin);
        managed.delete(w.fromPin);
        res.renamed++;
      } catch (e) {
        if (!(e instanceof ZKError) || e.code !== 'DEVICE_ERROR') throw e;
        res.errors.push(`pin ${w.fromPin} -> ${w.pin}: ${e.message}`);
      }
    }
    for (const w of plan.create) {
      const uid = alloc.take();
      try {
        await client.setUser({ uid, userId: w.pin, name: w.name, privilege: 0, card: w.card }, size);
        managed.add(w.pin);
        res.created++;
        res.deviceUserCount++;
      } catch (e) {
        if (!(e instanceof ZKError) || e.code !== 'DEVICE_ERROR') throw e;
        res.errors.push(`pin ${w.pin}: ${e.message}`);
      }
    }
  } catch (e) {
    failure = e;
    throw e;
  } finally {
    commit();
    if (res.created || res.updated || res.deleted || res.renamed) {
      try {
        await client.refreshData();
      } catch (e) {
        if (!failure) throw e; // otherwise keep the original error
      }
    }
  }
  return res;
}
