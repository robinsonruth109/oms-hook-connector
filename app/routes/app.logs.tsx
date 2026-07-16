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
import { authenticate } from "../shopify.server";

type ActionResult = {
  ok: boolean;
  message: string;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs) => {
  const { session } =
    await authenticate.admin(request);

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

export default function DeliveryLogsPage() {
  const { jobs, dueRetryCount } =
    useLoaderData<typeof loader>();

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

      <s-section heading="OMS order deliveries">
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
                          Invoice:{" "}
                          {job.invoiceId ??
                            "Not available"}
                        </div>
                      </div>

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
                        {job.status}
                      </span>
                    </div>

                    <div>
                      Customer:{" "}
                      {job.customerName ??
                        "Not available"}
                    </div>

                    <div>
                      Attempts: {job.attempts} /{" "}
                      {job.maxAttempts}
                    </div>

                    <div>
                      Created:{" "}
                      {formatDate(
                        job.createdAt,
                      )}
                    </div>

                    {job.status ===
                      "RETRYING" ||
                    job.status ===
                      "PENDING" ? (
                      <div>
                        Next retry:{" "}
                        {formatDate(
                          job.nextAttemptAt,
                        )}
                      </div>
                    ) : null}

                    {job.latestLog ? (
                      <>
                        <div>
                          Latest HTTP status:{" "}
                          {job.latestLog
                            .httpStatus ??
                            "No response"}
                        </div>

                        <div>
                          Latest response time:{" "}
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
        heading="Automatic retries"
      >
        <s-paragraph>
          Temporary network failures, HTTP
          408, HTTP 429 and OMS server errors
          are scheduled for another attempt.
        </s-paragraph>

        <s-paragraph>
          Invalid API keys and invalid order
          data require manual correction.
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