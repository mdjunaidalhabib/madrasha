BEGIN;
ALTER TABLE "madrasas" ADD COLUMN "admin_domain" VARCHAR(190);
CREATE UNIQUE INDEX "madrasas_admin_domain_key" ON "madrasas"("admin_domain");
COMMIT;
