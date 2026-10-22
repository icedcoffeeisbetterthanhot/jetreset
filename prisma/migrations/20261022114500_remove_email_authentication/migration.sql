DROP TABLE "AuthToken";

DROP TYPE "AuthTokenType";

DELETE FROM "AuthThrottle";

DROP INDEX "User_email_key";

ALTER TABLE "User"
DROP COLUMN "emailVerifiedAt",
DROP COLUMN "email";
