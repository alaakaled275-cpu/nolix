// Types matching the GET /api/convert/stats response
export type TodaySummary = {
  analyzed: number;
  actions_taken: number;
  conversions: number;
  revenue: number;
  discounts_avoided: number;
};

export type Session = {
  id: string;
  session_id: string;
  created_at: string;
  intent_level: string;
  intent_score: number;
  friction_detected: string | null;
  show_popup: boolean;
  offer_type: string | null;
  action_taken: string | null;
  converted: boolean;
  order_value: number | null;
  discount_avoided: boolean;
  business_explanation: string;
  traffic_source: string;
  cart_status: string;
  device: string;
};

export type IntentEntry = { intent_level: string; count: string };
export type FrictionEntry = { friction_detected: string; count: string };
export type ABResult = {
  variant: string;
  offer_type: string;
  impressions: number;
  conversions: number;
};

export type StatsData = {
  total_sessions: number;
  high_intent_sessions: number;
  popups_shown: number;
  total_conversions: number;
  cvr_pct: number;
  offer_rate_pct: number;
  revenue_attributed: number;
  revenue_lift_est: string;
  discount_avoided_count: number;
  discount_saved_pct: number;
  today: TodaySummary;
  top_action: string | null;
  top_action_cvr: number;
  intent_distribution: IntentEntry[];
  friction_distribution: FrictionEntry[];
  ab_results: ABResult[];
  insights: string[];
  sessions: Session[];
};
