import { randomInt } from "node:crypto";
import { prisma } from "@server/db";
import { requireAccountIdentity } from "@server/authService";
import { AuthInputError } from "@server/authErrors";
import {
  CLOUD_DODGER_MAX_TICKS,
  CLOUD_DODGER_TICK_MS,
  isValidCloudDodgerInputLog,
  simulateCloudDodgerRun,
} from "@lib/cloudDodger";

const completionInput = {
  tickCount: (value: unknown): value is number =>
    Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= CLOUD_DODGER_MAX_TICKS,
};

export async function startCloudDodgerRun() {
  const identity = await requireAccountIdentity();
  const run = await prisma.gameRun.create({
    data: {
      userId: identity.userId,
      seed: randomInt(1, 2_147_483_647),
    },
    select: { id: true, seed: true },
  });
  return run;
}

export async function completeCloudDodgerRun(runId: string, input: unknown) {
  const identity = await requireAccountIdentity();
  if (!/^[a-z0-9]{20,32}$/i.test(runId)) {
    throw new AuthInputError("Game run was not found.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AuthInputError("Game result is invalid.");
  }
  const body = input as Record<string, unknown>;
  if (!completionInput.tickCount(body.tickCount)) {
    throw new AuthInputError("Game result contains an invalid flight duration.");
  }
  const tickCount = body.tickCount;
  if (!isValidCloudDodgerInputLog(body.inputs, tickCount)) {
    throw new AuthInputError("Game result contains invalid steering data.");
  }

  const run = await prisma.gameRun.findFirst({
    where: { id: runId, userId: identity.userId, status: "active" },
    select: { id: true, seed: true, startedAt: true },
  });
  if (!run) throw new AuthInputError("Game run was not found or has already been submitted.");
  const completedAt = new Date();
  const elapsedMs = completedAt.getTime() - run.startedAt.getTime();
  if (
    elapsedMs < 0 ||
    elapsedMs > 4 * 60 * 60 * 1000 ||
    tickCount > Math.floor(elapsedMs / CLOUD_DODGER_TICK_MS) + 2
  ) {
    throw new AuthInputError("Game result arrived too quickly to be valid.");
  }

  const result = simulateCloudDodgerRun(run.seed, body.inputs, tickCount);
  if (!result.crashed || result.ticks !== tickCount) {
    throw new AuthInputError("The game run could not be verified.");
  }

  const saved = await prisma.gameRun.updateMany({
    where: { id: run.id, userId: identity.userId, status: "active" },
    data: {
      status: "completed",
      score: result.score,
      tickCount: result.ticks,
      inputLog: body.inputs,
      completedAt,
    },
  });
  if (saved.count !== 1) {
    throw new AuthInputError("Game run has already been submitted.");
  }

  return { score: result.score };
}
