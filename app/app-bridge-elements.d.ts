import type {
  DetailedHTMLProps,
  HTMLAttributes,
} from "react";

type ShopifyAppNavProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": ShopifyAppNavProps;
      "ui-nav-menu": ShopifyAppNavProps;
    }
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": ShopifyAppNavProps;
      "ui-nav-menu": ShopifyAppNavProps;
    }
  }
}

export {};