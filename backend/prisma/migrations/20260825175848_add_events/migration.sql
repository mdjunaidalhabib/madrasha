-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MEETING', 'NOTICE', 'HOLIDAY', 'OTHER');

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "madrasa_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "type" "EventType" NOT NULL DEFAULT 'OTHER',
    "event_date" DATE NOT NULL,
    "start_time" VARCHAR(10),
    "end_time" VARCHAR(10),
    "description" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_events_madrasa_date" ON "events"("madrasa_id", "event_date");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_madrasa_id_fkey" FOREIGN KEY ("madrasa_id") REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
