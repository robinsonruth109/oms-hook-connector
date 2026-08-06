# Changelog

## 2026-08-06 — App Store review readiness

- Added Shopify fulfillment synchronization for fulfilled, partially fulfilled, and updated orders.
- Added GraphQL reconciliation for recent orders when Delivery Logs opens.
- Added Shopify fulfillment status, timestamps, and synchronization details to Delivery Logs.
- Retained customer names for no more than seven days while immediately purging the encrypted payload after successful OMS delivery.
- Removed manual Shopify shop-domain installation and login forms.
- Standardized the public app name as `TrendyBridgeOMS Hook Connector` across application and Shopify configuration files.
- Updated privacy, terms, support, and security disclosures to match actual processing and retention behavior.
- Standardized public and staging Shopify app configurations and mandatory compliance webhooks.

## 2026-07-31 — Delivery log customer identification

- Saved the mapped customer name with new delivery jobs.
- Kept the customer name available after successful OMS delivery until the seven-day retention deadline.
- Continued immediate removal of encrypted phone and address payload data after successful delivery.

## 2026-07-17 — Privacy and data retention

- Added encrypted customer-data request reports.
- Added customer and shop redaction handling.
- Added protected-data audit logging and retention cleanup.
