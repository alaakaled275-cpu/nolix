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
<<<<<<< HEAD
    <html lang="en" className={outfitVariable}>
      <body>{children}</body>
=======
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
>>>>>>> 31c2dd0f71bc9ff3353df4e0b656489db5614e92
    </html>
  );
}
