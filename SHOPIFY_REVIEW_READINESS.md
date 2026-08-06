# Shopify review readiness — code package

This source package addresses the code-controlled review requirements for TrendyBridgeOMS Hook Connector.

## Implemented in code

- Shopify-owned installation and OAuth launch flow; no manual `myshopify.com` entry form.
- Embedded Shopify Admin UI.
- GraphQL Admin API reconciliation.
- Accurate OMS order delivery logs and Shopify fulfillment synchronization.
- Controlled retries and duplicate-webhook protection.
- HTTPS-only OMS endpoint validation.
- Encrypted API keys and queued order payloads.
- Mandatory privacy compliance webhooks and authenticated privacy-report UI.
- Public privacy, terms, support, and security pages with accurate retention disclosures.
- Consistent app naming across source and Shopify configuration.

## External Partner Dashboard work still required

The source ZIP cannot modify App Store listing fields. Before resubmission, the Partner Dashboard must use accurate production values:

1. Deploy the code and database migration to the production Railway service.
2. Deploy `shopify.app.production.toml` to the exact public app under review.
3. Verify the end-to-end order creation and fulfillment flow in the public app.
4. Replace all placeholder URLs such as `example.com` in the App Store listing.
5. Use the permanent production Privacy Policy URL.
6. Correct category, pricing, screenshots, feature media, screencast, and testing instructions.
7. Revoke any reviewer API key that has been exposed and create a dedicated replacement key.

A source package can be review-ready at code level, but Shopify approval also depends on production deployment, Partner Dashboard configuration, working credentials, media, and reviewer testing.
