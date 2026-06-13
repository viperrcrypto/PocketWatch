-- CreateTable
CREATE TABLE "PkceFlow" (
    "state" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'atf',
    "codeVerifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PkceFlow_pkey" PRIMARY KEY ("state")
);

-- CreateIndex
CREATE INDEX "PkceFlow_expiresAt_idx" ON "PkceFlow"("expiresAt");

-- AddForeignKey
ALTER TABLE "PkceFlow" ADD CONSTRAINT "PkceFlow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
