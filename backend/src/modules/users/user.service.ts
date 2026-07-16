import { hashPassword } from "../../shared/utils/hash.util";
import { logActivity } from "../../shared/utils/activity.util";
import { BadRequestError } from "../../shared/errors";
import { userRepository, UserRepository } from "./user.repository";
import { CreateUserRequestDto } from "./user.dto";
import { USER_ACTIVITY_ENTITY, USER_LIMIT_REACHED_MESSAGE } from "./user.constants";

export class UserService {
  constructor(private readonly repository: UserRepository = userRepository) {}

  listUsers(madrasaId: number) {
    return this.repository.findManyForTenant(madrasaId);
  }

  async createUser(madrasaId: number, actingUserId: number, dto: CreateUserRequestDto) {
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
      details: `User ${dto.name} created`,
    });

    return created.id;
  }

  async deleteUser(madrasaId: number, actingUserId: number, id: number) {
    await this.repository.deleteManyForTenant(id, madrasaId);

    await logActivity({
      madrasa_id: madrasaId,
      user_id: actingUserId,
      action: "DELETE",
      entity: USER_ACTIVITY_ENTITY,
      entity_id: id,
      details: `User ${id} deleted`,
    });
  }
}

export const userService = new UserService();
