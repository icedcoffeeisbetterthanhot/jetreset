import { toZonedInstant } from "../../src/lib/timezone";

describe("toZonedInstant", () => {
  it("converts local times in time zones with a positive UTC offset", () => {
    expect(
      toZonedInstant({
        localDateTime: "2026-01-15T09:30",
        timeZone: "Asia/Tokyo",
      }).toISOString(),
    ).toBe("2026-01-15T00:30:00.000Z");
  });

  it("converts local times in time zones with a negative UTC offset", () => {
    expect(
      toZonedInstant({
        localDateTime: "2026-01-15T09:30",
        timeZone: "America/New_York",
      }).toISOString(),
    ).toBe("2026-01-15T14:30:00.000Z");
  });

  it("converts local times during daylight-saving time", () => {
    expect(
      toZonedInstant({
        localDateTime: "2026-07-15T09:30",
        timeZone: "America/New_York",
      }).toISOString(),
    ).toBe("2026-07-15T13:30:00.000Z");
  });

  it("rejects local times skipped by a daylight-saving transition", () => {
    expect(() =>
      toZonedInstant({
        localDateTime: "2026-03-08T02:30",
        timeZone: "America/New_York",
      }),
    ).toThrow(/does not exist/);
  });

  it("rejects local times repeated by a daylight-saving transition", () => {
    expect(() =>
      toZonedInstant({
        localDateTime: "2026-11-01T01:30",
        timeZone: "America/New_York",
      }),
    ).toThrow(/occurs twice/);
  });

  it("rejects invalid calendar dates", () => {
    expect(() =>
      toZonedInstant({
        localDateTime: "2026-02-30T09:30",
        timeZone: "UTC",
      }),
    ).toThrow(/date and time is invalid/);
  });
});
