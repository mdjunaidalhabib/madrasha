import { comparePassword } from "../../shared/utils/hash.util";
import { generateToken } from "../../shared/utils/jwt.util";
import { NotFoundError, BadRequestError } from "../../shared/errors";
import { authRepository, AuthRepository } from "./auth.repository";
import { LoginCredentials, LoginResult, UnlockCredentials } from "./auth.types";
import {
  MUHTAMIM_ROLE_KEYS,
  TALIMAT_ROLE_KEYS,
  ACCOUNTANT_ROLE_KEYS,
  MUHTAMIM_BASELINE_PERMISSIONS,
  TALIMAT_BASELINE_PERMISSIONS,
  ACCOUNTANT_BASELINE_PERMISSIONS,
} from "./auth.constants";

const normalizeRoleKey = (value?: string | null) =>
  String(value || "")
    .trim()
    .toUpperCase();

export class AuthService {
  constructor(private readonly repository: AuthRepository = authRepository) {}

  async login({ email, password, madrasaId }: LoginCredentials): Promise<LoginResult> {
    const user = await this.repository.findActiveUserByEmail(email, madrasaId);
    if (!user) {
      throw new BadRequestError("Invalid credentials");
    }

    const [role, validPassword] = await Promise.all([
      this.repository.findRoleById(user.roleId),
      comparePassword(password, user.passwordHash),
    ]);
    if (!validPassword) {
      throw new BadRequestError("Invalid credentials");
    }

    const roleKey = normalizeRoleKey(role?.keyName || role?.nameBn);
    const [permissions, modules] = await Promise.all([
      this.resolvePermissions(user.roleId, roleKey),
      this.resolveEnabledModules(user.madrasaId),
    ]);

    const token = generateToken({
      id: user.id,
      madrasa_id: user.madrasaId,
      role_id: user.roleId,
      role: roleKey,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role_id: user.roleId,
        role_key: roleKey,
      },
      permissions,
      modules,
    };
  }

  async unlockScreen({ userId, madrasaId, password }: UnlockCredentials): Promise<void> {
    const user = await this.repository.findActiveUserById(userId, madrasaId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const validPassword = await comparePassword(password, user.passwordHash);
    if (!validPassword) {
      throw new BadRequestError("Invalid password");
    }
  }

  /** Loads DB-seeded role permissions and adds the baseline grants certain roles get implicitly. */
  private async resolvePermissions(roleId: number, roleKey: string): Promise<string[]> {
    const rolePermissions = await this.repository.findRolePermissionKeys(roleId);
    const dbPermissions = rolePermissions
      .map((rp) => rp.permission.keyName)
      .filter((k): k is string => Boolean(k));

    const permissionSet = new Set<string>(dbPermissions);

    if ((MUHTAMIM_ROLE_KEYS as readonly string[]).includes(roleKey)) {
      MUHTAMIM_BASELINE_PERMISSIONS.forEach((permission) => permissionSet.add(permission));
    }
    if ((TALIMAT_ROLE_KEYS as readonly string[]).includes(roleKey)) {
      TALIMAT_BASELINE_PERMISSIONS.forEach((permission) => permissionSet.add(permission));
    }
    if ((ACCOUNTANT_ROLE_KEYS as readonly string[]).includes(roleKey)) {
      ACCOUNTANT_BASELINE_PERMISSIONS.forEach((permission) => permissionSet.add(permission));
    }

    return Array.from(permissionSet);
  }

  private async resolveEnabledModules(madrasaId: number): Promise<string[]> {
    const madrasaModules = await this.repository.findActiveMadrasaModuleKeys(madrasaId);
    return madrasaModules.map((mm) => mm.module.keyName).filter((k): k is string => Boolean(k));
  }
}

export const authService = new AuthService();
