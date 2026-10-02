-- One active session per device: stable device id on refresh tokens.
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "device_id" VARCHAR(64);
CREATE INDEX IF NOT EXISTS "idx_refresh_token_user_device" ON "refresh_tokens"("user_id", "device_id");
