import type { TravelMetricsPeriod } from "@lib/travelMetrics";
import { calculateTravelMetrics } from "@lib/travelMetrics";
import { findAirport } from "@server/airportService";
import { prisma } from "@server/db";
import { getTripOwnerWhere } from "@server/tripService";

export async function getTravelMetrics(period: TravelMetricsPeriod, now = new Date()) {
  const owner = await getTripOwnerWhere();
  const trips = await prisma.trip.findMany({
    where: owner,
    select: {
      id: true,
      name: true,
      flightSegments: {
        select: {
          id: true,
          tripId: true,
          leg: true,
          departureAirportCode: true,
          departureAirportName: true,
          departureAirportCity: true,
          departureCountryCode: true,
          arrivalAirportCode: true,
          arrivalAirportName: true,
          arrivalAirportCity: true,
          arrivalCountryCode: true,
          scheduledDepartureAt: true,
          scheduledArrivalAt: true,
          updatedAt: true,
          statusSnapshot: {
            select: {
              sourceSegmentUpdatedAt: true,
              status: true,
              actualDepartureAt: true,
              actualArrivalAt: true,
            },
          },
        },
      },
    },
  });

  return calculateTravelMetrics(trips, period, now, findAirport);
}
