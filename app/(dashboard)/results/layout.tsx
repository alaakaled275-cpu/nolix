import { Suspense } from "react";
import ResultsPage from "./page";

export default function ResultsLayout() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh", background: "#09090f", display: "flex",
        alignItems: "center", justifyContent: "center",
        color: "#64748b", fontFamily: "Outfit, sans-serif", fontSize: "16px"
      }}>
        Loading analysis…
      </div>
    }>
      <ResultsPage />
    </Suspense>
  );
}
