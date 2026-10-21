import { getTimeZoneOffsetMinutes } from "@lib/timezone";

export interface ItinerarySegment {
  id: number;
  departureAirportCode: string;
  departureTimeZone: string;
  scheduledDepartureAt: string | Date;
  arrivalAirportCode: string;
  arrivalTimeZone: string;
  scheduledArrivalAt: string | Date;
}

export interface ItinerarySummary<T extends ItinerarySegment = ItinerarySegment> {
  segments: T[];
  flightMinutes: number;
  elapsedMinutes: number;
  layoverMinutes: number;
  warnings: string[];
}

export function calculateItinerary<T extends ItinerarySegment>(segments: T[]): ItinerarySummary<T> {
  const orderedSegments = [...segments].sort(
    (first, second) =>
      new Date(first.scheduledDepartureAt).getTime() -
      new Date(second.scheduledDepartureAt).getTime(),
  );
  const warnings: string[] = [];
  const flightMinutes = orderedSegments.reduce(
    (total, segment) =>
      total +
      Math.max(
        0,
        (new Date(segment.scheduledArrivalAt).getTime() -
          new Date(segment.scheduledDepartureAt).getTime()) /
          60000,
      ),
    0,
  );

  let layoverMinutes = 0;
  for (let index = 1; index < orderedSegments.length; index += 1) {
    const previous = orderedSegments[index - 1];
    const current = orderedSegments[index];
    const connectionMinutes =
      (new Date(current.scheduledDepartureAt).getTime() -
        new Date(previous.scheduledArrivalAt).getTime()) /
      60000;

    if (connectionMinutes < 0) {
      warnings.push(
        `${previous.arrivalAirportCode}–${current.departureAirportCode}: flights overlap by ${Math.round(
          Math.abs(connectionMinutes),
        )} minutes.`,
      );
    }
    if (previous.arrivalAirportCode !== current.departureAirportCode) {
      warnings.push(
        `Connection mismatch: the previous flight arrives at ${previous.arrivalAirportCode}, but the next departs from ${current.departureAirportCode}.`,
      );
    } else if (connectionMinutes >= 0) {
      layoverMinutes += connectionMinutes;
    }
  }

  const elapsedMinutes =
    orderedSegments.length === 0
      ? 0
      : Math.max(
          0,
          (new Date(orderedSegments[orderedSegments.length - 1].scheduledArrivalAt).getTime() -
            new Date(orderedSegments[0].scheduledDepartureAt).getTime()) /
            60000,
        );

  return { segments: orderedSegments, flightMinutes, elapsedMinutes, layoverMinutes, warnings };
}

export function getTimeZoneChangeMinutes(segment: ItinerarySegment): number {
  const departureOffset = getTimeZoneOffsetMinutes(
    new Date(segment.scheduledDepartureAt),
    segment.departureTimeZone,
  );
  const arrivalOffset = getTimeZoneOffsetMinutes(
    new Date(segment.scheduledArrivalAt),
    segment.arrivalTimeZone,
  );

  return arrivalOffset - departureOffset;
}
