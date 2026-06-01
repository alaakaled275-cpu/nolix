import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
  appInfo: { name: "NOLIX", version: "3.0.0" },
});

export const STRIPE_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER || "price_starter_dummy",
  growth: process.env.STRIPE_PRICE_GROWTH || "price_growth_dummy",
  scale: process.env.STRIPE_PRICE_SCALE || "price_scale_dummy",
  revenue_share: process.env.STRIPE_PRICE_METERED_SHARE || "price_metered_dummy",
};
