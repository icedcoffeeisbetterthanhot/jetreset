import { simulateCloudDodgerRun } from "@lib/cloudDodger";
import { completeCloudDodgerRun } from "@server/gameService";
import { AuthInputError } from "@server/authErrors";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@server/db", () => ({
  prisma: { gameRun: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } },
}));

vi.mock("@server/authService", () => ({
  requireAccountIdentity: vi.fn().mockResolvedValue({ kind: "user", userId: 7, username: "pilot" }),
}));

describe("Cloud Dodger score service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves only a replay-verified score for the owning player", async () => {
    const seed = 1234;
    let replay = { score: 0, ticks: 0, crashed: false };
    let ticks = 1;
    for (; ticks <= 100; ticks += 1) {
      replay = simulateCloudDodgerRun(seed, [], ticks);
      if (replay.crashed && replay.ticks === ticks) break;
    }
    expect(replay.crashed).toBe(true);
    mocks.findFirst.mockResolvedValue({
      id: "cm12345678901234567890",
      seed,
      startedAt: new Date(Date.now() - ticks * 700 - 3000),
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      completeCloudDodgerRun("cm12345678901234567890", { inputs: [], tickCount: ticks }),
    ).resolves.toEqual({ score: replay.score });

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "cm12345678901234567890", userId: 7, status: "active" },
      select: { id: true, seed: true, startedAt: true },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cm12345678901234567890", userId: 7, status: "active" },
        data: expect.objectContaining({
          status: "completed",
          score: replay.score,
          tickCount: ticks,
        }),
      }),
    );
  });

  it("rejects a run replayed faster than its tick rate allows", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "cm12345678901234567890",
      seed: 1234,
      startedAt: new Date(Date.now() - 100),
    });

    await expect(
      completeCloudDodgerRun("cm12345678901234567890", { inputs: [], tickCount: 10 }),
    ).rejects.toBeInstanceOf(AuthInputError);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
