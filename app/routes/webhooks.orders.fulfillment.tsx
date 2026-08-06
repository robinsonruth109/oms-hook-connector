import type { ActionFunctionArgs } from "react-router";

import {
  syncOrderFulfillmentWebhook,
  type ShopifyOrderStatusWebhook,
} from "../services/order-status-sync.server";
import { authenticate } from "../shopify.server";

const SUPPORTED_TOPICS = new Set([
  "ORDERS_FULFILLED",
  "ORDERS_PARTIALLY_FULFILLED",
  "ORDERS_UPDATED",
]);

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const webhookId =
    request.headers.get("x-shopify-webhook-id")?.trim() ?? "";

  const { topic, shop, payload } =
    await authenticate.webhook(request);

  if (!SUPPORTED_TOPICS.has(topic)) {
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

  try {
    const result =
      await syncOrderFulfillmentWebhook({
        shop,
        webhookId,
        topic,
        order: payload as ShopifyOrderStatusWebhook,
      });

    console.info(
      "Shopify fulfillment status webhook processed",
      {
        shop,
        topic,
        webhookId,
        duplicate: result.duplicate,
        matched: result.matched,
        fulfillmentStatus:
          result.fulfillmentStatus,
      },
    );

    return new Response(result.message, {
      status: 200,
    });
  } catch (error) {
    console.error(
      "Unable to synchronize Shopify fulfillment status",
      {
        shop,
        topic,
        webhookId,
        error,
      },
    );

    return new Response(
      "Unable to synchronize fulfillment status",
      {
        status: 500,
      },
    );
  }
};
