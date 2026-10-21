CREATE TYPE "RecoveryActivityType" AS ENUM (
    'sleep',
    'light',
    'meal',
    'hydration',
    'exercise',
    'caffeine'
);

CREATE TYPE "RecoveryDirection" AS ENUM ('east', 'west', 'none');

CREATE TABLE "RecoveryPlan" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "sourceTripUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceItineraryHash" VARCHAR(64) NOT NULL,
    "destinationTimeZone" VARCHAR(100) NOT NULL,
    "journeyDurationMinutes" INTEGER NOT NULL,
    "direction" "RecoveryDirection" NOT NULL,
    "timeZoneChangeMinutes" INTEGER NOT NULL,
    "estimatedTimeZonesCrossed" INTEGER NOT NULL,
    "recoveryDays" INTEGER NOT NULL,
    "targetBedtime" VARCHAR(5) NOT NULL,
    "targetWakeTime" VARCHAR(5) NOT NULL,
    "avoidCaffeine" BOOLEAN NOT NULL DEFAULT false,
    "preparationDaysAvailable" INTEGER NOT NULL DEFAULT 0,
    "assumptions" TEXT[] NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecoveryActivity" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "activityKey" VARCHAR(32) NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "type" "RecoveryActivityType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "guidance" VARCHAR(1000) NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "timeZone" VARCHAR(100) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecoveryPlan_tripId_key" ON "RecoveryPlan"("tripId");
CREATE UNIQUE INDEX "RecoveryActivity_planId_activityKey_key"
ON "RecoveryActivity"("planId", "activityKey");
CREATE INDEX "RecoveryActivity_planId_scheduledAt_idx"
ON "RecoveryActivity"("planId", "scheduledAt");

ALTER TABLE "RecoveryPlan"
ADD CONSTRAINT "RecoveryPlan_tripId_fkey"
FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecoveryActivity"
ADD CONSTRAINT "RecoveryActivity_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "RecoveryPlan"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
