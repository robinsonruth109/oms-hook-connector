-- CreateTable
CREATE TABLE "OmsConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "encryptedWebhookSecret" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" DATETIME,
    "lastTestSucceeded" BOOLEAN,
    "lastTestMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyWebhookId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "shopifyOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateTable
CREATE TABLE "OrderPushJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "webhookEventId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "customerName" TEXT,
    "encryptedPayload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 7,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "OrderPushJob_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderPushLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "httpStatus" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "responseSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderPushLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OrderPushJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OmsConnection_shop_key" ON "OmsConnection"("shop");

-- CreateIndex
CREATE INDEX "OmsConnection_isEnabled_idx" ON "OmsConnection"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_shopifyWebhookId_key" ON "WebhookEvent"("shopifyWebhookId");

-- CreateIndex
CREATE INDEX "WebhookEvent_shop_receivedAt_idx" ON "WebhookEvent"("shop", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_shop_status_idx" ON "WebhookEvent"("shop", "status");

-- CreateIndex
CREATE INDEX "WebhookEvent_shopifyOrderId_idx" ON "WebhookEvent"("shopifyOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPushJob_webhookEventId_key" ON "OrderPushJob"("webhookEventId");

-- CreateIndex
CREATE INDEX "OrderPushJob_shop_createdAt_idx" ON "OrderPushJob"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "OrderPushJob_shop_status_idx" ON "OrderPushJob"("shop", "status");

-- CreateIndex
CREATE INDEX "OrderPushJob_status_nextAttemptAt_idx" ON "OrderPushJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OrderPushJob_externalOrderId_idx" ON "OrderPushJob"("externalOrderId");

-- CreateIndex
CREATE INDEX "OrderPushLog_shop_createdAt_idx" ON "OrderPushLog"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "OrderPushLog_shop_status_idx" ON "OrderPushLog"("shop", "status");

-- CreateIndex
CREATE INDEX "OrderPushLog_jobId_attemptNumber_idx" ON "OrderPushLog"("jobId", "attemptNumber");

-- CreateIndex
CREATE INDEX "OrderPushLog_externalOrderId_idx" ON "OrderPushLog"("externalOrderId");

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");
