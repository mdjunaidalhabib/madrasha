import { hashPassword } from "../../shared/utils/hash.util";
import { logActivity } from "../../shared/utils/activity.util";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { isMuhtamimRole } from "../../shared/permissions";
import { userRepository, UserRepository } from "./user.repository";
import { CreateUserRequestDto, ResetPasswordRequestDto, UpdateUserRequestDto } from "./user.dto";
import { USER_ACTIVITY_ENTITY, USER_LIMIT_REACHED_MESSAGE } from "./user.constants";
import { DefaultUserProtectedError } from "./user.types";

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
      throw new BadRequestError("Password must be at least 6 characters");
    }

    const role = await this.repository.findRoleForTenant(dto.role_id, madrasaId);
    if (!role) throw new BadRequestError("Selected role does not belong to this madrasa");
    if (isMuhtamimRole(role.keyName || "")) {
      throw new ForbiddenError(
        "এখান থেকে মুহতামিম রোলের ইউজার যোগ করা যাবে না — প্রতিটি মাদ্রাসার একজনই ডিফল্ট মুহতামিম থাকতে পারেন।",
      );
    }

    const madrasa = await this.repository.findMadrasaUserLimit(madrasaId);
    const userLimit = madrasa?.userLimit ?? 0;

    const total = await this.repository.countActiveForTenant(madrasaId);
    if (total >= userLimit) {
      throw new BadRequestError(USER_LIMIT_REACHED_MESSAGE);
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
    if (!user) throw new NotFoundError("User not found");
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
    if (!existing) throw new NotFoundError("User not found");
    const existingIsMuhtamim = isMuhtamimRole(existing.role?.keyName || "");

    // The default Muhtamim account's role/active status is fixed from this
    // tenant-facing page - only Super Admin (a separate, platform-level
    // panel) may change it.
    if (existingIsMuhtamim && (dto.role_id !== undefined || dto.is_active !== undefined)) {
      throw new ForbiddenError(
        "ডিফল্ট মুহতামিম অ্যাকাউন্টের রোল বা স্ট্যাটাস এখান থেকে পরিবর্তন করা যাবে না — এটি শুধুমাত্র সুপার অ্যাডমিন করতে পারবেন।",
      );
    }

    const data: Record<string, unknown> = {};

    if (dto.role_id !== undefined) {
      const role = await this.repository.findRoleForTenant(dto.role_id, madrasaId);
      if (!role) throw new BadRequestError("Selected role does not belong to this madrasa");
      if (isMuhtamimRole(role.keyName || "")) {
        throw new ForbiddenError(
          "এখান থেকে কাউকে মুহতামিম রোল দেওয়া যাবে না — প্রতিটি মাদ্রাসার একজনই ডিফল্ট মুহতামিম থাকতে পারেন।",
        );
      }
      data.roleId = dto.role_id;
    }
    if (dto.is_active !== undefined) data.isActive = dto.is_active ? 1 : 0;
    if (dto.name !== undefined && dto.name.trim()) data.name = dto.name.trim();
    if (dto.mobile !== undefined) data.mobile = dto.mobile.trim() || null;
    if (dto.photo_url !== undefined) data.photoUrl = dto.photo_url.trim() || null;

    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    const result = await this.repository.updateManyForTenant(id, madrasaId, data as any);
    if (!result.count) throw new NotFoundError("User not found");

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
      throw new BadRequestError("Password must be at least 6 characters");
    }

    const existing = await this.repository.findByIdForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError("User not found");
    if (isMuhtamimRole(existing.role?.keyName || "")) {
      throw new ForbiddenError(
        "ডিফল্ট মুহতামিম অ্যাকাউন্টের পাসওয়ার্ড এখান থেকে রিসেট করা যাবে না।",
      );
    }

    const passwordHash = await hashPassword(dto.password);
    const result = await this.repository.updatePasswordHash(id, madrasaId, passwordHash);
    if (!result.count) throw new NotFoundError("User not found");

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
    if (!existing) throw new NotFoundError("User not found");

    const result = await this.repository.resetLockAndAttempts(id, madrasaId);
    if (!result.count) throw new NotFoundError("User not found");

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
