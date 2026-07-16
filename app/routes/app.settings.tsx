import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const connection = await prisma.omsConnection.findUnique({
    where: {
      shop: session.shop,
    },
    select: {
      endpoint: true,
      isEnabled: true,
      lastTestedAt: true,
      lastTestSucceeded: true,
      lastTestMessage: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    shop: session.shop,
    connection: connection
      ? {
          ...connection,
          lastTestedAt: connection.lastTestedAt?.toISOString() || null,
          createdAt: connection.createdAt.toISOString(),
          updatedAt: connection.updatedAt.toISOString(),
        }
      : null,
  };
};

export default function OmsSettingsPage() {
  const { shop, connection } = useLoaderData<typeof loader>();

  return (
    <s-page heading="OMS Settings">
      <s-section heading="Connection configuration">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Configure the OMS endpoint, API key, and webhook secret used for
            this Shopify store.
          </s-paragraph>

          <s-paragraph>
            Store: <s-text>{shop}</s-text>
          </s-paragraph>

          <s-paragraph>
            Current status:{" "}
            <s-text>
              {!connection
                ? "Not configured"
                : connection.isEnabled
                  ? "Enabled"
                  : "Disabled"}
            </s-text>
          </s-paragraph>

          {connection ? (
            <s-paragraph>
              Current endpoint: <s-text>{connection.endpoint}</s-text>
            </s-paragraph>
          ) : null}
        </s-stack>
      </s-section>

      <s-section heading="Secure credentials form">
        <s-paragraph>
          The encrypted OMS credential form will be added in the next step.
          Existing secrets will never be displayed in plain text.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Required OMS details">
        <s-unordered-list>
          <s-list-item>Endpoint URL</s-list-item>
          <s-list-item>API Key</s-list-item>
          <s-list-item>Webhook Secret</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};