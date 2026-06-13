-- CreateTable
CREATE TABLE "SavedRoute" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureDate" TEXT NOT NULL,
    "returnDate" TEXT,
    "tripType" TEXT NOT NULL DEFAULT 'one_way',
    "searchClass" TEXT NOT NULL DEFAULT 'ECON',
    "alertThreshold" DOUBLE PRECISION,
    "thresholdType" TEXT NOT NULL DEFAULT 'cash',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastPrice" DOUBLE PRECISION,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "savedRouteId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "cashPrice" DOUBLE PRECISION,
    "points" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedRoute_userId_active_idx" ON "SavedRoute"("userId", "active");

-- CreateIndex
CREATE INDEX "PriceSnapshot_savedRouteId_capturedAt_idx" ON "PriceSnapshot"("savedRouteId", "capturedAt");

-- AddForeignKey
ALTER TABLE "SavedRoute" ADD CONSTRAINT "SavedRoute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_savedRouteId_fkey" FOREIGN KEY ("savedRouteId") REFERENCES "SavedRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
