import { segmentsForLeg, type JourneyLeg } from "@lib/journeyLeg";
import { calendarDaysBetween, getLocalDate } from "@lib/recoveryDashboard";

export interface TimelineFlight {
  leg: JourneyLeg;
  departureTimeZone: string;
  arrivalTimeZone: string;
  scheduledDepartureAt: Date;
  scheduledArrivalAt: Date;
}

export interface TimelineTrip<F extends TimelineFlight> {
  departureAt: Date;
  arrivalAt: Date;
  destinationTimeZone: string;
  flightSegments: F[];
}

export type TripStatus = "upcoming" | "in-progress" | "past";

export interface TripTimeline<F extends TimelineFlight> {
  outboundFlights: F[];
  returnFlights: F[];
  /** When the trip begins: the first outbound flight, or the trip's planned departure. */
  startsAt: Date;
  /** When the trip ends: the last return flight's arrival, or the outbound arrival. */
  endsAt: Date;
  /** Local nights at the destination between arriving and the return flight, if known. */
  stayNights: number | null;
  status: TripStatus;
}

function byDeparture<F extends TimelineFlight>(flights: F[]): F[] {
  return [...flights].sort(
    (first, second) => first.scheduledDepartureAt.getTime() - second.scheduledDepartureAt.getTime(),
  );
}

export function getTripTimeline<F extends TimelineFlight>(
  trip: TimelineTrip<F>,
  now: Date,
): TripTimeline<F> {
  const outboundFlights = byDeparture(segmentsForLeg(trip.flightSegments, "outbound"));
  const returnFlights = byDeparture(segmentsForLeg(trip.flightSegments, "return"));
  const lastOutbound = outboundFlights[outboundFlights.length - 1];
  const firstReturn = returnFlights[0];
  const lastReturn = returnFlights[returnFlights.length - 1];

  const startsAt = outboundFlights[0]?.scheduledDepartureAt ?? trip.departureAt;
  const outboundArrivalAt = lastOutbound?.scheduledArrivalAt ?? trip.arrivalAt;
  const endsAt = lastReturn?.scheduledArrivalAt ?? outboundArrivalAt;
  const destinationTimeZone = lastOutbound?.arrivalTimeZone ?? trip.destinationTimeZone;
  const stayNights = firstReturn
    ? Math.max(
        0,
        calendarDaysBetween(
          getLocalDate(outboundArrivalAt, destinationTimeZone),
          getLocalDate(firstReturn.scheduledDepartureAt, firstReturn.departureTimeZone),
        ),
      )
    : null;

  return {
    outboundFlights,
    returnFlights,
    startsAt,
    endsAt,
    stayNights,
    status:
      now.getTime() < startsAt.getTime()
        ? "upcoming"
        : now.getTime() <= endsAt.getTime()
          ? "in-progress"
          : "past",
  };
}

/** Days between a flight's local departure date and its local arrival date (e.g. +1 overnight). */
export function arrivalDayOffset(flight: TimelineFlight): number {
  return calendarDaysBetween(
    getLocalDate(flight.scheduledDepartureAt, flight.departureTimeZone),
    getLocalDate(flight.scheduledArrivalAt, flight.arrivalTimeZone),
  );
}
