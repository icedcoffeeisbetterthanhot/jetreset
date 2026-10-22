-- CreateEnum
CREATE TYPE "JourneyLeg" AS ENUM ('outbound', 'return');

-- DropIndex
DROP INDEX "FlightSegment_tripId_scheduledDepartureAt_idx";

-- DropIndex
DROP INDEX "RecoveryPlan_tripId_key";

-- AlterTable
ALTER TABLE "FlightSegment" ADD COLUMN     "leg" "JourneyLeg" NOT NULL DEFAULT 'outbound';

-- AlterTable
ALTER TABLE "RecoveryPlan" ADD COLUMN     "leg" "JourneyLeg" NOT NULL DEFAULT 'outbound';

-- CreateIndex
CREATE INDEX "FlightSegment_tripId_leg_scheduledDepartureAt_idx" ON "FlightSegment"("tripId", "leg", "scheduledDepartureAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryPlan_tripId_leg_key" ON "RecoveryPlan"("tripId", "leg");

