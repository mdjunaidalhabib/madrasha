import { prisma } from "./src/shared/database/prisma";
import { sidebarService } from "./src/modules/sidebar/sidebar.service";

(async () => {
  const madrasa = await prisma.madrasa.findUnique({ where: { slug: "ahmadiya" } });
  if (!madrasa) throw new Error("no madrasa");
  const user = await prisma.user.findFirst({ where: { madrasaId: madrasa.id }, orderBy: { id: "asc" } });
  console.log("user:", user?.id, user?.email, user?.roleId);
  const tree = await sidebarService.getSidebarTree(madrasa.id, user?.roleId);
  const studentsModule = tree.find((m) => m.key === "students");
  console.log(JSON.stringify(studentsModule, null, 2));
  await prisma.$disconnect();
})();
