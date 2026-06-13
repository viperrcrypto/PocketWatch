-- Add per-transaction trip-exclusion flag so a charge the user removes from a
-- trip is never re-tagged by the auto-tagger or a manual re-tag.
ALTER TABLE "FinanceTransaction" ADD COLUMN "tripExcluded" BOOLEAN NOT NULL DEFAULT false;
