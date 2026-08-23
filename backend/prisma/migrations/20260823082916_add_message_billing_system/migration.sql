-- CreateEnum
CREATE TYPE "MessagePackageType" AS ENUM ('PACKAGE', 'RECHARGE');

-- CreateEnum
CREATE TYPE "MessageSubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SmsEncoding" AS ENUM ('GSM_7', 'UNICODE');

-- CreateEnum
CREATE TYPE "MessageUsageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BillingTransactionType" AS ENUM ('PACKAGE_PURCHASE', 'RECHARGE', 'RENEWAL', 'USAGE', 'REFUND', 'MANUAL_CREDIT', 'MANUAL_DEDUCTION');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "message_packages" (
    "id" SERIAL NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" "MessagePackageType" NOT NULL DEFAULT 'PACKAGE',
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'BDT',
    "credit" INTEGER NOT NULL,
    "validity_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_subscriptions" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "package_id" INTEGER,
    "start_date" TIMESTAMP(3) NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "status" "MessageSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "purchased_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_credit" INTEGER NOT NULL DEFAULT 0,
    "used_credit" INTEGER NOT NULL DEFAULT 0,
    "remaining_credit" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_usage_logs" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" VARCHAR(150) NOT NULL,
    "encoding" "SmsEncoding",
    "character_count" INTEGER,
    "segment_count" INTEGER NOT NULL DEFAULT 1,
    "price_per_unit" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "credit_used" INTEGER NOT NULL DEFAULT 1,
    "provider" VARCHAR(50),
    "provider_message_id" VARCHAR(150),
    "status" "MessageUsageStatus" NOT NULL DEFAULT 'PENDING',
    "failure_reason" VARCHAR(500),
    "notification_log_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_transactions" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" "BillingTransactionType" NOT NULL,
    "package_id" INTEGER,
    "amount" DECIMAL(10,2),
    "credit_delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "note" VARCHAR(300),
    "performed_by_id" INTEGER,
    "performed_by_type" VARCHAR(20),
    "usage_log_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_message_pricing" (
    "id" SERIAL NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "selling_price" DECIMAL(10,4) NOT NULL DEFAULT 0.5,
    "provider_cost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "low_credit_threshold" INTEGER NOT NULL DEFAULT 100,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_message_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "madrasa_message_pricing" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "selling_price" DECIMAL(10,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "madrasa_message_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_purchase_requests" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "package_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method_label" VARCHAR(150),
    "transaction_ref" VARCHAR(120),
    "note" VARCHAR(300),
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" INTEGER,
    "reviewed_by_id" INTEGER,
    "review_note" VARCHAR(300),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_message_package_channel_active" ON "message_packages"("channel", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_message_subscription_status" ON "message_subscriptions"("madrasa_id", "channel", "status");

-- CreateIndex
CREATE INDEX "idx_message_subscription_expiry" ON "message_subscriptions"("expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_message_subscription_madrasa_channel" ON "message_subscriptions"("madrasa_id", "channel");

-- CreateIndex
CREATE INDEX "idx_message_usage_madrasa_channel_created" ON "message_usage_logs"("madrasa_id", "channel", "created_at");

-- CreateIndex
CREATE INDEX "idx_message_usage_provider_msgid" ON "message_usage_logs"("provider_message_id");

-- CreateIndex
CREATE INDEX "idx_billing_tx_madrasa_channel_created" ON "billing_transactions"("madrasa_id", "channel", "created_at");

-- CreateIndex
CREATE INDEX "idx_billing_tx_type" ON "billing_transactions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "platform_message_pricing_channel_key" ON "platform_message_pricing"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_madrasa_message_pricing" ON "madrasa_message_pricing"("madrasa_id", "channel");

-- CreateIndex
CREATE INDEX "idx_purchase_request_madrasa_status" ON "message_purchase_requests"("madrasa_id", "status");

-- CreateIndex
CREATE INDEX "idx_purchase_request_status_created" ON "message_purchase_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "message_subscriptions" ADD CONSTRAINT "message_subscriptions_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_subscriptions" ADD CONSTRAINT "message_subscriptions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "message_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_usage_logs" ADD CONSTRAINT "message_usage_logs_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "message_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "madrasa_message_pricing" ADD CONSTRAINT "madrasa_message_pricing_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_purchase_requests" ADD CONSTRAINT "message_purchase_requests_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_purchase_requests" ADD CONSTRAINT "message_purchase_requests_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "message_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
