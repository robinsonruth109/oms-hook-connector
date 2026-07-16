import type { MetaFunction } from "react-router";

import {
  PolicyList,
  PolicySection,
  PublicPolicyLayout,
} from "../components/PublicPolicyLayout";

export const meta: MetaFunction = () => [
  {
    title:
      "Security | OMS Hook Connector",
  },
  {
    name: "description",
    content:
      "Security practices and vulnerability reporting for OMS Hook Connector.",
  },
];

export default function SecurityPage() {
  return (
    <PublicPolicyLayout
      title="Security"
      description="A summary of the technical and operational controls used to protect OMS Hook Connector."
      lastUpdated="July 17, 2026"
    >
      <PolicySection title="Security approach">
        <p>
          Trendy Deal BD applies data
          minimization, encryption, authenticated
          access, retention controls and audit
          logging to reduce the risk associated
          with processing Shopify order
          information.
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
            "Embedded merchant pages require Shopify administrator authentication.",
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
            "Customer names are not stored in a separate plaintext delivery-job field for new orders.",
            "Protected order payloads are deleted immediately after successful OMS delivery.",
            "Undelivered protected payloads expire after seven days.",
            "Operational delivery metadata expires after 30 days.",
            "Encrypted privacy reports expire after 30 days.",
            "Raw OMS responses are not retained because they could repeat customer information.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Audit logging">
        <p>
          The application records security and
          protected-data actions such as payload
          encryption, decryption for OMS
          delivery, retention cleanup, privacy
          report generation and merchant report
          download.
        </p>

        <p>
          Audit records are designed not to
          contain customer names, phone numbers
          or delivery addresses.
        </p>
      </PolicySection>

      <PolicySection title="Webhook and application security">
        <PolicyList
          items={[
            "Duplicate Shopify order webhooks are rejected using a unique webhook identifier.",
            "Temporary network and server errors use controlled retry intervals.",
            "Sensitive endpoint responses are sanitized before operational logging.",
            "Shop and customer redaction webhooks delete related records from the application database.",
            "Application secrets are kept outside frontend code and public repositories.",
          ]}
        />
      </PolicySection>

      <PolicySection title="Security certifications">
        <p>
          OMS Hook Connector does not currently
          claim an independent SOC 2, ISO 27001
          or similar security certification.
        </p>
      </PolicySection>

      <PolicySection title="Report a vulnerability">
        <p>
          Send security reports to{" "}
          <a href="mailto:trendysarverbd@gmail.com?subject=Security%20Vulnerability%20Report">
            trendysarverbd@gmail.com
          </a>
          .
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
          Suspected incidents are investigated
          to identify the affected systems,
          contain unauthorized access, protect
          credentials, preserve relevant audit
          information and notify affected
          parties where required.
        </p>
      </PolicySection>
    </PublicPolicyLayout>
  );
}