import { getFlightStatusProviderConfig, getServerEnv } from "../../src/lib/env";

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

describe("getFlightStatusProviderConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is unconfigured when no provider key is set", () => {
    vi.stubEnv("AVIATIONSTACK_API_KEY", "");

    expect(getFlightStatusProviderConfig()).toBeNull();
  });

  it("returns the Aviationstack configuration for a valid key", () => {
    vi.stubEnv("AVIATIONSTACK_API_KEY", " 0123456789abcdefABCDEF0123456789 ");

    expect(getFlightStatusProviderConfig()).toEqual({
      provider: "aviationstack",
      apiKey: "0123456789abcdefABCDEF0123456789",
    });
  });

  it("rejects a malformed key without echoing it", () => {
    vi.stubEnv("AVIATIONSTACK_API_KEY", "secret value!");

    expect(() => getFlightStatusProviderConfig()).toThrow(/unexpected characters/);
    expect(() => getFlightStatusProviderConfig()).not.toThrow(/secret value/);
  });
});
