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
  decryptSecret,
  encryptSecret,
} from "../services/crypto.server";
import { testOmsConnection } from "../services/oms.server";
import { authenticate } from "../shopify.server";

type FieldErrors = {
  endpoint?: string;
  apiKey?: string;
};

type ActionResult = {
  ok: boolean;
  intent: "save" | "test";
  message: string;
  fieldErrors?: FieldErrors;
  testDetails?: {
    httpStatus: number | null;
    durationMs: number;
    testInvoiceId: string;
    responseSummary: string | null;
  };
};

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
          endpoint: connection.endpoint,
          isEnabled: connection.isEnabled,
          hasApiKey: true,
          lastTestedAt: connection.lastTestedAt?.toISOString() ?? null,
          lastTestSucceeded: connection.lastTestSucceeded,
          lastTestMessage: connection.lastTestMessage,
          createdAt: connection.createdAt.toISOString(),
          updatedAt: connection.updatedAt.toISOString(),
        }
      : null,
  };
};

function validateEndpoint(endpoint: string): string | undefined {
  if (!endpoint) {
    return "OMS Endpoint is required.";
  }

  try {
    const parsedUrl = new URL(endpoint);

    const isLocalDevelopmentAddress =
      parsedUrl.hostname === "localhost" ||
      parsedUrl.hostname === "127.0.0.1";

    if (
      parsedUrl.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        isLocalDevelopmentAddress
      )
    ) {
      return "The OMS Endpoint must use HTTPS.";
    }

    return undefined;
  } catch {
    return "Enter a valid OMS Endpoint URL.";
  }
}

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionResult> => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const requestedIntent = String(formData.get("intent") ?? "save");
  const intent: "save" | "test" =
    requestedIntent === "test" ? "test" : "save";

  const endpoint = String(formData.get("endpoint") ?? "").trim();
  const submittedApiKey = String(formData.get("apiKey") ?? "").trim();
  const isEnabled = formData.get("isEnabled") === "on";

  const existingConnection = await prisma.omsConnection.findUnique({
    where: {
      shop: session.shop,
    },
  });

  const fieldErrors: FieldErrors = {};
  const endpointError = validateEndpoint(endpoint);

  if (endpointError) {
    fieldErrors.endpoint = endpointError;
  }

  if (!existingConnection && !submittedApiKey) {
    fieldErrors.apiKey =
      "API Key is required for the first OMS connection.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      intent,
      message: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  if (intent === "test") {
    let resolvedApiKey: string;

    try {
      resolvedApiKey = submittedApiKey
        ? submittedApiKey
        : decryptSecret(existingConnection!.encryptedApiKey);
    } catch (error) {
      console.error("Unable to decrypt saved OMS API key", {
        shop: session.shop,
        error,
      });

      return {
        ok: false,
        intent: "test",
        message:
          "The saved API key could not be read. Enter the API key again.",
      };
    }

    const result = await testOmsConnection({
      endpoint,
      apiKey: resolvedApiKey,
      shop: session.shop,
    });

    const testedSavedConfiguration =
      Boolean(existingConnection) &&
      endpoint === existingConnection?.endpoint &&
      submittedApiKey.length === 0;

    if (testedSavedConfiguration) {
      await prisma.omsConnection.update({
        where: {
          shop: session.shop,
        },
        data: {
          lastTestedAt: new Date(),
          lastTestSucceeded: result.success,
          lastTestMessage: result.message,
        },
      });
    }

    return {
      ok: result.success,
      intent: "test",
      message: result.message,
      testDetails: {
        httpStatus: result.httpStatus,
        durationMs: result.durationMs,
        testInvoiceId: result.testInvoiceId,
        responseSummary: result.responseSummary,
      },
    };
  }

  try {
    const encryptedApiKey = submittedApiKey
      ? encryptSecret(submittedApiKey)
      : existingConnection!.encryptedApiKey;

    const credentialsChanged =
      !existingConnection ||
      endpoint !== existingConnection.endpoint ||
      submittedApiKey.length > 0;

    await prisma.omsConnection.upsert({
      where: {
        shop: session.shop,
      },
      create: {
        shop: session.shop,
        endpoint,
        encryptedApiKey,
        isEnabled,
      },
      update: {
        endpoint,
        encryptedApiKey,
        isEnabled,
        ...(credentialsChanged
          ? {
              lastTestedAt: null,
              lastTestSucceeded: null,
              lastTestMessage: null,
            }
          : {}),
      },
    });

    return {
      ok: true,
      intent: "save",
      message: existingConnection
        ? "OMS connection updated securely."
        : "OMS connection saved securely.",
    };
  } catch (error) {
    console.error("Failed to save OMS connection", {
      shop: session.shop,
      error,
    });

    return {
      ok: false,
      intent: "save",
      message:
        error instanceof Error
          ? error.message
          : "Unable to save the OMS connection.",
    };
  }
};

const inputStyle = {
  width: "100%",
  minHeight: "42px",
  padding: "10px 12px",
  border: "1px solid #8c9196",
  borderRadius: "8px",
  fontSize: "14px",
  background: "#ffffff",
  boxSizing: "border-box" as const,
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 600,
};

const helpTextStyle = {
  marginTop: "6px",
  color: "#616161",
  fontSize: "13px",
};

const errorTextStyle = {
  marginTop: "6px",
  color: "#b42318",
  fontSize: "13px",
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

export default function OmsSettingsPage() {
  const { shop, connection } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const submittingIntent = navigation.formData?.get("intent");
  const isTesting =
    navigation.state === "submitting" &&
    submittingIntent === "test";
  const isSaving =
    navigation.state === "submitting" &&
    submittingIntent === "save";
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page heading="OMS Settings">
      {actionData ? (
        <div
          role={actionData.ok ? "status" : "alert"}
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
          <div style={{ fontWeight: 600 }}>
            {actionData.message}
          </div>

          {actionData.testDetails ? (
            <div style={{ marginTop: "10px", fontSize: "13px" }}>
              <div>
                Test invoice:{" "}
                {actionData.testDetails.testInvoiceId}
              </div>
              <div>
                HTTP status:{" "}
                {actionData.testDetails.httpStatus ?? "No response"}
              </div>
              <div>
                Response time:{" "}
                {actionData.testDetails.durationMs} ms
              </div>

              {actionData.testDetails.responseSummary ? (
                <div>
                  OMS response:{" "}
                  {actionData.testDetails.responseSummary}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <s-section heading="Connection configuration">
        <Form method="post">
          <div style={{ display: "grid", gap: "20px" }}>
            <div>
              <label htmlFor="endpoint" style={labelStyle}>
                OMS Endpoint
              </label>

              <input
                id="endpoint"
                name="endpoint"
                type="url"
                required
                autoComplete="url"
                placeholder="https://oms.example.com/api/integrations/store/orders"
                defaultValue={connection?.endpoint ?? ""}
                aria-invalid={
                  actionData?.fieldErrors?.endpoint
                    ? true
                    : undefined
                }
                style={inputStyle}
              />

              {actionData?.fieldErrors?.endpoint ? (
                <div style={errorTextStyle}>
                  {actionData.fieldErrors.endpoint}
                </div>
              ) : (
                <div style={helpTextStyle}>
                  Shopify orders will be POSTed to this endpoint.
                </div>
              )}
            </div>

            <div>
              <label htmlFor="apiKey" style={labelStyle}>
                OMS API Key
              </label>

              <input
                id="apiKey"
                name="apiKey"
                type="password"
                autoComplete="new-password"
                placeholder={
                  connection
                    ? "Leave blank to use the saved API key"
                    : "Enter the API key generated by your OMS"
                }
                aria-invalid={
                  actionData?.fieldErrors?.apiKey
                    ? true
                    : undefined
                }
                style={inputStyle}
              />

              {actionData?.fieldErrors?.apiKey ? (
                <div style={errorTextStyle}>
                  {actionData.fieldErrors.apiKey}
                </div>
              ) : (
                <div style={helpTextStyle}>
                  {connection?.hasApiKey
                    ? "An encrypted API key is already saved."
                    : "The API key will be encrypted before database storage."}
                </div>
              )}
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              <input
                name="isEnabled"
                type="checkbox"
                defaultChecked={connection?.isEnabled ?? true}
              />

              <span>Enable automatic Shopify order delivery</span>
            </label>

            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "#fff8e5",
                border: "1px solid #e5c56b",
                fontSize: "13px",
              }}
            >
              Test Connection sends a real order to the OMS. The order
              will use a TEST invoice number and the product name
              “OMS Connection Test”.
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <button
                type="submit"
                name="intent"
                value="test"
                disabled={isSubmitting}
                style={{
                  minHeight: "42px",
                  padding: "10px 18px",
                  border: "1px solid #8c9196",
                  borderRadius: "8px",
                  background: "#ffffff",
                  color: "#303030",
                  fontWeight: 600,
                  cursor: isSubmitting
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {isTesting ? "Testing connection…" : "Test Connection"}
              </button>

              <button
                type="submit"
                name="intent"
                value="save"
                disabled={isSubmitting}
                style={{
                  minHeight: "42px",
                  padding: "10px 18px",
                  border: 0,
                  borderRadius: "8px",
                  background: isSubmitting
                    ? "#8c9196"
                    : "#303030",
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: isSubmitting
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {isSaving
                  ? "Saving securely…"
                  : connection
                    ? "Update OMS Connection"
                    : "Save OMS Connection"}
              </button>
            </div>
          </div>
        </Form>
      </s-section>

      <s-section heading="Connection status">
        <s-stack direction="block" gap="base">
          <s-paragraph>Shopify store: {shop}</s-paragraph>

          <s-paragraph>
            Status:{" "}
            {!connection
              ? "Not configured"
              : connection.isEnabled
                ? "Configured and enabled"
                : "Configured but disabled"}
          </s-paragraph>

          {connection ? (
            <>
              <s-paragraph>
                Last updated: {formatDate(connection.updatedAt)}
              </s-paragraph>

              <s-paragraph>
                Last connection test:{" "}
                {formatDate(connection.lastTestedAt)}
              </s-paragraph>

              <s-paragraph>
                Test status:{" "}
                {connection.lastTestSucceeded === null
                  ? "Not tested"
                  : connection.lastTestSucceeded
                    ? "Successful"
                    : "Failed"}
              </s-paragraph>

              {connection.lastTestMessage ? (
                <s-paragraph>
                  Last test result: {connection.lastTestMessage}
                </s-paragraph>
              ) : null}
            </>
          ) : null}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Credential security">
        <s-unordered-list>
          <s-list-item>
            The API key is never displayed after saving.
          </s-list-item>
          <s-list-item>
            The API key is encrypted before database storage.
          </s-list-item>
          <s-list-item>
            Only the endpoint and API key are required.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};