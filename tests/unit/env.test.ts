import { getServerEnv } from "../../src/lib/env";

describe("getServerEnv", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://jetreset_user:example-password@localhost:5432/jetreset_db?schema=public",
    );
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
