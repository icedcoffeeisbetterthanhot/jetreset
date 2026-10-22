export const CLOUD_DODGER_COLUMNS = 7;
export const CLOUD_DODGER_ROWS = 10;
export const CLOUD_DODGER_TICK_MS = 700;
export const CLOUD_DODGER_MAX_TICKS = 20_000;

export const CLOUD_DODGER_OBSTACLES = ["cloud", "bird", "balloon"] as const;
export type CloudDodgerObstacle = (typeof CLOUD_DODGER_OBSTACLES)[number];
export type CloudDodgerInput = { tick: number; direction: -1 | 1 };

export function createCloudDodgerRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    let value = (state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function simulateCloudDodgerRun(
  seed: number,
  inputs: CloudDodgerInput[],
  tickCount: number,
): { score: number; ticks: number; crashed: boolean } {
  let planeLane = Math.floor(CLOUD_DODGER_COLUMNS / 2);
  let score = 0;
  let ticks = 0;
  let nextObstacleId = 0;
  let obstacles: Array<{
    id: number;
    lane: number;
    row: number;
    type: CloudDodgerObstacle;
  }> = [];
  let inputIndex = 0;
  const nextRandom = createCloudDodgerRandom(seed);

  for (let tick = 0; tick < tickCount; tick += 1) {
    while (inputIndex < inputs.length && inputs[inputIndex].tick === tick) {
      planeLane = Math.max(
        0,
        Math.min(CLOUD_DODGER_COLUMNS - 1, planeLane + inputs[inputIndex].direction),
      );
      inputIndex += 1;
    }

    const movement = 1 + Math.floor(ticks / 8);
    const moved = obstacles.map((obstacle) => ({ ...obstacle, row: obstacle.row + movement }));
    const crossed = moved.filter(
      (obstacle) =>
        obstacle.row >= CLOUD_DODGER_ROWS - 1 &&
        obstacles.some(
          (previous) => previous.id === obstacle.id && previous.row < CLOUD_DODGER_ROWS - 1,
        ),
    );
    const crashed = crossed.some((obstacle) => obstacle.lane === planeLane);
    const cleared = crossed.filter((obstacle) => obstacle.lane !== planeLane).length;
    score += cleared;
    obstacles = [
      ...moved.filter((obstacle) => obstacle.row < CLOUD_DODGER_ROWS - 1),
      {
        id: nextObstacleId,
        lane: Math.floor(nextRandom() * CLOUD_DODGER_COLUMNS),
        row: 0,
        type: CLOUD_DODGER_OBSTACLES[Math.floor(nextRandom() * CLOUD_DODGER_OBSTACLES.length)],
      },
    ];
    nextObstacleId += 1;
    ticks += 1;
    if (crashed) return { score, ticks, crashed: true };
  }

  return { score, ticks, crashed: false };
}

export function isValidCloudDodgerInputLog(
  value: unknown,
  tickCount: number,
): value is CloudDodgerInput[] {
  if (!Array.isArray(value) || value.length > 50_000) return false;
  let lastTick = 0;
  for (const action of value) {
    if (
      !action ||
      typeof action !== "object" ||
      !("tick" in action) ||
      !("direction" in action) ||
      !Number.isSafeInteger(action.tick) ||
      (action.direction !== -1 && action.direction !== 1) ||
      action.tick < 0 ||
      action.tick >= tickCount ||
      action.tick < lastTick
    ) {
      return false;
    }
    lastTick = action.tick;
  }
  return true;
}
