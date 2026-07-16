import type { MetaFunction } from "react-router";

import {
  PolicyList,
  PolicySection,
  PublicPolicyLayout,
} from "../components/PublicPolicyLayout";

export const meta: MetaFunction = () => [
  {
    title:
      "Privacy Policy | OMS Hook Connector",
  },
  {
    name: "description",
    content:
      "Privacy policy for OMS Hook Connector by Trendy Deal BD.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <PublicPolicyLayout
      title="Privacy Policy"
      description="How OMS Hook Connector processes merchant, store and customer order data."
      lastUpdated="July 17, 2026"
    >
      <PolicySection title="1. Who we are">
        <p>
          OMS Hook Connector is operated by
          Trendy Deal BD in Bangladesh. This
          policy explains how we process data
          when a Shopify merchant installs or
          uses the application.
        </p>

        <p>
          Contact:{" "}
          <a href="mailto:trendysarverbd@gmail.com">
            trendysarverbd@gmail.com
          </a>
        </p>
      </PolicySection>

      <PolicySection title="2. Our role">
        <p>
          The Shopify merchant normally
          determines why customer information
          is processed. For customer order
          information, Trendy Deal BD acts as a
          service provider or data processor on
          the merchant&apos;s instructions.
        </p>

        <p>
          Customers should normally contact the
          Shopify store where they placed their
          order to exercise their privacy
          rights.
        </p>
      </PolicySection>

      <PolicySection title="3. Information we process">
        <PolicyList
          items={[
            <>
              <strong>
                Merchant and store information:
              </strong>{" "}
              shop domain, Shopify installation
              sessions, authorized app-user
              information supplied by Shopify,
              access scopes and application
              settings.
            </>,
            <>
              <strong>
                OMS configuration:
              </strong>{" "}
              the merchant&apos;s OMS endpoint,
              encrypted API key, connection
              status and connection-test
              results.
            </>,
            <>
              <strong>
                Customer and order information:
              </strong>{" "}
              order identifiers, invoice
              references, recipient name, phone
              number, delivery address, order
              items, SKU, quantity, price,
              delivery charge, discount,
              advance amount and order notes.
            </>,
            <>
              <strong>
                Operational information:
              </strong>{" "}
              webhook identifiers, delivery
              status, retry attempts,
              timestamps, HTTP status codes,
              response duration and sanitized
              error summaries.
            </>,
            <>
              <strong>
                Privacy-request information:
              </strong>{" "}
              encrypted reports prepared in
              response to Shopify customer-data
              requests and audit records showing
              when protected information was
              processed or downloaded.
            </>,
          ]}
        />

        <p>
          Customer email is not intentionally
          stored as part of the normal OMS order
          transfer.
        </p>
      </PolicySection>

      <PolicySection title="4. Why we process information">
        <PolicyList
          items={[
            "To connect a Shopify store to the merchant’s chosen order management system.",
            "To securely transfer newly created Shopify orders to that system.",
            "To retry temporary delivery failures and show delivery status to the merchant.",
            "To troubleshoot errors and protect the reliability and security of the service.",
            "To respond to Shopify customer-data access, deletion and shop-redaction requests.",
            "To prevent duplicate webhook processing and unauthorized access.",
          ]}
        />
      </PolicySection>

      <PolicySection title="5. How information is shared">
        <p>
          Order information is transmitted to
          the OMS endpoint configured by the
          merchant. The merchant is responsible
          for selecting and managing that OMS.
        </p>

        <p>
          We also use hosting, database,
          security and infrastructure providers
          where necessary to operate the
          application. Those providers may
          process information only to provide
          services to us.
        </p>

        <p>
          We do not sell customer or merchant
          personal information, use it for
          advertising, or use it for automated
          decisions that produce legal or
          similarly significant effects.
        </p>
      </PolicySection>

      <PolicySection title="6. Retention">
        <PolicyList
          items={[
            "A protected queued order payload is removed immediately after successful OMS delivery.",
            "If delivery does not succeed, the protected queued payload is retained for no more than seven days.",
            "Delivery metadata used for troubleshooting is retained for up to 30 days.",
            "Encrypted customer-data request reports are retained for up to 30 days.",
            "OMS configuration and Shopify session data are retained while required to provide the installed application.",
            "Shop-related records are deleted when Shopify sends the applicable shop-redaction request.",
            "Protected-data audit records are removed when the related shop data is redacted.",
          ]}
        />
      </PolicySection>

      <PolicySection title="7. Security">
        <PolicyList
          items={[
            "Production connections use HTTPS.",
            "OMS API keys and queued order payloads are encrypted at application level using AES-256-GCM.",
            "Privacy reports can only be downloaded through an authenticated Shopify merchant session.",
            "Report-download responses disable browser and intermediary caching.",
            "Protected-data processing and report downloads are audit logged without writing customer names, phone numbers or addresses into the audit record.",
            "Application secrets are stored outside the source-code repository.",
          ]}
        />
      </PolicySection>

      <PolicySection title="8. Privacy requests">
        <p>
          Shopify merchants and their customers
          may have rights to access, correct or
          delete personal information. We
          process Shopify&apos;s mandatory
          customer-data access, customer
          redaction and shop-redaction
          requests.
        </p>

        <p>
          Merchants may also contact us at{" "}
          <a href="mailto:trendysarverbd@gmail.com">
            trendysarverbd@gmail.com
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="9. International processing">
        <p>
          Information may be processed in
          countries where our infrastructure
          providers operate. We take reasonable
          steps to limit processing to what is
          necessary to provide and secure the
          application.
        </p>
      </PolicySection>

      <PolicySection title="10. Policy changes">
        <p>
          We may update this policy when the
          application, our security controls or
          legal requirements change. The
          updated date at the top of this page
          identifies the latest version.
        </p>
      </PolicySection>
    </PublicPolicyLayout>
  );
}