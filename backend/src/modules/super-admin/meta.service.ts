import { metaRepository, MetaRepository } from "./meta.repository";

export class MetaService {
  constructor(private readonly repository: MetaRepository = metaRepository) {}

  async listDivisions() {
    const rows = await this.repository.findDivisions();
    return rows.map((r) => ({ id: r.id, key_name: r.keyName, name: r.name, label: r.nameBn }));
  }

  async listModules() {
    const rows = await this.repository.findActiveModules();
    return rows.map((r) => ({
      id: r.id,
      key_name: r.keyName,
      name: r.name,
      label: r.nameBn,
      group_name: r.groupName,
    }));
  }

  async listClasses(divisionId?: number) {
    const rows = await this.repository.findClasses(divisionId);
    return rows.map((r) => ({ id: r.id, name: r.name, label: r.nameBn, division_id: r.divisionId }));
  }

  async listBooks(classId?: number) {
    const rows = await this.repository.findBooks(classId);
    return rows.map((r) => ({ id: r.id, name: r.name, label: r.nameBn, class_id: r.classId }));
  }
}

export const metaService = new MetaService();
