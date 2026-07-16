import { Prisma } from "@prisma/client";
import type { ActionFunctionArgs } from "react-router";

import prisma from "../db.server";
import { encryptSecret } from "../services/crypto.server";
import {
  mapShopifyOrderToOms,
  type ShopifyOrderWebhook,
} from "../services/order-mapper.server";
import { calculatePersonalDataExpiry } from "../services/privacy.server";
import { authenticate } from "../shopify.server";

function getShopifyOrderId(
  order: ShopifyOrderWebhook,
): string | null {
  if (order.id === null || order.id === undefined) {
    return null;
  }

  return String(order.id);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function recordRejectedWebhook({
  shop,
  webhookId,
  topic,
  shopifyOrderId,
  message,
}: {
  shop: string;
  webhookId: string;
  topic: string;
  shopifyOrderId: string | null;
  message: string;
}) {
  try {
    await prisma.webhookEvent.create({
      data: {
        shop,
        shopifyWebhookId: webhookId,
        topic,
        shopifyOrderId,
        status: "FAILED",
        errorMessage: message,
        processedAt: new Date(),
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return;
    }

    throw error;
  }
}

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const webhookId =
    request.headers.get("x-shopify-webhook-id")?.trim() ?? "";

  const { topic, shop, payload } =
    await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    return new Response("Unhandled webhook topic", {
      status: 404,
    });
  }

  if (!webhookId) {
    console.error("Shopify webhook ID is missing", {
      shop,
      topic,
    });

    return new Response("Missing Shopify webhook ID", {
      status: 400,
    });
  }

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
    console.info("Duplicate Shopify webhook ignored", {
      shop,
      topic,
      webhookId,
      status: existingEvent.status,
    });

    return new Response("Already received", {
      status: 200,
    });
  }

  const order = payload as ShopifyOrderWebhook;
  const shopifyOrderId = getShopifyOrderId(order);

  const connection =
    await prisma.omsConnection.findUnique({
      where: {
        shop,
      },
      select: {
        isEnabled: true,
      },
    });

  if (!connection) {
    const message =
      "No OMS connection is configured for this Shopify store.";

    await recordRejectedWebhook({
      shop,
      webhookId,
      topic,
      shopifyOrderId,
      message,
    });

    console.warn(message, {
      shop,
      webhookId,
      shopifyOrderId,
    });

    return new Response("OMS connection not configured", {
      status: 200,
    });
  }

  if (!connection.isEnabled) {
    const message =
      "Automatic OMS order delivery is disabled for this store.";

    await recordRejectedWebhook({
      shop,
      webhookId,
      topic,
      shopifyOrderId,
      message,
    });

    console.warn(message, {
      shop,
      webhookId,
      shopifyOrderId,
    });

    return new Response("OMS connection disabled", {
      status: 200,
    });
  }

  let mappedOrder;

  try {
    mappedOrder = mapShopifyOrderToOms({
      order,
      shop,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to convert the Shopify order.";

    await recordRejectedWebhook({
      shop,
      webhookId,
      topic,
      shopifyOrderId,
      message,
    });

    console.error("Shopify order validation failed", {
      shop,
      webhookId,
      shopifyOrderId,
      error,
    });

    // Retrying the same webhook will not fix missing order data.
    return new Response("Order validation failed", {
      status: 200,
    });
  }

  try {
    const encryptedPayload = encryptSecret(
      JSON.stringify(mappedOrder),
    );

    const now = new Date();

    await prisma.$transaction(async (transaction) => {
      const event = await transaction.webhookEvent.create({
        data: {
          shop,
          shopifyWebhookId: webhookId,
          topic,
          shopifyOrderId,
          status: "PENDING",
        },
      });

      const job = await transaction.orderPushJob.create({
        data: {
          shop,
          webhookEventId: event.id,
          externalOrderId: mappedOrder.externalOrderId,
          invoiceId: mappedOrder.invoiceId,

          // Do not store the customer name separately in plaintext.
          customerName: null,

          encryptedPayload,
          personalDataExpiresAt:
            calculatePersonalDataExpiry(now),
          payloadPurgedAt: null,

          status: "PENDING",
          attempts: 0,
          nextAttemptAt: now,
        },
      });

      await transaction.protectedDataAccessLog.create({
        data: {
          shop,
          action: "ORDER_PAYLOAD_ENCRYPTED_AND_STORED",
          resourceType: "ORDER_PUSH_JOB",
          resourceId: job.id,
          actorType: "SYSTEM",
          purpose:
            "Temporarily queue the order for delivery to the merchant-configured OMS.",
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      console.info("Concurrent duplicate webhook ignored", {
        shop,
        webhookId,
      });

      return new Response("Already received", {
        status: 200,
      });
    }

    console.error("Unable to queue Shopify order", {
      shop,
      webhookId,
      shopifyOrderId,
      error,
    });

    return new Response("Unable to queue order", {
      status: 500,
    });
  }

  console.info("Shopify order queued for OMS delivery", {
    shop,
    webhookId,
    shopifyOrderId,
    externalOrderId: mappedOrder.externalOrderId,
  });

  return new Response("Queued", {
    status: 200,
  });
};