import process from "node:process";

const appUrl = process.env.SHOPIFY_APP_URL?.trim().replace(/\/+$/, "");
const retrySecret = process.env.OMS_RETRY_SECRET?.trim();

if (!appUrl) {
  console.error("SHOPIFY_APP_URL is missing.");
  process.exit(1);
}

if (!retrySecret) {
  console.error("OMS_RETRY_SECRET is missing.");
  process.exit(1);
}

const endpoint = `${appUrl}/api/retries/run`;

try {
  console.log(`Running OMS retries through ${endpoint}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${retrySecret}`,
    },
    signal: AbortSignal.timeout(60_000),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(
      `Retry worker failed with HTTP ${response.status}: ${responseText}`,
    );
    process.exit(1);
  }

  console.log(`Retry worker completed: ${responseText}`);
} catch (error) {
  console.error(
    "Retry worker request failed:",
    error instanceof Error ? error.message : String(error),
  );

  process.exit(1);
}