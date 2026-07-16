CREATE TABLE "PrivacyDataRequest" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "shopifyWebhookId" TEXT NOT NULL,

  "status" TEXT NOT NULL DEFAULT 'READY',
  "requestedOrderCount" INTEGER NOT NULL DEFAULT 0,
  "matchedOrderCount" INTEGER NOT NULL DEFAULT 0,

  "encryptedReport" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  "firstViewedAt" TIMESTAMP(3),
  "lastDownloadedAt" TIMESTAMP(3),
  "reportPurgedAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PrivacyDataRequest_pkey"
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
"PrivacyDataRequest_shopifyWebhookId_key"
ON "PrivacyDataRequest"("shopifyWebhookId");

CREATE INDEX
"PrivacyDataRequest_shop_createdAt_idx"
ON "PrivacyDataRequest"("shop", "createdAt");

CREATE INDEX
"PrivacyDataRequest_shop_status_idx"
ON "PrivacyDataRequest"("shop", "status");

CREATE INDEX
"PrivacyDataRequest_expiresAt_idx"
ON "PrivacyDataRequest"("expiresAt");