// Dummy root page to prevent Turbopack panicking over a missing Root Segment page.
// The actual root URL (/) is rewritten to the static /nolix-home.html in next.config.ts

export default function Root() {
  return null;
}
