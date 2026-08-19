-- CreateTable
CREATE TABLE "platform_sms_configs" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(100),
    "api_url" VARCHAR(300) NOT NULL,
    "api_key_enc" TEXT NOT NULL,
    "sender_id" VARCHAR(50),
    "http_method" VARCHAR(10) NOT NULL DEFAULT 'GET',
    "param_api_key" VARCHAR(50) NOT NULL DEFAULT 'api_key',
    "param_sender_id" VARCHAR(50) NOT NULL DEFAULT 'senderid',
    "param_number" VARCHAR(50) NOT NULL DEFAULT 'number',
    "param_message" VARCHAR(50) NOT NULL DEFAULT 'message',
    "balance_url" VARCHAR(300),
    "balance_http_method" VARCHAR(10) NOT NULL DEFAULT 'GET',
    "balance_param_api_key" VARCHAR(50) NOT NULL DEFAULT 'api_key',
    "balance_response_path" VARCHAR(100) NOT NULL DEFAULT 'balance',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_sms_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_email_configs" (
    "id" SERIAL NOT NULL,
    "host" VARCHAR(200) NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "user" VARCHAR(200) NOT NULL,
    "pass_enc" TEXT NOT NULL,
    "from_name" VARCHAR(150) NOT NULL DEFAULT 'Madrasa Management',
    "from_email" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_email_configs_pkey" PRIMARY KEY ("id")
);
