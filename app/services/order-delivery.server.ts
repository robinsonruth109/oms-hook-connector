// app/services/order-delivery.server.ts

import prisma from "../db.server";
import { decryptSecret } from "./crypto.server";
import {
  sendOmsOrder,
  type OmsOrderData,
  type OmsRequestResult,
} from "./oms.server";

type DeliveryStatus =
  | "PENDING"
  | "PROCESSING"
  | "RETRYING"
  | "SUCCESS"
  | "FAILED";

export type ProcessOrderJobResult = {
  processed: boolean;
  status: DeliveryStatus | null;
  message: string;
  attemptNumber: number | null;
  nextAttemptAt: Date | null;
};

export type RetryRunSummary = {
  selected: number;
  processed: number;
  successful: number;
  retrying: number;
  failed: number;
  skipped: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

const RETRY_DELAY_SECONDS = [
  60,
  5 * 60,
  15 * 60,
  60 * 60,
  6 * 60 * 60,
  24 * 60 * 60,
];

function parseEncryptedOrderPayload(
  encryptedPayload: string | null,
): OmsOrderData {
  if (!encryptedPayload) {
    throw new Error(
      "The protected order payload is no longer available.",
    );
  }

  const decryptedPayload =
    decryptSecret(encryptedPayload);

  const parsed = JSON.parse(
    decryptedPayload,
  ) as Partial<OmsOrderData>;

  if (
    !parsed ||
    typeof parsed.externalOrderId !== "string" ||
    typeof parsed.invoiceId !== "string" ||
    typeof parsed.customerName !== "string" ||
    typeof parsed.phone !== "string" ||
    typeof parsed.address !== "string" ||
    !Array.isArray(parsed.items)
  ) {
    throw new Error(
      "The saved OMS order payload has an invalid format.",
    );
  }

  return parsed as OmsOrderData;
}

function isRetryableFailure(
  result: OmsRequestResult,
): boolean {
  if (result.success) {
    return false;
  }

  if (result.httpStatus === null) {
    return true;
  }

  return (
    result.httpStatus === 408 ||
    result.httpStatus === 429 ||
    result.httpStatus >= 500
  );
}

function calculateNextAttemptAt(
  completedAttemptNumber: number,
): Date {
  const delayIndex = Math.min(
    Math.max(completedAttemptNumber - 1, 0),
    RETRY_DELAY_SECONDS.length - 1,
  );

  const delaySeconds =
    RETRY_DELAY_SECONDS[delayIndex] ??
    RETRY_DELAY_SECONDS[
      RETRY_DELAY_SECONDS.length - 1
    ];

  return new Date(
    Date.now() + delaySeconds * 1000,
  );
}

function createLocalFailure(
  message: string,
): OmsRequestResult {
  return {
    success: false,
    httpStatus: null,
    durationMs: 0,
    message,
    responseSummary: null,
  };
}

/*
 * Never store the raw OMS response because an OMS could echo
 * a name, phone number or address in its response.
 */
function getSafeStoredMessage(
  result: OmsRequestResult,
): string {
  if (result.success) {
    return "Order accepted by the OMS.";
  }

  if (result.httpStatus === null) {
    return "The OMS could not be reached or the protected order payload could not be prepared.";
  }

  if (
    result.httpStatus === 401 ||
    result.httpStatus === 403
  ) {
    return "The OMS rejected the configured API key.";
  }

  if (result.httpStatus === 404) {
    return "The configured OMS endpoint was not found.";
  }

  if (result.httpStatus === 408) {
    return "The OMS request timed out.";
  }

  if (
    result.httpStatus === 400 ||
    result.httpStatus === 422
  ) {
    return "The OMS rejected the submitted order data.";
  }

  if (result.httpStatus === 409) {
    return "The OMS reported that the order already exists.";
  }

  if (result.httpStatus === 429) {
    return "The OMS is temporarily rate-limiting requests.";
  }

  if (result.httpStatus >= 500) {
    return `The OMS server returned HTTP ${result.httpStatus}.`;
  }

  return `The OMS rejected the order with HTTP ${result.httpStatus}.`;
}

async function expireProtectedPayload({
  jobId,
  webhookEventId,
  shop,
}: {
  jobId: string;
  webhookEventId: string;
  shop: string;
}): Promise<void> {
  const now = new Date();
  const message =
    "The protected order payload expired before OMS delivery completed.";

  await prisma.$transaction(
    async (transaction) => {
      await transaction.orderPushJob.update({
        where: {
          id: jobId,
        },
        data: {
          encryptedPayload: null,
          customerName: null,
          payloadPurgedAt: now,
          status: "FAILED",
          completedAt: now,
          nextAttemptAt: now,
          lastError: message,
        },
      });

      await transaction.webhookEvent.update({
        where: {
          id: webhookEventId,
        },
        data: {
          status: "FAILED",
          processedAt: now,
          errorMessage: message,
        },
      });

      await transaction.protectedDataAccessLog.create({
        data: {
          shop,
          action:
            "ORDER_PAYLOAD_PURGED_AFTER_RETENTION_LIMIT",
          resourceType: "ORDER_PUSH_JOB",
          resourceId: jobId,
          actorType: "SYSTEM",
          purpose:
            "Enforce the seven-day personal-data retention limit.",
        },
      });
    },
  );
}

export async function processOrderPushJob({
  jobId,
  shop,
  force = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  jobId: string;
  shop?: string;
  force?: boolean;
  timeoutMs?: number;
}): Promise<ProcessOrderJobResult> {
  const currentJob =
    await prisma.orderPushJob.findFirst({
      where: {
        id: jobId,
        ...(shop ? { shop } : {}),
      },
    });

  if (!currentJob) {
    return {
      processed: false,
      status: null,
      message: "The delivery job was not found.",
      attemptNumber: null,
      nextAttemptAt: null,
    };
  }

  if (currentJob.status === "SUCCESS") {
    /*
     * Backward-compatible cleanup for successful jobs created
     * before immediate payload purging was implemented.
     */
    if (
      currentJob.encryptedPayload !== null ||
      currentJob.customerName !== null
    ) {
      const now = new Date();

      await prisma.$transaction(
        async (transaction) => {
          await transaction.orderPushJob.update({
            where: {
              id: currentJob.id,
            },
            data: {
              encryptedPayload: null,
              customerName: null,
              payloadPurgedAt: now,
            },
          });

          await transaction.protectedDataAccessLog.create({
            data: {
              shop: currentJob.shop,
              action:
                "ORDER_PAYLOAD_PURGED_AFTER_SUCCESS",
              resourceType: "ORDER_PUSH_JOB",
              resourceId: currentJob.id,
              actorType: "SYSTEM",
              purpose:
                "Remove customer data after successful OMS delivery.",
            },
          });
        },
      );
    }

    return {
      processed: false,
      status: "SUCCESS",
      message:
        "This order has already been delivered successfully.",
      attemptNumber: currentJob.attempts,
      nextAttemptAt: null,
    };
  }

  const retentionExpired =
    currentJob.personalDataExpiresAt !== null &&
    currentJob.personalDataExpiresAt.getTime() <=
      Date.now();

  if (retentionExpired) {
    await expireProtectedPayload({
      jobId: currentJob.id,
      webhookEventId:
        currentJob.webhookEventId,
      shop: currentJob.shop,
    });

    return {
      processed: false,
      status: "FAILED",
      message:
        "The protected order payload expired before OMS delivery completed.",
      attemptNumber: currentJob.attempts,
      nextAttemptAt: null,
    };
  }

  if (!currentJob.encryptedPayload) {
    return {
      processed: false,
      status: "FAILED",
      message:
        "The protected order payload is no longer available.",
      attemptNumber: currentJob.attempts,
      nextAttemptAt: null,
    };
  }

  if (
    !force &&
    currentJob.nextAttemptAt.getTime() >
      Date.now()
  ) {
    return {
      processed: false,
      status:
        currentJob.status as DeliveryStatus,
      message:
        "The next retry is not due yet.",
      attemptNumber: currentJob.attempts,
      nextAttemptAt:
        currentJob.nextAttemptAt,
    };
  }

  if (
    !force &&
    currentJob.attempts >=
      currentJob.maxAttempts
  ) {
    return {
      processed: false,
      status: "FAILED",
      message:
        "This order has reached the automatic retry limit.",
      attemptNumber: currentJob.attempts,
      nextAttemptAt: null,
    };
  }

  const claimed =
    await prisma.orderPushJob.updateMany({
      where: {
        id: currentJob.id,
        status: {
          in: [
            "PENDING",
            "RETRYING",
            "FAILED",
          ],
        },
      },
      data: {
        status: "PROCESSING",
        completedAt: null,
      },
    });

  if (claimed.count === 0) {
    return {
      processed: false,
      status:
        currentJob.status as DeliveryStatus,
      message:
        "This order is already being processed by another request.",
      attemptNumber: currentJob.attempts,
      nextAttemptAt:
        currentJob.nextAttemptAt,
    };
  }

  const job =
    await prisma.orderPushJob.findUnique({
      where: {
        id: currentJob.id,
      },
    });

  if (!job) {
    throw new Error(
      "The delivery job disappeared after it was claimed.",
    );
  }

  const attemptNumber = job.attempts + 1;

  const connection =
    await prisma.omsConnection.findUnique({
      where: {
        shop: job.shop,
      },
    });

  let result: OmsRequestResult;

  if (!connection) {
    result = createLocalFailure(
      "No OMS connection is configured for this Shopify store.",
    );
  } else if (!connection.isEnabled) {
    result = createLocalFailure(
      "Automatic OMS order delivery is disabled.",
    );
  } else {
    try {
      await prisma.protectedDataAccessLog.create({
        data: {
          shop: job.shop,
          action:
            "ORDER_PAYLOAD_DECRYPTED_FOR_OMS_DELIVERY",
          resourceType: "ORDER_PUSH_JOB",
          resourceId: job.id,
          actorType: "SYSTEM",
          purpose:
            "Send the Shopify order to the merchant-configured OMS.",
        },
      });

      const orderData =
        parseEncryptedOrderPayload(
          job.encryptedPayload,
        );

      const apiKey = decryptSecret(
        connection.encryptedApiKey,
      );

      result = await sendOmsOrder({
        endpoint: connection.endpoint,
        payload: {
          apiKey,
          ...orderData,
        },
        timeoutMs,
      });
    } catch {
      result = createLocalFailure(
        "Unable to prepare the protected OMS order request.",
      );
    }
  }

  const safeMessage =
    getSafeStoredMessage(result);

  const shouldRetry =
    !result.success &&
    isRetryableFailure(result) &&
    attemptNumber < job.maxAttempts;

  const finalStatus: DeliveryStatus =
    result.success
      ? "SUCCESS"
      : shouldRetry
        ? "RETRYING"
        : "FAILED";

  const nextAttemptAt = shouldRetry
    ? calculateNextAttemptAt(
        attemptNumber,
      )
    : new Date();

  const completedAt =
    finalStatus === "SUCCESS" ||
    finalStatus === "FAILED"
      ? new Date()
      : null;

  await prisma.$transaction(
    async (transaction) => {
      await transaction.orderPushLog.create({
        data: {
          shop: job.shop,
          jobId: job.id,
          externalOrderId:
            job.externalOrderId,
          invoiceId: job.invoiceId,
          status: finalStatus,
          attemptNumber,
          httpStatus: result.httpStatus,
          durationMs: result.durationMs,
          errorMessage: result.success
            ? null
            : safeMessage,

          // Never retain a raw response from a third-party OMS.
          responseSummary: null,
        },
      });

      await transaction.orderPushJob.update({
        where: {
          id: job.id,
        },
        data: {
          status: finalStatus,
          attempts: attemptNumber,
          nextAttemptAt,
          lastError: result.success
            ? null
            : safeMessage,
          completedAt,

          /*
           * After successful transfer, this connector no longer
           * needs the customer's name, phone or address.
           */
          ...(finalStatus === "SUCCESS"
            ? {
                encryptedPayload: null,
                customerName: null,
                payloadPurgedAt:
                  completedAt ?? new Date(),
              }
            : {}),
        },
      });

      await transaction.webhookEvent.update({
        where: {
          id: job.webhookEventId,
        },
        data: {
          status: finalStatus,
          errorMessage: result.success
            ? null
            : safeMessage,
          processedAt:
            finalStatus === "RETRYING"
              ? null
              : new Date(),
        },
      });

      if (finalStatus === "SUCCESS") {
        await transaction.protectedDataAccessLog.create({
          data: {
            shop: job.shop,
            action:
              "ORDER_PAYLOAD_PURGED_AFTER_SUCCESS",
            resourceType: "ORDER_PUSH_JOB",
            resourceId: job.id,
            actorType: "SYSTEM",
            purpose:
              "Remove customer data immediately after successful OMS delivery.",
          },
        });
      }
    },
  );

  return {
    processed: true,
    status: finalStatus,
    message: result.success
      ? safeMessage
      : shouldRetry
        ? `${safeMessage} Another attempt has been scheduled.`
        : safeMessage,
    attemptNumber,
    nextAttemptAt: shouldRetry
      ? nextAttemptAt
      : null,
  };
}

export async function runDueOrderRetries({
  shop,
  limit = 20,
}: {
  shop?: string;
  limit?: number;
} = {}): Promise<RetryRunSummary> {
  const safeLimit = Math.min(
    Math.max(Math.trunc(limit), 1),
    100,
  );

  const jobs =
    await prisma.orderPushJob.findMany({
      where: {
        ...(shop ? { shop } : {}),
        status: {
          in: ["PENDING", "RETRYING"],
        },
        nextAttemptAt: {
          lte: new Date(),
        },
      },
      orderBy: {
        nextAttemptAt: "asc",
      },
      take: safeLimit,
      select: {
        id: true,
      },
    });

  const summary: RetryRunSummary = {
    selected: jobs.length,
    processed: 0,
    successful: 0,
    retrying: 0,
    failed: 0,
    skipped: 0,
  };

  for (const job of jobs) {
    const result =
      await processOrderPushJob({
        jobId: job.id,
        shop,
        force: false,
      });

    if (!result.processed) {
      summary.skipped += 1;
      continue;
    }

    summary.processed += 1;

    if (result.status === "SUCCESS") {
      summary.successful += 1;
    } else if (
      result.status === "RETRYING"
    ) {
      summary.retrying += 1;
    } else if (
      result.status === "FAILED"
    ) {
      summary.failed += 1;
    }
  }

  return summary;
}