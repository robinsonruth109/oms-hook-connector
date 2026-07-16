import { timingSafeEqual } from "node:crypto";
import type { ActionFunctionArgs } from "react-router";

import { runDueOrderRetries } from "../services/order-delivery.server";

function secretsMatch(supplied: string, expected: string): boolean {
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (suppliedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(suppliedBuffer, expectedBuffer);
}

// Opening this endpoint in a browser uses GET.
// Only authenticated POST requests are allowed.
export const loader = async () => {
  return Response.json(
    {
      success: false,
      message: "Method not allowed. Use POST.",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    },
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const expectedSecret = process.env.OMS_RETRY_SECRET?.trim();

  if (!expectedSecret) {
    console.error("OMS_RETRY_SECRET is not configured.");

    return Response.json(
      {
        success: false,
        message: "Retry worker is not configured.",
      },
      {
        status: 503,
      },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearerPrefix = "Bearer ";

  const suppliedSecret = authorization.startsWith(bearerPrefix)
    ? authorization.slice(bearerPrefix.length).trim()
    : "";

  if (
    !suppliedSecret ||
    !secretsMatch(suppliedSecret, expectedSecret)
  ) {
    return Response.json(
      {
        success: false,
        message: "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const summary = await runDueOrderRetries({
      limit: 50,
    });

    console.info("OMS retry worker completed", summary);

    return Response.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error("OMS retry worker failed", error);

    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The retry worker failed unexpectedly.",
      },
      {
        status: 500,
      },
    );
  }
};