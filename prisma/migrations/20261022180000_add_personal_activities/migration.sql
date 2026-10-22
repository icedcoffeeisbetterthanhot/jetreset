-- CreateTable
CREATE TABLE "PersonalActivity" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "notes" VARCHAR(500),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timeZone" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalActivity_tripId_startsAt_idx" ON "PersonalActivity"("tripId", "startsAt");

-- AddForeignKey
ALTER TABLE "PersonalActivity" ADD CONSTRAINT "PersonalActivity_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Personal activities must end after they start (also validated by the service).
ALTER TABLE "PersonalActivity" ADD CONSTRAINT "PersonalActivity_endsAt_after_startsAt" CHECK ("endsAt" > "startsAt");
