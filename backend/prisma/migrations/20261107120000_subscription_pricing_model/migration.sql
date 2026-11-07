-- Preserve existing plan IDs, subscriptions and negotiated prices.
ALTER TABLE "plans" ALTER COLUMN "user_limit" DROP NOT NULL;
ALTER TABLE "plans"
 ADD COLUMN "renewal_price" DECIMAL(10,2),
 ADD COLUMN "extra_student_price_first" DECIMAL(10,2),
 ADD COLUMN "extra_student_price_renewal" DECIMAL(10,2),
 ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "name_bn" TEXT,
 ADD COLUMN "tagline" TEXT,
 ADD COLUMN "tagline_bn" TEXT,
 ADD COLUMN "show_on_landing" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN "is_featured" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "accent_color" TEXT;
CREATE TYPE "SubscriptionCycle" AS ENUM ('FIRST', 'RENEWAL');
ALTER TABLE "madrasa_subscriptions"
 ADD COLUMN "cycle" "SubscriptionCycle" NOT NULL DEFAULT 'FIRST',
 ADD COLUMN "price_paid" DECIMAL(10,2),
 ADD COLUMN "student_limit_at_start" INTEGER,
 ADD COLUMN "cancelled_at" TIMESTAMP(3),
 ADD COLUMN "refunded_at" TIMESTAMP(3),
 ADD COLUMN "refund_amount" DECIMAL(10,2);
