/**
 * NOLIX — Quickstart & Onboarding Engine (COMMAND 11)
 * lib/nolix-quickstart-engine.ts
 */

import { runHybridBrain, BrainInput } from "./nolix-hybrid-brain";
import crypto from "crypto";

export function detectPlatform(userAgent: string, htmlContent?: string): "Shopify" | "WooCommerce" | "Custom" {
  if (htmlContent) {
    if (htmlContent.includes("cdn.shopify.com") || htmlContent.includes("Shopify.theme")) return "Shopify";
    if (htmlContent.includes("wp-content/plugins/woocommerce")) return "WooCommerce";
  }
  return "Custom";
}

export function generateScriptTag(workspaceId: string) {
  return `<!-- Zeno AI Intelligence Core -->
<script src="https://engine.nolix.ai/v1/core.js" data-workspace="${workspaceId}" async></script>`;
}

export async function simulateFirstValueDecision(): Promise<any> {
   const simulatedVisitorId = `demo_usr_${crypto.randomBytes(4).toString("hex")}`;
   
   // Create a highly engaged dummy signal
   const fakeSignal: any = {
     signal: {
       visitor_id: simulatedVisitorId,
       session_id: `sess_${Date.now()}`,
       store_domain: "demo.nolix.ai",
       time_on_site: 120,
       scroll_depth: 85,
       bounce_risk: 0.1,
       intent: "HIGH",
       friction: "PRICE"
     },
     return_visitor: false,
     hesitations: 4,               
     mouse_leave_count: 0,
     tab_hidden_count: 0,
     trigger: "exit_intent",
     coupon_abuse: 0,
     visit_count: 1,
     aov_estimate: 150             
   };

   // Run the actual hybrid brain
   const decision = await runHybridBrain(fakeSignal);

   return {
     visitor_id: simulatedVisitorId,
     decision,
     story: `Visitor showed HIGH intent but hesitated 4 times. ZENO Personalization recognized Price Sensitivity. Pricing Engine computed max ROI discount: ${decision.discount_pct}%. Expected Revenue retained: $${decision.expected_uplift.toFixed(2)}.`
   };
}
