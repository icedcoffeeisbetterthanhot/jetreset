import {
  createCloudDodgerRandom,
  isValidCloudDodgerInputLog,
  simulateCloudDodgerRun,
} from "@lib/cloudDodger";

describe("Cloud Dodger run verification", () => {
  it("generates a reproducible obstacle sequence from the server seed", () => {
    const first = createCloudDodgerRandom(1234);
    const second = createCloudDodgerRandom(1234);

    expect(Array.from({ length: 12 }, first)).toEqual(Array.from({ length: 12 }, second));
  });

  it("replays the same inputs into the same crash and score", () => {
    const first = simulateCloudDodgerRun(1234, [], 100);
    const second = simulateCloudDodgerRun(1234, [], 100);

    expect(first).toEqual(second);
    expect(first.crashed).toBe(true);
  });

  it("rejects unsorted or out-of-range steering input", () => {
    expect(
      isValidCloudDodgerInputLog(
        [
          { tick: 1, direction: -1 },
          { tick: 0, direction: 1 },
        ],
        3,
      ),
    ).toBe(false);
    expect(isValidCloudDodgerInputLog([{ tick: 3, direction: 1 }], 3)).toBe(false);
    expect(isValidCloudDodgerInputLog([{ tick: 1, direction: 0 }], 3)).toBe(false);
  });
});
