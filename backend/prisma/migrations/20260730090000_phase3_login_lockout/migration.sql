-- Phase 3: Security Optimization - account lockout after repeated failed logins

ALTER TABLE "users"
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMP(3);
