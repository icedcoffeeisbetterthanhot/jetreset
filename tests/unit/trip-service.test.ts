import { Prisma } from "@prisma/client";
import {
  createTrip,
  deleteTrip,
  listTripsWithFlights,
  TripInputError,
  TripNotFoundError,
  updateTrip,
} from "@server/tripService";

const tripMocks = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@server/db", () => ({
  prisma: {
    trip: tripMocks,
  },
}));

vi.mock("@server/authService", () => ({
  getRequestIdentity: vi.fn().mockResolvedValue({ kind: "guest", guestId: "a".repeat(64) }),
}));

const validTrip = {
  name: "  London to Paris  ",
  origin: " London ",
  destination: " Paris ",
  originTimeZone: "Europe/London",
  destinationTimeZone: "Europe/Paris",
  departureLocal: "2026-05-01T10:00",
  arrivalLocal: "2026-05-01T12:00",
  notes: "  ",
};

describe("trip service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a trip using trimmed values and absolute timestamps", async () => {
    tripMocks.create.mockResolvedValue({ id: 1 });

    await createTrip(validTrip);

    expect(tripMocks.create).toHaveBeenCalledWith({
      data: {
        name: "London to Paris",
        origin: "London",
        destination: "Paris",
        originTimeZone: "Europe/London",
        destinationTimeZone: "Europe/Paris",
        departureAt: new Date("2026-05-01T09:00:00.000Z"),
        arrivalAt: new Date("2026-05-01T10:00:00.000Z"),
        notes: null,
        userId: null,
        guestId: "a".repeat(64),
      },
    });
  });

  it("rejects invalid or non-positive journeys before persistence", async () => {
    await expect(createTrip({ ...validTrip, arrivalLocal: "not-a-date" })).rejects.toBeInstanceOf(
      TripInputError,
    );
    await expect(createTrip({ ...validTrip, arrivalLocal: "2026-05-01T09:00" })).rejects.toThrow(
      "Arrival date and time must be after departure when interpreted in the selected time zones.",
    );

    expect(tripMocks.create).not.toHaveBeenCalled();
  });

  it("accepts a later arrival on the same calendar day in the same time zone", async () => {
    tripMocks.create.mockResolvedValue({ id: 1 });

    await createTrip({
      ...validTrip,
      originTimeZone: "Europe/London",
      destinationTimeZone: "Europe/London",
      departureLocal: "2026-05-01T10:00",
      arrivalLocal: "2026-05-01T10:01",
    });

    expect(tripMocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        departureAt: new Date("2026-05-01T09:00:00.000Z"),
        arrivalAt: new Date("2026-05-01T09:01:00.000Z"),
      }),
    });
  });

  it("rejects an earlier arrival time on the same calendar day", async () => {
    await expect(
      createTrip({
        ...validTrip,
        originTimeZone: "Europe/London",
        destinationTimeZone: "Europe/London",
        departureLocal: "2026-05-01T10:00",
        arrivalLocal: "2026-05-01T09:59",
      }),
    ).rejects.toThrow(
      "Arrival date and time must be after departure when interpreted in the selected time zones.",
    );

    expect(tripMocks.create).not.toHaveBeenCalled();
  });

  it("lists only the current owner's trips with flights", async () => {
    tripMocks.findMany.mockResolvedValue([]);

    await listTripsWithFlights();

    expect(tripMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: null, guestId: "a".repeat(64) },
        orderBy: { departureAt: "asc" },
      }),
    );
  });

  it("updates the existing trip rather than creating a duplicate", async () => {
    tripMocks.update.mockResolvedValue({ id: 7 });

    await updateTrip(7, validTrip);

    expect(tripMocks.update).toHaveBeenCalledWith({
      where: { id: 7, userId: null, guestId: "a".repeat(64) },
      data: expect.objectContaining({ name: "London to Paris" }),
    });
    expect(tripMocks.create).not.toHaveBeenCalled();
  });

  it("maps a missing record from deletion to a not-found error", async () => {
    tripMocks.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found.", {
        code: "P2025",
        clientVersion: "test",
      }),
    );

    await expect(deleteTrip(7)).rejects.toBeInstanceOf(TripNotFoundError);
  });
});
