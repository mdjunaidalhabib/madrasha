import { hashPassword } from "../../shared/utils/hash.util";
import {
  superAdminAccountRepository,
  SuperAdminAccountRepository,
} from "./superadmin-account.repository";
import {
  CannotDeactivateSelfError,
  LastActiveSuperAdminError,
  SuperAdminEmailConflictError,
  SuperAdminEmailRequiredError,
  SuperAdminNameRequiredError,
  SuperAdminNotFoundError,
  SuperAdminPasswordTooShortError,
} from "./superadmin.types";

export class SuperAdminAccountService {
  constructor(private readonly repository: SuperAdminAccountRepository = superAdminAccountRepository) {}

  async list() {
    const rows = await this.repository.findAllActive();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      is_active: r.isActive,
      created_at: r.createdAt,
    }));
  }

  async create(dto: { name?: string; email?: string; password?: string }) {
    const name = (dto.name || "").trim();
    const email = (dto.email || "").trim();
    const password = dto.password || "";

    if (!name) throw new SuperAdminNameRequiredError();
    if (!email) throw new SuperAdminEmailRequiredError();
    if (password.length < 6) throw new SuperAdminPasswordTooShortError();

    const existing = await this.repository.findByEmail(email);
    if (existing) throw new SuperAdminEmailConflictError();

    const passwordHash = await hashPassword(password);
    const created = await this.repository.create({ name, email, passwordHash, isActive: 1 });

    return { id: created.id };
  }

  async deactivate(id: number, requesterId: number) {
    if (id === requesterId) throw new CannotDeactivateSelfError();

    const admin = await this.repository.findById(id);
    if (!admin) throw new SuperAdminNotFoundError();

    if (admin.isActive) {
      const activeCount = await this.repository.countActive();
      if (activeCount <= 1) throw new LastActiveSuperAdminError();
    }

    await this.repository.setActive(id, 0);
  }

  async reactivate(id: number) {
    const admin = await this.repository.findById(id);
    if (!admin) throw new SuperAdminNotFoundError();

    await this.repository.setActive(id, 1);
  }
}

export const superAdminAccountService = new SuperAdminAccountService();
