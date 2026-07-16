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

// Delay after attempt 1, 2, 3, 4, 5 and 6.
const RETRY_DELAY_SECONDS = [
  60,
  5 * 60,
  15 * 60,
  60 * 60,
  6 * 60 * 60,
  24 * 60 * 60,
];

function parseEncryptedOrderPayload(
  encryptedPayload: string,
): OmsOrderData {
  const decryptedPayload = decryptSecret(encryptedPayload);

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

  return new Date(Date.now() + delaySeconds * 1000);
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
    return {
      processed: false,
      status: "SUCCESS",
      message:
        "This order has already been delivered successfully.",
      attemptNumber: currentJob.attempts,
      nextAttemptAt: null,
    };
  }

  if (
    !force &&
    currentJob.nextAttemptAt.getTime() > Date.now()
  ) {
    return {
      processed: false,
      status: currentJob.status as DeliveryStatus,
      message: "The next retry is not due yet.",
      attemptNumber: currentJob.attempts,
      nextAttemptAt: currentJob.nextAttemptAt,
    };
  }

  if (
    !force &&
    currentJob.attempts >= currentJob.maxAttempts
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

  const claimed = await prisma.orderPushJob.updateMany({
    where: {
      id: currentJob.id,
      status: {
        in: ["PENDING", "RETRYING", "FAILED"],
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
      status: currentJob.status as DeliveryStatus,
      message:
        "This order is already being processed by another request.",
      attemptNumber: currentJob.attempts,
      nextAttemptAt: currentJob.nextAttemptAt,
    };
  }

  const job = await prisma.orderPushJob.findUnique({
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
      const orderData = parseEncryptedOrderPayload(
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
    } catch (error) {
      result = createLocalFailure(
        error instanceof Error
          ? error.message
          : "Unable to prepare the OMS order request.",
      );
    }
  }

  const shouldRetry =
    !result.success &&
    isRetryableFailure(result) &&
    attemptNumber < job.maxAttempts;

  const finalStatus: DeliveryStatus = result.success
    ? "SUCCESS"
    : shouldRetry
      ? "RETRYING"
      : "FAILED";

  const nextAttemptAt = shouldRetry
    ? calculateNextAttemptAt(attemptNumber)
    : new Date();

  const completedAt =
    finalStatus === "SUCCESS" ||
    finalStatus === "FAILED"
      ? new Date()
      : null;

  await prisma.$transaction([
    prisma.orderPushLog.create({
      data: {
        shop: job.shop,
        jobId: job.id,
        externalOrderId: job.externalOrderId,
        invoiceId: job.invoiceId,
        status: finalStatus,
        attemptNumber,
        httpStatus: result.httpStatus,
        durationMs: result.durationMs,
        errorMessage: result.success
          ? null
          : result.message,
        responseSummary: result.responseSummary,
      },
    }),

    prisma.orderPushJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: finalStatus,
        attempts: attemptNumber,
        nextAttemptAt,
        lastError: result.success
          ? null
          : result.message,
        completedAt,
      },
    }),

    prisma.webhookEvent.update({
      where: {
        id: job.webhookEventId,
      },
      data: {
        status: finalStatus,
        errorMessage: result.success
          ? null
          : result.message,
        processedAt:
          finalStatus === "RETRYING"
            ? null
            : new Date(),
      },
    }),
  ]);

  return {
    processed: true,
    status: finalStatus,
    message: result.success
      ? result.message
      : shouldRetry
        ? `${result.message} Another attempt has been scheduled.`
        : result.message,
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

  const jobs = await prisma.orderPushJob.findMany({
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
    const result = await processOrderPushJob({
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
    } else if (result.status === "RETRYING") {
      summary.retrying += 1;
    } else if (result.status === "FAILED") {
      summary.failed += 1;
    }
  }

  return summary;
}