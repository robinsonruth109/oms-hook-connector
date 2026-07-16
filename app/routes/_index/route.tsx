import type { LoaderFunctionArgs } from "react-router";
import {
  Form,
  redirect,
  useLoaderData,
} from "react-router";

import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({
  request,
}: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return {
    showForm: Boolean(login),
  };
};

function LogoMark() {
  return (
    <span className={styles.logoMark} aria-hidden="true">
      <svg
        viewBox="0 0 48 48"
        width="28"
        height="28"
        fill="none"
      >
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
      <svg
        viewBox="0 0 20 20"
        width="14"
        height="14"
        fill="none"
      >
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
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <main className={styles.page}>
      <div className={styles.backgroundGlowOne} />
      <div className={styles.backgroundGlowTwo} />

      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="OMS Hook Connector">
          <LogoMark />

          <span>
            <strong>OMS Hook</strong>
            <small>Connector</small>
          </span>
        </a>

        <a className={styles.headerLogin} href="#merchant-login">
          Merchant login
        </a>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            Shopify order automation
          </div>

          <h1 className={styles.heading}>
            Send every Shopify order directly to your custom OMS.
          </h1>

          <p className={styles.subheading}>
            Connect Shopify with your order management system using a secure
            endpoint and API key. New orders are transferred automatically,
            logged and retried when delivery temporarily fails.
          </p>

          <div className={styles.benefitList}>
            <div className={styles.benefit}>
              <CheckIcon />
              Automatic order delivery
            </div>

            <div className={styles.benefit}>
              <CheckIcon />
              Encrypted OMS credentials
            </div>

            <div className={styles.benefit}>
              <CheckIcon />
              Delivery logs and retry protection
            </div>
          </div>

          <div className={styles.trustRow}>
            <div>
              <strong>Secure</strong>
              <span>Encrypted API keys</span>
            </div>

            <div>
              <strong>Reliable</strong>
              <span>Durable delivery queue</span>
            </div>

            <div>
              <strong>Simple</strong>
              <span>Endpoint + API key</span>
            </div>
          </div>
        </div>

        <aside className={styles.loginCard} id="merchant-login">
          <div className={styles.cardIcon}>
            <LogoMark />
          </div>

          <p className={styles.eyebrow}>MERCHANT ACCESS</p>

          <h2>Connect your Shopify store</h2>

          <p className={styles.cardDescription}>
            Enter your permanent Shopify store domain to install or open OMS
            Hook Connector.
          </p>

          {showForm ? (
            <Form
              className={styles.form}
              method="post"
              action="/auth/login"
            >
              <label className={styles.label} htmlFor="shop">
                Shopify store domain
              </label>

              <div className={styles.inputWrapper}>
                <span className={styles.inputPrefix}>https://</span>

                <input
                  className={styles.input}
                  id="shop"
                  name="shop"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="your-store.myshopify.com"
                  required
                  aria-describedby="shop-help"
                />
              </div>

              <p className={styles.helpText} id="shop-help">
                Example: your-store.myshopify.com
              </p>

              <button className={styles.button} type="submit">
                Continue to Shopify
                <span aria-hidden="true">→</span>
              </button>
            </Form>
          ) : (
            <p className={styles.unavailable}>
              Shopify authentication is currently unavailable.
            </p>
          )}

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
          <h2>Everything needed for a dependable OMS connection</h2>
        </div>

        <div className={styles.featureGrid}>
          <article className={styles.featureCard}>
            <div className={styles.featureNumber}>01</div>
            <h3>Real-time order transfer</h3>
            <p>
              New Shopify orders are mapped to your OMS JSON structure and
              queued for secure delivery.
            </p>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureNumber}>02</div>
            <h3>Connection testing</h3>
            <p>
              Test the OMS endpoint and API key directly from Shopify before
              enabling automatic delivery.
            </p>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureNumber}>03</div>
            <h3>Logs and retries</h3>
            <p>
              Review successful and failed deliveries, inspect errors and retry
              orders without creating duplicate webhook jobs.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.workflow}>
        <div className={styles.workflowCopy}>
          <p className={styles.eyebrow}>HOW IT WORKS</p>
          <h2>Connect once. Orders move automatically.</h2>
          <p>
            The merchant only needs the endpoint and API key generated by their
            compatible OMS integration.
          </p>
        </div>

        <div className={styles.steps}>
          <div className={styles.step}>
            <span>1</span>
            <div>
              <strong>Install the app</strong>
              <p>Authorize access to new Shopify orders.</p>
            </div>
          </div>

          <div className={styles.stepLine} />

          <div className={styles.step}>
            <span>2</span>
            <div>
              <strong>Connect the OMS</strong>
              <p>Save and test the OMS endpoint and API key.</p>
            </div>
          </div>

          <div className={styles.stepLine} />

          <div className={styles.step}>
            <span>3</span>
            <div>
              <strong>Receive orders</strong>
              <p>New Shopify orders are transferred automatically.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <a className={styles.footerBrand} href="/">
          <LogoMark />
          OMS Hook Connector
        </a>

        <p>Secure Shopify-to-OMS order automation.</p>

        <p>© {new Date().getFullYear()} OMS Hook Connector</p>
      </footer>
    </main>
  );
}