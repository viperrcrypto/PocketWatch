-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "source" TEXT;
ALTER TABLE "Trip" ADD COLUMN "sourceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[];
