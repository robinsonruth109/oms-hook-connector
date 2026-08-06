import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";

import { APP_NAME } from "../../config/app-info";
import styles from "./styles.module.css";

export const meta: MetaFunction = () => [
  { title: APP_NAME },
  {
    name: "description",
    content:
      "Securely send complete Shopify orders to a merchant-configured OMS and keep OMS delivery and Shopify fulfillment status visible in one embedded app.",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Shopify-owned install and launch surfaces include the shop context.
  // Continue directly to the authenticated embedded app when it is present.
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

function LogoMark() {
  return (
    <span className={styles.logoMark} aria-hidden="true">
      <svg viewBox="0 0 48 48" width="28" height="28" fill="none">
        <path
          d="M24 5.5 39 11v11.2c0 9.8-6.2 17-15 20.3C15.2 39.2 9 32 9 22.2V11l15-5.5Z"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="m17.5 24.2 4.2 4.2 9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function CheckIcon() {
  return (
    <span className={styles.checkIcon} aria-hidden="true">
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
        <path
          d="m5 10 3.1 3.1L15 6.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.backgroundGlowOne} />
      <div className={styles.backgroundGlowTwo} />

      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label={APP_NAME}>
          <LogoMark />
          <span>
            <strong>TrendyBridgeOMS</strong>
            <small>Hook Connector</small>
          </span>
        </a>

        <a className={styles.headerLogin} href="#installation">
          Installation
        </a>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            Shopify order-to-OMS synchronization
          </div>

          <h1 className={styles.heading}>
            Send complete Shopify orders to your OMS and track fulfillment.
          </h1>

          <p className={styles.subheading}>
            Connect a Shopify store to a compatible order management system
            using an HTTPS endpoint and API key. Eligible new orders are sent
            automatically, delivery attempts are logged, and Shopify
            fulfillment status stays visible in the embedded app.
          </p>

          <div className={styles.benefitList}>
            <div className={styles.benefit}>
              <CheckIcon />
              Automatic OMS order delivery
            </div>
            <div className={styles.benefit}>
              <CheckIcon />
              Encrypted OMS credentials and queued payloads
            </div>
            <div className={styles.benefit}>
              <CheckIcon />
              Delivery retries and Shopify fulfillment sync
            </div>
          </div>

          <div className={styles.trustRow}>
            <div>
              <strong>Secure</strong>
              <span>HTTPS and encrypted secrets</span>
            </div>
            <div>
              <strong>Reliable</strong>
              <span>Durable queue and controlled retries</span>
            </div>
            <div>
              <strong>Accurate</strong>
              <span>Webhook sync plus GraphQL reconciliation</span>
            </div>
          </div>
        </div>

        <aside className={styles.loginCard} id="installation">
          <div className={styles.cardIcon}>
            <LogoMark />
          </div>

          <p className={styles.eyebrow}>SHOPIFY-OWNED INSTALLATION</p>
          <h2>Install or open the app from Shopify</h2>

          <p className={styles.cardDescription}>
            Installation and authentication start only from the Shopify App
            Store or Shopify Admin. This website does not request a store
            domain or accept a manual installation.
          </p>

          <div className={styles.benefitList}>
            <div className={styles.benefit}>
              <CheckIcon />
              Open Shopify Admin and choose Apps
            </div>
            <div className={styles.benefit}>
              <CheckIcon />
              Select {APP_NAME}
            </div>
            <div className={styles.benefit}>
              <CheckIcon />
              Complete Shopify OAuth before using the app
            </div>
          </div>

          <div className={styles.securityNote}>
            <svg
              viewBox="0 0 20 20"
              width="16"
              height="16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6.5 8V6.5a3.5 3.5 0 0 1 7 0V8M5 8h10v8H5V8Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Authentication is completed securely through Shopify.
          </div>
        </aside>
      </section>

      <section className={styles.features}>
        <div className={styles.sectionHeading}>
          <p>BUILT FOR ORDER OPERATIONS</p>
          <h2>A dependable connection between Shopify and your OMS</h2>
        </div>

        <div className={styles.featureGrid}>
          <article className={styles.featureCard}>
            <div className={styles.featureNumber}>01</div>
            <h3>Secure order transfer</h3>
            <p>
              Complete Shopify orders are mapped to the configured OMS format,
              encrypted while queued, and sent to the merchant&apos;s HTTPS
              endpoint.
            </p>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureNumber}>02</div>
            <h3>Connection testing</h3>
            <p>
              Merchants can save and test their OMS endpoint and API key from
              the embedded Shopify Admin interface before enabling delivery.
            </p>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureNumber}>03</div>
            <h3>Logs, retries and fulfillment sync</h3>
            <p>
              Delivery Logs shows OMS results and Shopify fulfillment status,
              with controlled retries and a direct reconciliation check for
              missed or delayed webhook updates.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.workflow}>
        <div className={styles.workflowCopy}>
          <p className={styles.eyebrow}>HOW IT WORKS</p>
          <h2>Connect once. Review every synchronization step.</h2>
          <p>
            The merchant provides an endpoint and API key generated by their
            compatible OMS integration.
          </p>
        </div>

        <div className={styles.steps}>
          <div className={styles.step}>
            <span>1</span>
            <div>
              <strong>Install through Shopify</strong>
              <p>Authorize the required read-orders access through OAuth.</p>
            </div>
          </div>
          <div className={styles.stepLine} />
          <div className={styles.step}>
            <span>2</span>
            <div>
              <strong>Connect the OMS</strong>
              <p>Save and test the HTTPS endpoint and API key.</p>
            </div>
          </div>
          <div className={styles.stepLine} />
          <div className={styles.step}>
            <span>3</span>
            <div>
              <strong>Monitor delivery and fulfillment</strong>
              <p>Review OMS delivery and Shopify fulfillment in one log.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <a className={styles.footerBrand} href="/">
          <LogoMark />
          {APP_NAME}
        </a>

        <p>
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> ·{" "}
          <a href="/support">Support</a> · <a href="/security">Security</a>
        </p>

        <p>© {new Date().getFullYear()} Trendy Deal BD</p>
      </footer>
    </main>
  );
}
