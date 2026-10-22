import { FriendRequestStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@server/db";
import { requireAccountIdentity } from "@server/authService";
import { AuthConflictError, AuthInputError, AuthRequiredError } from "@server/authErrors";

const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/),
});

const responseSchema = z.object({ accepted: z.boolean() });

function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AuthInputError(result.error.errors.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

export async function listFriendRequests() {
  const identity = await requireAccountIdentity();
  const requests = await prisma.friendRequest.findMany({
    where: { OR: [{ requesterId: identity.userId }, { recipientId: identity.userId }] },
    include: {
      requester: { select: { id: true, username: true } },
      recipient: { select: { id: true, username: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return requests.map((request) => ({
    id: request.id,
    status: request.status,
    direction: request.requesterId === identity.userId ? "sent" : "received",
    otherUser: request.requesterId === identity.userId ? request.recipient : request.requester,
  }));
}

export async function sendFriendRequest(input: unknown) {
  const identity = await requireAccountIdentity();
  const { username } = validate(usernameSchema, input);
  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!target) throw new AuthInputError("No account was found with that username.");
  if (target.id === identity.userId) {
    throw new AuthInputError("You cannot add your own account as a friend.");
  }

  const userAId = Math.min(identity.userId, target.id);
  const userBId = Math.max(identity.userId, target.id);
  const uniqueKey = { userAId_userBId: { userAId, userBId } };
  const existing = await prisma.friendRequest.findUnique({ where: uniqueKey });
  if (existing?.status === FriendRequestStatus.accepted) {
    throw new AuthInputError("You are already friends.");
  }
  if (existing?.status === FriendRequestStatus.pending) {
    throw new AuthInputError(
      existing.recipientId === identity.userId
        ? "This user has already sent you a request. Accept it from your friend requests."
        : "A friend request is already pending.",
    );
  }

  const data = {
    requesterId: identity.userId,
    recipientId: target.id,
    status: FriendRequestStatus.pending,
  };
  try {
    const request = existing
      ? await prisma.friendRequest.update({ where: { id: existing.id }, data })
      : await prisma.friendRequest.create({ data: { ...data, userAId, userBId } });
    return { id: request.id, status: request.status };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AuthConflictError("A friend request already exists for these accounts.");
    }
    throw error;
  }
}

export async function respondToFriendRequest(id: number, input: unknown) {
  const identity = await requireAccountIdentity();
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new AuthInputError("Friend request ID must be a positive integer.");
  }
  const { accepted } = validate(responseSchema, input);
  const update = await prisma.friendRequest.updateMany({
    where: { id, recipientId: identity.userId, status: FriendRequestStatus.pending },
    data: { status: accepted ? FriendRequestStatus.accepted : FriendRequestStatus.declined },
  });
  if (update.count === 0) {
    throw new AuthInputError("Friend request was not found or has already been handled.");
  }
  return { id, status: accepted ? "accepted" : "declined" };
}

export async function getGlobalLeaderboard() {
  const grouped = await prisma.gameRun.groupBy({
    by: ["userId"],
    where: { status: "completed", score: { not: null } },
    _max: { score: true },
    orderBy: [{ _max: { score: "desc" } }, { userId: "asc" }],
    take: 100,
  });
  const entries = grouped.flatMap((entry) =>
    entry._max.score === null ? [] : [{ userId: entry.userId, score: entry._max.score }],
  );
  const users = await prisma.user.findMany({
    where: { id: { in: entries.map((entry) => entry.userId) } },
    select: { id: true, username: true },
  });
  const usernames = new Map(users.map((user) => [user.id, user.username]));
  return entries
    .map((entry, index) => ({
      rank: index + 1,
      username: usernames.get(entry.userId) ?? "player",
      score: entry.score,
    }))
    .filter((entry) => entry.username !== "player");
}

export async function getCommunityData() {
  const leaderboard = await getGlobalLeaderboard();
  try {
    const friendRequests = await listFriendRequests();
    return { signedIn: true as const, friendRequests, leaderboard };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { signedIn: false as const, friendRequests: [], leaderboard };
    }
    throw error;
  }
}
