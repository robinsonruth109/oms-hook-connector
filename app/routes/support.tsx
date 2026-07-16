import type { MetaFunction } from "react-router";

import {
  PolicyList,
  PolicySection,
  PublicPolicyLayout,
} from "../components/PublicPolicyLayout";

export const meta: MetaFunction = () => [
  {
    title:
      "Support | OMS Hook Connector",
  },
  {
    name: "description",
    content:
      "Installation, troubleshooting and privacy support for OMS Hook Connector.",
  },
];

export default function SupportPage() {
  return (
    <PublicPolicyLayout
      title="Support"
      description="Help with installation, OMS connection testing, webhook delivery and privacy requests."
      lastUpdated="July 17, 2026"
    >
      <PolicySection title="Contact support">
        <p>
          Email:{" "}
          <a href="mailto:trendysarverbd@gmail.com">
            trendysarverbd@gmail.com
          </a>
        </p>

        <p>
          Support requests are monitored during
          normal business days in Bangladesh.
          Response time depends on the severity
          and complexity of the issue.
        </p>
      </PolicySection>

      <PolicySection title="Information to include">
        <PolicyList
          items={[
            "Your Shopify store domain.",
            "A short description of what you expected to happen.",
            "The date and approximate Bangladesh time of the issue.",
            "The OMS delivery status or sanitized error shown inside the app.",
            "The Shopify order or invoice reference, where necessary.",
            "A screenshot with customer names, phone numbers, addresses and API keys hidden.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Do not email sensitive credentials">
        <p>
          Never send Shopify access tokens, OMS
          API keys, passwords, database
          credentials or encryption keys by
          email.
        </p>

        <p>
          Do not include customer names, phone
          numbers or full delivery addresses
          unless support specifically confirms
          that the information is necessary and
          provides an approved secure method.
        </p>
      </PolicySection>

      <PolicySection title="Basic setup">
        <PolicyList
          items={[
            "Install OMS Hook Connector from Shopify.",
            "Open OMS Settings inside the embedded application.",
            "Enter the HTTPS OMS order endpoint and API key.",
            "Save the connection and run Test Connection.",
            "Confirm that the clearly marked test order appears in the OMS.",
            "Enable automatic Shopify order delivery.",
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
            "Orders with missing phone numbers, delivery addresses or required SKU information may need correction before they can be processed.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Privacy requests">
        <p>
          Shopify customer-data reports appear
          in the authenticated Privacy Requests
          section of the app. Reports are
          encrypted and available only for their
          configured retention period.
        </p>

        <p>
          Merchants needing assistance with a
          customer access or deletion request
          should use the subject:
        </p>

        <p>
          <strong>
            Shopify Privacy Request Support
          </strong>
        </p>
      </PolicySection>

      <PolicySection title="Security incidents">
        <p>
          Suspected credential exposure,
          unauthorized access or a possible
          customer-data incident should be
          reported immediately to{" "}
          <a href="mailto:trendysarverbd@gmail.com?subject=URGENT%20SECURITY%20REPORT">
            trendysarverbd@gmail.com
          </a>
          .
        </p>

        <p>
          Use the email subject:
          <strong> URGENT SECURITY REPORT</strong>.
        </p>
      </PolicySection>
    </PublicPolicyLayout>
  );
}