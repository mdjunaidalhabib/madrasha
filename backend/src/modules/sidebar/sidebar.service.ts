import { normalizeAppRole } from "../../shared/permissions";
import { sidebarRepository, SidebarRepository } from "./sidebar.repository";
import { SidebarChildItem, SidebarModuleItem } from "./sidebar.types";
import {
  SIDEBAR_MUHTAMIM_ROLE,
  SIDEBAR_SUPER_ADMIN_ROLE,
  SIDEBAR_TALIMAT_ROLE,
  SIDEBAR_ACCOUNTANT_ROLE,
  SIDEBAR_TALIMAT_MODULE_KEY,
  SIDEBAR_ACCOUNTS_MODULE_KEY,
} from "./sidebar.constants";

const isAllowed = (role: string, moduleKey: string) => {
  if (!role || role === SIDEBAR_MUHTAMIM_ROLE || role === SIDEBAR_SUPER_ADMIN_ROLE) return true;
  if (role === SIDEBAR_TALIMAT_ROLE) return moduleKey === SIDEBAR_TALIMAT_MODULE_KEY;
  if (role === SIDEBAR_ACCOUNTANT_ROLE) return moduleKey === SIDEBAR_ACCOUNTS_MODULE_KEY;
  return true;
};

export class SidebarService {
  constructor(private readonly repository: SidebarRepository = sidebarRepository) {}

  private async resolveRoleKey(roleId?: number): Promise<string> {
    if (!roleId) return "";
    const role = await this.repository.findRoleById(roleId);
    return normalizeAppRole(role?.keyName || role?.nameBn || "");
  }

  async getSidebarTree(madrasaId: number, roleId?: number): Promise<SidebarModuleItem[]> {
    const roleKey = await this.resolveRoleKey(roleId);

    const madrasaModules = await this.repository.findActiveMadrasaModules(madrasaId);
    const modules = madrasaModules.map((mm) => mm.module);

    const moduleIds = modules.map((m) => m.id);
    const features = await this.repository.findFeaturesByModuleIds(moduleIds);

    return modules.map((mod) => {
      const disabled = !isAllowed(roleKey, mod.keyName || "");
      const children: SidebarChildItem[] = features
        .filter((f) => f.moduleId === mod.id)
        .map((f) => ({
          id: f.id,
          key: f.keyName,
          label: f.nameBn,
          sort_order: f.sortOrder,
          disabled,
        }));

      return {
        id: mod.id,
        key: mod.keyName,
        label: mod.nameBn,
        group: mod.groupName,
        sort_order: mod.sortOrder,
        disabled,
        children,
      };
    });
  }
}

export const sidebarService = new SidebarService();
