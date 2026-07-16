import { randomUUID } from "node:crypto";

export type OmsOrderItem = {
  sku: string;
  name: string;
  quantity: number;
  price: number;
};

export type OmsOrderPayload = {
  apiKey: string;
  externalOrderId: string;
  invoiceId: string;
  customerName: string;
  phone: string;
  address: string;
  deliveryCharge: number;
  discount: number;
  advance: number;
  note: string;
  items: OmsOrderItem[];
};

export type OmsRequestResult = {
  success: boolean;
  httpStatus: number | null;
  durationMs: number;
  message: string;
  responseSummary: string | null;
  testInvoiceId: string;
};

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_LENGTH = 500;

function createTestOrder(shop: string, apiKey: string): OmsOrderPayload {
  const shopPrefix = shop
    .split(".")[0]
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toUpperCase()
    .slice(0, 20);

  const uniquePart = `${Date.now()}-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase()}`;

  const invoiceId = `TEST-${uniquePart}`;

  return {
    apiKey,
    externalOrderId: `${shopPrefix}-${invoiceId}`,
    invoiceId,
    customerName: "Shopify Connection Test",
    phone: "01700000000",
    address: "OMS connection test order",
    deliveryCharge: 0,
    discount: 0,
    advance: 0,
    note: "Created automatically by OMS Hook Connector to test the connection.",
    items: [
      {
        sku: "CONNECTION-TEST",
        name: "OMS Connection Test",
        quantity: 1,
        price: 1,
      },
    ],
  };
}

async function readResponseSummary(response: Response): Promise<string | null> {
  const responseText = (await response.text()).trim();

  if (!responseText) {
    return null;
  }

  let summary = responseText;

  try {
    const parsed = JSON.parse(responseText) as {
      message?: unknown;
      error?: unknown;
      success?: unknown;
    };

    if (typeof parsed.message === "string") {
      summary = parsed.message;
    } else if (typeof parsed.error === "string") {
      summary = parsed.error;
    }
  } catch {
    // The OMS returned plain text instead of JSON.
  }

  return summary.slice(0, MAX_RESPONSE_LENGTH);
}

function getFailureMessage(
  status: number,
  responseSummary: string | null,
): string {
  if (status === 401 || status === 403) {
    return "The OMS rejected the API key.";
  }

  if (status === 404) {
    return "The OMS endpoint was not found. Check the Endpoint URL.";
  }

  if (status === 408) {
    return "The OMS request timed out.";
  }

  if (status === 429) {
    return "The OMS is temporarily rate-limiting requests.";
  }

  if (status >= 500) {
    return `The OMS server returned HTTP ${status}.`;
  }

  if (responseSummary) {
    return `The OMS rejected the test order: ${responseSummary}`;
  }

  return `The OMS rejected the test order with HTTP ${status}.`;
}

export async function testOmsConnection({
  endpoint,
  apiKey,
  shop,
}: {
  endpoint: string;
  apiKey: string;
  shop: string;
}): Promise<OmsRequestResult> {
  const payload = createTestOrder(shop, apiKey);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const durationMs = Date.now() - startedAt;
    const responseSummary = await readResponseSummary(response);

    if (response.ok) {
      return {
        success: true,
        httpStatus: response.status,
        durationMs,
        message: `Connection successful. Test order ${payload.invoiceId} was accepted by the OMS.`,
        responseSummary,
        testInvoiceId: payload.invoiceId,
      };
    }

    return {
      success: false,
      httpStatus: response.status,
      durationMs,
      message: getFailureMessage(response.status, responseSummary),
      responseSummary,
      testInvoiceId: payload.invoiceId,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return {
        success: false,
        httpStatus: null,
        durationMs,
        message: "The OMS did not respond within 10 seconds.",
        responseSummary: null,
        testInvoiceId: payload.invoiceId,
      };
    }

    return {
      success: false,
      httpStatus: null,
      durationMs,
      message:
        error instanceof Error
          ? `Could not reach the OMS: ${error.message}`
          : "Could not reach the OMS endpoint.",
      responseSummary: null,
      testInvoiceId: payload.invoiceId,
    };
  }
}