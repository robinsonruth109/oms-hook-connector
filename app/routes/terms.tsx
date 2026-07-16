import type { MetaFunction } from "react-router";

import {
  PolicyList,
  PolicySection,
  PublicPolicyLayout,
} from "../components/PublicPolicyLayout";

export const meta: MetaFunction = () => [
  {
    title:
      "Terms of Service | OMS Hook Connector",
  },
  {
    name: "description",
    content:
      "Terms of service and merchant data-processing terms for OMS Hook Connector.",
  },
];

export default function TermsPage() {
  return (
    <PublicPolicyLayout
      title="Terms of Service"
      description="Terms governing merchant access to and use of OMS Hook Connector."
      lastUpdated="July 17, 2026"
    >
      <PolicySection title="1. Agreement">
        <p>
          These Terms of Service form an
          agreement between Trendy Deal BD and
          the Shopify merchant who installs or
          uses OMS Hook Connector.
        </p>

        <p>
          By installing, configuring or using
          the application, the merchant confirms
          that they have authority to accept
          these terms for the relevant business.
        </p>
      </PolicySection>

      <PolicySection title="2. Service description">
        <p>
          OMS Hook Connector receives newly
          created Shopify orders and attempts to
          transmit the selected order
          information to an OMS endpoint
          configured by the merchant.
        </p>

        <p>
          The application may also provide
          delivery logs, automatic retries,
          connection testing and tools for
          handling Shopify privacy requests.
        </p>
      </PolicySection>

      <PolicySection title="3. Merchant responsibilities">
        <PolicyList
          items={[
            "Provide an accurate and secure OMS endpoint and API key.",
            "Maintain authorization to use the connected OMS.",
            "Ensure that order and customer information is processed lawfully.",
            "Provide any privacy notices or obtain any consent required for the merchant’s business.",
            "Limit access to the Shopify store and application to authorized personnel.",
            "Review delivery logs and correct invalid configuration or order data.",
            "Avoid submitting secrets, passwords or unnecessary personal information through support messages.",
          ]}
        />
      </PolicySection>

      <PolicySection title="4. Connection testing">
        <p>
          The Test Connection feature sends a
          real test order to the merchant&apos;s
          configured OMS endpoint. The test
          order uses a clearly identified test
          invoice and demonstration customer
          information.
        </p>

        <p>
          The merchant is responsible for
          removing or ignoring that test order
          in the connected OMS.
        </p>
      </PolicySection>

      <PolicySection title="5. Third-party systems">
        <p>
          Shopify and the merchant-configured
          OMS are separate services. Trendy Deal
          BD does not control their
          availability, security policies,
          pricing, data retention or changes.
        </p>

        <p>
          The merchant is responsible for the
          OMS they connect and for any
          instructions or data transfers they
          configure.
        </p>
      </PolicySection>

      <PolicySection title="6. Data-processing terms">
        <p>
          For customer order information
          processed through the application, the
          merchant acts as the party determining
          the purpose of processing, and Trendy
          Deal BD processes that information
          only to provide, secure and support
          OMS Hook Connector.
        </p>

        <PolicyList
          items={[
            "We process customer order information only on the merchant’s documented instructions expressed through installation and configuration of the application.",
            "We limit processing to order delivery, retries, troubleshooting, security and privacy-request handling.",
            "We apply confidentiality, access-control, encryption, retention and audit measures appropriate to the application.",
            "We use infrastructure service providers where necessary to operate the application.",
            "We assist merchants with customer access and deletion requests through Shopify’s mandatory privacy webhook process.",
            "We delete or purge protected information according to the retention periods described in the Privacy Policy.",
            "The merchant must not instruct the application to process information unlawfully.",
          ]}
        />
      </PolicySection>

      <PolicySection title="7. Fees">
        <p>
          Any current or future fees will be
          disclosed through Shopify or the
          application before the merchant
          authorizes a charge. Shopify billing
          terms may also apply.
        </p>
      </PolicySection>

      <PolicySection title="8. Availability and changes">
        <p>
          We aim to keep the service available
          and reliable, but uninterrupted or
          error-free operation is not
          guaranteed. Maintenance, network
          failures, Shopify changes or
          third-party OMS failures may affect
          service.
        </p>

        <p>
          We may update the application to
          improve security, compliance,
          reliability or functionality.
        </p>
      </PolicySection>

      <PolicySection title="9. Suspension and termination">
        <p>
          Access may be limited or suspended
          where necessary to protect merchants,
          customers, the application or third
          parties, including suspected abuse,
          unlawful processing, security risk or
          violation of these terms.
        </p>

        <p>
          A merchant may stop using the service
          by uninstalling the application.
          Applicable shop information is deleted
          after the related Shopify redaction
          process is received and completed.
        </p>
      </PolicySection>

      <PolicySection title="10. Disclaimer">
        <p>
          The application is provided on an
          “as available” basis. To the maximum
          extent permitted by applicable law,
          Trendy Deal BD disclaims warranties
          that are not expressly stated in these
          terms.
        </p>
      </PolicySection>

      <PolicySection title="11. Limitation of liability">
        <p>
          To the maximum extent permitted by
          applicable law, Trendy Deal BD is not
          responsible for indirect,
          consequential or special loss,
          including loss caused by an
          unavailable or incorrectly configured
          third-party OMS.
        </p>
      </PolicySection>

      <PolicySection title="12. Governing law">
        <p>
          These terms are governed by the laws
          of Bangladesh. Disputes will be
          subject to the competent courts of
          Bangladesh unless applicable law
          requires otherwise.
        </p>
      </PolicySection>

      <PolicySection title="13. Contact">
        <p>
          Questions about these terms may be
          sent to{" "}
          <a href="mailto:trendysarverbd@gmail.com">
            trendysarverbd@gmail.com
          </a>
          .
        </p>
      </PolicySection>
    </PublicPolicyLayout>
  );
}