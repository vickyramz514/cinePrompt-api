-- Remove Prisma tables that have no application code references.
-- Safe: does not touch DataCaptain tables (stocks, api_usage, etc.) or AdminAuditLog.

DROP TABLE IF EXISTS "CreditUsageLog" CASCADE;
DROP TABLE IF EXISTS "VideoAsset" CASCADE;
DROP TABLE IF EXISTS "ApiUsage" CASCADE;
DROP TABLE IF EXISTS "NotificationPreference" CASCADE;
DROP TABLE IF EXISTS "ErrorLog" CASCADE;
DROP TABLE IF EXISTS "SystemSettings" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "SystemMetrics" CASCADE;

DROP TYPE IF EXISTS "ErrorSeverity";
DROP TYPE IF EXISTS "NotificationChannel";
