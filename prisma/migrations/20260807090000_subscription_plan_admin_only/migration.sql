-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN IF NOT EXISTS "adminOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubscriptionPlan_adminOnly_idx" ON "SubscriptionPlan"("adminOnly");
