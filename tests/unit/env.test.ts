describe("getServerEnv", () => {
  let getServerEnv: typeof import("../../src/lib/env").getServerEnv;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/jetreset_db");
    ({ getServerEnv } = await import("../../src/lib/env"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when DATABASE_URL is missing", () => {
    vi.stubEnv("DATABASE_URL", undefined);
    expect(() => getServerEnv()).toThrow(/DATABASE_URL is required/);
  });

  it("returns validated environment configuration", () => {
    const env = getServerEnv();
    expect(env.NODE_ENV).toBe("test");
    expect(env.DATABASE_URL).toContain("postgresql://");
  });
});
