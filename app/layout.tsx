import type { Metadata } from "next";
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
        <DateInputEnhancer />
        {children}
      </body>
    </html>
  );
}
