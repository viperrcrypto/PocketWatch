-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "encryptedDek" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "encryptionSalt" TEXT;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
