-- Allow protected order payloads to be removed after processing.
ALTER TABLE "OrderPushJob"
ALTER COLUMN "encryptedPayload" DROP NOT NULL;

-- Add explicit personal-data retention tracking.
ALTER TABLE "OrderPushJob"
ADD COLUMN "personalDataExpiresAt" TIMESTAMP(3),
ADD COLUMN "payloadPurgedAt" TIMESTAMP(3);

-- Existing jobs receive the same seven-day retention limit.
UPDATE "OrderPushJob"
SET "personalDataExpiresAt" =
  "createdAt" + INTERVAL '7 days'
WHERE
  "encryptedPayload" IS NOT NULL
  AND "personalDataExpiresAt" IS NULL;

-- Immediately remove protected payloads from previously successful jobs.
UPDATE "OrderPushJob"
SET
  "encryptedPayload" = NULL,
  "customerName" = NULL,
  "payloadPurgedAt" = COALESCE(
    "completedAt",
    CURRENT_TIMESTAMP
  )
WHERE "status" = 'SUCCESS';

CREATE INDEX
"OrderPushJob_personalDataExpiresAt_idx"
ON "OrderPushJob"("personalDataExpiresAt");

-- Audit log for protected-data processing.
CREATE TABLE "ProtectedDataAccessLog" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "purpose" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProtectedDataAccessLog_pkey"
  PRIMARY KEY ("id")
);

CREATE INDEX
"ProtectedDataAccessLog_shop_createdAt_idx"
ON "ProtectedDataAccessLog"("shop", "createdAt");

CREATE INDEX
"ProtectedDataAccessLog_action_createdAt_idx"
ON "ProtectedDataAccessLog"("action", "createdAt");

CREATE INDEX
"ProtectedDataAccessLog_resourceType_resourceId_idx"
ON "ProtectedDataAccessLog"(
  "resourceType",
  "resourceId"
);