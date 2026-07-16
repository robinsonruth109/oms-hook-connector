// app/routes/app.privacy.tsx

import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import prisma from "../db.server";
import { decryptSecret } from "../services/crypto.server";
import { authenticate } from "../shopify.server";

export const loader = async ({
  request,
}: LoaderFunctionArgs) => {
  const { session } =
    await authenticate.admin(request);

  const requests =
    await prisma.privacyDataRequest.findMany({
      where: {
        shop: session.shop,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        status: true,
        requestedOrderCount: true,
        matchedOrderCount: true,
        encryptedReport: true,
        expiresAt: true,
        firstViewedAt: true,
        lastDownloadedAt: true,
        reportPurgedAt: true,
        createdAt: true,
      },
    });

  const now = Date.now();

  const mappedRequests = requests.map(
    (privacyRequest) => {
      const hasExpired =
        privacyRequest.expiresAt.getTime() <=
        now;

      const reportAvailable =
        privacyRequest.status === "READY" &&
        privacyRequest.encryptedReport !==
          null &&
        !hasExpired;

      return {
        id: privacyRequest.id,
        status: hasExpired
          ? "EXPIRED"
          : privacyRequest.status,
        requestedOrderCount:
          privacyRequest.requestedOrderCount,
        matchedOrderCount:
          privacyRequest.matchedOrderCount,
        reportAvailable,
        expiresAt:
          privacyRequest.expiresAt.toISOString(),
        firstViewedAt:
          privacyRequest.firstViewedAt?.toISOString() ??
          null,
        lastDownloadedAt:
          privacyRequest.lastDownloadedAt?.toISOString() ??
          null,
        reportPurgedAt:
          privacyRequest.reportPurgedAt?.toISOString() ??
          null,
        createdAt:
          privacyRequest.createdAt.toISOString(),
      };
    },
  );

  return {
    requests: mappedRequests,
    readyCount: mappedRequests.filter(
      (privacyRequest) =>
        privacyRequest.reportAvailable,
    ).length,
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const { session } =
    await authenticate.admin(request);

  const formData = await request.formData();

  const intent = String(
    formData.get("intent") ?? "",
  );

  if (intent !== "download_report") {
    return new Response(
      "Unknown privacy request action.",
      {
        status: 400,
      },
    );
  }

  const privacyRequestId = String(
    formData.get("privacyRequestId") ?? "",
  ).trim();

  if (!privacyRequestId) {
    return new Response(
      "Privacy request ID is missing.",
      {
        status: 400,
      },
    );
  }

  const privacyRequest =
    await prisma.privacyDataRequest.findFirst({
      where: {
        id: privacyRequestId,
        shop: session.shop,
      },
      select: {
        id: true,
        shop: true,
        status: true,
        encryptedReport: true,
        expiresAt: true,
        firstViewedAt: true,
      },
    });

  if (!privacyRequest) {
    return new Response(
      "Privacy request not found.",
      {
        status: 404,
      },
    );
  }

  const now = new Date();

  const hasExpired =
    privacyRequest.expiresAt.getTime() <=
    now.getTime();

  if (
    hasExpired ||
    privacyRequest.status !== "READY" ||
    !privacyRequest.encryptedReport
  ) {
    /*
     * Immediately purge an expired report when the
     * merchant tries to access it before the cron
     * cleanup has processed it.
     */
    if (
      hasExpired &&
      privacyRequest.encryptedReport
    ) {
      await prisma.$transaction(
        async (transaction) => {
          await transaction.privacyDataRequest.update({
            where: {
              id: privacyRequest.id,
            },
            data: {
              status: "EXPIRED",
              encryptedReport: null,
              reportPurgedAt: now,
            },
          });

          await transaction.protectedDataAccessLog.create({
            data: {
              shop: privacyRequest.shop,
              action:
                "PRIVACY_DATA_REQUEST_REPORT_EXPIRED",
              resourceType:
                "PRIVACY_DATA_REQUEST",
              resourceId:
                privacyRequest.id,
              actorType: "SYSTEM",
              purpose:
                "Remove an expired customer-data request report.",
            },
          });
        },
      );
    }

    return new Response(
      "This privacy report is no longer available.",
      {
        status: 410,
      },
    );
  }

  let formattedReport: string;

  try {
    const decryptedReport =
      decryptSecret(
        privacyRequest.encryptedReport,
      );

    const parsedReport = JSON.parse(
      decryptedReport,
    ) as unknown;

    formattedReport = JSON.stringify(
      parsedReport,
      null,
      2,
    );
  } catch (error) {
    console.error(
      "Unable to decrypt privacy report",
      {
        shop: session.shop,
        privacyRequestId:
          privacyRequest.id,
        error:
          error instanceof Error
            ? error.message
            : "Unknown decryption error",
      },
    );

    return new Response(
      "The privacy report could not be prepared.",
      {
        status: 500,
      },
    );
  }

  /*
   * Record the authenticated merchant access.
   * No customer data is written to the audit log.
   */
  await prisma.$transaction(
    async (transaction) => {
      await transaction.privacyDataRequest.update({
        where: {
          id: privacyRequest.id,
        },
        data: {
          firstViewedAt:
            privacyRequest.firstViewedAt ??
            now,
          lastDownloadedAt: now,
        },
      });

      await transaction.protectedDataAccessLog.create({
        data: {
          shop: privacyRequest.shop,
          action:
            "PRIVACY_DATA_REQUEST_REPORT_DOWNLOADED",
          resourceType:
            "PRIVACY_DATA_REQUEST",
          resourceId:
            privacyRequest.id,
          actorType: "MERCHANT",
          purpose:
            "Allow the authenticated merchant to fulfill a Shopify customer data request.",
        },
      });
    },
  );

  const filename =
    `privacy-data-request-${privacyRequest.id}.json`;

  return new Response(formattedReport, {
    status: 200,
    headers: {
      "Content-Type":
        "application/json; charset=utf-8",
      "Content-Disposition":
        `attachment; filename="${filename}"`,
      "Cache-Control":
        "private, no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options":
        "nosniff",
      "Referrer-Policy":
        "no-referrer",
      "Content-Security-Policy":
        "default-src 'none'",
    },
  });
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
  if (status === "READY") {
    return "#e8f5e9";
  }

  if (status === "EXPIRED") {
    return "#f1f1f1";
  }

  if (status === "REDACTED") {
    return "#fdecea";
  }

  return "#fff8e1";
}

export default function PrivacyRequestsPage() {
  const { requests, readyCount } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Privacy Requests">
      <div
        style={{
          marginBottom: "16px",
          padding: "14px 16px",
          borderRadius: "8px",
          border: "1px solid #b7c7e6",
          background: "#f4f7ff",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            marginBottom: "6px",
          }}
        >
          Protected customer-data requests
        </div>

        <div
          style={{
            color: "#414141",
            lineHeight: 1.5,
          }}
        >
          Reports are encrypted in storage and
          can only be downloaded by an
          authenticated merchant. Report
          downloads are recorded in the
          protected-data audit log.
        </div>
      </div>

      <s-section heading="Request summary">
        <s-stack
          direction="block"
          gap="base"
        >
          <s-paragraph>
            Total requests: {requests.length}
          </s-paragraph>

          <s-paragraph>
            Reports ready for download:{" "}
            {readyCount}
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="Customer data reports">
        {requests.length === 0 ? (
          <s-paragraph>
            No customer data requests have
            been received from Shopify.
          </s-paragraph>
        ) : (
          <s-stack
            direction="block"
            gap="base"
          >
            {requests.map(
              (privacyRequest) => (
                <s-box
                  key={privacyRequest.id}
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
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                          }}
                        >
                          Privacy request
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "#616161",
                            fontSize: "13px",
                          }}
                        >
                          Reference:{" "}
                          {privacyRequest.id}
                        </div>
                      </div>

                      <span
                        style={{
                          padding: "5px 10px",
                          borderRadius:
                            "999px",
                          background:
                            statusBackground(
                              privacyRequest.status,
                            ),
                          fontWeight: 600,
                        }}
                      >
                        {privacyRequest.status}
                      </span>
                    </div>

                    <div>
                      Received:{" "}
                      {formatDate(
                        privacyRequest.createdAt,
                      )}
                    </div>

                    <div>
                      Requested Shopify orders:{" "}
                      {
                        privacyRequest.requestedOrderCount
                      }
                    </div>

                    <div>
                      Matching stored records:{" "}
                      {
                        privacyRequest.matchedOrderCount
                      }
                    </div>

                    <div>
                      Report expires:{" "}
                      {formatDate(
                        privacyRequest.expiresAt,
                      )}
                    </div>

                    <div>
                      First accessed:{" "}
                      {formatDate(
                        privacyRequest.firstViewedAt,
                      )}
                    </div>

                    <div>
                      Last downloaded:{" "}
                      {formatDate(
                        privacyRequest.lastDownloadedAt,
                      )}
                    </div>

                    {privacyRequest.reportPurgedAt ? (
                      <div>
                        Report removed:{" "}
                        {formatDate(
                          privacyRequest.reportPurgedAt,
                        )}
                      </div>
                    ) : null}

                    {privacyRequest.reportAvailable ? (
                      <form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="download_report"
                        />

                        <input
                          type="hidden"
                          name="privacyRequestId"
                          value={privacyRequest.id}
                        />

                        <button
                          type="submit"
                          style={{
                            minHeight: "40px",
                            padding:
                              "9px 16px",
                            border: 0,
                            borderRadius:
                              "8px",
                            background:
                              "#303030",
                            color: "#ffffff",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Download JSON report
                        </button>
                      </form>
                    ) : (
                      <div
                        style={{
                          color: "#616161",
                          fontSize: "13px",
                        }}
                      >
                        The encrypted report is
                        no longer available.
                      </div>
                    )}
                  </div>
                </s-box>
              ),
            )}
          </s-stack>
        )}
      </s-section>

      <s-section
        slot="aside"
        heading="Report protection"
      >
        <s-paragraph>
          Reports are encrypted using the
          application encryption key.
        </s-paragraph>

        <s-paragraph>
          Download responses disable browser
          and intermediary caching.
        </s-paragraph>

        <s-paragraph>
          Reports are removed automatically
          when their retention period expires.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (
  headersArgs,
) => {
  return boundary.headers(headersArgs);
};