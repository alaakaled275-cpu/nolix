import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zeno Learning Log — Self-Improvement Memory",
  description: "Every error Zeno detected, every correction rule created, and every accuracy improvement stored — the persistent memory of a self-improving AI.",
};

export default function LearningLogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
