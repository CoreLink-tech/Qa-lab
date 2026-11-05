-- AlterTable
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "totpSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN "totpRecoveryHashes" TEXT[] DEFAULT ARRAY[]::TEXT[];
