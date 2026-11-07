CREATE TYPE "DomainRegistrationOwner" AS ENUM ('institution', 'platform');
CREATE TABLE "madrasa_domain_subscriptions" (
 "id" SERIAL PRIMARY KEY,
 "madrasa_id" INTEGER NOT NULL,
 "domain" VARCHAR(190) NOT NULL,
 "amount_paid" DECIMAL(10,2) NOT NULL,
 "start_date" DATE NOT NULL,
 "end_date" DATE NOT NULL,
 "is_active" INTEGER NOT NULL DEFAULT 1,
 "registered_in_name_of" "DomainRegistrationOwner" NOT NULL DEFAULT 'institution',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "madrasa_domain_subscriptions_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_domain_subscription_madrasa" ON "madrasa_domain_subscriptions"("madrasa_id", "end_date");
