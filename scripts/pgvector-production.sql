/**
 * NOLIX — pgvector Production Mode (STEP 14 PART 1)
 * scripts/pgvector-production.sql
 *
 * TUNED FOR PRODUCTION:
 * - lists = SQRT(n) tuned per data size, minimum 10
 * - ANALYZE after index creation
 * - Reindex strategy documented
 * - Enforcement: throws if pgvector not active
 */

-- ================================================================
-- STEP 1: ENABLE EXTENSION
-- ================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ================================================================
-- STEP 2: ADD VECTOR COLUMN (safe — keeps TEXT column)
-- ================================================================
ALTER TABLE nolix_embeddings
  ADD COLUMN IF NOT EXISTS vector_native vector(8);

-- ================================================================
-- STEP 3: MIGRATE EXISTING TEXT DATA → NATIVE VECTOR
-- ================================================================
UPDATE nolix_embeddings
SET vector_native = vector_8d::vector
WHERE vector_native IS NULL
  AND vector_8d IS NOT NULL
  AND vector_8d ~ '^\[[-\d.,\s]+\]$';

-- ================================================================
-- STEP 4: DROP OLD WEAK INDEX (if exists)
-- ================================================================
DROP INDEX IF EXISTS idx_nolix_emb_vector_cos;
DROP INDEX IF EXISTS idx_nolix_emb_vector;
DROP INDEX IF EXISTS idx_nolix_emb_vector_hnsw;

-- ================================================================
-- STEP 5: CREATE TUNED IVFFLAT INDEX
-- lists = SQRT(COUNT(*)) approximately
-- For 0-1k rows: lists=10
-- For 10k rows:  lists=100    ← production minimum
-- For 100k rows: lists=316
-- For 1M rows:   lists=1000
-- Start at 100 — rebuild when row count grows 10x
-- ================================================================
CREATE INDEX idx_nolix_emb_vector_cos
ON nolix_embeddings
USING ivfflat (vector_native vector_cosine_ops)
WITH (lists = 100);

-- ================================================================
-- STEP 6: ANALYZE — CRITICAL for query planner to USE the index
-- ================================================================
ANALYZE nolix_embeddings;

-- ================================================================
-- STEP 7: VERIFY
-- ================================================================
SELECT
  COUNT(*)                                           AS total_rows,
  COUNT(*) FILTER (WHERE vector_native IS NOT NULL)  AS indexed_rows,
  COUNT(*) FILTER (WHERE vector_native IS NULL)      AS pending_rows,
  pg_size_pretty(pg_relation_size('nolix_embeddings')) AS table_size,
  pg_size_pretty(pg_relation_size('idx_nolix_emb_vector_cos')) AS index_size
FROM nolix_embeddings;

-- ================================================================
-- STEP 8: TEST QUERY (cosine similarity)
-- ================================================================
-- SELECT visitor_id,
--        1 - (vector_native <=> '[0.25,0.20,0.15,0.35,0.25,0.10,0.10,0.15]') AS similarity
-- FROM nolix_embeddings
-- WHERE vector_native IS NOT NULL
-- ORDER BY vector_native <=> '[0.25,0.20,0.15,0.35,0.25,0.10,0.10,0.15]'
-- LIMIT 20;

-- ================================================================
-- REINDEX STRATEGY (run when row count grows 10x):
-- REINDEX INDEX CONCURRENTLY idx_nolix_emb_vector_cos;
-- ANALYZE nolix_embeddings;
-- ================================================================
