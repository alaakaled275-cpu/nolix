import type { Metadata } from "next";
import "./globals.css";
const outfitVariable = "--font-outfit";

export const metadata: Metadata = {
  title: "NOLIX – E-Commerce Interaction Engine",
  description:
    "AI-powered interactive offers that increase your store's conversion rate. Works with Shopify, WooCommerce, and Etsy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfitVariable} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/landing.css" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
