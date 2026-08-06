import { Prisma } from "@prisma/client";

import prisma from "../db.server";

type ShopifyFulfillmentWebhook = {
  id?: string | number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ShopifyOrderStatusWebhook = {
  id?: string | number | null;
  fulfillment_status?: string | null;
  updated_at?: string | null;
  fulfillments?: ShopifyFulfillmentWebhook[] | null;
};

type GraphqlOrderFulfillment = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type GraphqlOrderNode = {
  id: string;
  displayFulfillmentStatus: string;
  updatedAt: string;
  fulfillments: GraphqlOrderFulfillment[];
};

type GraphqlSyncResponse = {
  data?: {
    nodes?: Array<GraphqlOrderNode | null>;
  };
  errors?: Array<{
    message?: string;
  }>;
};

type GraphqlRequester = (
  query: string,
  variables: Record<string, unknown>,
) => Promise<Response>;

export type FulfillmentWebhookResult = {
  duplicate: boolean;
  matched: boolean;
  message: string;
  fulfillmentStatus: string | null;
};

export type FulfillmentReconciliationSummary = {
  checked: number;
  matched: number;
  updated: number;
  unavailable: number;
  error: string | null;
};

const FULFILLED_STATUSES = new Set([
  "FULFILLED",
  "PARTIALLY_FULFILLED",
]);

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function latestDate(values: Array<Date | null>): Date | null {
  const timestamps = values
    .filter((value): value is Date => value !== null)
    .map((value) => value.getTime());

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
}

export function normalizeShopifyFulfillmentStatus(
  value: unknown,
): string {
  if (typeof value !== "string") {
    return "UNFULFILLED";
  }

  const normalized = value
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

  if (!normalized || normalized === "NULL") {
    return "UNFULFILLED";
  }

  if (normalized === "PARTIAL") {
    return "PARTIALLY_FULFILLED";
  }

  if (normalized === "OPEN") {
    return "UNFULFILLED";
  }

  return normalized;
}

function statusFromWebhookTopic({
  topic,
  payloadStatus,
}: {
  topic: string;
  payloadStatus: unknown;
}): string {
  if (topic === "ORDERS_FULFILLED") {
    return "FULFILLED";
  }

  if (topic === "ORDERS_PARTIALLY_FULFILLED") {
    return "PARTIALLY_FULFILLED";
  }

  return normalizeShopifyFulfillmentStatus(payloadStatus);
}

function fulfilledAtFromWebhook({
  order,
  fulfillmentStatus,
}: {
  order: ShopifyOrderStatusWebhook;
  fulfillmentStatus: string;
}): Date | null {
  if (!FULFILLED_STATUSES.has(fulfillmentStatus)) {
    return null;
  }

  const fulfillments = Array.isArray(order.fulfillments)
    ? order.fulfillments
    : [];

  const latestFulfillmentDate = latestDate(
    fulfillments
      .filter(
        (fulfillment) =>
          normalizeShopifyFulfillmentStatus(
            fulfillment.status,
          ) !== "CANCELLED",
      )
      .flatMap((fulfillment) => [
        parseDate(fulfillment.updated_at),
        parseDate(fulfillment.created_at),
      ]),
  );

  return (
    latestFulfillmentDate ??
    parseDate(order.updated_at) ??
    new Date()
  );
}

function fulfilledAtFromGraphql({
  node,
  fulfillmentStatus,
}: {
  node: GraphqlOrderNode;
  fulfillmentStatus: string;
}): Date | null {
  if (!FULFILLED_STATUSES.has(fulfillmentStatus)) {
    return null;
  }

  const latestFulfillmentDate = latestDate(
    node.fulfillments
      .filter(
        (fulfillment) =>
          normalizeShopifyFulfillmentStatus(
            fulfillment.status,
          ) !== "CANCELLED",
      )
      .flatMap((fulfillment) => [
        parseDate(fulfillment.updatedAt),
        parseDate(fulfillment.createdAt),
      ]),
  );

  return (
    latestFulfillmentDate ??
    parseDate(node.updatedAt) ??
    new Date()
  );
}

function getShopifyOrderId(
  order: ShopifyOrderStatusWebhook,
): string | null {
  if (order.id === null || order.id === undefined) {
    return null;
  }

  const normalized = String(order.id).trim();

  return normalized || null;
}

function toOrderGid(shopifyOrderId: string): string {
  if (shopifyOrderId.startsWith("gid://shopify/Order/")) {
    return shopifyOrderId;
  }

  return `gid://shopify/Order/${shopifyOrderId}`;
}

export async function syncOrderFulfillmentWebhook({
  shop,
  webhookId,
  topic,
  order,
}: {
  shop: string;
  webhookId: string;
  topic: string;
  order: ShopifyOrderStatusWebhook;
}): Promise<FulfillmentWebhookResult> {
  const existingEvent =
    await prisma.webhookEvent.findUnique({
      where: {
        shopifyWebhookId: webhookId,
      },
      select: {
        status: true,
      },
    });

  if (existingEvent) {
    return {
      duplicate: true,
      matched: false,
      message: "This Shopify webhook was already processed.",
      fulfillmentStatus: null,
    };
  }

  const shopifyOrderId = getShopifyOrderId(order);

  if (!shopifyOrderId) {
    throw new Error(
      "The Shopify fulfillment webhook does not contain an order ID.",
    );
  }

  const now = new Date();
  const fulfillmentStatus = statusFromWebhookTopic({
    topic,
    payloadStatus: order.fulfillment_status,
  });
  const fulfillmentUpdatedAt =
    parseDate(order.updated_at) ?? now;
  const fulfilledAt = fulfilledAtFromWebhook({
    order,
    fulfillmentStatus,
  });

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const job =
          await transaction.orderPushJob.findFirst({
            where: {
              shop,
              webhookEvent: {
                is: {
                  shopifyOrderId,
                },
              },
            },
            select: {
              id: true,
            },
          });

        await transaction.webhookEvent.create({
          data: {
            shop,
            shopifyWebhookId: webhookId,
            topic,
            shopifyOrderId,
            status: "SUCCESS",
            errorMessage: job
              ? null
              : "No matching OMS delivery record was found for this Shopify order.",
            processedAt: now,
          },
        });

        if (!job) {
          return {
            duplicate: false,
            matched: false,
            message:
              "The Shopify fulfillment update was recorded, but no matching OMS delivery record was found.",
            fulfillmentStatus,
          };
        }

        await transaction.orderPushJob.update({
          where: {
            id: job.id,
          },
          data: {
            shopifyFulfillmentStatus:
              fulfillmentStatus,
            shopifyFulfillmentUpdatedAt:
              fulfillmentUpdatedAt,
            shopifyFulfillmentSyncedAt: now,
            shopifyFulfilledAt: fulfilledAt,
          },
        });

        return {
          duplicate: false,
          matched: true,
          message:
            "The Shopify fulfillment status was synchronized.",
          fulfillmentStatus,
        };
      },
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        duplicate: true,
        matched: false,
        message: "This Shopify webhook was already processed.",
        fulfillmentStatus: null,
      };
    }

    throw error;
  }
}

export async function reconcileRecentOrderFulfillmentStatuses({
  shop,
  jobs,
  graphql,
}: {
  shop: string;
  jobs: Array<{
    id: string;
    shopifyOrderId: string | null;
  }>;
  graphql: GraphqlRequester;
}): Promise<FulfillmentReconciliationSummary> {
  const candidates = jobs
    .filter(
      (
        job,
      ): job is {
        id: string;
        shopifyOrderId: string;
      } => Boolean(job.shopifyOrderId?.trim()),
    )
    .slice(0, 50);

  if (candidates.length === 0) {
    return {
      checked: 0,
      matched: 0,
      updated: 0,
      unavailable: 0,
      error: null,
    };
  }

  const jobByGid = new Map(
    candidates.map((job) => [
      toOrderGid(job.shopifyOrderId),
      job,
    ]),
  );

  const query = `#graphql
    query OmsConnectorOrderFulfillmentSync($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Order {
          id
          displayFulfillmentStatus
          updatedAt
          fulfillments(first: 10) {
            id
            status
            createdAt
            updatedAt
          }
        }
      }
    }
  `;

  try {
    const response = await graphql(query, {
      ids: [...jobByGid.keys()],
    });

    const body =
      (await response.json()) as GraphqlSyncResponse;

    if (!response.ok || body.errors?.length) {
      const message =
        body.errors
          ?.map((error) => error.message)
          .filter(Boolean)
          .join("; ") ||
        `Shopify returned HTTP ${response.status}.`;

      return {
        checked: candidates.length,
        matched: 0,
        updated: 0,
        unavailable: candidates.length,
        error: message,
      };
    }

    const nodes = Array.isArray(body.data?.nodes)
      ? body.data.nodes
      : [];
    const now = new Date();
    let matched = 0;
    let updated = 0;

    for (const node of nodes) {
      if (!node) {
        continue;
      }

      const job = jobByGid.get(node.id);

      if (!job) {
        continue;
      }

      matched += 1;

      const fulfillmentStatus =
        normalizeShopifyFulfillmentStatus(
          node.displayFulfillmentStatus,
        );
      const fulfillmentUpdatedAt =
        parseDate(node.updatedAt) ?? now;
      const fulfilledAt = fulfilledAtFromGraphql({
        node,
        fulfillmentStatus,
      });

      const result =
        await prisma.orderPushJob.updateMany({
          where: {
            id: job.id,
            shop,
          },
          data: {
            shopifyFulfillmentStatus:
              fulfillmentStatus,
            shopifyFulfillmentUpdatedAt:
              fulfillmentUpdatedAt,
            shopifyFulfillmentSyncedAt: now,
            shopifyFulfilledAt: fulfilledAt,
          },
        });

      updated += result.count;
    }

    return {
      checked: candidates.length,
      matched,
      updated,
      unavailable:
        candidates.length - matched,
      error: null,
    };
  } catch (error) {
    return {
      checked: candidates.length,
      matched: 0,
      updated: 0,
      unavailable: candidates.length,
      error:
        error instanceof Error
          ? error.message
          : "Unable to refresh fulfillment statuses from Shopify.",
    };
  }
}
