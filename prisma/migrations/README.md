# Database Migrations

This directory contains Prisma migrations for the PocketWatch database.

## Migrations

### 20260208011522_add_deal_campaign_system

**Created:** 2026-02-08

**Description:** Adds the complete deal campaign flow system with phase-based progression.

**New Models:**
- `DealCampaign` - Main deal orchestrator with phase tracking
- `InterestGauge` - Phase 1 user interest submissions
- `Commitment` - Phase 2 user commitments with pro-rata allocation
- `DealContribution` - Phase 3 actual contributions (separate from legacy Contribution)
- `AllocationOverride` - Admin adjustment tracking
- `PhaseTransition` - Audit trail for phase changes

**New Enums:**
- `DealPhase` - INTEREST_GAUGE, PROOF_OF_COMMITMENT, CONTRIBUTION, CLOSED, VESTING
- `ProRataStrategy` - PRO_RATA_CURRENT, OPEN_TO_NEW
- `CommitmentStatus` - PENDING, APPROVED, REJECTED
- `ContributionStatus` - PENDING, VERIFIED, REJECTED, EDITED

**Schema Updates:**
- `VestingSchedule` - Added optional `dealCampaignId` field for linking to new deal campaigns
- `DealStatus` enum - Added ACTIVE, PAUSED, CANCELLED values
- `User` - Added relations to all new models

**Safety:**
- All monetary amounts use `Decimal(28,18)` for precision
- Proper indexes added for query performance
- Cascade deletes configured appropriately
- All new fields are optional or have defaults (backward compatible)
- No data loss - only additive changes

**Status:** ⚠️ NOT YET APPLIED - Review SQL before applying to production

## Applying This Migration

**IMPORTANT:** This migration has been created but NOT applied to the database yet.

To apply this migration to your database:

```bash
# Option 1: Apply migration using Prisma Migrate
npx prisma migrate deploy

# Option 2: Mark as applied without running (if already manually applied)
npx prisma migrate resolve --applied 20260208011522_add_deal_campaign_system

# Option 3: Review and manually apply the SQL
cat prisma/migrations/20260208011522_add_deal_campaign_system/migration.sql
# Then apply manually to your database
```

**For Production:**
1. Review the SQL in `migration.sql` carefully
2. Test in a staging environment first
3. Create a database backup before applying
4. Apply during low-traffic period
5. Verify application works correctly after migration

## Database URL Configuration

This project uses `prisma.config.ts` for configuration. The database URL is read from there instead of a `.env` file.
