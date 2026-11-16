CREATE TABLE "website_donation_settings" (
  "madrasa_id" INTEGER NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "website_donation_settings_pkey" PRIMARY KEY ("madrasa_id"),
  CONSTRAINT "website_donation_settings_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
