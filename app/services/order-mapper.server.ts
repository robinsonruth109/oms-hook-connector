import type { OmsOrderData } from "./oms.server";

type ShopifyMoney = {
  amount?: string | number | null;
};

type ShopifyMoneySet = {
  shop_money?: ShopifyMoney | null;
};

type ShopifyAddress = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  province_code?: string | null;
  zip?: string | null;
  country?: string | null;
  country_code?: string | null;
};

type ShopifyCustomer = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

type ShopifyLineItem = {
  id?: string | number | null;
  sku?: string | null;
  name?: string | null;
  title?: string | null;
  variant_title?: string | null;
  quantity?: string | number | null;
  price?: string | number | null;
  price_set?: ShopifyMoneySet | null;
};

type ShopifyShippingLine = {
  price?: string | number | null;
  discounted_price?: string | number | null;
  price_set?: ShopifyMoneySet | null;
  discounted_price_set?: ShopifyMoneySet | null;
};

export type ShopifyOrderWebhook = {
  id?: string | number | null;
  name?: string | null;
  order_number?: string | number | null;
  phone?: string | null;
  note?: string | null;
  total_discounts?: string | number | null;
  current_total_discounts?: string | number | null;
  total_discounts_set?: ShopifyMoneySet | null;
  current_total_discounts_set?: ShopifyMoneySet | null;
  shipping_address?: ShopifyAddress | null;
  billing_address?: ShopifyAddress | null;
  customer?: ShopifyCustomer | null;
  shipping_lines?: ShopifyShippingLine[] | null;
  line_items?: ShopifyLineItem[] | null;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = cleanText(value);

    if (cleaned) {
      return cleaned;
    }
  }

  return "";
}

function combineName(
  firstName: unknown,
  lastName: unknown,
): string {
  return [cleanText(firstName), cleanText(lastName)]
    .filter(Boolean)
    .join(" ");
}

function buildAddress(
  address: ShopifyAddress | null | undefined,
): string {
  if (!address) {
    return "";
  }

  return [
    address.address1,
    address.address2,
    address.city,
    address.province || address.province_code,
    address.zip,
    address.country || address.country_code,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(", ");
}

function getShopPrefix(shop: string): string {
  const prefix = shop
    .replace(/\.myshopify\.com$/i, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()
    .slice(0, 24);

  return prefix || "SHOPIFY";
}

function getInvoiceId(order: ShopifyOrderWebhook): string {
  const orderName = cleanText(order.name).replace(/^#+/, "");

  if (orderName) {
    return orderName;
  }

  const orderNumber = String(order.order_number ?? "").trim();

  if (orderNumber) {
    return orderNumber;
  }

  const orderId = String(order.id ?? "").trim();

  if (orderId) {
    return orderId;
  }

  throw new Error("Shopify order does not contain an order ID.");
}

function getDeliveryCharge(order: ShopifyOrderWebhook): number {
  const shippingLines = Array.isArray(order.shipping_lines)
    ? order.shipping_lines
    : [];

  return shippingLines.reduce((total, line) => {
    const amount =
      line.discounted_price_set?.shop_money?.amount ??
      line.discounted_price ??
      line.price_set?.shop_money?.amount ??
      line.price;

    return total + toNumber(amount);
  }, 0);
}

function getDiscount(order: ShopifyOrderWebhook): number {
  const amount =
    order.current_total_discounts_set?.shop_money?.amount ??
    order.current_total_discounts ??
    order.total_discounts_set?.shop_money?.amount ??
    order.total_discounts;

  return toNumber(amount);
}

export function mapShopifyOrderToOms({
  order,
  shop,
}: {
  order: ShopifyOrderWebhook;
  shop: string;
}): OmsOrderData {
  const invoiceId = getInvoiceId(order);
  const externalOrderId = `${getShopPrefix(shop)}-${invoiceId}`;

  const shippingAddress = order.shipping_address;
  const billingAddress = order.billing_address;

  const customerName = firstNonEmpty(
    shippingAddress?.name,
    combineName(
      shippingAddress?.first_name,
      shippingAddress?.last_name,
    ),
    billingAddress?.name,
    combineName(
      billingAddress?.first_name,
      billingAddress?.last_name,
    ),
    combineName(
      order.customer?.first_name,
      order.customer?.last_name,
    ),
    "Shopify Customer",
  );

  const phone = firstNonEmpty(
    shippingAddress?.phone,
    billingAddress?.phone,
    order.phone,
    order.customer?.phone,
  );

  if (!phone) {
    throw new Error(
      `Shopify order ${invoiceId} does not contain a customer phone number.`,
    );
  }

  const address = firstNonEmpty(
    buildAddress(shippingAddress),
    buildAddress(billingAddress),
  );

  if (!address) {
    throw new Error(
      `Shopify order ${invoiceId} does not contain a delivery address.`,
    );
  }

  const sourceItems = Array.isArray(order.line_items)
    ? order.line_items
    : [];

  if (sourceItems.length === 0) {
    throw new Error(
      `Shopify order ${invoiceId} does not contain any products.`,
    );
  }

  const items = sourceItems.map((item, index) => {
    const sku = cleanText(item.sku);

    if (!sku) {
      const itemName = firstNonEmpty(
        item.name,
        item.title,
        `Item ${index + 1}`,
      );

      throw new Error(
        `Missing SKU for "${itemName}" in Shopify order ${invoiceId}.`,
      );
    }

    const quantity = Math.max(
      1,
      Math.trunc(toNumber(item.quantity)),
    );

    const price = toNumber(
      item.price_set?.shop_money?.amount ?? item.price,
    );

    const name = firstNonEmpty(
      item.name,
      [cleanText(item.title), cleanText(item.variant_title)]
        .filter(Boolean)
        .join(" - "),
      item.title,
      sku,
    );

    return {
      sku,
      name,
      quantity,
      price,
    };
  });

  return {
    externalOrderId,
    invoiceId,
    customerName,
    phone,
    address,
    deliveryCharge: getDeliveryCharge(order),
    discount: getDiscount(order),
    advance: 0,
    note: cleanText(order.note),
    items,
  };
}