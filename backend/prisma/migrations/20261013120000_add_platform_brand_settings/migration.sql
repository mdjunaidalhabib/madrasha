-- Platform-wide brand assets of the main admin panel (favicon + PWA icon source).
-- Separate from any madrasa's Branding Settings; no row / NULL logo => no icon.
CREATE TABLE "platform_brand_settings" (
    "id" SERIAL NOT NULL,
    "admin_logo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_brand_settings_pkey" PRIMARY KEY ("id")
);
