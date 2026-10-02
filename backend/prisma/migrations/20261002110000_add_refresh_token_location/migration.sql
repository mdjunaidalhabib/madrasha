-- Device list: where each session is logged in from, and when it was last used.
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(64);
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "city" VARCHAR(100);
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "country" VARCHAR(2);
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP(3);
