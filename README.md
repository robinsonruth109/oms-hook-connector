# TrendyBridgeOMS Hook Connector

TrendyBridgeOMS Hook Connector is an embedded Shopify public app operated by Trendy Deal BD. It sends complete newly created Shopify orders to a merchant-configured OMS endpoint, records delivery attempts, retries temporary failures, and synchronizes Shopify fulfillment status into Delivery Logs.

## Core workflow

1. The merchant installs or opens the app from a Shopify-owned surface and completes Shopify OAuth.
2. The merchant saves an HTTPS OMS endpoint and API key in OMS Settings.
3. Test Connection sends a clearly identified demonstration order.
4. `orders/create` queues a complete Shopify order for encrypted delivery to the OMS.
5. Delivery Logs shows OMS status, HTTP status, response time, customer name, and retry state.
6. `orders/fulfilled`, `orders/partially_fulfilled`, and `orders/updated` synchronize Shopify fulfillment state.
7. Delivery Logs also performs GraphQL reconciliation for recent orders to repair missed or delayed webhook updates.

## Required order data

The connected OMS requires each Shopify order to contain:

- customer name;
- phone number;
- shipping or billing address;
- at least one product;
- an SKU for every line item.

Orders missing required data are rejected with a sanitized operational error and are not silently sent with incomplete information.

## Privacy and security

- OMS API keys and queued order payloads are encrypted with AES-256-GCM.
- The encrypted order payload is removed immediately after successful OMS delivery.
- The customer name is retained separately for no more than seven days so authorized merchants can identify a Delivery Logs record.
- Operational metadata is removed after 30 days by the retention worker.
- Mandatory Shopify compliance webhooks are implemented for `customers/data_request`, `customers/redact`, and `shop/redact`.
- Raw third-party OMS responses are not retained.

## Environment variables

Copy `.env.example` and configure:

- `DATABASE_URL`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `SCOPES=read_orders`
- `OMS_ENCRYPTION_KEY`
- `OMS_RETRY_SECRET`

Never commit production secrets or reviewer credentials.

## Local verification

```bash
npm ci
npm run prisma -- validate
npm run prisma -- generate
npm run lint
npm run typecheck
npm run build
```

## Database deployment

The production container runs:

```bash
prisma generate
prisma migrate deploy
```

before starting the server. The fulfillment synchronization migration is:

```text
prisma/migrations/20260806080000_add_shopify_fulfillment_sync/migration.sql
```

## Shopify configurations

- `shopify.app.toml`: public App Store app; safe default for production release.
- `shopify.app.production.toml`: alias for the public App Store app.
- `shopify.app.oms-hook-connector-public.toml`: explicit public App Store configuration.
- `shopify.app.staging.toml`: staging Shopify app and Railway staging URL.
- `shopify.app.oms-hook-connector.toml`: staging alias retained for compatibility.

Use an explicit config when deploying:

```bash
npm run shopify -- app config validate --config staging
npm run shopify -- app deploy --config staging

npm run shopify -- app config validate --config production
npm run shopify -- app deploy --config production
```

Confirm the correct `client_id`, Railway environment, and migration before releasing production configuration.

## Public information pages

- `/privacy`
- `/terms`
- `/support`
- `/security`

Installation is not initiated from the public website. Merchants install and launch the app only from Shopify-owned surfaces.
