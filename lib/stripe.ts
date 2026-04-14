import Stripe from "stripe";

// Initialize Stripe gracefully, failing only when explicitly needed if missing
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_sk_test", {
  apiVersion: "2025-02-24.acacia" as any,
  typescript: true,
  appInfo: {
    name: "ConvertAI Hybrid Engine",
    version: "1.0.0",
  },
});

// Helper for Stripe Price IDs (Usually maintained in a real .env, keeping constants for execution)
export const STRIPE_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER || "price_starter_dummy",
  growth: process.env.STRIPE_PRICE_GROWTH || "price_growth_dummy",
  scale: process.env.STRIPE_PRICE_SCALE || "price_scale_dummy",
  revenue_share: process.env.STRIPE_PRICE_METERED_SHARE || "price_metered_dummy",
};
