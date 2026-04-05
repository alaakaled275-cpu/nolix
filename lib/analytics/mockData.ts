// ─── Mock Data for SaaS Analytics Dashboard ───────────────────────────────────

export type Period = "7d" | "30d";

// ── Metric Card Data ──────────────────────────────────────────────────────────
export interface MetricData {
  label: string;
  value: string;
  change: number; // positive = increase, negative = decrease
  prefix?: string;
  suffix?: string;
}

export const getMetrics = (period: Period): MetricData[] => {
  if (period === "7d") {
    return [
      { label: "Total Revenue", value: "24,830", prefix: "$", change: 12.4 },
      { label: "Total Users", value: "3,291", change: 8.1 },
      { label: "Conversion Rate", value: "4.72", suffix: "%", change: -2.3 },
      { label: "Orders", value: "812", change: 15.6 },
    ];
  }
  return [
    { label: "Total Revenue", value: "98,450", prefix: "$", change: 22.7 },
    { label: "Total Users", value: "14,820", change: 18.4 },
    { label: "Conversion Rate", value: "5.18", suffix: "%", change: 3.9 },
    { label: "Orders", value: "3,410", change: 21.2 },
  ];
};

// ── User Growth (Line Chart) ─────────────────────────────────────────────────
export interface UserGrowthPoint {
  date: string;
  users: number;
  newUsers: number;
}

const last30Days = (): string[] => {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  }
  return days;
};

const dates30 = last30Days();

const rawUsers30 = [
  312, 328, 305, 380, 410, 390, 425, 448, 460, 442,
  480, 510, 495, 530, 562, 540, 585, 610, 598, 625,
  642, 630, 668, 692, 710, 698, 730, 755, 742, 780,
];

const rawNew30 = [
  42, 38, 35, 55, 62, 48, 70, 72, 65, 58,
  80, 88, 75, 92, 98, 82, 95, 110, 98, 112,
  108, 95, 118, 125, 132, 115, 138, 145, 130, 155,
];

export const getUserGrowth = (period: Period): UserGrowthPoint[] => {
  const start = period === "7d" ? 23 : 0;
  return dates30.slice(start).map((date, i) => ({
    date,
    users: rawUsers30[start + i],
    newUsers: rawNew30[start + i],
  }));
};

// ── Revenue per Day (Bar Chart) ───────────────────────────────────────────────
export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

const rawRevenue30 = [
  2100, 1850, 2400, 3200, 2900, 3500, 4200,
  2800, 3100, 3800, 4100, 3600, 4400, 5100,
  3900, 4600, 5200, 4800, 5500, 6100, 4700,
  5800, 6400, 5900, 6800, 7200, 5600, 7500, 6900, 8200,
];

const rawOrders30 = [
  55, 48, 62, 82, 74, 88, 108,
  72, 80, 96, 104, 92, 112, 128,
  100, 116, 134, 122, 140, 154, 120,
  148, 162, 150, 172, 184, 142, 190, 176, 208,
];

export const getRevenue = (period: Period): RevenuePoint[] => {
  const start = period === "7d" ? 23 : 0;
  return dates30.slice(start).map((date, i) => ({
    date,
    revenue: rawRevenue30[start + i],
    orders: rawOrders30[start + i],
  }));
};

// ── Conversion Funnel ─────────────────────────────────────────────────────────
export interface FunnelStep {
  label: string;
  value: number;
  pct: number;
  color: string;
}

export const getFunnel = (period: Period): FunnelStep[] => {
  const mult = period === "30d" ? 4.3 : 1;
  const visitors = Math.round(8240 * mult);
  const addToCart = Math.round(3180 * mult);
  const checkout = Math.round(1420 * mult);
  const purchase = Math.round(812 * mult);
  return [
    { label: "Visitors",    value: visitors,   pct: 100,                                    color: "#7c3aed" },
    { label: "Add to Cart", value: addToCart,  pct: Math.round((addToCart / visitors) * 100), color: "#6d28d9" },
    { label: "Checkout",    value: checkout,   pct: Math.round((checkout / visitors) * 100),  color: "#ff6b35" },
    { label: "Purchase",    value: purchase,   pct: Math.round((purchase / visitors) * 100),  color: "#10b981" },
  ];
};

// ── Customers Table ───────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  email: string;
  status: "active" | "churned";
  revenue: number;
  orders: number;
  joinedAt: string;
  avatar: string;
}

export const CUSTOMERS: Customer[] = [
  { id: "1",  name: "Sarah Mitchell",  email: "sarah.m@techwave.io",    status: "active",  revenue: 4820, orders: 12, joinedAt: "Jan 14, 2025", avatar: "SM" },
  { id: "2",  name: "James Thornton",  email: "j.thornton@nexify.co",   status: "active",  revenue: 3415, orders: 9,  joinedAt: "Feb 3, 2025",  avatar: "JT" },
  { id: "3",  name: "Priya Sharma",    email: "priya@storefront.dev",   status: "churned", revenue: 1200, orders: 3,  joinedAt: "Nov 22, 2024", avatar: "PS" },
  { id: "4",  name: "Carlos Reyes",    email: "carlos@shopblitz.com",   status: "active",  revenue: 6750, orders: 18, joinedAt: "Dec 8, 2024",  avatar: "CR" },
  { id: "5",  name: "Emma Larsson",    email: "e.larsson@nordic.store", status: "active",  revenue: 2980, orders: 7,  joinedAt: "Mar 1, 2025",  avatar: "EL" },
  { id: "6",  name: "Aiden Park",      email: "aiden@convrt.io",        status: "churned", revenue: 890,  orders: 2,  joinedAt: "Oct 15, 2024", avatar: "AP" },
  { id: "7",  name: "Fatima Al-Zahra", email: "fatima@luxebrand.ae",    status: "active",  revenue: 9140, orders: 24, joinedAt: "Sep 30, 2024", avatar: "FA" },
  { id: "8",  name: "Luca Ferrari",    email: "l.ferrari@milanos.eu",   status: "active",  revenue: 5530, orders: 15, joinedAt: "Jan 28, 2025", avatar: "LF" },
  { id: "9",  name: "Olivia Bennett",  email: "olivia@dropvault.com",   status: "churned", revenue: 450,  orders: 1,  joinedAt: "Feb 18, 2025", avatar: "OB" },
  { id: "10", name: "Marcus Webb",     email: "marcus@sellsphere.io",   status: "active",  revenue: 7220, orders: 20, joinedAt: "Nov 5, 2024",  avatar: "MW" },
];

// ── AI Insights ───────────────────────────────────────────────────────────────
export interface Insight {
  id: string;
  type: "warning" | "positive" | "info";
  title: string;
  description: string;
  metric?: string;
}

export const getInsights = (period: Period): Insight[] => [
  {
    id: "1",
    type: "warning",
    title: "Checkout drop-off spike",
    description: `Most users abandon at the checkout step — ${period === "7d" ? "68%" : "64%"} of users who reach checkout don't complete the purchase. Consider reducing form fields or adding trust badges.`,
    metric: period === "7d" ? "-68% at checkout" : "-64% at checkout",
  },
  {
    id: "2",
    type: "positive",
    title: "Friday drives peak revenue",
    description: `Fridays outperform all other days by ${period === "7d" ? "34%" : "29%"} in both orders and revenue. Consider scheduling major promotions or email campaigns on Thursday evenings.`,
    metric: period === "7d" ? "+34% vs avg" : "+29% vs avg",
  },
  {
    id: "3",
    type: "warning",
    title: "Conversion rate trending down",
    description: `Conversion rate dropped ${period === "7d" ? "2.3%" : "1.1%"} compared to the previous period. Mobile users show the steepest decline — check mobile checkout flow for friction.`,
    metric: period === "7d" ? "-2.3% CVR" : "-1.1% CVR",
  },
  {
    id: "4",
    type: "info",
    title: "3 high-value customers at churn risk",
    description: "Customers who haven't placed an order in 45+ days have historically churned. Fatima Al-Zahra, Marcus Webb and Carlos Reyes haven't engaged in the last 30 days.",
    metric: "3 at-risk accounts",
  },
  {
    id: "5",
    type: "positive",
    title: "Add-to-cart rate improving",
    description: `Add-to-cart conversion improved by ${period === "7d" ? "8.4%" : "12.1%"} this period. Product page changes from last sprint appear to be working — consider A/B testing the new layout more broadly.`,
    metric: period === "7d" ? "+8.4% ATC rate" : "+12.1% ATC rate",
  },
];
