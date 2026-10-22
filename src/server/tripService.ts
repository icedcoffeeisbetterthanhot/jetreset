import { Prisma } from "@prisma/client";
import { prisma } from "@server/db";
import { z } from "zod";
import { TripDateTimeSchema, toZonedInstant } from "@lib/timezone";
import { getRequestIdentity } from "@server/authService";

const tripBaseSchema = z.object({
  name: z.string().trim().min(1, "Trip name is required").max(200),
  origin: z.string().trim().min(1, "Origin is required").max(200),
  destination: z.string().trim().min(1, "Destination is required").max(200),
  originTimeZone: TripDateTimeSchema.shape.timeZone,
  destinationTimeZone: TripDateTimeSchema.shape.timeZone,
  departureLocal: TripDateTimeSchema.shape.localDateTime,
  arrivalLocal: TripDateTimeSchema.shape.localDateTime,
  notes: z.string().trim().max(2000).optional(),
});

export const createTripSchema = tripBaseSchema;
export type CreateTripInput = z.infer<typeof createTripSchema>;

export async function getTripOwnerWhere() {
  const identity = await getRequestIdentity();
  return identity.kind === "user"
    ? { userId: identity.userId, guestId: null }
    : { userId: null, guestId: identity.guestId };
}

export class TripInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TripInputError";
  }
}

export class TripNotFoundError extends Error {
  constructor() {
    super("Trip not found.");
    this.name = "TripNotFoundError";
  }
}

function parseTripInput(input: unknown): CreateTripInput {
  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join("; ");
    throw new TripInputError(message);
  }

  return parsed.data;
}

function getTripData(input: unknown) {
  const {
    name,
    origin,
    destination,
    originTimeZone,
    destinationTimeZone,
    departureLocal,
    arrivalLocal,
    notes,
  } = parseTripInput(input);

  let departureAt: Date;
  let arrivalAt: Date;
  try {
    departureAt = toZonedInstant({
      localDateTime: departureLocal,
      timeZone: originTimeZone,
    });
    arrivalAt = toZonedInstant({
      localDateTime: arrivalLocal,
      timeZone: destinationTimeZone,
    });
  } catch (error) {
    throw new TripInputError(
      error instanceof Error ? error.message : "Unable to interpret the selected local time.",
    );
  }

  if (arrivalAt.getTime() <= departureAt.getTime()) {
    throw new TripInputError(
      "Arrival date and time must be after departure when interpreted in the selected time zones.",
    );
  }

  return {
    name,
    origin,
    destination,
    originTimeZone,
    destinationTimeZone,
    departureAt,
    arrivalAt,
    notes: notes && notes.length > 0 ? notes : null,
  };
}

function validateTripId(id: number): void {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new TripInputError("Trip ID must be a positive integer.");
  }
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function createTrip(input: unknown) {
  const owner = await getTripOwnerWhere();
  return prisma.trip.create({
    data: { ...getTripData(input), ...owner },
  });
}

export async function listTrips() {
  const owner = await getTripOwnerWhere();
  return prisma.trip.findMany({
    where: owner,
    orderBy: { departureAt: "asc" },
  });
}

export async function getTripById(id: number) {
  validateTripId(id);
  const owner = await getTripOwnerWhere();
  return prisma.trip.findFirst({ where: { id, ...owner } });
}

export async function updateTrip(id: number, input: unknown) {
  validateTripId(id);
  const owner = await getTripOwnerWhere();

  try {
    return await prisma.trip.update({
      where: { id, ...owner },
      data: getTripData(input),
    });
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new TripNotFoundError();
    }
    throw error;
  }
}

export async function deleteTrip(id: number) {
  validateTripId(id);
  const owner = await getTripOwnerWhere();

  try {
    await prisma.trip.delete({ where: { id, ...owner } });
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new TripNotFoundError();
    }
    throw error;
  }
}
