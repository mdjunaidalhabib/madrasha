import { comparePassword } from "../../shared/utils/hash.util";
import { generateToken } from "../../shared/utils/jwt.util";
import { BadRequestError, ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { superAdminAuthRepository, SuperAdminAuthRepository } from "./superadmin.auth.repository";
import { SuperAdminLoginRequestDto } from "./superadmin.auth.dto";
import { SuperAdminLoginResult } from "./superadmin.auth.types";

export class SuperAdminAuthService {
  constructor(private readonly repository: SuperAdminAuthRepository = superAdminAuthRepository) {}

  async login(dto: SuperAdminLoginRequestDto): Promise<SuperAdminLoginResult> {
    if (!dto.email || !dto.password) {
      throw new BadRequestError("Email and password required");
    }

    const admin = await this.repository.findActiveByEmail(dto.email);
    if (!admin) throw new BadRequestError("Invalid credentials");

    if (!admin.passwordHash) {
      throw new ApiError("Super admin password is not configured", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const valid = await comparePassword(dto.password, admin.passwordHash);
    if (!valid) throw new BadRequestError("Invalid credentials");

    const token = generateToken({ id: admin.id, role: "super_admin" });

    return {
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email },
    };
  }
}

export const superAdminAuthService = new SuperAdminAuthService();
