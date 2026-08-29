import { comparePassword } from "../../shared/utils/hash.util";
import { generateToken } from "../../shared/utils/jwt.util";
import { BadRequestError, ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { superAdminAuthRepository, SuperAdminAuthRepository } from "./superadmin.auth.repository";
import { SuperAdminLoginRequestDto } from "./superadmin.auth.dto";
import { SuperAdminLoginResult } from "./superadmin.auth.types";

// Explicit override: generateToken()'s default expiresIn is now the short
// tenant-admin ACCESS token lifetime (see env.jwtExpiresIn / RefreshToken
// model) - super admin has no refresh-token flow, so it must keep its own
// long-lived expiry independent of that default.
const SUPER_ADMIN_TOKEN_EXPIRY = "7d";

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

    const token = generateToken({ id: admin.id, role: "super_admin" }, SUPER_ADMIN_TOKEN_EXPIRY);

    return {
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email },
    };
  }
}

export const superAdminAuthService = new SuperAdminAuthService();
