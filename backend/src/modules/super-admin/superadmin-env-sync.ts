import bcrypt from "bcryptjs";

type SeedAdmin = { id: number; name: string; email: string; passwordHash: string };
type AdminData = { name: string; email: string; passwordHash: string };
type AdminStore = {
  findFirst(args: { orderBy: Array<{ createdAt: "asc" } | { id: "asc" }> }): Promise<SeedAdmin | null>;
  findUnique(args: { where: { email: string } }): Promise<SeedAdmin | null>;
  create(args: { data: AdminData & { isActive: number } }): Promise<SeedAdmin>;
  update(args: { where: { id: number }; data: Partial<AdminData> }): Promise<SeedAdmin>;
};

/** The oldest account is the original platform owner. Keep its ID when changing
 * its email; never edit or merge later super-admin accounts. Blank env values
 * preserve existing fields. A fresh database needs all three credentials. */
export async function syncSuperAdminFromEnv(store: AdminStore, env: Record<string, string | undefined> = process.env) {
  const name = env.SUPER_ADMIN_NAME?.trim() || undefined;
  const email = env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || undefined;
  const password = env.SUPER_ADMIN_PASSWORD?.trim() || undefined;
  const existing = await store.findFirst({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });

  if (password && password.length < 8) throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters");
  if (!existing) {
    if (!name || !email || !password)
      throw new Error("No existing Super Admin. Set SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD before server startup.");
    const account = await store.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10), isActive: 1 } });
    return { account, status: "created" as const, changedFields: ["name", "email", "password"] };
  }

  const changes: Partial<AdminData> = {};
  if (name && name !== existing.name) changes.name = name;
  if (email && email !== existing.email) {
    const duplicate = await store.findUnique({ where: { email } });
    if (duplicate && duplicate.id !== existing.id)
      throw new Error("SUPER_ADMIN_EMAIL belongs to another Super Admin. Original account was not changed.");
    changes.email = email;
  }
  if (password && !(await bcrypt.compare(password, existing.passwordHash)))
    changes.passwordHash = await bcrypt.hash(password, 10);

  if (!Object.keys(changes).length)
    return { account: existing, status: "unchanged" as const, changedFields: [] };
  const account = await store.update({ where: { id: existing.id }, data: changes });
  return { account, status: "updated" as const,
    changedFields: Object.keys(changes).map((key) => key === "passwordHash" ? "password" : key) };
}
