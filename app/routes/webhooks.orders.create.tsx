import type { ActionFunctionArgs } from "react-router";

import prisma from "../db.server";
import { encryptSecret } from "../services/crypto.server";
import {
  processOrderPushJob,
} from "../services/order-delivery.server";
import {
  mapShopifyOrderToOms,
  type ShopifyOrderWebhook,
} from "../services/order-mapper.server";
import { authenticate } from "../shopify.server";

const INITIAL_OMS_TIMEOUT_MS = 3_000;

function getShopifyOrderId(
  order: ShopifyOrderWebhook,
): string | null {
  if (order.id === null || order.id === undefined) {
    return null;
  }

  return String(order.id);
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
}

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const webhookId =
    request.headers
      .get("x-shopify-webhook-id")
      ?.trim() || "";

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

    return new Response(
      "Missing Shopify webhook ID",
      {
        status: 400,
      },
    );
  }

  const existingEvent =
    await prisma.webhookEvent.findUnique({
      where: {
        shopifyWebhookId: webhookId,
      },
      select: {
        id: true,
        status: true,
      },
    });

  if (existingEvent) {
    console.log(
      "Duplicate Shopify webhook ignored",
      {
        shop,
        topic,
        webhookId,
        status: existingEvent.status,
      },
    );

    return new Response("Already processed", {
      status: 200,
    });
  }

  const order = payload as ShopifyOrderWebhook;
  const shopifyOrderId =
    getShopifyOrderId(order);

  const connection =
    await prisma.omsConnection.findUnique({
      where: {
        shop,
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

    return new Response(
      "OMS connection not configured",
      {
        status: 200,
      },
    );
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

    return new Response(
      "OMS connection disabled",
      {
        status: 200,
      },
    );
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

    console.error(
      "Shopify order validation failed",
      {
        shop,
        webhookId,
        shopifyOrderId,
        error,
      },
    );

    return new Response(
      "Order validation failed",
      {
        status: 200,
      },
    );
  }

  const encryptedPayload = encryptSecret(
    JSON.stringify(mappedOrder),
  );

  const { job } = await prisma.$transaction(
    async (transaction) => {
      const event =
        await transaction.webhookEvent.create({
          data: {
            shop,
            shopifyWebhookId: webhookId,
            topic,
            shopifyOrderId,
            status: "PENDING",
          },
        });

      const createdJob =
        await transaction.orderPushJob.create({
          data: {
            shop,
            webhookEventId: event.id,
            externalOrderId:
              mappedOrder.externalOrderId,
            invoiceId: mappedOrder.invoiceId,
            customerName:
              mappedOrder.customerName,
            encryptedPayload,
            status: "PENDING",
            attempts: 0,
            nextAttemptAt: new Date(),
          },
        });

      return {
        job: createdJob,
      };
    },
  );

  try {
    const result = await processOrderPushJob({
      jobId: job.id,
      shop,
      timeoutMs: INITIAL_OMS_TIMEOUT_MS,
    });

    console.log(
      "Shopify order webhook processed",
      {
        shop,
        webhookId,
        externalOrderId:
          mappedOrder.externalOrderId,
        status: result.status,
        attemptNumber:
          result.attemptNumber,
      },
    );
  } catch (error) {
    const retryAt = new Date(
      Date.now() + 60 * 1000,
    );

    await prisma.$transaction([
      prisma.orderPushJob.update({
        where: {
          id: job.id,
        },
        data: {
          status: "RETRYING",
          nextAttemptAt: retryAt,
          lastError:
            error instanceof Error
              ? error.message
              : "Unexpected delivery error.",
        },
      }),

      prisma.webhookEvent.update({
        where: {
          id: job.webhookEventId,
        },
        data: {
          status: "RETRYING",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unexpected delivery error.",
        },
      }),
    ]);

    console.error(
      "Initial OMS delivery failed unexpectedly",
      {
        shop,
        webhookId,
        jobId: job.id,
        error,
      },
    );
  }

  return new Response("OK", {
    status: 200,
  });
};