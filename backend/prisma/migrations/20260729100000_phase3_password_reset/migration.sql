-- Phase 3: Forgot / Reset Password

CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(100) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "idx_password_reset_user" ON "password_reset_tokens"("user_id");
CREATE INDEX "idx_password_reset_expires" ON "password_reset_tokens"("expires_at");

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_madrasa_id_fkey"
  FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
