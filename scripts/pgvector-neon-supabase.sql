-- ================================================================
-- NOLIX pgvector Activation SQL
-- Run this DIRECTLY in: Neon / Supabase SQL Editor / psql
-- ================================================================
-- STEP 1: Enable the extension
CREATE EXTENSION IF NOT EXISTS vector;

-- STEP 2: Add native vector column (keeps old TEXT column safe)
ALTER TABLE nolix_embeddings ADD COLUMN IF NOT EXISTS vector_native vector(8);

-- STEP 3: Migrate existing TEXT vectors to native vector type
UPDATE nolix_embeddings
SET vector_native = vector_8d::vector
WHERE vector_8d IS NOT NULL
  AND vector_8d != ''
  AND vector_8d ~ '^\[[-\d.,\s]+\]$';

-- STEP 4: Create IVFFlat ANN Index (cosine similarity)
-- lists = ~sqrt(row count), adjust if you have more data
CREATE INDEX IF NOT EXISTS idx_nolix_emb_vector_cos
ON nolix_embeddings
USING ivfflat (vector_native vector_cosine_ops)
WITH (lists = 10);

-- STEP 5: Verify
SELECT
  COUNT(*) FILTER (WHERE vector_native IS NOT NULL) AS rows_with_vector,
  COUNT(*) FILTER (WHERE vector_native IS NULL)     AS rows_without_vector,
  COUNT(*) AS total
FROM nolix_embeddings;

-- STEP 6: Test cosine similarity query (after data exists)
-- SELECT visitor_id,
--        1 - (vector_native <=> '[0.25,0.20,0.15,0.35,0.25,0.10,0.10,0.15]') AS similarity
-- FROM nolix_embeddings
-- WHERE vector_native IS NOT NULL
-- ORDER BY vector_native <=> '[0.25,0.20,0.15,0.35,0.25,0.10,0.10,0.15]'
-- LIMIT 10;
