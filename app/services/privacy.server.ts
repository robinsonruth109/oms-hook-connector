// app/services/privacy.server.ts

import prisma from "../db.server";

export const PERSONAL_DATA_RETENTION_DAYS = 7;
export const OPERATIONAL_METADATA_RETENTION_DAYS = 30;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type CleanupSummary = {
  selectedPayloads: number;
  payloadsPurged: number;
  expiredActiveJobs: number;
  operationalRecordsDeleted: number;
};

type AccessLogInput = {
  shop: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  purpose: string;
  actorType?: "SYSTEM" | "MERCHANT" | "STAFF";
};

function addDays(date: Date, days: number): Date {
  return new Date(
    date.getTime() + days * MILLISECONDS_PER_DAY,
  );
}

export function calculatePersonalDataExpiry(
  from: Date = new Date(),
): Date {
  return addDays(from, PERSONAL_DATA_RETENTION_DAYS);
}

export async function recordProtectedDataAccess({
  shop,
  action,
  resourceType,
  resourceId = null,
  purpose,
  actorType = "SYSTEM",
}: AccessLogInput): Promise<void> {
  await prisma.protectedDataAccessLog.create({
    data: {
      shop,
      action,
      resourceType,
      resourceId,
      purpose,
      actorType,
    },
  });
}

export async function runDataRetentionCleanup({
  limit = 100,
}: {
  limit?: number;
} = {}): Promise<CleanupSummary> {
  const safeLimit = Math.min(
    Math.max(Math.trunc(limit), 1),
    500,
  );

  const now = new Date();

  /*
   * Select:
   * 1. Successful jobs whose payload was not purged previously.
   * 2. Failed, retrying or stuck jobs whose seven-day retention
   *    period has expired.
   */
  const jobsToPurge =
    await prisma.orderPushJob.findMany({
      where: {
        encryptedPayload: {
          not: null,
        },
        OR: [
          {
            status: "SUCCESS",
          },
          {
            personalDataExpiresAt: {
              lte: now,
            },
          },
        ],
      },
      orderBy: {
        createdAt: "asc",
      },
      take: safeLimit,
      select: {
        id: true,
        shop: true,
        webhookEventId: true,
        status: true,
        personalDataExpiresAt: true,
      },
    });

  let payloadsPurged = 0;
  let expiredActiveJobs = 0;

  for (const job of jobsToPurge) {
    const expiryReached =
      job.personalDataExpiresAt !== null &&
      job.personalDataExpiresAt.getTime() <= now.getTime();

    const wasStillActive =
      expiryReached &&
      ["PENDING", "RETRYING", "PROCESSING"].includes(
        job.status,
      );

    await prisma.$transaction(async (transaction) => {
      await transaction.orderPushJob.update({
        where: {
          id: job.id,
        },
        data: {
          encryptedPayload: null,
          customerName: null,
          payloadPurgedAt: now,

          ...(wasStillActive
            ? {
                status: "FAILED",
                completedAt: now,
                nextAttemptAt: now,
                lastError:
                  "The protected order payload expired before OMS delivery completed.",
              }
            : {}),
        },
      });

      if (wasStillActive) {
        await transaction.webhookEvent.update({
          where: {
            id: job.webhookEventId,
          },
          data: {
            status: "FAILED",
            processedAt: now,
            errorMessage:
              "The protected order payload expired before OMS delivery completed.",
          },
        });
      }

      await transaction.protectedDataAccessLog.create({
        data: {
          shop: job.shop,
          action: wasStillActive
            ? "ORDER_PAYLOAD_PURGED_AFTER_RETENTION_LIMIT"
            : "ORDER_PAYLOAD_PURGED_AFTER_SUCCESS",
          resourceType: "ORDER_PUSH_JOB",
          resourceId: job.id,
          actorType: "SYSTEM",
          purpose: wasStillActive
            ? "Enforce the seven-day personal-data retention limit."
            : "Remove customer data after successful OMS delivery.",
        },
      });
    });

    payloadsPurged += 1;

    if (wasStillActive) {
      expiredActiveJobs += 1;
    }
  }

  /*
   * Delivery metadata is useful temporarily for troubleshooting.
   * Completed records older than 30 days are removed completely.
   *
   * Deleting WebhookEvent cascades to OrderPushJob and OrderPushLog.
   */
  const operationalCutoff = new Date(
    now.getTime() -
      OPERATIONAL_METADATA_RETENTION_DAYS *
        MILLISECONDS_PER_DAY,
  );

  const oldEvents = await prisma.webhookEvent.findMany({
    where: {
      receivedAt: {
        lte: operationalCutoff,
      },
      status: {
        in: ["SUCCESS", "FAILED"],
      },
    },
    orderBy: {
      receivedAt: "asc",
    },
    take: safeLimit,
    select: {
      id: true,
    },
  });

  let operationalRecordsDeleted = 0;

  if (oldEvents.length > 0) {
    const deletionResult =
      await prisma.webhookEvent.deleteMany({
        where: {
          id: {
            in: oldEvents.map((event) => event.id),
          },
        },
      });

    operationalRecordsDeleted = deletionResult.count;
  }

  return {
    selectedPayloads: jobsToPurge.length,
    payloadsPurged,
    expiredActiveJobs,
    operationalRecordsDeleted,
  };
}