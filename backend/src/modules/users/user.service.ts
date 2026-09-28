import { hashPassword } from "../../shared/utils/hash.util";
import { logActivity } from "../../shared/utils/activity.util";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { isMuhtamimRole } from "../../shared/permissions";
import { userRepository, UserRepository } from "./user.repository";
import { CreateUserRequestDto, ResetPasswordRequestDto, UpdateUserRequestDto } from "./user.dto";
import { USER_ACTIVITY_ENTITY, USER_LIMIT_REACHED_MESSAGE } from "./user.constants";
import { DefaultUserProtectedError } from "./user.types";
import { t } from "../../shared/i18n";

export class UserService {
  constructor(private readonly repository: UserRepository = userRepository) {}

  async listUsers(madrasaId: number) {
    const rows = await this.repository.findManyForTenant(madrasaId);
    return rows.map(({ role, ...row }) => ({
      ...row,
      roleKey: role?.keyName ?? null,
      isMuhtamim: isMuhtamimRole(role?.keyName || ""),
    }));
  }

  async createUser(madrasaId: number, actingUserId: number, dto: CreateUserRequestDto) {
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestError(t({ bn: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে", en: "Password must be at least 6 characters", ar: "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل" }));
    }

    const role = await this.repository.findRoleForTenant(dto.role_id, madrasaId);
    if (!role) throw new BadRequestError(t({ bn: "নির্বাচিত রোলটি এই প্রতিষ্ঠানের নয়", en: "Selected role does not belong to this institution", ar: "الدور المختار لا يتبع هذه المؤسسة" }));
    if (isMuhtamimRole(role.keyName || "")) {
      throw new ForbiddenError(
        t({ bn: "এখান থেকে প্রতিষ্ঠান প্রধান রোলের ব্যবহারকারী যোগ করা যাবে না — প্রতিটি প্রতিষ্ঠানের একজনই ডিফল্ট প্রধান থাকতে পারেন।", en: "Users with the institution head role cannot be added here — each institution can have only one default head.", ar: "لا يمكن إضافة مستخدمين بدور رئيس المؤسسة من هنا — لكل مؤسسة رئيس افتراضي واحد فقط." }),
      );
    }

    const madrasa = await this.repository.findMadrasaUserLimit(madrasaId);
    const userLimit = madrasa?.userLimit ?? 0;

    const total = await this.repository.countActiveForTenant(madrasaId);
    if (total >= userLimit) {
      throw new BadRequestError(USER_LIMIT_REACHED_MESSAGE());
    }

    const passwordHash = await hashPassword(dto.password);
    const created = await this.repository.create({
      madrasaId,
      name: dto.name,
      email: dto.email,
      passwordHash,
      roleId: dto.role_id,
      isActive: 1,
    });

    await logActivity({
      madrasa_id: madrasaId,
      user_id: actingUserId,
      action: "CREATE",
      entity: USER_ACTIVITY_ENTITY,
      entity_id: created.id,
      details: `ইউজার ${dto.name} তৈরি করা হয়েছে`,
    });

    return created.id;
  }

  async deleteUser(madrasaId: number, actingUserId: number, id: number) {
    const user = await this.repository.findByIdForTenant(id, madrasaId);
    if (!user) throw new NotFoundError(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found", ar: "لم يتم العثور على المستخدم" }));
    if (isMuhtamimRole(user.role?.keyName || "")) {
      throw new DefaultUserProtectedError();
    }

    await this.repository.deleteManyForTenant(id, madrasaId);

    await logActivity({
      madrasa_id: madrasaId,
      user_id: actingUserId,
      action: "DELETE",
      entity: USER_ACTIVITY_ENTITY,
      entity_id: id,
      details: `ইউজার আইডি ${id} মুছে ফেলা হয়েছে`,
    });
  }

  /** Changes a user's role and/or active status. Was previously
   * impossible after creation - the only mutations were create/delete. */
  async updateUser(madrasaId: number, actingUserId: number, id: number, dto: UpdateUserRequestDto) {
    const existing = await this.repository.findByIdForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found", ar: "لم يتم العثور على المستخدم" }));
    const existingIsMuhtamim = isMuhtamimRole(existing.role?.keyName || "");

    // The default Muhtamim account's role/active status is fixed from this
    // tenant-facing page - only Super Admin (a separate, platform-level
    // panel) may change it.
    if (existingIsMuhtamim && (dto.role_id !== undefined || dto.is_active !== undefined)) {
      throw new ForbiddenError(
        t({ bn: "ডিফল্ট প্রতিষ্ঠান প্রধানের অ্যাকাউন্টের রোল বা স্ট্যাটাস এখান থেকে পরিবর্তন করা যাবে না — এটি শুধুমাত্র সুপার অ্যাডমিন করতে পারবেন।", en: "The default institution head account's role or status cannot be changed here — only the Super Admin can do that.", ar: "لا يمكن تغيير دور أو حالة حساب رئيس المؤسسة الافتراضي من هنا — يمكن للمشرف العام فقط القيام بذلك." }),
      );
    }

    const data: Record<string, unknown> = {};

    if (dto.role_id !== undefined) {
      const role = await this.repository.findRoleForTenant(dto.role_id, madrasaId);
      if (!role) throw new BadRequestError(t({ bn: "নির্বাচিত রোলটি এই প্রতিষ্ঠানের নয়", en: "Selected role does not belong to this institution", ar: "الدور المختار لا يتبع هذه المؤسسة" }));
      if (isMuhtamimRole(role.keyName || "")) {
        throw new ForbiddenError(
          t({ bn: "এখান থেকে কাউকে প্রতিষ্ঠান প্রধানের রোল দেওয়া যাবে না — প্রতিটি প্রতিষ্ঠানের একজনই ডিফল্ট প্রধান থাকতে পারেন।", en: "No one can be given the institution head role here — each institution can have only one default head.", ar: "لا يمكن منح دور رئيس المؤسسة لأي شخص من هنا — لكل مؤسسة رئيس افتراضي واحد فقط." }),
        );
      }
      data.roleId = dto.role_id;
    }
    if (dto.is_active !== undefined) data.isActive = dto.is_active ? 1 : 0;
    if (dto.name !== undefined && dto.name.trim()) data.name = dto.name.trim();
    if (dto.mobile !== undefined) data.mobile = dto.mobile.trim() || null;
    if (dto.photo_url !== undefined) data.photoUrl = dto.photo_url.trim() || null;

    if (!Object.keys(data).length) throw new BadRequestError(t({ bn: "আপডেট করার মতো কোনো সঠিক তথ্য নেই", en: "No valid data to update", ar: "لا توجد بيانات صالحة للتحديث" }));

    const result = await this.repository.updateManyForTenant(id, madrasaId, data as any);
    if (!result.count) throw new NotFoundError(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found", ar: "لم يتم العثور على المستخدم" }));

    await logActivity({
      madrasa_id: madrasaId,
      user_id: actingUserId,
      action: "UPDATE",
      entity: USER_ACTIVITY_ENTITY,
      entity_id: id,
      details: `ইউজার আইডি ${id} হালনাগাদ করা হয়েছে`,
    });
  }

  /** Lets a Muhtamim/privileged staff reset a colleague's password without
   * needing their current one - the self-service change-password flow
   * requires the current password, which is useless if the staff member is
   * simply locked out or has forgotten it. */
  async adminResetPassword(
    madrasaId: number,
    actingUserId: number,
    id: number,
    dto: ResetPasswordRequestDto,
  ) {
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestError(t({ bn: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে", en: "Password must be at least 6 characters", ar: "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل" }));
    }

    const existing = await this.repository.findByIdForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found", ar: "لم يتم العثور على المستخدم" }));
    if (isMuhtamimRole(existing.role?.keyName || "")) {
      throw new ForbiddenError(
        t({ bn: "ডিফল্ট প্রতিষ্ঠান প্রধানের অ্যাকাউন্টের পাসওয়ার্ড এখান থেকে রিসেট করা যাবে না।", en: "The default institution head account's password cannot be reset here.", ar: "لا يمكن إعادة تعيين كلمة مرور حساب رئيس المؤسسة الافتراضي من هنا." }),
      );
    }

    const passwordHash = await hashPassword(dto.password);
    const result = await this.repository.updatePasswordHash(id, madrasaId, passwordHash);
    if (!result.count) throw new NotFoundError(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found", ar: "لم يتم العثور على المستخدم" }));

    await logActivity({
      madrasa_id: madrasaId,
      user_id: actingUserId,
      action: "UPDATE",
      entity: USER_ACTIVITY_ENTITY,
      entity_id: id,
      details: `অ্যাডমিন কর্তৃক ইউজার আইডি ${id}-এর পাসওয়ার্ড রিসেট করা হয়েছে`,
    });
  }

  /** Clears the failed-login lockout (see MAX_FAILED_LOGIN_ATTEMPTS in
   * auth.constants.ts) so a locked-out staff member can log in again
   * immediately, instead of waiting out the 15-minute cooldown. */
  async adminUnlockAccount(madrasaId: number, actingUserId: number, id: number) {
    const existing = await this.repository.findByIdForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found", ar: "لم يتم العثور على المستخدم" }));

    const result = await this.repository.resetLockAndAttempts(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found", ar: "لم يتم العثور على المستخدم" }));

    await logActivity({
      madrasa_id: madrasaId,
      user_id: actingUserId,
      action: "UPDATE",
      entity: USER_ACTIVITY_ENTITY,
      entity_id: id,
      details: `অ্যাডমিন কর্তৃক ইউজার আইডি ${id}-এর অ্যাকাউন্ট আনলক করা হয়েছে`,
    });
  }
}

export const userService = new UserService();
