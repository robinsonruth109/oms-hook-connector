import type { MetaFunction } from "react-router";

import {
  APP_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from "../config/app-info";
import {
  PolicyList,
  PolicySection,
  PublicPolicyLayout,
} from "../components/PublicPolicyLayout";

export const meta: MetaFunction = () => [
  { title: `Support | ${APP_NAME}` },
  {
    name: "description",
    content: `Installation, OMS connection, synchronization and privacy support for ${APP_NAME}.`,
  },
];

export default function SupportPage() {
  return (
    <PublicPolicyLayout
      title="Support"
      description="Help with Shopify installation, OMS connection testing, order delivery, fulfillment synchronization and privacy requests."
      lastUpdated="August 6, 2026"
    >
      <PolicySection title="Contact support">
        <p>
          Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        <p>Phone: {SUPPORT_PHONE}</p>
        <p>
          Support requests are monitored during normal business days in
          Bangladesh. Response time depends on the severity and complexity of
          the issue.
        </p>
      </PolicySection>

      <PolicySection title="Information to include">
        <PolicyList
          items={[
            "The Shopify store name shown in Shopify Admin.",
            "A short description of what you expected to happen.",
            "The date and approximate Bangladesh time of the issue.",
            "The OMS delivery or Shopify fulfillment status shown inside the app.",
            "The Shopify order or invoice reference, where necessary.",
            "A screenshot with customer names, phone numbers, addresses and API keys hidden.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Do not email sensitive credentials">
        <p>
          Never send Shopify access tokens, OMS API keys, passwords, database
          credentials or encryption keys by email.
        </p>
        <p>
          Do not include customer names, phone numbers or full delivery
          addresses unless support specifically confirms a secure method and
          the information is necessary to resolve the issue.
        </p>
      </PolicySection>

      <PolicySection title="Installation and setup">
        <PolicyList
          items={[
            `Install or open ${APP_NAME} only from the Shopify App Store or Shopify Admin.`,
            "Complete Shopify OAuth before using the embedded application.",
            "Open OMS Settings inside the embedded application.",
            "Enter the HTTPS OMS order endpoint and API key.",
            "Save the connection and run Test Connection.",
            "Confirm that the clearly marked test order appears in the OMS.",
            "Create a Shopify order with customer name, phone number, shipping address and a product with an SKU.",
            "Open Delivery Logs to confirm OMS delivery and Shopify fulfillment status.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Fulfillment synchronization test">
        <PolicyList
          items={[
            "Create a complete Shopify order and confirm it appears in Delivery Logs.",
            "Open the order in Shopify Admin and fulfill all or part of the order.",
            "Return to Delivery Logs and use Refresh Shopify statuses if needed.",
            "Confirm the Shopify badge changes to Fulfilled or Partially Fulfilled and that the synchronization timestamp is updated.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Common troubleshooting">
        <PolicyList
          items={[
            "HTTP 401 or 403 normally means the OMS rejected the configured API key.",
            "HTTP 404 normally means the configured endpoint path was not found.",
            "HTTP 400 or 422 normally means the OMS rejected the order structure or required data.",
            "HTTP 408, 429 and server errors can be retried automatically.",
            "Orders with missing phone numbers, delivery addresses, products or required SKU information must be corrected before they can be sent.",
            "If fulfillment status is delayed, open Delivery Logs and use Refresh Shopify statuses to reconcile recent orders through Shopify's GraphQL Admin API.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Privacy requests">
        <p>
          Shopify customer-data reports appear in the authenticated Privacy
          Requests section of the app. Reports are encrypted and available only
          for their configured retention period.
        </p>
        <p>
          Merchants needing assistance with a customer access or deletion
          request should use the subject <strong>Shopify Privacy Request Support</strong>.
        </p>
      </PolicySection>

      <PolicySection title="Security incidents">
        <p>
          Suspected credential exposure, unauthorized access or a possible
          customer-data incident should be reported immediately to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=URGENT%20SECURITY%20REPORT`}>
            {SUPPORT_EMAIL}
          </a>.
        </p>
      </PolicySection>
    </PublicPolicyLayout>
  );
}
