import type { Airport } from "@server/airportService";

export const TRAVEL_METRICS_PERIODS = ["month", "six-months", "year"] as const;

export type TravelMetricsPeriod = (typeof TRAVEL_METRICS_PERIODS)[number];

export type TravelMetricsSegment = {
  id: number;
  tripId: number;
  leg: string;
  departureAirportCode: string;
  departureAirportName: string;
  departureAirportCity: string | null;
  departureCountryCode: string | null;
  arrivalAirportCode: string;
  arrivalAirportName: string;
  arrivalAirportCity: string | null;
  arrivalCountryCode: string | null;
  scheduledDepartureAt: Date;
  scheduledArrivalAt: Date;
  updatedAt: Date;
  statusSnapshot: {
    sourceSegmentUpdatedAt: Date;
    status: string;
    actualDepartureAt: Date | null;
    actualArrivalAt: Date | null;
  } | null;
};

export type TravelMetricsTrip = {
  id: number;
  name: string;
  flightSegments: TravelMetricsSegment[];
};

export type TravelMetricsFlight = {
  tripId: number;
  tripName: string;
  leg: string;
  departureAirportCode: string;
  departureAirportName: string;
  departureAirportCity: string | null;
  departureCountryCode: string | null;
  arrivalAirportCode: string;
  arrivalAirportName: string;
  arrivalAirportCity: string | null;
  arrivalCountryCode: string | null;
  departureAt: string;
  arrivalAt: string;
  timeBasis: "actual" | "scheduled estimate";
  airTimeMinutes: number;
  distanceKm: number | null;
};

export type TravelMetricsAirport = Omit<Airport, "latitude" | "longitude"> & {
  latitude: number;
  longitude: number;
  flightCount: number;
  trips: Array<{ id: number; name: string }>;
};

export type TravelMetricsMonth = {
  key: string;
  label: string;
  flights: number;
  distanceKm: number;
  distanceFlights: number;
  distanceMissingFlights: number;
  airTimeMinutes: number;
};

export type TravelMetricsReport = {
  period: TravelMetricsPeriod;
  periodLabel: string;
  start: Date;
  endExclusive: Date;
  generatedAt: Date;
  totals: {
    distanceKm: number;
    distanceFlights: number;
    distanceMissingFlights: number;
    airTimeMinutes: number;
    flights: number;
    verifiedFlights: number;
    estimatedFlights: number;
    airportTimeMinutes: number;
    completedTrips: number;
  };
  months: TravelMetricsMonth[];
  flights: TravelMetricsFlight[];
  airports: TravelMetricsAirport[];
};

type PeriodRange = {
  start: Date;
  endExclusive: Date;
  months: TravelMetricsMonth[];
};

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function periodRange(period: TravelMetricsPeriod, now: Date): PeriodRange {
  const monthCount = period === "month" ? 1 : period === "six-months" ? 6 : 12;
  const start = new Date(
    period === "year"
      ? Date.UTC(now.getUTCFullYear(), 0, 1)
      : Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthCount + 1, 1),
  );
  const endExclusive = new Date(
    period === "year"
      ? Date.UTC(now.getUTCFullYear() + 1, 0, 1)
      : Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const formatter = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
  const months: TravelMetricsMonth[] = [];

  for (let index = 0; index < monthCount; index += 1) {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const key = monthKey(date.getUTCFullYear(), date.getUTCMonth());
    months.push({
      key,
      label: formatter.format(date),
      flights: 0,
      distanceKm: 0,
      distanceFlights: 0,
      distanceMissingFlights: 0,
      airTimeMinutes: 0,
    });
  }

  return { start, endExclusive, months };
}

function haversineKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const chord =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

function unionMinutes(
  flights: Array<{ departureAt: Date; arrivalAt: Date }>,
  start: Date,
  endExclusive: Date,
): number {
  const intervals = flights
    .map(({ departureAt, arrivalAt }) => ({
      start: Math.max(departureAt.getTime(), start.getTime()),
      end: Math.min(arrivalAt.getTime(), endExclusive.getTime()),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((first, second) => first.start - second.start);

  let total = 0;
  let intervalStart: number | null = null;
  let intervalEnd = 0;
  for (const interval of intervals) {
    if (intervalStart === null) {
      intervalStart = interval.start;
      intervalEnd = interval.end;
    } else if (interval.start <= intervalEnd) {
      intervalEnd = Math.max(intervalEnd, interval.end);
    } else {
      total += intervalEnd - intervalStart;
      intervalStart = interval.start;
      intervalEnd = interval.end;
    }
  }
  if (intervalStart !== null) total += intervalEnd - intervalStart;
  return total / 60_000;
}

function segmentTimes(segment: TravelMetricsSegment, now: Date) {
  const snapshot = segment.statusSnapshot;
  const actual =
    snapshot !== null &&
    snapshot.sourceSegmentUpdatedAt.getTime() === segment.updatedAt.getTime() &&
    snapshot.status === "arrived" &&
    snapshot.actualDepartureAt !== null &&
    snapshot.actualArrivalAt !== null &&
    snapshot.actualArrivalAt.getTime() > snapshot.actualDepartureAt.getTime() &&
    snapshot.actualArrivalAt.getTime() <= now.getTime();

  return actual
    ? {
        departureAt: snapshot.actualDepartureAt!,
        arrivalAt: snapshot.actualArrivalAt!,
        timeBasis: "actual" as const,
      }
    : {
        departureAt: segment.scheduledDepartureAt,
        arrivalAt: segment.scheduledArrivalAt,
        timeBasis: "scheduled estimate" as const,
      };
}

function isCancelled(segment: TravelMetricsSegment): boolean {
  const snapshot = segment.statusSnapshot;
  if (!snapshot || snapshot.sourceSegmentUpdatedAt.getTime() !== segment.updatedAt.getTime()) {
    return false;
  }
  return ["cancelled", "possibly_cancelled", "diverted"].includes(snapshot.status);
}

export function calculateTravelMetrics(
  trips: TravelMetricsTrip[],
  period: TravelMetricsPeriod,
  now: Date,
  findAirport: (code: string) => Airport | null,
): TravelMetricsReport {
  const range = periodRange(period, now);
  const periodMonthLabel = (date: Date) =>
    new Intl.DateTimeFormat("en", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  const monthByKey = new Map(range.months.map((month) => [month.key, month]));
  const seenSegments = new Set<string>();
  const completedFlights: Array<{
    segment: TravelMetricsSegment;
    tripName: string;
    departureAt: Date;
    arrivalAt: Date;
    timeBasis: "actual" | "scheduled estimate";
    airTimeMinutes: number;
    distanceKm: number | null;
  }> = [];
  const tripCompletions = new Map<number, Date>();
  const allTripsById = new Map(trips.map((trip) => [trip.id, trip]));

  for (const trip of trips) {
    const eligibleSegments = trip.flightSegments
      .filter((segment) => !isCancelled(segment))
      .map((segment) => ({ segment, ...segmentTimes(segment, now) }))
      .sort((first, second) => first.departureAt.getTime() - second.departureAt.getTime());

    if (eligibleSegments.length > 0) {
      const lastArrival = eligibleSegments.reduce(
        (latest, item) => (item.arrivalAt.getTime() > latest.getTime() ? item.arrivalAt : latest),
        eligibleSegments[0].arrivalAt,
      );
      if (lastArrival.getTime() <= now.getTime()) tripCompletions.set(trip.id, lastArrival);
    }

    for (const { segment, departureAt, arrivalAt, timeBasis } of eligibleSegments) {
      if (arrivalAt.getTime() > now.getTime() || arrivalAt.getTime() <= departureAt.getTime()) {
        continue;
      }
      const dedupeKey = [
        trip.id,
        segment.leg,
        segment.departureAirportCode,
        segment.arrivalAirportCode,
        segment.scheduledDepartureAt.toISOString(),
        segment.scheduledArrivalAt.toISOString(),
      ].join("|");
      if (seenSegments.has(dedupeKey)) continue;
      seenSegments.add(dedupeKey);

      const departureAirport = findAirport(segment.departureAirportCode);
      const arrivalAirport = findAirport(segment.arrivalAirportCode);
      completedFlights.push({
        segment,
        tripName: trip.name,
        departureAt,
        arrivalAt,
        timeBasis,
        airTimeMinutes: (arrivalAt.getTime() - departureAt.getTime()) / 60_000,
        distanceKm:
          departureAirport &&
          arrivalAirport &&
          typeof departureAirport.latitude === "number" &&
          typeof departureAirport.longitude === "number" &&
          typeof arrivalAirport.latitude === "number" &&
          typeof arrivalAirport.longitude === "number"
            ? haversineKm(
                {
                  latitude: departureAirport.latitude,
                  longitude: departureAirport.longitude,
                },
                {
                  latitude: arrivalAirport.latitude,
                  longitude: arrivalAirport.longitude,
                },
              )
            : null,
      });
    }
  }

  const selectedFlights = completedFlights.filter(
    (flight) =>
      flight.departureAt.getTime() >= range.start.getTime() &&
      flight.departureAt.getTime() < range.endExclusive.getTime(),
  );
  const selectedTripIds = new Set(
    [...tripCompletions.entries()]
      .filter(
        ([, completedAt]) =>
          completedAt.getTime() >= range.start.getTime() &&
          completedAt.getTime() < range.endExclusive.getTime(),
      )
      .map(([tripId]) => tripId),
  );
  const verifiedSegments = new Set(
    selectedFlights
      .filter((flight) => flight.timeBasis === "actual")
      .map((flight) => flight.segment),
  );
  let airportTimeMinutes = 0;
  const flightsByTripLeg = new Map<string, typeof completedFlights>();
  for (const flight of completedFlights) {
    const key = `${flight.segment.tripId}:${flight.segment.leg}`;
    const flights = flightsByTripLeg.get(key) ?? [];
    flights.push(flight);
    flightsByTripLeg.set(key, flights);
  }

  for (const flights of flightsByTripLeg.values()) {
    flights.sort((first, second) => first.departureAt.getTime() - second.departureAt.getTime());
    for (let index = 0; index < flights.length - 1; index += 1) {
      const previous = flights[index];
      const next = flights[index + 1];
      if (
        previous.timeBasis !== "actual" ||
        next.timeBasis !== "actual" ||
        previous.segment.arrivalAirportCode !== next.segment.departureAirportCode ||
        !selectedFlights.includes(next)
      ) {
        continue;
      }
      const layover = (next.departureAt.getTime() - previous.arrivalAt.getTime()) / 60_000;
      if (layover > 0) airportTimeMinutes += layover;
    }
  }

  const flights: TravelMetricsFlight[] = selectedFlights.map((flight) => ({
    tripId: flight.segment.tripId,
    tripName: flight.tripName,
    leg: flight.segment.leg,
    departureAirportCode: flight.segment.departureAirportCode,
    departureAirportName: flight.segment.departureAirportName,
    departureAirportCity: flight.segment.departureAirportCity,
    departureCountryCode: flight.segment.departureCountryCode,
    arrivalAirportCode: flight.segment.arrivalAirportCode,
    arrivalAirportName: flight.segment.arrivalAirportName,
    arrivalAirportCity: flight.segment.arrivalAirportCity,
    arrivalCountryCode: flight.segment.arrivalCountryCode,
    departureAt: flight.departureAt.toISOString(),
    arrivalAt: flight.arrivalAt.toISOString(),
    timeBasis: flight.timeBasis,
    airTimeMinutes: flight.airTimeMinutes,
    distanceKm: flight.distanceKm,
  }));

  for (const flight of selectedFlights) {
    const key = monthKey(flight.departureAt.getUTCFullYear(), flight.departureAt.getUTCMonth());
    const month = monthByKey.get(key);
    if (!month) continue;
    month.flights += 1;
    if (flight.distanceKm === null) {
      month.distanceMissingFlights += 1;
    } else {
      month.distanceFlights += 1;
      month.distanceKm += flight.distanceKm;
    }
  }
  for (const month of range.months) {
    const [year, monthNumber] = month.key.split("-").map(Number);
    month.airTimeMinutes = unionMinutes(
      selectedFlights,
      new Date(Date.UTC(year, monthNumber - 1, 1)),
      new Date(Date.UTC(year, monthNumber, 1)),
    );
  }

  const locations = new Map<string, TravelMetricsAirport>();
  for (const flight of selectedFlights) {
    const trip = allTripsById.get(flight.segment.tripId);
    for (const code of [flight.segment.departureAirportCode, flight.segment.arrivalAirportCode]) {
      const airport = findAirport(code);
      if (
        !airport ||
        typeof airport.latitude !== "number" ||
        typeof airport.longitude !== "number"
      ) {
        continue;
      }
      const location: TravelMetricsAirport = locations.get(code) ?? {
        ...airport,
        latitude: airport.latitude,
        longitude: airport.longitude,
        flightCount: 0,
        trips: [],
      };
      location.flightCount += 1;
      if (trip && !location.trips.some((entry) => entry.id === trip.id)) {
        location.trips.push({ id: trip.id, name: trip.name });
      }
      locations.set(code, location);
    }
  }

  const verifiedFlights = verifiedSegments.size;
  return {
    period,
    periodLabel:
      period === "month"
        ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
            now,
          )
        : period === "six-months"
          ? `${periodMonthLabel(range.start)}–${periodMonthLabel(
              new Date(range.endExclusive.getTime() - 1),
            )}`
          : String(now.getUTCFullYear()),
    start: range.start,
    endExclusive: range.endExclusive,
    generatedAt: now,
    totals: {
      distanceKm: selectedFlights.reduce((total, flight) => total + (flight.distanceKm ?? 0), 0),
      distanceFlights: selectedFlights.filter((flight) => flight.distanceKm !== null).length,
      distanceMissingFlights: selectedFlights.filter((flight) => flight.distanceKm === null).length,
      airTimeMinutes: unionMinutes(selectedFlights, range.start, range.endExclusive),
      flights: selectedFlights.length,
      verifiedFlights,
      estimatedFlights: selectedFlights.length - verifiedFlights,
      airportTimeMinutes,
      completedTrips: selectedTripIds.size,
    },
    months: range.months,
    flights,
    airports: [...locations.values()].sort((first, second) =>
      first.code.localeCompare(second.code),
    ),
  };
}
