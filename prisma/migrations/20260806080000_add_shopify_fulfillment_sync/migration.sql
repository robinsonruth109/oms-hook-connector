-- Track Shopify fulfillment state beside each OMS delivery record.
ALTER TABLE "OrderPushJob"
ADD COLUMN "shopifyFulfillmentStatus" TEXT NOT NULL DEFAULT 'UNFULFILLED',
ADD COLUMN "shopifyFulfillmentUpdatedAt" TIMESTAMP(3),
ADD COLUMN "shopifyFulfillmentSyncedAt" TIMESTAMP(3),
ADD COLUMN "shopifyFulfilledAt" TIMESTAMP(3);

CREATE INDEX
"OrderPushJob_shop_shopifyFulfillmentStatus_idx"
ON "OrderPushJob"(
  "shop",
  "shopifyFulfillmentStatus"
);
