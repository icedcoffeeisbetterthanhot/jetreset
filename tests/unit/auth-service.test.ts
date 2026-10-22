import { loginAccount, registerAccount, transferGuestTripsToAccount } from "@server/authService";

const mocks = vi.hoisted(() => ({
  userCreate: vi.fn(),
  userFindUnique: vi.fn(),
  authThrottleFindUnique: vi.fn(),
  authThrottleDeleteMany: vi.fn(),
  authThrottleUpsert: vi.fn(),
  tripCount: vi.fn(),
  tripUpdateMany: vi.fn(),
  userSessionCreate: vi.fn(),
  userSessionFindUnique: vi.fn(),
  sessionCookie: "b".repeat(64),
  guestCookie: "a".repeat(64),
}));

vi.mock("@server/db", () => ({
  prisma: {
    user: { create: mocks.userCreate, findUnique: mocks.userFindUnique },
    authThrottle: {
      findUnique: mocks.authThrottleFindUnique,
      deleteMany: mocks.authThrottleDeleteMany,
      upsert: mocks.authThrottleUpsert,
    },
    trip: { count: mocks.tripCount, updateMany: mocks.tripUpdateMany },
    userSession: {
      create: mocks.userSessionCreate,
      findUnique: mocks.userSessionFindUnique,
    },
    legacyGuestClaim: { findUnique: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "jetreset_session"
        ? { value: mocks.sessionCookie }
        : name === "jetreset_guest"
          ? { value: mocks.guestCookie }
          : undefined,
  }),
}));

describe("username and password accounts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authThrottleFindUnique.mockResolvedValue(null);
    mocks.tripCount.mockResolvedValue(2);
    mocks.userSessionCreate.mockResolvedValue({});
  });

  it("creates and signs in an account without collecting email", async () => {
    mocks.userCreate.mockImplementation(async ({ data }) => ({
      id: 1,
      username: data.username,
    }));

    const result = await registerAccount(
      { username: "TestPilot", password: "a-long-test-password" },
      mocks.guestCookie,
    );

    expect(mocks.userCreate.mock.calls[0][0].data).toEqual({
      username: "testpilot",
      passwordHash: expect.stringMatching(/^scrypt\$16384\$8\$1\$/),
    });
    expect(result.user).toEqual({ id: 1, username: "testpilot" });
    expect(result.guestTripCount).toBe(2);
    expect(result.sessionToken).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.userSessionCreate).toHaveBeenCalledOnce();
  });

  it("logs in by normalized username and issues a session", async () => {
    mocks.userCreate.mockImplementation(async ({ data }) => ({
      id: 1,
      username: data.username,
    }));
    await registerAccount(
      { username: "testpilot", password: "a-long-test-password" },
      mocks.guestCookie,
    );
    mocks.userFindUnique.mockResolvedValue({
      id: 1,
      username: "testpilot",
      passwordHash: mocks.userCreate.mock.calls[0][0].data.passwordHash,
    });

    const result = await loginAccount(
      { username: "TestPilot", password: "a-long-test-password" },
      mocks.guestCookie,
    );

    const loginLookup =
      mocks.userFindUnique.mock.calls[mocks.userFindUnique.mock.calls.length - 1][0];
    expect(loginLookup).toEqual({
      where: { username: "testpilot" },
      select: { id: true, username: true, passwordHash: true },
    });
    expect(result.user).toEqual({ id: 1, username: "testpilot" });
  });

  it("transfers only the active guest session's trips to the signed-in user", async () => {
    mocks.userSessionFindUnique.mockResolvedValue({
      id: "session",
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 17, username: "testpilot" },
    });
    mocks.tripUpdateMany.mockResolvedValue({ count: 2 });

    await expect(transferGuestTripsToAccount()).resolves.toBe(2);
    expect(mocks.tripUpdateMany).toHaveBeenCalledWith({
      where: { userId: null, guestId: mocks.guestCookie },
      data: { userId: 17, guestId: null },
    });
  });
});
