/*
  Warnings:

  - You are about to drop the column `encryptedWebhookSecret` on the `OmsConnection` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OmsConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" DATETIME,
    "lastTestSucceeded" BOOLEAN,
    "lastTestMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_OmsConnection" ("createdAt", "encryptedApiKey", "endpoint", "id", "isEnabled", "lastTestMessage", "lastTestSucceeded", "lastTestedAt", "shop", "updatedAt") SELECT "createdAt", "encryptedApiKey", "endpoint", "id", "isEnabled", "lastTestMessage", "lastTestSucceeded", "lastTestedAt", "shop", "updatedAt" FROM "OmsConnection";
DROP TABLE "OmsConnection";
ALTER TABLE "new_OmsConnection" RENAME TO "OmsConnection";
CREATE UNIQUE INDEX "OmsConnection_shop_key" ON "OmsConnection"("shop");
CREATE INDEX "OmsConnection_isEnabled_idx" ON "OmsConnection"("isEnabled");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
