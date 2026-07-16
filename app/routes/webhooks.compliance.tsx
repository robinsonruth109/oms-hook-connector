import type { ActionFunctionArgs } from "react-router";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";

type CustomerRedactPayload = {
  customer?: {
    id?: string | number | null;
  } | null;
  orders_to_redact?: Array<string | number> | null;
};

type DataRequestPayload = {
  customer?: {
    id?: string | number | null;
  } | null;
  orders_requested?: Array<string | number> | null;
};

async function deleteStoredOrders({
  shop,
  orderIds,
}: {
  shop: string;
  orderIds: Array<string | number>;
}) {
  const normalizedOrderIds = orderIds
    .map((orderId) => String(orderId).trim())
    .filter(Boolean);

  if (normalizedOrderIds.length === 0) {
    return 0;
  }

  // Deleting WebhookEvent records cascades to OrderPushJob
  // and OrderPushLog through the Prisma relations.
  const result = await prisma.webhookEvent.deleteMany({
    where: {
      shop,
      shopifyOrderId: {
        in: normalizedOrderIds,
      },
    },
  });

  return result.count;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      const dataRequest = payload as DataRequestPayload;

      // Do not log customer email, phone, address, or raw payload.
      console.info("Customer data request received", {
        shop,
        customerId:
          dataRequest.customer?.id !== undefined &&
          dataRequest.customer?.id !== null
            ? String(dataRequest.customer.id)
            : null,
        requestedOrderCount: Array.isArray(dataRequest.orders_requested)
          ? dataRequest.orders_requested.length
          : 0,
      });

      return new Response("Customer data request received", {
        status: 200,
      });
    }

    case "CUSTOMERS_REDACT": {
      const redactRequest = payload as CustomerRedactPayload;

      const deletedOrderCount = await deleteStoredOrders({
        shop,
        orderIds: Array.isArray(redactRequest.orders_to_redact)
          ? redactRequest.orders_to_redact
          : [],
      });

      console.info("Customer data redaction completed", {
        shop,
        customerId:
          redactRequest.customer?.id !== undefined &&
          redactRequest.customer?.id !== null
            ? String(redactRequest.customer.id)
            : null,
        deletedOrderCount,
      });

      return new Response("Customer data redacted", {
        status: 200,
      });
    }

    case "SHOP_REDACT": {
      await prisma.$transaction([
        // Cascades to delivery jobs and delivery logs.
        prisma.webhookEvent.deleteMany({
          where: {
            shop,
          },
        }),

        prisma.omsConnection.deleteMany({
          where: {
            shop,
          },
        }),

        prisma.session.deleteMany({
          where: {
            shop,
          },
        }),
      ]);

      console.info("Shop data redaction completed", {
        shop,
      });

      return new Response("Shop data redacted", {
        status: 200,
      });
    }

    default:
      console.warn("Unsupported compliance webhook topic", {
        shop,
        topic,
      });

      return new Response("Unsupported compliance topic", {
        status: 404,
      });
  }
};