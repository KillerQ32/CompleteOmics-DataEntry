import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Complete Omics Customer Portal",
  description:
    "Customer and admin portal concept for sample intake, package tracking, and clinical data review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
