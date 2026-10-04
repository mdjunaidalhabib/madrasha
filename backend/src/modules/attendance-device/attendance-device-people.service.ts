import crypto from "crypto";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { t } from "../../shared/i18n";
import { PersonType } from "./attendance-device.constants";
import { AssignPinsDto, ConvertPinsDto, PeopleQuery, SetCardDto } from "./attendance-device.dto";
import {
  comparePins,
  DeviceRules,
  deviceUserName,
  normalizeCardNumber,
  REGISTRATION_PIN_OFFSET,
  registrationPin,
} from "./attendance-device-rules";
import {
  attendanceDevicePeopleRepository,
  AttendanceDevicePeopleRepository,
  Person,
  PersonRef,
  personIdColumns,
} from "./attendance-device-people.repository";
import {
  attendanceDeviceSettingsService,
  AttendanceDeviceSettingsService,
} from "./attendance-device-settings.service";

const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === "P2002";

const PIN_ALLOC_ATTEMPTS = 5;

export interface ConnectorUser {
  pin: string;
  name: string;
  card: string | null;
  attendee_type: PersonType;
  /** PIN before a convert-pins run: the connector renames that K40 user in place (fingerprints survive). */
  prev_pin: string | null;
}

type MapLite = { deviceUserId: string; cardNumber: string | null; autoAssigned: boolean } | null;

export const toPersonItem = (person: Person, map: MapLite) => ({
  attendee_type: person.type,
  attendee_id: person.id,
  name: person.nameBn,
  name_en: person.nameEn,
  image: person.image,
  roll: person.roll,
  registration_no: person.registrationNo,
  class_id: person.classId,
  class_name: person.className,
  designation: person.designation,
  device_user_id: map?.deviceUserId ?? null,
  card_number: map?.cardNumber ?? null,
  auto_assigned: map?.autoAssigned ?? false,
});

const personNotFound = (type: PersonType) =>
  new NotFoundError(
    type === "STUDENT"
      ? t({ bn: "শিক্ষার্থী পাওয়া যায়নি", en: "Student not found" })
      : type === "TEACHER"
        ? t({ bn: "শিক্ষক পাওয়া যায়নি", en: "Teacher not found" })
        : t({ bn: "স্টাফ পাওয়া যায়নি", en: "Staff member not found" }),
  );

/**
 * Generic person <-> K40 user mapping: system PIN allocation, RFID cards and
 * the desired K40 user list the connector writes to every device.
 */
export class AttendanceDevicePeopleService {
  constructor(
    private readonly repository: AttendanceDevicePeopleRepository = attendanceDevicePeopleRepository,
    private readonly settings: AttendanceDeviceSettingsService = attendanceDeviceSettingsService,
  ) {}

  /* ================= persons ================= */

  /** The person (must belong to the madrasa, not deleted, active/approved). */
  async requireEligiblePerson(madrasaId: number, ref: PersonRef): Promise<Person> {
    const person = await this.repository.findPerson(madrasaId, ref);
    if (!person) throw personNotFound(ref.type);
    if (!person.eligible) {
      throw new BadRequestError(
        t({ bn: "এই ব্যক্তি সক্রিয় নয় (নিষ্ক্রিয়/মুছে ফেলা/অননুমোদিত)", en: "This person is not active (inactive/deleted/not approved)" }),
      );
    }
    return person;
  }

  /* ================= PIN allocation ================= */

  /**
   * Auto PIN = the smallest integer >= settings.pinStart not used by any map
   * row of the madrasa (current or previous PIN) and never seen as an
   * unmapped K40 user id in the punch logs.
   */
  private nextPin(start: number, taken: Set<string>): string {
    let n = Math.max(1, start);
    while (taken.has(String(n))) n++;
    return String(n);
  }

  /**
   * pin_mode "registration": student = reg no, teacher = 90000 + reg no,
   * staff = 95000 + reg no - unless the registration number is missing or that
   * PIN is taken, then the auto PIN. pin_mode "auto": always the auto PIN.
   */
  private pickPin(
    rules: Pick<DeviceRules, "pinMode" | "pinStart">,
    type: PersonType,
    registrationNo: number | null,
    taken: Set<string>,
  ) {
    if (rules.pinMode !== "auto") {
      const pin = registrationPin(type, registrationNo);
      if (pin && !taken.has(pin)) return pin;
    }
    return this.nextPin(rules.pinStart, taken);
  }

  /** Returns the person's map row, creating one with a system PIN when missing. */
  async ensureMap(madrasaId: number, ref: PersonRef) {
    const existing = await this.repository.findMapByPerson(madrasaId, ref);
    if (existing) return existing;

    const rules = await this.settings.getRules(madrasaId);
    const registrationNo =
      rules.pinMode === "auto" ? null : ((await this.repository.findPerson(madrasaId, ref))?.registrationNo ?? null);
    for (let attempt = 0; attempt < PIN_ALLOC_ATTEMPTS; attempt++) {
      const taken = await this.repository.findTakenDeviceUserIds(madrasaId);
      const pin = this.pickPin(rules, ref.type, registrationNo, taken);
      try {
        const created = await this.repository.createMap({
          madrasaId,
          attendeeType: ref.type,
          ...personIdColumns(ref),
          deviceUserId: pin,
          autoAssigned: true,
        });
        logger.info("Attendance device PIN assigned", { madrasaId, type: ref.type, personId: ref.id, pin });
        return created;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Either a concurrent request mapped this person, or took the PIN: re-check and retry.
        const raced = await this.repository.findMapByPerson(madrasaId, ref);
        if (raced) return raced;
      }
    }
    throw new ConflictError(t({ bn: "PIN বরাদ্দ করা যায়নি, আবার চেষ্টা করুন", en: "Could not allocate a PIN, please retry" }));
  }

  /** Bulk: a PIN for every eligible person of the type (and class) without a map. */
  async assignPins(madrasaId: number, dto: AssignPinsDto) {
    const rules = await this.settings.getRules(madrasaId);
    let created = 0;
    for (let attempt = 0; attempt < PIN_ALLOC_ATTEMPTS; attempt++) {
      const people = await this.repository.findEligibleWithoutMap(madrasaId, dto.attendee_type, dto.class_id);
      if (!people.length) break;
      const taken = await this.repository.findTakenDeviceUserIds(madrasaId);
      // Registration PINs first, so a fallback auto PIN never takes another person's registration PIN.
      const pins = new Map<number, string>();
      if (rules.pinMode !== "auto") {
        for (const person of people) {
          const pin = registrationPin(dto.attendee_type, person.registrationNo);
          if (pin && !taken.has(pin)) {
            pins.set(person.id, pin);
            taken.add(pin);
          }
        }
      }
      const rows = people.map(({ id }) => {
        let pin = pins.get(id);
        if (!pin) {
          pin = this.nextPin(rules.pinStart, taken);
          taken.add(pin);
        }
        return {
          madrasaId,
          attendeeType: dto.attendee_type,
          ...personIdColumns({ type: dto.attendee_type, id }),
          deviceUserId: pin,
          autoAssigned: true,
        };
      });
      // skipDuplicates: a concurrent writer can only make us insert fewer rows;
      // the loop then re-reads who is still unmapped with a fresh taken-set.
      for (let i = 0; i < rows.length; i += 500) {
        const res = await this.repository.createMaps(rows.slice(i, i + 500));
        created += res.count;
      }
    }
    logger.info("Attendance device PINs assigned (bulk)", { madrasaId, type: dto.attendee_type, classId: dto.class_id ?? null, created });
    return { created };
  }

  /**
   * Moves auto-assigned PINs to the registration-mode PIN (only pin_mode
   * "registration"). Manually typed PINs (autoAssigned=false) are never touched.
   * The old PIN is kept as previousDeviceUserId: punches under it still
   * resolve, and the connector renames that K40 user in place.
   */
  async convertPins(madrasaId: number, dto: ConvertPinsDto) {
    const rules = await this.settings.getRules(madrasaId);
    if (rules.pinMode !== "registration") {
      throw new BadRequestError(
        t({ bn: "PIN রূপান্তর শুধু রেজিস্ট্রেশন নম্বর PIN মোডে করা যায়", en: "PIN conversion is only allowed in registration PIN mode" }),
      );
    }
    const maps = await this.repository.listAutoAssignedMaps(madrasaId, dto.attendee_type ?? undefined);
    const taken = await this.repository.findTakenDeviceUserIds(madrasaId);
    let changed = 0;
    let skipped = 0;
    for (const m of maps) {
      const type = m.attendeeType as PersonType;
      const regNo = (m.student ?? m.teacher ?? m.staff)?.registrationNo ?? null;
      const pin = registrationPin(type, regNo);
      if (!pin || pin === m.deviceUserId) continue;
      // Free = not any other row's current/previous PIN and not an unmapped K40 id
      // (this row's own previous PIN may be reused: it is the same person).
      if (taken.has(pin) && pin !== m.previousDeviceUserId) {
        skipped++;
        continue;
      }
      try {
        const res = await this.repository.movePin(madrasaId, m.id, pin, m.deviceUserId);
        if (res.count === 0) {
          skipped++;
          continue;
        }
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        skipped++;
        continue;
      }
      taken.add(pin);
      changed++;
    }
    logger.info("Attendance device PINs converted to registration numbers", {
      madrasaId,
      type: dto.attendee_type ?? "ALL",
      changed,
      skipped,
    });
    return { changed, skipped };
  }

  /** Bangla warnings shown under the PIN-mode setting when the registration ranges may overlap. */
  async pinWarnings(madrasaId: number): Promise<string[]> {
    const max = await this.repository.maxRegistrationNos(madrasaId);
    const warnings: string[] = [];
    if (max.student !== null && max.student >= REGISTRATION_PIN_OFFSET.TEACHER) {
      warnings.push("শিক্ষার্থীর রেজি. নং 90000 ছুঁয়েছে, শিক্ষকের আইডির সাথে মিলে যেতে পারে");
    }
    const teacherSpan = REGISTRATION_PIN_OFFSET.STAFF - REGISTRATION_PIN_OFFSET.TEACHER;
    if (max.teacher !== null && max.teacher >= teacherSpan) {
      warnings.push(`শিক্ষকের রেজি. নং ${teacherSpan} ছুঁয়েছে, স্টাফের আইডির সাথে মিলে যেতে পারে`);
    }
    return warnings;
  }

  /* ================= admin: people / cards ================= */

  async listPeople(madrasaId: number, q: PeopleQuery) {
    const { rows, total } = await this.repository.listPeople(madrasaId, {
      type: q.attendee_type,
      classId: q.class_id,
      search: q.search || undefined,
      hasCard: q.has_card === undefined ? undefined : q.has_card === "true",
      attendeeId: q.attendee_id,
      page: q.page,
      limit: q.limit,
    });
    return {
      items: rows.map((r) => toPersonItem(r.person, r.map)),
      total,
      page: q.page,
      limit: q.limit,
      total_pages: Math.max(1, Math.ceil(total / q.limit)),
    };
  }

  /** Throws 409 when `card` belongs to somebody other than `ref`. */
  private async assertCardFree(madrasaId: number, card: string, ref: PersonRef) {
    const holder = await this.repository.findMapByCard(madrasaId, card);
    if (holder && !(holder.person?.type === ref.type && holder.person.id === ref.id)) {
      const name = holder.person?.nameBn ?? holder.deviceUserId;
      throw new ConflictError(
        t({ bn: `এই কার্ড (${card}) ইতিমধ্যে ${name}-এর নামে যুক্ত আছে`, en: `This card (${card}) is already used by ${name}` }),
      );
    }
  }

  /** Manual / USB-reader card entry. Creates the map (system PIN) if missing. */
  async setCard(madrasaId: number, dto: SetCardDto) {
    const ref: PersonRef = { type: dto.attendee_type, id: dto.attendee_id };
    const card = normalizeCardNumber(dto.card_number);
    if (!card) throw new BadRequestError(t({ bn: "কার্ড নম্বর সঠিক নয়", en: "card_number is invalid" }));
    const person = await this.requireEligiblePerson(madrasaId, ref);
    await this.assertCardFree(madrasaId, card, ref);

    const map = await this.ensureMap(madrasaId, ref);
    try {
      await this.repository.updateMapCard(madrasaId, map.id, card);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(t({ bn: "এই কার্ড অন্য একজনের নামে যুক্ত আছে", en: "This card is already used by someone else" }));
      }
      throw err;
    }
    logger.info("Attendance device card set", { madrasaId, type: ref.type, personId: ref.id });
    return toPersonItem(person, { deviceUserId: map.deviceUserId, cardNumber: card, autoAssigned: map.autoAssigned });
  }

  async clearCard(madrasaId: number, ref: PersonRef) {
    const map = await this.repository.findMapByPerson(madrasaId, ref);
    if (!map) throw new NotFoundError(t({ bn: "ম্যাপিং পাওয়া যায়নি", en: "Mapping not found" }));
    await this.repository.updateMapCard(madrasaId, map.id, null);
    logger.info("Attendance device card cleared", { madrasaId, type: ref.type, personId: ref.id });
  }

  async deleteMap(madrasaId: number, ref: PersonRef) {
    const res = await this.repository.deleteMapByPerson(madrasaId, ref);
    if (res.count === 0) throw new NotFoundError(t({ bn: "ম্যাপিং পাওয়া যায়নি", en: "Mapping not found" }));
    logger.info("Attendance device mapping deleted", { madrasaId, type: ref.type, personId: ref.id });
  }

  /* ================= connector: desired K40 user list ================= */

  async connectorUsers(madrasaId: number): Promise<{ version: string; users: ConnectorUser[] }> {
    const maps = await this.repository.listAllMaps(madrasaId);
    const users: ConnectorUser[] = maps
      .filter((m) => m.person?.eligible)
      .map((m) => ({
        pin: m.deviceUserId,
        name: deviceUserName(m.person!.type, m.person!.nameEn, m.deviceUserId),
        card: m.cardNumber ?? null,
        attendee_type: m.person!.type,
        prev_pin: m.previousDeviceUserId ?? null,
      }))
      .sort((a, b) => comparePins(a.pin, b.pin));
    const version = crypto.createHash("sha256").update(JSON.stringify(users)).digest("hex");
    return { version, users };
  }

  async usersVersion(madrasaId: number): Promise<string> {
    return (await this.connectorUsers(madrasaId)).version;
  }
}

export const attendanceDevicePeopleService = new AttendanceDevicePeopleService();
