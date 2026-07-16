import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const logs = await prisma.orderPushLog.findMany({
    where: {
      shop: session.shop,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    select: {
      id: true,
      externalOrderId: true,
      invoiceId: true,
      status: true,
      attemptNumber: true,
      httpStatus: true,
      durationMs: true,
      errorMessage: true,
      responseSummary: true,
      createdAt: true,
    },
  });

  return {
    logs: logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function DeliveryLogsPage() {
  const { logs } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Delivery Logs">
      <s-section heading="OMS order delivery history">
        {logs.length === 0 ? (
          <s-stack direction="block" gap="base">
            <s-paragraph>
              No OMS delivery attempts have been recorded yet.
            </s-paragraph>

            <s-paragraph>
              Logs will appear here after Shopify begins sending new orders to
              the OMS connector.
            </s-paragraph>
          </s-stack>
        ) : (
          <s-stack direction="block" gap="base">
            {logs.map((log) => (
              <s-box
                key={log.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="base">
                  <s-heading>{log.externalOrderId}</s-heading>

                  <s-paragraph>
                    Invoice: {log.invoiceId || "Not available"}
                  </s-paragraph>

                  <s-paragraph>
                    Status: {log.status} · Attempt {log.attemptNumber}
                  </s-paragraph>

                  <s-paragraph>
                    HTTP status: {log.httpStatus ?? "No response"}
                  </s-paragraph>

                  <s-paragraph>
                    Duration:{" "}
                    {log.durationMs !== null
                      ? `${log.durationMs} ms`
                      : "Not available"}
                  </s-paragraph>

                  <s-paragraph>{formatDate(log.createdAt)}</s-paragraph>

                  {log.errorMessage ? (
                    <s-paragraph>Error: {log.errorMessage}</s-paragraph>
                  ) : null}

                  {log.responseSummary ? (
                    <s-paragraph>
                      OMS response: {log.responseSummary}
                    </s-paragraph>
                  ) : null}
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      <s-section slot="aside" heading="Log retention">
        <s-paragraph>
          Logs do not display API keys, webhook secrets, complete phone
          numbers, addresses, or unencrypted order payloads.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};