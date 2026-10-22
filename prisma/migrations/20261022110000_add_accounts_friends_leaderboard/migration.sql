CREATE TYPE "AuthTokenType" AS ENUM ('email_verification', 'password_reset');
CREATE TYPE "FriendRequestStatus" AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE "GameRunStatus" AS ENUM ('active', 'completed', 'rejected');

CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "username" VARCHAR(24) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthToken" (
    "tokenHash" VARCHAR(64) NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("tokenHash")
);

CREATE TABLE "AuthThrottle" (
    "key" VARCHAR(64) NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "LegacyGuestClaim" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "guestId" VARCHAR(64) NOT NULL,
    CONSTRAINT "LegacyGuestClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FriendRequest" (
    "id" SERIAL NOT NULL,
    "userAId" INTEGER NOT NULL,
    "userBId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "status" "FriendRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameRun" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "status" "GameRunStatus" NOT NULL DEFAULT 'active',
    "score" INTEGER,
    "tickCount" INTEGER,
    "inputLog" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "GameRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Trip"
ADD COLUMN "userId" INTEGER,
ADD COLUMN "guestId" VARCHAR(64);

UPDATE "Trip"
SET "guestId" = 'legacy'
WHERE "userId" IS NULL AND "guestId" IS NULL;

ALTER TABLE "Trip"
ADD CONSTRAINT "Trip_owner_check"
CHECK (("userId" IS NULL) <> ("guestId" IS NULL));

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");
CREATE UNIQUE INDEX "LegacyGuestClaim_guestId_key" ON "LegacyGuestClaim"("guestId");
CREATE UNIQUE INDEX "FriendRequest_userAId_userBId_key" ON "FriendRequest"("userAId", "userBId");
CREATE INDEX "FriendRequest_recipientId_status_idx" ON "FriendRequest"("recipientId", "status");
CREATE INDEX "FriendRequest_requesterId_status_idx" ON "FriendRequest"("requesterId", "status");
CREATE INDEX "GameRun_userId_status_score_idx" ON "GameRun"("userId", "status", "score");
CREATE INDEX "Trip_userId_departureAt_idx" ON "Trip"("userId", "departureAt");
CREATE INDEX "Trip_guestId_departureAt_idx" ON "Trip"("guestId", "departureAt");

ALTER TABLE "UserSession"
ADD CONSTRAINT "UserSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthToken"
ADD CONSTRAINT "AuthToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Trip"
ADD CONSTRAINT "Trip_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendRequest"
ADD CONSTRAINT "FriendRequest_userAId_fkey"
FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendRequest"
ADD CONSTRAINT "FriendRequest_userBId_fkey"
FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendRequest"
ADD CONSTRAINT "FriendRequest_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendRequest"
ADD CONSTRAINT "FriendRequest_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GameRun"
ADD CONSTRAINT "GameRun_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
