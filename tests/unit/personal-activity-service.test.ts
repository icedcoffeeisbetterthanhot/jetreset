import {
  createPersonalActivity,
  deletePersonalActivity,
  listPersonalActivities,
  updatePersonalActivity,
} from "@server/personalActivityService";
import { TripInputError, TripNotFoundError } from "@server/tripService";
import { PersonalActivityNotFoundError } from "@server/personalActivityErrors";

const mocks = vi.hoisted(() => ({
  tripFindUnique: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@server/db", () => ({
  prisma: {
    trip: { findUnique: mocks.tripFindUnique },
    personalActivity: {
      create: mocks.create,
      findMany: mocks.findMany,
      updateMany: mocks.updateMany,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      deleteMany: mocks.deleteMany,
    },
  },
}));

const input = {
  title: "  Client meeting ",
  notes: " Bring slides ",
  date: "2026-10-23",
  startTime: "10:00",
  endTime: "11:30",
  timeZone: "America/New_York",
};

describe("personal activity service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tripFindUnique.mockResolvedValue({ id: 5 });
    mocks.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }));
  });

  it("stores local times as instants in the activity's time zone", async () => {
    await createPersonalActivity(5, input);

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        title: "Client meeting",
        notes: "Bring slides",
        // New York is UTC-4 on 23 October 2026.
        startsAt: new Date("2026-10-23T14:00:00.000Z"),
        endsAt: new Date("2026-10-23T15:30:00.000Z"),
        timeZone: "America/New_York",
        trip: { connect: { id: 5 } },
      },
    });
  });

  it.each([
    [{ title: "" }, /Add a title/],
    [{ endTime: "10:00" }, /must end after it starts/],
    [{ endTime: "09:00" }, /must end after it starts/],
    [{ startTime: "25:00" }, /Start time must be HH:MM/],
    [{ timeZone: "Mars/Olympus" }, /time zone/i],
  ])("rejects invalid input %o before writing", async (override, message) => {
    const error = await createPersonalActivity(5, { ...input, ...override }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(TripInputError);
    expect((error as Error).message).toMatch(message);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects times that do not exist because of a daylight-saving change", async () => {
    // Clocks in New York jump from 02:00 to 03:00 on 8 March 2026.
    await expect(
      createPersonalActivity(5, { ...input, date: "2026-03-08", startTime: "02:30" }),
    ).rejects.toBeInstanceOf(TripInputError);
  });

  it("requires the trip to exist", async () => {
    mocks.tripFindUnique.mockResolvedValue(null);

    await expect(createPersonalActivity(9, input)).rejects.toBeInstanceOf(TripNotFoundError);
    await expect(listPersonalActivities(9)).rejects.toBeInstanceOf(TripNotFoundError);
  });

  it("scopes updates and deletes to the trip", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({ id: 3 });
    mocks.deleteMany.mockResolvedValue({ count: 1 });

    await updatePersonalActivity(5, 3, { ...input, title: "Dinner" });
    await deletePersonalActivity(5, 3);

    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3, tripId: 5 },
        data: expect.objectContaining({ title: "Dinner" }),
      }),
    );
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: 3, tripId: 5 } });
  });

  it("reports activities that belong to another trip as not found", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.deleteMany.mockResolvedValue({ count: 0 });

    await expect(updatePersonalActivity(5, 99, input)).rejects.toBeInstanceOf(
      PersonalActivityNotFoundError,
    );
    await expect(deletePersonalActivity(5, 99)).rejects.toBeInstanceOf(
      PersonalActivityNotFoundError,
    );
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
