import type { MetaFunction } from "react-router";

import {
  APP_NAME,
  BUSINESS_NAME,
  OPERATIONAL_DATA_RETENTION_DAYS,
  PERSONAL_DATA_RETENTION_DAYS,
  SUPPORT_EMAIL,
} from "../config/app-info";
import {
  PolicyList,
  PolicySection,
  PublicPolicyLayout,
} from "../components/PublicPolicyLayout";

export const meta: MetaFunction = () => [
  { title: `Security | ${APP_NAME}` },
  {
    name: "description",
    content: `Security practices and vulnerability reporting for ${APP_NAME}.`,
  },
];

export default function SecurityPage() {
  return (
    <PublicPolicyLayout
      title="Security"
      description={`A summary of the technical and operational controls used to protect ${APP_NAME}.`}
      lastUpdated="August 6, 2026"
    >
      <PolicySection title="Security approach">
        <p>
          {BUSINESS_NAME} applies data minimization, encryption, authenticated
          access, retention controls and audit logging to reduce the risk
          associated with processing Shopify order information.
        </p>
      </PolicySection>

      <PolicySection title="Encryption">
        <PolicyList
          items={[
            "Production application and OMS connections are required to use HTTPS.",
            "OMS API keys are encrypted before database storage.",
            "Queued order payloads containing names, phone numbers and addresses are encrypted using AES-256-GCM.",
            "Customer-data request reports are encrypted before storage.",
            "Encryption keys are supplied through protected environment configuration and are not committed to the source-code repository.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Authentication and access">
        <PolicyList
          items={[
            "Installation and app launch begin from Shopify-owned surfaces.",
            "Embedded merchant pages require Shopify administrator authentication and session tokens.",
            "Privacy reports are restricted to the authenticated Shopify shop that received the request.",
            "Background retry and cleanup endpoints require a separate bearer secret.",
            "Webhook authenticity is verified through the Shopify application authentication library.",
            "Protected-data reports are delivered with no-store and no-cache response headers.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Data minimization and retention">
        <PolicyList
          items={[
            "After successful OMS delivery, the encrypted payload containing the phone number and address is removed immediately.",
            `The customer name is retained separately for no more than ${PERSONAL_DATA_RETENTION_DAYS} days so the merchant can identify a Delivery Logs record.`,
            `Undelivered protected payloads expire after ${PERSONAL_DATA_RETENTION_DAYS} days.`,
            `Operational delivery and fulfillment metadata expires after ${OPERATIONAL_DATA_RETENTION_DAYS} days.`,
            `Encrypted privacy reports expire after ${OPERATIONAL_DATA_RETENTION_DAYS} days.`,
            "Raw OMS responses are not retained because they could repeat customer information.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Synchronization safeguards">
        <PolicyList
          items={[
            "Shopify order creation webhooks queue eligible orders for OMS delivery.",
            "Fulfilled, partially fulfilled and updated-order webhooks update the matching Delivery Logs record.",
            "Opening Delivery Logs performs a GraphQL reconciliation check for recent orders to repair missed or delayed webhook updates.",
            "Webhook identifiers provide idempotency protection against duplicate delivery processing.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Audit logging">
        <p>
          The application records security and protected-data actions such as
          payload encryption, decryption for OMS delivery, retention cleanup,
          privacy report generation and merchant report download.
        </p>
        <p>
          Audit records are designed not to contain customer names, phone
          numbers or delivery addresses.
        </p>
      </PolicySection>

      <PolicySection title="Webhook and application security">
        <PolicyList
          items={[
            "Temporary network and server errors use controlled retry intervals.",
            "Sensitive endpoint responses are sanitized before operational logging.",
            "Shop and customer redaction webhooks delete related records from the application database.",
            "Application secrets are kept outside frontend code and public repositories.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Security certifications">
        <p>
          {APP_NAME} does not currently claim an independent SOC 2, ISO 27001
          or similar security certification.
        </p>
      </PolicySection>

      <PolicySection title="Report a vulnerability">
        <p>
          Send security reports to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Security%20Vulnerability%20Report`}>
            {SUPPORT_EMAIL}
          </a>.
        </p>
        <PolicyList
          items={[
            "Explain the affected page or feature.",
            "Describe the steps needed to reproduce the issue.",
            "Explain the potential security impact.",
            "Do not access, modify or download another merchant’s or customer’s data.",
            "Do not include API keys, passwords or customer personal data in the report.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Incident response">
        <p>
          Suspected incidents are investigated to identify affected systems,
          contain unauthorized access, protect credentials, preserve relevant
          audit information and notify affected parties where required.
        </p>
      </PolicySection>
    </PublicPolicyLayout>
  );
}
