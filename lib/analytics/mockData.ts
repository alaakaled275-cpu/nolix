// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserGrowthPoint {
  date: string;
  users: number;
  newUsers: number;
}

export interface RevenuePoint {
  month: string;
  mrr: number;
  arr: number;
}

export interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  status: "active" | "churned";
  plan: string;
  revenue: number;
  orders: number;
  joinedAt: string;
}

export interface Insight {
  id: string;
  type: "warning" | "positive" | "info";
  title: string;
  description: string;
  metric: string;
}

export interface MetricData {
  label: string;
  value: string;
  prefix?: string;
  suffix?: string;
  change: number; // percent, positive = up
  icon: "revenue" | "users" | "churn" | "conversion";
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

export const userGrowthData: UserGrowthPoint[] = [
  { date: "Jan 1", users: 3200, newUsers: 420 },
  { date: "Jan 8", users: 3580, newUsers: 380 },
  { date: "Jan 15", users: 3940, newUsers: 360 },
  { date: "Jan 22", users: 4210, newUsers: 270 },
  { date: "Feb 1", users: 4650, newUsers: 440 },
  { date: "Feb 8", users: 5010, newUsers: 360 },
  { date: "Feb 15", users: 5300, newUsers: 290 },
  { date: "Feb 22", users: 5720, newUsers: 420 },
  { date: "Mar 1", users: 6100, newUsers: 380 },
  { date: "Mar 8", users: 6580, newUsers: 480 },
  { date: "Mar 15", users: 7020, newUsers: 440 },
  { date: "Mar 22", users: 7550, newUsers: 530 },
  { date: "Apr 1", users: 8100, newUsers: 550 },
  { date: "Apr 8", users: 8640, newUsers: 540 },
  { date: "Apr 15", users: 9180, newUsers: 540 },
  { date: "Apr 22", users: 9750, newUsers: 570 },
  { date: "May 1", users: 10400, newUsers: 650 },
  { date: "May 8", users: 11000, newUsers: 600 },
  { date: "May 15", users: 11600, newUsers: 600 },
  { date: "May 22", users: 12300, newUsers: 700 },
  { date: "Jun 1", users: 13100, newUsers: 800 },
  { date: "Jun 8", users: 13900, newUsers: 800 },
  { date: "Jun 15", users: 14800, newUsers: 900 },
  { date: "Jun 22", users: 15700, newUsers: 900 },
  { date: "Jul 1", users: 16700, newUsers: 1000 },
  { date: "Jul 8", users: 17800, newUsers: 1100 },
  { date: "Jul 15", users: 18900, newUsers: 1100 },
  { date: "Jul 22", users: 20100, newUsers: 1200 },
];

export const revenueData: RevenuePoint[] = [
  { month: "Jan", mrr: 42000, arr: 504000 },
  { month: "Feb", mrr: 46500, arr: 558000 },
  { month: "Mar", mrr: 51200, arr: 614400 },
  { month: "Apr", mrr: 55800, arr: 669600 },
  { month: "May", mrr: 61400, arr: 736800 },
  { month: "Jun", mrr: 68200, arr: 818400 },
  { month: "Jul", mrr: 74900, arr: 898800 },
  { month: "Aug", mrr: 82100, arr: 985200 },
  { month: "Sep", mrr: 88500, arr: 1062000 },
  { month: "Oct", mrr: 95300, arr: 1143600 },
  { month: "Nov", mrr: 103800, arr: 1245600 },
  { month: "Dec", mrr: 112400, arr: 1348800 },
];

export const funnelData: FunnelStep[] = [
  { label: "Visitors",       value: 120000, color: "#7c3aed" },
  { label: "Sign-ups",       value:  32400, color: "#6d28d9" },
  { label: "Trial Started",  value:  14800, color: "#a78bfa" },
  { label: "Activated",      value:   8200, color: "#10b981" },
  { label: "Converted",      value:   4100, color: "#34d399" },
];

export const customersData: Customer[] = [
  { id: "c1",  name: "Ava Thompson",    email: "ava@prismatic.io",    status: "active",  plan: "Enterprise", revenue: 24000, orders: 12, joinedAt: "Jan 2024" },
  { id: "c2",  name: "Liam Rodriguez",  email: "liam@synapse.co",     status: "active",  plan: "Pro",        revenue:  9600, orders: 8,  joinedAt: "Mar 2024" },
  { id: "c3",  name: "Sofia Patel",     email: "sofia@novalabs.dev",  status: "active",  plan: "Enterprise", revenue: 31200, orders: 15, joinedAt: "Nov 2023" },
  { id: "c4",  name: "Marcus Kim",      email: "marcus@loopify.app",  status: "churned", plan: "Pro",        revenue:  4800, orders: 4,  joinedAt: "Feb 2024" },
  { id: "c5",  name: "Isabella Chen",   email: "isa@stackrise.io",    status: "active",  plan: "Starter",    revenue:  1800, orders: 6,  joinedAt: "May 2024" },
  { id: "c6",  name: "Noah Williams",   email: "noah@gridforge.com",  status: "active",  plan: "Pro",        revenue:  8400, orders: 7,  joinedAt: "Apr 2024" },
  { id: "c7",  name: "Mia Johnson",     email: "mia@cloudpeak.io",    status: "churned", plan: "Starter",    revenue:  1200, orders: 3,  joinedAt: "Jun 2024" },
  { id: "c8",  name: "Ethan Davis",     email: "ethan@nexaflow.ai",   status: "active",  plan: "Enterprise", revenue: 18000, orders: 10, joinedAt: "Dec 2023" },
];

export const insightsData: Insight[] = [
  {
    id: "i1",
    type: "positive",
    title: "MRR Growth on Track",
    description: "Revenue grew 12.4% this month, outperforming the 90-day trend. Enterprise tier is the primary driver.",
    metric: "+12.4% MRR",
  },
  {
    id: "i2",
    type: "warning",
    title: "Churn Spike Detected",
    description: "Starter plan churn increased by 3.2% over the last 14 days. Consider triggering in-app re-engagement flows.",
    metric: "+3.2% churn",
  },
  {
    id: "i3",
    type: "info",
    title: "Funnel Bottleneck: Activation",
    description: "Only 55% of trials reach the activation milestone. Optimising onboarding step 3 could add ~$8K MRR.",
    metric: "55% activation",
  },
];

export const metricsData: MetricData[] = [
  { label: "Monthly Revenue",    value: "112,400",  prefix: "$", change: +12.4, icon: "revenue"    },
  { label: "Total Users",        value: "20,100",             change: +18.7, icon: "users"      },
  { label: "Churn Rate",         value: "2.8",      suffix: "%", change: -0.4, icon: "churn"      },
  { label: "Trial Conversion",   value: "27.7",     suffix: "%", change: +2.1, icon: "conversion" },
];
