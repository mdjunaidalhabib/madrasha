import { comparePassword } from "../../shared/utils/hash.util";
import { madrasaCleanRepository, MadrasaCleanRepository } from "./madrasa-clean.repository";
import { superAdminRepository, SuperAdminRepository } from "./superadmin.repository";
import { superAdminAccountRepository, SuperAdminAccountRepository } from "./superadmin-account.repository";
import { MADRASA_ACTIVITY } from "./superadmin.constants";
import { MadrasaNotFoundError, TrashedMadrasaOperationError } from "./superadmin.types";
import {
  CleanConfirmNameMismatchError,
  CleanPasswordIncorrectError,
  CleanPasswordRequiredError,
  InvalidCleanModeError,
} from "./madrasa-clean.types";
import { CleanMadrasaDataRequestDto } from "./madrasa-clean.dto";

export class MadrasaCleanService {
  constructor(
    private readonly repository: MadrasaCleanRepository = madrasaCleanRepository,
    private readonly superAdminRepo: SuperAdminRepository = superAdminRepository,
    private readonly accountRepo: SuperAdminAccountRepository = superAdminAccountRepository,
  ) {}

  async getCleanStats(id: number) {
    const [students, invoices, exams, attendanceRecords, users, staff, teachers] =
      await this.repository.countCleanStats(id);
    return { students, invoices, exams, attendanceRecords, users, staff, teachers };
  }

  /** Double-confirmed, password-verified, irreversible tenant data wipe -
   * see madrasa-clean.repository.ts for exactly what each mode removes.
   * actingSuperAdminId is whoever is logged in and calling this (from the
   * JWT, not the tenant being wiped) - their OWN password is re-verified
   * here as the second confirmation factor. */
  async cleanMadrasaData(id: number, actingSuperAdminId: number, dto: CleanMadrasaDataRequestDto) {
    if (dto.mode !== "operational" && dto.mode !== "full") throw new InvalidCleanModeError();

    const madrasa = await this.repository.findMadrasaForClean(id);
    if (!madrasa) throw new MadrasaNotFoundError();
    if (madrasa.deletedAt) {
      throw new TrashedMadrasaOperationError("ট্র্যাশে থাকা মাদ্রাসার ডেটা ক্লিন করা যাবে না");
    }

    if ((dto.confirm_name || "").trim() !== madrasa.name) {
      throw new CleanConfirmNameMismatchError();
    }

    if (!dto.password) throw new CleanPasswordRequiredError();
    const admin = await this.accountRepo.findById(actingSuperAdminId);
    if (!admin) throw new CleanPasswordIncorrectError();
    const validPassword = await comparePassword(dto.password, admin.passwordHash);
    if (!validPassword) throw new CleanPasswordIncorrectError();

    await this.repository.runTransaction((tx) =>
      dto.mode === "full"
        ? this.repository.wipeFullDataOnTx(tx, id)
        : this.repository.wipeOperationalDataOnTx(tx, id),
    );

    // Written AFTER the wipe (both modes clear ActivityLog) so this is the
    // one record that survives, marking who cleaned this tenant and when.
    await this.superAdminRepo.createActivityLog({
      madrasaId: id,
      action: MADRASA_ACTIVITY.DATA_CLEANED,
      entity: "madrasa",
      entityId: id,
      details: JSON.stringify({ mode: dto.mode, superAdminId: actingSuperAdminId }),
    });
  }
}

export const madrasaCleanService = new MadrasaCleanService();
