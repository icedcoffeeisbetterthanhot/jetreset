import {
  getGlobalLeaderboard,
  respondToFriendRequest,
  sendFriendRequest,
} from "@server/communityService";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  friendFindUnique: vi.fn(),
  friendCreate: vi.fn(),
  friendUpdateMany: vi.fn(),
  gameGroupBy: vi.fn(),
}));

vi.mock("@server/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, findMany: mocks.userFindMany },
    friendRequest: {
      findUnique: mocks.friendFindUnique,
      create: mocks.friendCreate,
      updateMany: mocks.friendUpdateMany,
    },
    gameRun: { groupBy: mocks.gameGroupBy },
  },
}));

vi.mock("@server/authService", () => ({
  requireAccountIdentity: vi.fn().mockResolvedValue({ kind: "user", userId: 7, username: "pilot" }),
}));

describe("community service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a pending request with canonical pair IDs and the requested recipient", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 3 });
    mocks.friendFindUnique.mockResolvedValue(null);
    mocks.friendCreate.mockResolvedValue({ id: 12, status: "pending" });

    await expect(sendFriendRequest({ username: "Friend_3" })).resolves.toEqual({
      id: 12,
      status: "pending",
    });
    expect(mocks.friendCreate).toHaveBeenCalledWith({
      data: {
        userAId: 3,
        userBId: 7,
        requesterId: 7,
        recipientId: 3,
        status: "pending",
      },
    });
  });

  it("only allows the intended recipient to accept a pending request", async () => {
    mocks.friendUpdateMany.mockResolvedValue({ count: 1 });

    await respondToFriendRequest(12, { accepted: true });

    expect(mocks.friendUpdateMany).toHaveBeenCalledWith({
      where: { id: 12, recipientId: 7, status: "pending" },
      data: { status: "accepted" },
    });
  });

  it("builds a public leaderboard using usernames and each player's best score", async () => {
    mocks.gameGroupBy.mockResolvedValue([
      { userId: 7, _max: { score: 18 } },
      { userId: 3, _max: { score: 11 } },
    ]);
    mocks.userFindMany.mockResolvedValue([
      { id: 7, username: "pilot" },
      { id: 3, username: "guestpilot" },
    ]);

    await expect(getGlobalLeaderboard()).resolves.toEqual([
      { rank: 1, username: "pilot", score: 18 },
      { rank: 2, username: "guestpilot", score: 11 },
    ]);
    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: { id: { in: [7, 3] } },
      select: { id: true, username: true },
    });
  });
});
