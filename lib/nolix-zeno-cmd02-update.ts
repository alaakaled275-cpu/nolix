/**
 * NOLIX — ZENO Command Update: CMD_02 now uses Hybrid Brain
 * lib/nolix-zeno-cmd02-update.ts
 *
 * This override replaces the old CMD_02_SCORE_INTENT with the
 * Hybrid Brain scoring formula.
 *
 * Architecture:
 *   OLD: ZENO manually computed intent_score
 *   NEW: ZENO delegates to runHybridBrain() for full scoring
 *        but stays READ-ONLY (no DB writes except trace)
 */

// This file documents the CMD_02 integration.
// The actual update is done inside nolix-zeno-commands.ts
// To avoid circular imports, CMD_02 imports from nolix-behavioral-rules
// and nolix-context-logic directly (same logic as the Brain, no duplication).

export const CMD02_BRAIN_FORMULA = `
⚔️ CMD_02_SCORE_INTENT — Hybrid Brain Formula

intent_score (0-100) =
  behavioral_score * 100 * 0.40    ← from assessBehavior() rules
  + ml.p_convert * 100 * 0.40      ← from hybridPredict() ML engine
  + similarity_boost * 100 * 0.20  ← from findSimilarUsers() ANN

Laws:
  ✅ ML contributes 40% MAX to intent score
  ✅ Behavioral rules always active (40%)
  ✅ Similarity enriches (20%)
  ❌ ML alone NEVER determines the score
  ❌ If behavioral score = 0, ML cannot rescue (intent stays LOW)
` as const;
