-- Encrypted DataCaptain key material (Prisma /api-keys/regenerate, /api-keys/me)
CREATE TABLE IF NOT EXISTS "ApiKeySecret" (
    "apiKeyId" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeySecret_pkey" PRIMARY KEY ("apiKeyId")
);

-- api_keys.key_prefix holds first 12 chars (e.g. sdata_abcdef); VARCHAR(10) truncates / errors in Postgres
ALTER TABLE api_keys ALTER COLUMN key_prefix TYPE VARCHAR(32);
