import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [
    connection,
    totalDeliveries,
    successfulDeliveries,
    failedDeliveries,
    pendingDeliveries,
    recentLogs,
  ] = await Promise.all([
    prisma.omsConnection.findUnique({
      where: {
        shop,
      },
      select: {
        endpoint: true,
        isEnabled: true,
        lastTestedAt: true,
        lastTestSucceeded: true,
        lastTestMessage: true,
      },
    }),

    prisma.orderPushJob.count({
      where: {
        shop,
      },
    }),

    prisma.orderPushJob.count({
      where: {
        shop,
        status: "SUCCESS",
      },
    }),

    prisma.orderPushJob.count({
      where: {
        shop,
        status: "FAILED",
      },
    }),

    prisma.orderPushJob.count({
      where: {
        shop,
        status: {
          in: ["PENDING", "PROCESSING", "RETRYING"],
        },
      },
    }),

    prisma.orderPushLog.findMany({
      where: {
        shop,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        externalOrderId: true,
        invoiceId: true,
        status: true,
        httpStatus: true,
        attemptNumber: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    shop,
    connection: connection
      ? {
          endpoint: connection.endpoint,
          isEnabled: connection.isEnabled,
          lastTestedAt: connection.lastTestedAt?.toISOString() || null,
          lastTestSucceeded: connection.lastTestSucceeded,
          lastTestMessage: connection.lastTestMessage,
        }
      : null,
    stats: {
      total: totalDeliveries,
      successful: successfulDeliveries,
      failed: failedDeliveries,
      pending: pendingDeliveries,
    },
    recentLogs: recentLogs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
  };
};

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
    >
      <s-stack direction="block" gap="base">
        <s-text>{label}</s-text>
        <s-heading>{value.toLocaleString()}</s-heading>
        <s-paragraph>{description}</s-paragraph>
      </s-stack>
    </s-box>
  );
}

export default function DashboardPage() {
  const { shop, connection, stats, recentLogs } =
    useLoaderData<typeof loader>();

  const connectionStatus = !connection
    ? "Not connected"
    : connection.isEnabled
      ? "Connected and enabled"
      : "Connected but disabled";

  return (
    <s-page heading="OMS Hook Connector">
      <s-section heading="OMS connection">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text>Status: </s-text>
            <s-text>{connectionStatus}</s-text>
          </s-paragraph>

          {connection ? (
            <>
              <s-paragraph>
                <s-text>Endpoint: </s-text>
                <s-text>{connection.endpoint}</s-text>
              </s-paragraph>

              <s-paragraph>
                <s-text>Last connection test: </s-text>
                <s-text>{formatDate(connection.lastTestedAt)}</s-text>
              </s-paragraph>

              {connection.lastTestMessage ? (
                <s-paragraph>
                  <s-text>Last test result: </s-text>
                  <s-text>{connection.lastTestMessage}</s-text>
                </s-paragraph>
              ) : null}
            </>
          ) : (
            <s-paragraph>
              Connect this Shopify store to your custom OMS using its endpoint and
                API key.
            </s-paragraph>
          )}

          <s-link href="/app/settings">
            {connection ? "Manage OMS connection" : "Connect your OMS"}
          </s-link>
        </s-stack>
      </s-section>

      <s-section heading="Order delivery overview">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "16px",
          }}
        >
          <StatCard
            label="Total deliveries"
            value={stats.total}
            description="All OMS order delivery jobs."
          />

          <StatCard
            label="Successful"
            value={stats.successful}
            description="Orders accepted by your OMS."
          />

          <StatCard
            label="Pending"
            value={stats.pending}
            description="Waiting or scheduled for retry."
          />

          <StatCard
            label="Failed"
            value={stats.failed}
            description="Orders requiring attention."
          />
        </div>
      </s-section>

      <s-section heading="Recent delivery activity">
        {recentLogs.length === 0 ? (
          <s-paragraph>
            No order delivery attempts have been recorded yet.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {recentLogs.map((log) => (
              <s-box
                key={log.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="base">
                  <s-heading>{log.externalOrderId}</s-heading>

                  <s-paragraph>
                    Status: {log.status}
                    {log.httpStatus ? ` · HTTP ${log.httpStatus}` : ""}
                    {` · Attempt ${log.attemptNumber}`}
                  </s-paragraph>

                  <s-paragraph>{formatDate(log.createdAt)}</s-paragraph>

                  {log.errorMessage ? (
                    <s-paragraph>Error: {log.errorMessage}</s-paragraph>
                  ) : null}
                </s-stack>
              </s-box>
            ))}

            <s-link href="/app/logs">View all delivery logs</s-link>
          </s-stack>
        )}
      </s-section>

      <s-section slot="aside" heading="Connected Shopify store">
        <s-paragraph>{shop}</s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Next step">
        <s-paragraph>
          Add your OMS endpoint and API key from the OMS Settings page, then test
          the connection.
        </s-paragraph>

        <s-link href="/app/settings">Open OMS Settings</s-link>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};