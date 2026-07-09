import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "cap-widget": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          "data-cap-api-endpoint"?: string;
          "data-cap-i18n-initial-state"?: string;
          "data-cap-i18n-verifying-label"?: string;
          "data-cap-i18n-solved-label"?: string;
          "data-cap-i18n-error-label"?: string;
          "data-cap-i18n-required-label"?: string;
          required?: boolean;
          onsolve?: (e: CustomEvent<{ token: string }>) => void;
          onerror?: (e: CustomEvent<{ message: string }>) => void;
          onreset?: (e: CustomEvent) => void;
        },
        HTMLElement
      >;
    }
  }
}
