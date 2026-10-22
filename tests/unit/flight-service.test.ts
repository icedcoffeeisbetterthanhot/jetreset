import { createFlightSegment, deleteFlightSegment } from "@server/flightService";
import { TripInputError } from "@server/tripService";

const mocks = vi.hoisted(() => ({
  flightCreate: vi.fn(),
  flightDeleteMany: vi.fn(),
  tripFindFirst: vi.fn(),
}));

vi.mock("@server/db", () => ({
  prisma: {
    trip: { findFirst: mocks.tripFindFirst },
    flightSegment: {
      create: mocks.flightCreate,
      deleteMany: mocks.flightDeleteMany,
    },
  },
}));

vi.mock("@server/authService", () => ({
  getRequestIdentity: vi.fn().mockResolvedValue({ kind: "guest", guestId: "a".repeat(64) }),
}));

const input = {
  airline: "  Example Air ",
  flightNumber: " EX123 ",
  departureAirportCode: "lhr",
  departureLocal: "2026-11-01T10:00",
  arrivalAirportCode: "jfk",
  arrivalLocal: "2026-11-01T12:00",
};

describe("flight service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tripFindFirst.mockResolvedValue({ id: 4 });
  });

  it("stores airport time zones and converts each scheduled local time", async () => {
    mocks.flightCreate.mockResolvedValue({ id: 21 });

    await createFlightSegment(4, input);

    expect(mocks.flightCreate).toHaveBeenCalledWith({
      data: {
        airline: "Example Air",
        flightNumber: "EX123",
        departureAirportCode: "LHR",
        departureAirportName: "London Heathrow Airport",
        departureAirportCity: "London",
        departureCountryCode: "GB",
        departureTimeZone: "Europe/London",
        arrivalAirportCode: "JFK",
        arrivalAirportName: "John F. Kennedy International Airport",
        arrivalAirportCity: "New York",
        arrivalCountryCode: "US",
        arrivalTimeZone: "America/New_York",
        scheduledDepartureAt: new Date("2026-11-01T10:00:00.000Z"),
        scheduledArrivalAt: new Date("2026-11-01T17:00:00.000Z"),
        trip: { connect: { id: 4 } },
      },
    });
  });

  it("rejects unknown airports and ambiguous airport local times before persistence", async () => {
    await expect(
      createFlightSegment(4, { ...input, departureAirportCode: "XXX" }),
    ).rejects.toBeInstanceOf(TripInputError);
    await expect(
      createFlightSegment(4, { ...input, departureLocal: "2026-10-25T01:30" }),
    ).rejects.toThrow("occurs twice");

    expect(mocks.flightCreate).not.toHaveBeenCalled();
  });

  it("deletes only a flight segment belonging to the requested trip", async () => {
    mocks.flightDeleteMany.mockResolvedValue({ count: 1 });

    await deleteFlightSegment(4, 21);

    expect(mocks.flightDeleteMany).toHaveBeenCalledWith({
      where: { id: 21, tripId: 4 },
    });
  });

  it("reports a segment not found when deletion does not match the trip", async () => {
    mocks.flightDeleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteFlightSegment(4, 99)).rejects.toThrow("Flight segment not found.");
  });
});
