import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import prisma from "../db.server";
import {
  processOrderPushJob,
  runDueOrderRetries,
} from "../services/order-delivery.server";
import { reconcileRecentOrderFulfillmentStatuses } from "../services/order-status-sync.server";
import { authenticate } from "../shopify.server";

type ActionResult = {
  ok: boolean;
  message: string;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs) => {
  const { admin, session } =
    await authenticate.admin(request);

  const syncCandidates =
    await prisma.orderPushJob.findMany({
      where: {
        shop: session.shop,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
      select: {
        id: true,
        webhookEvent: {
          select: {
            shopifyOrderId: true,
          },
        },
      },
    });

  const syncSummary =
    await reconcileRecentOrderFulfillmentStatuses({
      shop: session.shop,
      jobs: syncCandidates.map((job) => ({
        id: job.id,
        shopifyOrderId:
          job.webhookEvent.shopifyOrderId,
      })),
      graphql: (query, variables) =>
        admin.graphql(query, {
          variables,
        }),
    });

  const now = new Date();

  const [jobs, dueRetryCount] =
    await Promise.all([
      prisma.orderPushJob.findMany({
        where: {
          shop: session.shop,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
        include: {
          logs: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      }),

      prisma.orderPushJob.count({
        where: {
          shop: session.shop,
          status: {
            in: ["PENDING", "RETRYING"],
          },
          nextAttemptAt: {
            lte: now,
          },
        },
      }),
    ]);

  return {
    dueRetryCount,
    syncSummary,
    jobs: jobs.map((job) => {
      const latestLog = job.logs[0] ?? null;

      return {
        id: job.id,
        externalOrderId:
          job.externalOrderId,
        invoiceId: job.invoiceId,
        customerName:
          job.customerName,
        status: job.status,
        shopifyFulfillmentStatus:
          job.shopifyFulfillmentStatus,
        shopifyFulfillmentUpdatedAt:
          job.shopifyFulfillmentUpdatedAt?.toISOString() ??
          null,
        shopifyFulfillmentSyncedAt:
          job.shopifyFulfillmentSyncedAt?.toISOString() ??
          null,
        shopifyFulfilledAt:
          job.shopifyFulfilledAt?.toISOString() ??
          null,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        nextAttemptAt:
          job.nextAttemptAt.toISOString(),
        lastError: job.lastError,
        createdAt:
          job.createdAt.toISOString(),
        updatedAt:
          job.updatedAt.toISOString(),
        completedAt:
          job.completedAt?.toISOString() ??
          null,
        latestLog: latestLog
          ? {
              status: latestLog.status,
              attemptNumber:
                latestLog.attemptNumber,
              httpStatus:
                latestLog.httpStatus,
              durationMs:
                latestLog.durationMs,
              errorMessage:
                latestLog.errorMessage,
              responseSummary:
                latestLog.responseSummary,
              createdAt:
                latestLog.createdAt.toISOString(),
            }
          : null,
      };
    }),
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionResult> => {
  const { session } =
    await authenticate.admin(request);

  const formData = await request.formData();
  const intent = String(
    formData.get("intent") ?? "",
  );

  if (intent === "retry_due") {
    const summary = await runDueOrderRetries({
      shop: session.shop,
      limit: 20,
    });

    return {
      ok: summary.failed === 0,
      message:
        `Selected ${summary.selected}, processed ${summary.processed}, ` +
        `successful ${summary.successful}, retrying ${summary.retrying}, ` +
        `failed ${summary.failed}, skipped ${summary.skipped}.`,
    };
  }

  if (intent === "retry_job") {
    const jobId = String(
      formData.get("jobId") ?? "",
    ).trim();

    if (!jobId) {
      return {
        ok: false,
        message:
          "The delivery job ID is missing.",
      };
    }

    const result =
      await processOrderPushJob({
        jobId,
        shop: session.shop,
        force: true,
      });

    return {
      ok:
        result.processed &&
        result.status !== "FAILED",
      message: result.message,
    };
  }

  return {
    ok: false,
    message: "Unknown delivery-log action.",
  };
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-BD",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

function formatFulfillmentStatus(
  status: string,
): string {
  return status
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

function statusBackground(
  status: string,
): string {
  if (status === "SUCCESS") {
    return "#e8f5e9";
  }

  if (
    status === "PENDING" ||
    status === "PROCESSING" ||
    status === "RETRYING"
  ) {
    return "#fff8e1";
  }

  return "#fdecea";
}

function fulfillmentStatusBackground(
  status: string,
): string {
  if (status === "FULFILLED") {
    return "#e8f5e9";
  }

  if (
    status === "PARTIALLY_FULFILLED" ||
    status === "IN_PROGRESS" ||
    status === "PENDING_FULFILLMENT" ||
    status === "SCHEDULED"
  ) {
    return "#fff8e1";
  }

  if (
    status === "REQUEST_DECLINED" ||
    status === "RESTOCKED"
  ) {
    return "#fdecea";
  }

  return "#f1f2f3";
}

export default function DeliveryLogsPage() {
  const {
    jobs,
    dueRetryCount,
    syncSummary,
  } = useLoaderData<typeof loader>();

  const actionData =
    useActionData<typeof action>();

  const navigation = useNavigation();

  const submittingIntent =
    navigation.formData?.get("intent");

  const submittingJobId =
    navigation.formData?.get("jobId");

  const isRunningDue =
    navigation.state === "submitting" &&
    submittingIntent === "retry_due";

  const isRefreshingShopify =
    navigation.state === "loading";

  return (
    <s-page heading="Delivery Logs">
      {actionData ? (
        <div
          role={
            actionData.ok
              ? "status"
              : "alert"
          }
          style={{
            marginBottom: "16px",
            padding: "14px 16px",
            borderRadius: "8px",
            border: actionData.ok
              ? "1px solid #8fcf9b"
              : "1px solid #e0a3a3",
            background: actionData.ok
              ? "#f0fff4"
              : "#fff4f4",
          }}
        >
          {actionData.message}
        </div>
      ) : null}

      {syncSummary.error ? (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            padding: "14px 16px",
            borderRadius: "8px",
            border: "1px solid #e0a3a3",
            background: "#fff4f4",
          }}
        >
          Shopify status refresh could not be completed: {" "}
          {syncSummary.error}
        </div>
      ) : null}

      <s-section heading="Shopify fulfillment synchronization">
        <s-stack
          direction="block"
          gap="base"
        >
          <s-paragraph>
            Fulfillment status is updated by Shopify webhooks and
            rechecked against Shopify whenever this page is opened.
          </s-paragraph>

          <s-paragraph>
            Checked {syncSummary.checked} recent orders; matched {" "}
            {syncSummary.matched}; synchronized {syncSummary.updated};
            unavailable {syncSummary.unavailable}.
          </s-paragraph>

          <Form method="get">
            <button
              type="submit"
              disabled={isRefreshingShopify}
              style={{
                minHeight: "40px",
                padding: "9px 16px",
                border: "1px solid #8c9196",
                borderRadius: "8px",
                background: "#ffffff",
                color: "#303030",
                fontWeight: 600,
                cursor: isRefreshingShopify
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {isRefreshingShopify
                ? "Refreshing Shopify statuses…"
                : "Refresh Shopify statuses"}
            </button>
          </Form>
        </s-stack>
      </s-section>

      <s-section heading="Retry controls">
        <s-stack
          direction="block"
          gap="base"
        >
          <s-paragraph>
            Due retry jobs: {dueRetryCount}
          </s-paragraph>

          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="retry_due"
            />

            <button
              type="submit"
              disabled={
                isRunningDue ||
                dueRetryCount === 0
              }
              style={{
                minHeight: "40px",
                padding: "9px 16px",
                border: 0,
                borderRadius: "8px",
                background:
                  dueRetryCount === 0
                    ? "#8c9196"
                    : "#303030",
                color: "#ffffff",
                fontWeight: 600,
                cursor:
                  dueRetryCount === 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {isRunningDue
                ? "Running retries…"
                : "Run due retries now"}
            </button>
          </Form>
        </s-stack>
      </s-section>

      <s-section heading="OMS deliveries and Shopify fulfillment">
        {jobs.length === 0 ? (
          <s-paragraph>
            No Shopify order deliveries have
            been recorded yet.
          </s-paragraph>
        ) : (
          <s-stack
            direction="block"
            gap="base"
          >
            {jobs.map((job) => {
              const canRetry =
                job.status === "FAILED" ||
                job.status === "RETRYING" ||
                job.status === "PENDING";

              const isRetryingThisJob =
                navigation.state ===
                  "submitting" &&
                submittingIntent ===
                  "retry_job" &&
                submittingJobId === job.id;

              return (
                <s-box
                  key={job.id}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                >
                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent:
                          "space-between",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "15px",
                          }}
                        >
                          {
                            job.externalOrderId
                          }
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "#616161",
                          }}
                        >
                          Invoice: {" "}
                          {job.invoiceId ??
                            "Not available"}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            padding:
                              "5px 10px",
                            borderRadius:
                              "999px",
                            background:
                              statusBackground(
                                job.status,
                              ),
                            fontWeight: 600,
                            height:
                              "fit-content",
                          }}
                        >
                          OMS: {job.status}
                        </span>

                        <span
                          style={{
                            padding:
                              "5px 10px",
                            borderRadius:
                              "999px",
                            background:
                              fulfillmentStatusBackground(
                                job.shopifyFulfillmentStatus,
                              ),
                            fontWeight: 600,
                            height:
                              "fit-content",
                          }}
                        >
                          Shopify: {" "}
                          {formatFulfillmentStatus(
                            job.shopifyFulfillmentStatus,
                          )}
                        </span>
                      </div>
                    </div>

                    <div>
                      Customer: {" "}
                      {job.customerName ??
                        "Not available"}
                    </div>

                    <div>
                      Shopify fulfillment updated: {" "}
                      {formatDate(
                        job.shopifyFulfillmentUpdatedAt,
                      )}
                    </div>

                    <div>
                      Last synchronized with Shopify: {" "}
                      {formatDate(
                        job.shopifyFulfillmentSyncedAt,
                      )}
                    </div>

                    {job.shopifyFulfilledAt ? (
                      <div>
                        Fulfilled at: {" "}
                        {formatDate(
                          job.shopifyFulfilledAt,
                        )}
                      </div>
                    ) : null}

                    <div>
                      OMS attempts: {job.attempts} / {" "}
                      {job.maxAttempts}
                    </div>

                    <div>
                      Order received: {" "}
                      {formatDate(
                        job.createdAt,
                      )}
                    </div>

                    {job.status ===
                      "RETRYING" ||
                    job.status ===
                      "PENDING" ? (
                      <div>
                        Next OMS retry: {" "}
                        {formatDate(
                          job.nextAttemptAt,
                        )}
                      </div>
                    ) : null}

                    {job.latestLog ? (
                      <>
                        <div>
                          Latest OMS HTTP status: {" "}
                          {job.latestLog
                            .httpStatus ??
                            "No response"}
                        </div>

                        <div>
                          Latest OMS response time: {" "}
                          {job.latestLog
                            .durationMs !==
                          null
                            ? `${job.latestLog.durationMs} ms`
                            : "Not available"}
                        </div>
                      </>
                    ) : null}

                    {job.lastError ? (
                      <div
                        style={{
                          color: "#b42318",
                        }}
                      >
                        Error: {job.lastError}
                      </div>
                    ) : null}

                    {canRetry ? (
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="retry_job"
                        />

                        <input
                          type="hidden"
                          name="jobId"
                          value={job.id}
                        />

                        <button
                          type="submit"
                          disabled={
                            isRetryingThisJob
                          }
                          style={{
                            minHeight: "38px",
                            padding:
                              "8px 14px",
                            border:
                              "1px solid #8c9196",
                            borderRadius:
                              "8px",
                            background:
                              "#ffffff",
                            color: "#303030",
                            fontWeight: 600,
                            cursor:
                              isRetryingThisJob
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {isRetryingThisJob
                            ? "Retrying…"
                            : "Retry now"}
                        </button>
                      </Form>
                    ) : null}
                  </div>
                </s-box>
              );
            })}
          </s-stack>
        )}
      </s-section>

      <s-section
        slot="aside"
        heading="Synchronization behavior"
      >
        <s-paragraph>
          Shopify fulfillment webhooks update each matching delivery
          record when an order is fulfilled, partially fulfilled, or
          otherwise updated.
        </s-paragraph>

        <s-paragraph>
          Opening this page also checks recent order statuses directly
          through Shopify&apos;s GraphQL Admin API to repair missed or
          delayed webhook updates.
        </s-paragraph>

        <s-paragraph>
          Temporary network failures, HTTP 408, HTTP 429 and OMS server
          errors are scheduled for another OMS delivery attempt.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (
  headersArgs,
) => {
  return boundary.headers(headersArgs);
};
