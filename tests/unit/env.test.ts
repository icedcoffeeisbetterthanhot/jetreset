import { getServerEnv } from "../../src/lib/env";

describe("getServerEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when DATABASE_URL is missing", () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;

    expect(() => getServerEnv()).toThrow(/DATABASE_URL is required/);
  });

  it("returns validated env when configuration is correct", () => {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL =
      "postgresql://jetreset_user:jetreset_password@localhost:5432/jetreset_db?schema=public";

    const env = getServerEnv();
    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_URL).toContain("postgresql://");
  });
});
