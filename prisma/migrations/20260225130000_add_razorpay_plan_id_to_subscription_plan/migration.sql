-- Add razorpayPlanId to SubscriptionPlan (for Razorpay subscription plans)
ALTER TABLE "SubscriptionPlan" ADD COLUMN IF NOT EXISTS "razorpayPlanId" TEXT;
CREATE INDEX IF NOT EXISTS "SubscriptionPlan_razorpayPlanId_idx" ON "SubscriptionPlan"("razorpayPlanId");
