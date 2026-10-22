-- CreateEnum
CREATE TYPE "FlightStatusLookupResult" AS ENUM ('found', 'not_found');

-- CreateEnum
CREATE TYPE "FlightStatusCode" AS ENUM ('unknown', 'scheduled', 'delayed', 'departed', 'arrived', 'cancelled', 'possibly_cancelled', 'diverted');

-- AlterTable
ALTER TABLE "RecoveryPlan" ADD COLUMN     "adjustedAt" TIMESTAMP(3),
ADD COLUMN     "adjustmentNote" VARCHAR(1000),
ADD COLUMN     "flightStatusSignature" VARCHAR(64),
ADD COLUMN     "routeArrivalAt" TIMESTAMP(3),
ADD COLUMN     "routeDepartureAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FlightStatusSnapshot" (
    "id" SERIAL NOT NULL,
    "segmentId" INTEGER NOT NULL,
    "sourceSegmentUpdatedAt" TIMESTAMP(3) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "lookupResult" "FlightStatusLookupResult" NOT NULL,
    "status" "FlightStatusCode" NOT NULL DEFAULT 'unknown',
    "providerScheduledDepartureAt" TIMESTAMP(3),
    "estimatedDepartureAt" TIMESTAMP(3),
    "actualDepartureAt" TIMESTAMP(3),
    "providerScheduledArrivalAt" TIMESTAMP(3),
    "estimatedArrivalAt" TIMESTAMP(3),
    "actualArrivalAt" TIMESTAMP(3),
    "providerUpdatedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightStatusSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlightStatusSnapshot_segmentId_key" ON "FlightStatusSnapshot"("segmentId");

-- AddForeignKey
ALTER TABLE "FlightStatusSnapshot" ADD CONSTRAINT "FlightStatusSnapshot_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "FlightSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

