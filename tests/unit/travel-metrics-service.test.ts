import { getTravelMetrics } from "@server/travelMetricsService";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@server/db", () => ({
  prisma: {
    trip: mocks,
  },
}));

vi.mock("@server/authService", () => ({
  getRequestIdentity: vi.fn().mockResolvedValue({ kind: "user", userId: 42 }),
}));

vi.mock("@server/airportService", () => ({
  findAirport: vi.fn().mockReturnValue(null),
}));

describe("travel metrics service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
  });

  it("queries only the current account's trip and flight data", async () => {
    await getTravelMetrics("month", new Date("2026-10-22T12:00:00.000Z"));

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 42, guestId: null },
        select: expect.objectContaining({
          id: true,
          name: true,
          flightSegments: expect.objectContaining({
            select: expect.objectContaining({
              scheduledDepartureAt: true,
              scheduledArrivalAt: true,
              statusSnapshot: expect.any(Object),
            }),
          }),
        }),
      }),
    );
    const selection = mocks.findMany.mock.calls[0][0].select;
    expect(selection.notes).toBeUndefined();
    expect(selection.flightSegments.select.notes).toBeUndefined();
  });
});
