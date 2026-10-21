import { Prisma } from "@prisma/client";
import { z } from "zod";
import { TripDateTimeSchema, toZonedInstant } from "@lib/timezone";
import { prisma } from "@server/db";
import { findAirport } from "@server/airportService";
import { TripInputError, TripNotFoundError } from "@server/tripService";
import { FlightSegmentNotFoundError } from "@server/flightErrors";

const flightSegmentSchema = z.object({
  airline: z.string().trim().max(120).optional(),
  flightNumber: z.string().trim().max(32).optional(),
  departureAirportCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Choose a valid departure airport."),
  departureLocal: TripDateTimeSchema.shape.localDateTime,
  arrivalAirportCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Choose a valid arrival airport."),
  arrivalLocal: TripDateTimeSchema.shape.localDateTime,
});

function validateId(id: number, label: string): void {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new TripInputError(`${label} must be a positive integer.`);
  }
}

function buildFlightSegmentData(input: unknown) {
  const parsed = flightSegmentSchema.safeParse(input);
  if (!parsed.success) {
    throw new TripInputError(parsed.error.errors.map((error) => error.message).join("; "));
  }

  const departureAirport = findAirport(parsed.data.departureAirportCode);
  const arrivalAirport = findAirport(parsed.data.arrivalAirportCode);
  if (!departureAirport) throw new TripInputError("Choose a valid departure airport.");
  if (!arrivalAirport) throw new TripInputError("Choose a valid arrival airport.");

  let scheduledDepartureAt: Date;
  let scheduledArrivalAt: Date;
  try {
    scheduledDepartureAt = toZonedInstant({
      localDateTime: parsed.data.departureLocal,
      timeZone: departureAirport.timeZone,
    });
    scheduledArrivalAt = toZonedInstant({
      localDateTime: parsed.data.arrivalLocal,
      timeZone: arrivalAirport.timeZone,
    });
  } catch (error) {
    throw new TripInputError(
      error instanceof Error ? error.message : "Unable to interpret the selected flight times.",
    );
  }

  if (scheduledArrivalAt.getTime() <= scheduledDepartureAt.getTime()) {
    throw new TripInputError("Flight arrival must be after its departure.");
  }

  return {
    airline: parsed.data.airline || null,
    flightNumber: parsed.data.flightNumber || null,
    departureAirportCode: departureAirport.code,
    departureAirportName: departureAirport.name,
    departureAirportCity: departureAirport.city,
    departureCountryCode: departureAirport.countryCode,
    departureTimeZone: departureAirport.timeZone,
    arrivalAirportCode: arrivalAirport.code,
    arrivalAirportName: arrivalAirport.name,
    arrivalAirportCity: arrivalAirport.city,
    arrivalCountryCode: arrivalAirport.countryCode,
    arrivalTimeZone: arrivalAirport.timeZone,
    scheduledDepartureAt,
    scheduledArrivalAt,
  };
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function listFlightSegments(tripId: number) {
  validateId(tripId, "Trip ID");
  if (!(await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } }))) {
    throw new TripNotFoundError();
  }

  return prisma.flightSegment.findMany({
    where: { tripId },
    orderBy: [{ scheduledDepartureAt: "asc" }, { id: "asc" }],
  });
}

export async function createFlightSegment(tripId: number, input: unknown) {
  validateId(tripId, "Trip ID");

  try {
    return await prisma.flightSegment.create({
      data: {
        ...buildFlightSegmentData(input),
        trip: { connect: { id: tripId } },
      },
    });
  } catch (error) {
    if (isRecordNotFound(error)) throw new TripNotFoundError();
    throw error;
  }
}

export async function updateFlightSegment(tripId: number, flightSegmentId: number, input: unknown) {
  validateId(tripId, "Trip ID");
  validateId(flightSegmentId, "Flight segment ID");

  const existing = await prisma.flightSegment.findFirst({
    where: { id: flightSegmentId, tripId },
    select: { id: true },
  });
  if (!existing) throw new FlightSegmentNotFoundError();

  try {
    return await prisma.flightSegment.update({
      where: { id: flightSegmentId },
      data: buildFlightSegmentData(input),
    });
  } catch (error) {
    if (isRecordNotFound(error)) throw new FlightSegmentNotFoundError();
    throw error;
  }
}

export async function deleteFlightSegment(tripId: number, flightSegmentId: number) {
  validateId(tripId, "Trip ID");
  validateId(flightSegmentId, "Flight segment ID");

  const result = await prisma.flightSegment.deleteMany({
    where: { id: flightSegmentId, tripId },
  });
  if (result.count === 0) throw new FlightSegmentNotFoundError();
}
