// app/services/privacy.server.ts

import prisma from "../db.server";
import {
  decryptSecret,
  encryptSecret,
} from "./crypto.server";
import type { OmsOrderData } from "./oms.server";

export const PERSONAL_DATA_RETENTION_DAYS = 7;
export const OPERATIONAL_METADATA_RETENTION_DAYS = 30;
export const PRIVACY_REPORT_RETENTION_DAYS = 30;

const MILLISECONDS_PER_DAY =
  24 * 60 * 60 * 1000;

type CleanupSummary = {
  selectedPayloads: number;
  payloadsPurged: number;
  expiredActiveJobs: number;
  operationalRecordsDeleted: number;
  privacyReportsPurged: number;
};

type AccessLogInput = {
  shop: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  purpose: string;
  actorType?: "SYSTEM" | "MERCHANT" | "STAFF";
};

type CreatePrivacyDataRequestInput = {
  shop: string;
  shopifyWebhookId: string;
  customerId?: string | number | null;
  orderIds: Array<string | number>;
};

export type CreatePrivacyDataRequestResult = {
  id: string;
  created: boolean;
  requestedOrderCount: number;
  matchedOrderCount: number;
  expiresAt: Date;
};

function addDays(
  date: Date,
  days: number,
): Date {
  return new Date(
    date.getTime() +
      days * MILLISECONDS_PER_DAY,
  );
}

function normalizeIdentifiers(
  values: Array<string | number>,
): string[] {
  return [
    ...new Set(
      values
        .map((value) =>
          String(value).trim(),
        )
        .filter(Boolean),
    ),
  ];
}

function normalizeCustomerId(
  customerId?: string | number | null,
): string | null {
  if (
    customerId === null ||
    customerId === undefined
  ) {
    return null;
  }

  const normalized =
    String(customerId).trim();

  return normalized || null;
}

function parseStoredOrderPayload(
  encryptedPayload: string,
): OmsOrderData {
  const decrypted =
    decryptSecret(encryptedPayload);

  const parsed = JSON.parse(
    decrypted,
  ) as Partial<OmsOrderData>;

  if (
    !parsed ||
    typeof parsed.externalOrderId !==
      "string" ||
    typeof parsed.invoiceId !== "string" ||
    typeof parsed.customerName !==
      "string" ||
    typeof parsed.phone !== "string" ||
    typeof parsed.address !== "string" ||
    !Array.isArray(parsed.items)
  ) {
    throw new Error(
      "The encrypted order payload has an invalid format.",
    );
  }

  return parsed as OmsOrderData;
}

export function calculatePersonalDataExpiry(
  from: Date = new Date(),
): Date {
  return addDays(
    from,
    PERSONAL_DATA_RETENTION_DAYS,
  );
}

export function calculatePrivacyReportExpiry(
  from: Date = new Date(),
): Date {
  return addDays(
    from,
    PRIVACY_REPORT_RETENTION_DAYS,
  );
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

export async function createPrivacyDataRequestReport({
  shop,
  shopifyWebhookId,
  customerId,
  orderIds,
}: CreatePrivacyDataRequestInput): Promise<CreatePrivacyDataRequestResult> {
  const existing =
    await prisma.privacyDataRequest.findUnique({
      where: {
        shopifyWebhookId,
      },
      select: {
        id: true,
        requestedOrderCount: true,
        matchedOrderCount: true,
        expiresAt: true,
      },
    });

  if (existing) {
    return {
      id: existing.id,
      created: false,
      requestedOrderCount:
        existing.requestedOrderCount,
      matchedOrderCount:
        existing.matchedOrderCount,
      expiresAt: existing.expiresAt,
    };
  }

  const normalizedOrderIds =
    normalizeIdentifiers(orderIds);

  const normalizedCustomerId =
    normalizeCustomerId(customerId);

  const events =
    normalizedOrderIds.length > 0
      ? await prisma.webhookEvent.findMany({
          where: {
            shop,
            shopifyOrderId: {
              in: normalizedOrderIds,
            },
          },
          orderBy: {
            receivedAt: "asc",
          },
          include: {
            orderPushJob: true,
          },
        })
      : [];

  const reportOrders = events.map(
    (event) => {
      const job = event.orderPushJob;

      const protectedOrderData =
        job?.encryptedPayload
          ? parseStoredOrderPayload(
              job.encryptedPayload,
            )
          : null;

      return {
        shopifyOrderId:
          event.shopifyOrderId,
        webhook: {
          topic: event.topic,
          status: event.status,
          receivedAt:
            event.receivedAt.toISOString(),
          processedAt:
            event.processedAt?.toISOString() ??
            null,
        },
        omsDelivery: job
          ? {
              externalOrderId:
                job.externalOrderId,
              invoiceId: job.invoiceId,
              status: job.status,
              attempts: job.attempts,
              createdAt:
                job.createdAt.toISOString(),
              completedAt:
                job.completedAt?.toISOString() ??
                null,
              protectedPayloadRetained:
                protectedOrderData !== null,
              payloadPurgedAt:
                job.payloadPurgedAt?.toISOString() ??
                null,
              protectedOrderData,
            }
          : null,
      };
    },
  );

  const now = new Date();
  const expiresAt =
    calculatePrivacyReportExpiry(now);

  const report = {
    reportVersion: 1,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    shop,
    request: {
      customerId:
        normalizedCustomerId,
      requestedOrderIds:
        normalizedOrderIds,
      requestedOrderCount:
        normalizedOrderIds.length,
      matchedOrderCount:
        reportOrders.length,
    },
    dataProcessingPurpose:
      "Shopify order delivery to the merchant-configured order management system.",
    retentionExplanation:
      "Protected order payloads are removed after successful OMS delivery or after the configured retention period.",
    orders: reportOrders,
  };

  const encryptedReport =
    encryptSecret(
      JSON.stringify(report),
    );

  const created =
    await prisma.$transaction(
      async (transaction) => {
        const privacyRequest =
          await transaction.privacyDataRequest.create({
            data: {
              shop,
              shopifyWebhookId,
              status: "READY",
              requestedOrderCount:
                normalizedOrderIds.length,
              matchedOrderCount:
                reportOrders.length,
              encryptedReport,
              expiresAt,
            },
          });

        await transaction.protectedDataAccessLog.create({
          data: {
            shop,
            action:
              "PRIVACY_DATA_REQUEST_REPORT_CREATED",
            resourceType:
              "PRIVACY_DATA_REQUEST",
            resourceId:
              privacyRequest.id,
            actorType: "SYSTEM",
            purpose:
              "Prepare the merchant's response to a Shopify customer data request.",
          },
        });

        return privacyRequest;
      },
    );

  return {
    id: created.id,
    created: true,
    requestedOrderCount:
      created.requestedOrderCount,
    matchedOrderCount:
      created.matchedOrderCount,
    expiresAt: created.expiresAt,
  };
}

export async function purgePrivacyReportsForShop({
  shop,
  reason,
}: {
  shop: string;
  reason: string;
}): Promise<number> {
  const reports =
    await prisma.privacyDataRequest.findMany({
      where: {
        shop,
        encryptedReport: {
          not: null,
        },
      },
      select: {
        id: true,
      },
    });

  if (reports.length === 0) {
    return 0;
  }

  const now = new Date();

  await prisma.$transaction(
    async (transaction) => {
      await transaction.privacyDataRequest.updateMany({
        where: {
          id: {
            in: reports.map(
              (report) => report.id,
            ),
          },
        },
        data: {
          status: "REDACTED",
          encryptedReport: null,
          reportPurgedAt: now,
        },
      });

      await transaction.protectedDataAccessLog.createMany({
        data: reports.map((report) => ({
          shop,
          action:
            "PRIVACY_DATA_REQUEST_REPORT_REDACTED",
          resourceType:
            "PRIVACY_DATA_REQUEST",
          resourceId: report.id,
          actorType: "SYSTEM",
          purpose: reason,
        })),
      });
    },
  );

  return reports.length;
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
      job.personalDataExpiresAt.getTime() <=
        now.getTime();

    const wasStillActive =
      expiryReached &&
      [
        "PENDING",
        "RETRYING",
        "PROCESSING",
      ].includes(job.status);

    await prisma.$transaction(
      async (transaction) => {
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
            resourceType:
              "ORDER_PUSH_JOB",
            resourceId: job.id,
            actorType: "SYSTEM",
            purpose: wasStillActive
              ? "Enforce the seven-day personal-data retention limit."
              : "Remove customer data after successful OMS delivery.",
          },
        });
      },
    );

    payloadsPurged += 1;

    if (wasStillActive) {
      expiredActiveJobs += 1;
    }
  }

  const expiredReports =
    await prisma.privacyDataRequest.findMany({
      where: {
        encryptedReport: {
          not: null,
        },
        expiresAt: {
          lte: now,
        },
      },
      orderBy: {
        expiresAt: "asc",
      },
      take: safeLimit,
      select: {
        id: true,
        shop: true,
      },
    });

  for (const report of expiredReports) {
    await prisma.$transaction(
      async (transaction) => {
        await transaction.privacyDataRequest.update({
          where: {
            id: report.id,
          },
          data: {
            status: "EXPIRED",
            encryptedReport: null,
            reportPurgedAt: now,
          },
        });

        await transaction.protectedDataAccessLog.create({
          data: {
            shop: report.shop,
            action:
              "PRIVACY_DATA_REQUEST_REPORT_EXPIRED",
            resourceType:
              "PRIVACY_DATA_REQUEST",
            resourceId: report.id,
            actorType: "SYSTEM",
            purpose:
              "Remove an expired customer-data request report.",
          },
        });
      },
    );
  }

  const operationalCutoff = new Date(
    now.getTime() -
      OPERATIONAL_METADATA_RETENTION_DAYS *
        MILLISECONDS_PER_DAY,
  );

  const oldEvents =
    await prisma.webhookEvent.findMany({
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
            in: oldEvents.map(
              (event) => event.id,
            ),
          },
        },
      });

    operationalRecordsDeleted =
      deletionResult.count;
  }

  return {
    selectedPayloads:
      jobsToPurge.length,
    payloadsPurged,
    expiredActiveJobs,
    operationalRecordsDeleted,
    privacyReportsPurged:
      expiredReports.length,
  };
}