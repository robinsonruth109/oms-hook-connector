// app/routes/webhooks.compliance.tsx

import { Prisma } from "@prisma/client";
import type { ActionFunctionArgs } from "react-router";

import prisma from "../db.server";
import {
  createPrivacyDataRequestReport,
  purgePrivacyReportsForShop,
  recordProtectedDataAccess,
} from "../services/privacy.server";
import { authenticate } from "../shopify.server";

type CustomerRedactPayload = {
  customer?: {
    id?: string | number | null;
  } | null;
  orders_to_redact?:
    | Array<string | number>
    | null;
};

type DataRequestPayload = {
  customer?: {
    id?: string | number | null;
  } | null;
  orders_requested?:
    | Array<string | number>
    | null;
};

function isUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function deleteStoredOrders({
  shop,
  orderIds,
}: {
  shop: string;
  orderIds: Array<string | number>;
}) {
  const normalizedOrderIds = [
    ...new Set(
      orderIds
        .map((orderId) =>
          String(orderId).trim(),
        )
        .filter(Boolean),
    ),
  ];

  if (normalizedOrderIds.length === 0) {
    return 0;
  }

  /*
   * Deleting WebhookEvent records cascades to
   * OrderPushJob and OrderPushLog.
   */
  const result =
    await prisma.webhookEvent.deleteMany({
      where: {
        shop,
        shopifyOrderId: {
          in: normalizedOrderIds,
        },
      },
    });

  return result.count;
}

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const webhookId =
    request.headers
      .get("x-shopify-webhook-id")
      ?.trim() ?? "";

  const { topic, shop, payload } =
    await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      if (!webhookId) {
        console.error(
          "Compliance webhook ID is missing",
          {
            shop,
            topic,
          },
        );

        return new Response(
          "Missing Shopify webhook ID",
          {
            status: 400,
          },
        );
      }

      const dataRequest =
        payload as DataRequestPayload;

      const orderIds = Array.isArray(
        dataRequest.orders_requested,
      )
        ? dataRequest.orders_requested
        : [];

      try {
        const result =
          await createPrivacyDataRequestReport({
            shop,
            shopifyWebhookId: webhookId,
            customerId:
              dataRequest.customer?.id ??
              null,
            orderIds,
          });

        console.info(
          "Customer data request report prepared",
          {
            shop,
            privacyRequestId:
              result.id,
            created: result.created,
            requestedOrderCount:
              result.requestedOrderCount,
            matchedOrderCount:
              result.matchedOrderCount,
          },
        );

        return new Response(
          "Customer data request prepared",
          {
            status: 200,
          },
        );
      } catch (error) {
        /*
         * Shopify can deliver the same webhook more
         * than once. The unique webhook ID is the
         * final idempotency guard.
         */
        if (isUniqueConstraintError(error)) {
          return new Response(
            "Customer data request already prepared",
            {
              status: 200,
            },
          );
        }

        console.error(
          "Unable to prepare customer data request",
          {
            shop,
            topic,
            webhookId,
            error:
              error instanceof Error
                ? error.message
                : "Unknown error",
          },
        );

        return new Response(
          "Unable to prepare customer data request",
          {
            status: 500,
          },
        );
      }
    }

    case "CUSTOMERS_REDACT": {
      const redactRequest =
        payload as CustomerRedactPayload;

      const orderIds = Array.isArray(
        redactRequest.orders_to_redact,
      )
        ? redactRequest.orders_to_redact
        : [];

      const deletedOrderCount =
        await deleteStoredOrders({
          shop,
          orderIds,
        });

      /*
       * Customer identifiers exist only inside
       * encrypted reports, so conservatively purge
       * all active privacy reports for this shop.
       */
      const purgedReportCount =
        await purgePrivacyReportsForShop({
          shop,
          reason:
            "Purge privacy reports following a Shopify customer redaction request.",
        });

      await recordProtectedDataAccess({
        shop,
        action:
          "CUSTOMER_REDACTION_COMPLETED",
        resourceType:
          "SHOPIFY_CUSTOMER_REDACTION",
        purpose:
          "Delete customer-related order data stored by the connector.",
      });

      console.info(
        "Customer data redaction completed",
        {
          shop,
          deletedOrderCount,
          purgedReportCount,
        },
      );

      return new Response(
        "Customer data redacted",
        {
          status: 200,
        },
      );
    }

    case "SHOP_REDACT": {
      await prisma.$transaction([
        prisma.privacyDataRequest.deleteMany({
          where: {
            shop,
          },
        }),

        prisma.protectedDataAccessLog.deleteMany({
          where: {
            shop,
          },
        }),

        /*
         * Cascades to delivery jobs and logs.
         */
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

      console.info(
        "Shop data redaction completed",
        {
          shop,
        },
      );

      return new Response(
        "Shop data redacted",
        {
          status: 200,
        },
      );
    }

    default:
      console.warn(
        "Unsupported compliance webhook topic",
        {
          shop,
          topic,
        },
      );

      return new Response(
        "Unsupported compliance topic",
        {
          status: 404,
        },
      );
  }
};