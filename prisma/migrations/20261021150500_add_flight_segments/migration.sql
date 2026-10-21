CREATE TABLE "FlightSegment" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "airline" VARCHAR(120),
    "flightNumber" VARCHAR(32),
    "departureAirportCode" VARCHAR(3) NOT NULL,
    "departureAirportName" VARCHAR(200) NOT NULL,
    "departureAirportCity" VARCHAR(120),
    "departureCountryCode" VARCHAR(2),
    "departureTimeZone" VARCHAR(100) NOT NULL,
    "arrivalAirportCode" VARCHAR(3) NOT NULL,
    "arrivalAirportName" VARCHAR(200) NOT NULL,
    "arrivalAirportCity" VARCHAR(120),
    "arrivalCountryCode" VARCHAR(2),
    "arrivalTimeZone" VARCHAR(100) NOT NULL,
    "scheduledDepartureAt" TIMESTAMP(3) NOT NULL,
    "scheduledArrivalAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightSegment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FlightSegment_tripId_scheduledDepartureAt_idx"
ON "FlightSegment"("tripId", "scheduledDepartureAt");

ALTER TABLE "FlightSegment"
ADD CONSTRAINT "FlightSegment_tripId_fkey"
FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
