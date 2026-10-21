import { prisma } from "@server/db";
import { z } from "zod";
import { TripDateTimeSchema, toZonedInstant } from "@lib/timezone";

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

export async function createTrip(input: CreateTripInput) {
  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join("; ");
    throw new Error(`Invalid trip data: ${message}`);
  }

  const {
    name,
    origin,
    destination,
    originTimeZone,
    destinationTimeZone,
    departureLocal,
    arrivalLocal,
    notes,
  } = parsed.data;

  const departureAt = toZonedInstant({
    localDateTime: departureLocal,
    timeZone: originTimeZone,
  });

  const arrivalAt = toZonedInstant({
    localDateTime: arrivalLocal,
    timeZone: destinationTimeZone,
  });

  if (arrivalAt.getTime() <= departureAt.getTime()) {
    throw new Error("Arrival must be after departure.");
  }

  const trip = await prisma.trip.create({
    data: {
      name,
      origin,
      destination,
      originTimeZone,
      destinationTimeZone,
      departureAt,
      arrivalAt,
      notes: notes && notes.length > 0 ? notes : null,
    },
  });

  return trip;
}

export async function listTrips() {
  return prisma.trip.findMany({
    orderBy: { departureAt: "asc" },
  });
}

export async function getTripById(id: number) {
  return prisma.trip.findUnique({ where: { id } });
}

export async function updateTrip(id: number, input: CreateTripInput) {
  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join("; ");
    throw new Error(`Invalid trip data: ${message}`);
  }

  const {
    name,
    origin,
    destination,
    originTimeZone,
    destinationTimeZone,
    departureLocal,
    arrivalLocal,
    notes,
  } = parsed.data;

  const departureAt = toZonedInstant({
    localDateTime: departureLocal,
    timeZone: originTimeZone,
  });

  const arrivalAt = toZonedInstant({
    localDateTime: arrivalLocal,
    timeZone: destinationTimeZone,
  });

  if (arrivalAt.getTime() <= departureAt.getTime()) {
    throw new Error("Arrival must be after departure.");
  }

  const trip = await prisma.trip.update({
    where: { id },
    data: {
      name,
      origin,
      destination,
      originTimeZone,
      destinationTimeZone,
      departureAt,
      arrivalAt,
      notes: notes && notes.length > 0 ? notes : null,
    },
  });

  return trip;
}

export async function deleteTrip(id: number) {
  await prisma.trip.delete({ where: { id } });
}
