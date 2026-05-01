import type { Metadata } from "next";
import Script from "next/script";
import { DateInputEnhancer } from "./date-input-enhancer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Complete Omics Customer Portal",
  description:
    "Customer and admin portal concept for sample intake, package tracking, and clinical data review.",
  icons: {
    icon: "/completeomics-favicon-transparent.png?v=3",
    shortcut: "/completeomics-favicon-transparent.png?v=3",
    apple: "/completeomics-favicon-transparent.png?v=3",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Script id="strip-form-extension-attrs" strategy="beforeInteractive">
          {`
            (() => {
              const ATTRIBUTES = ["fdprocessedid"];

              const stripAttributes = (node) => {
                if (!node || node.nodeType !== Node.ELEMENT_NODE) {
                  return;
                }

                for (const attribute of ATTRIBUTES) {
                  if (node.hasAttribute(attribute)) {
                    node.removeAttribute(attribute);
                  }
                }

                if (node.querySelectorAll) {
                  for (const attribute of ATTRIBUTES) {
                    node.querySelectorAll('[' + attribute + ']').forEach((element) => {
                      element.removeAttribute(attribute);
                    });
                  }
                }
              };

              const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                  if (mutation.type === "attributes") {
                    stripAttributes(mutation.target);
                  }

                  mutation.addedNodes.forEach((addedNode) => {
                    stripAttributes(addedNode);
                  });
                }
              });

              const start = () => {
                stripAttributes(document.documentElement);
                observer.observe(document.documentElement, {
                  subtree: true,
                  childList: true,
                  attributes: true,
                  attributeFilter: ATTRIBUTES,
                });

                window.addEventListener(
                  "load",
                  () => {
                    setTimeout(() => observer.disconnect(), 1500);
                  },
                  { once: true },
                );
              };

              if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", start, { once: true });
              } else {
                start();
              }
            })();
          `}
        </Script>
        <DateInputEnhancer />
        {children}
      </body>
    </html>
  );
}
