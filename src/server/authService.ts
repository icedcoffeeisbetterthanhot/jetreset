import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@server/db";
import { AuthConflictError, AuthInputError, AuthRequiredError } from "@server/authErrors";

const SESSION_COOKIE = "jetreset_session";
const GUEST_COOKIE = "jetreset_guest";
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "Username must be 3–24 letters, numbers, or underscores."),
  password: z.string().min(12).max(128),
});

export type RequestIdentity =
  { kind: "user"; userId: number; username: string } | { kind: "guest"; guestId: string };

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

function derivePasswordKey(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      length,
      { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await derivePasswordKey(password, salt, 64);
  return `scrypt$16384$8$1$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, saltHex, hashHex] = encoded.split("$");
  if (algorithm !== "scrypt" || n !== "16384" || r !== "8" || p !== "1") return false;
  if (!/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]{128}$/.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await derivePasswordKey(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AuthInputError(result.error.errors.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

async function claimLegacyGuestData(guestId: string): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;
  const existingClaim = await prisma.legacyGuestClaim.findUnique({ where: { id: 1 } });
  if (existingClaim) return;

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.legacyGuestClaim.create({ data: { id: 1, guestId } });
      await transaction.trip.updateMany({
        where: { userId: null, guestId: "legacy" },
        data: { guestId },
      });
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
  }
}

async function createAccountSession(user: { id: number; username: string }, guestId: string) {
  await claimLegacyGuestData(guestId);
  const guestTripCount = await prisma.trip.count({
    where: { userId: null, guestId },
  });
  const sessionToken = newToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await prisma.userSession.create({
    data: { tokenHash: hashToken(sessionToken), userId: user.id, expiresAt },
  });

  return {
    sessionToken,
    expiresAt,
    guestTripCount,
    user,
  };
}

export async function registerAccount(input: unknown, guestId: string) {
  const credentials = parse(credentialsSchema, input);
  const passwordHash = await hashPassword(credentials.password);

  let user: { id: number; username: string };
  try {
    user = await prisma.user.create({
      data: {
        username: credentials.username,
        passwordHash,
      },
      select: { id: true, username: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AuthConflictError("That username is already taken.");
    }
    throw error;
  }

  return createAccountSession(user, guestId);
}

export async function loginAccount(input: unknown, guestId: string) {
  const credentials = parse(credentialsSchema, input);
  const throttleKey = hashToken(credentials.username);
  const now = new Date();
  const throttle = await prisma.authThrottle.findUnique({ where: { key: throttleKey } });
  const windowExpired =
    !throttle || now.getTime() - throttle.windowStartedAt.getTime() >= 15 * 60 * 1000;
  if (!windowExpired && throttle.failures >= 10) {
    throw new AuthInputError("Username or password is incorrect.");
  }

  const user = await prisma.user.findUnique({
    where: { username: credentials.username },
    select: { id: true, username: true, passwordHash: true },
  });
  const passwordIsValid = user
    ? await verifyPassword(credentials.password, user.passwordHash)
    : (await derivePasswordKey(credentials.password, Buffer.alloc(16), 64), false);
  if (!user || !passwordIsValid) {
    await prisma.authThrottle.upsert({
      where: { key: throttleKey },
      update: windowExpired
        ? { failures: 1, windowStartedAt: now }
        : { failures: { increment: 1 } },
      create: { key: throttleKey, failures: 1, windowStartedAt: now },
    });
    throw new AuthInputError("Username or password is incorrect.");
  }

  await prisma.authThrottle.deleteMany({ where: { key: throttleKey } });
  return createAccountSession({ id: user.id, username: user.username }, guestId);
}

export async function transferGuestTripsToAccount(): Promise<number> {
  const identity = await requireAccountIdentity();
  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_COOKIE)?.value;
  if (!guestId || !/^[a-f0-9]{64}$/.test(guestId)) {
    throw new AuthInputError("Guest trip session was not found.");
  }
  const result = await prisma.trip.updateMany({
    where: { userId: null, guestId },
    data: { userId: identity.userId, guestId: null },
  });
  return result.count;
}

export async function logoutSession(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken) return;
  await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(sessionToken) } });
}

export async function getRequestIdentity(): Promise<RequestIdentity> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionToken && /^[a-f0-9]{64}$/.test(sessionToken)) {
    const session = await prisma.userSession.findUnique({
      where: { tokenHash: hashToken(sessionToken) },
      include: { user: { select: { id: true, username: true } } },
    });
    if (session?.expiresAt && session.expiresAt.getTime() > Date.now()) {
      return { kind: "user", userId: session.user.id, username: session.user.username };
    }
    if (session) {
      await prisma.userSession.delete({ where: { id: session.id } });
    }
  }

  const guestId = cookieStore.get(GUEST_COOKIE)?.value;
  if (!guestId || !/^[a-f0-9]{64}$/.test(guestId)) {
    throw new Error("Guest session is missing. Refresh the page to start a guest session.");
  }
  await claimLegacyGuestData(guestId);
  return { kind: "guest", guestId };
}

export async function requireAccountIdentity(): Promise<
  Extract<RequestIdentity, { kind: "user" }>
> {
  const identity = await getRequestIdentity();
  if (identity.kind !== "user") throw new AuthRequiredError();
  return identity;
}

export function getAuthCookieNames() {
  return { session: SESSION_COOKIE, guest: GUEST_COOKIE };
}

export function authCookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(expires ? { expires } : {}),
  };
}
