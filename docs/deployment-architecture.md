/**
 * NOLIX — Deployment Architecture (STEP 15 PART 15)
 * docs/deployment-architecture.md
 *
 * Complete production deployment guide.
 */

# NOLIX — Production Deployment Architecture (STEP 15)

## System Components

```
┌─────────────────────────────────────────────────────┐
│                  CLIENT BROWSER                     │
│    public/master.js → Distributed Kill-Switch       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│              VERCEL API SERVER (Next.js)             │
│                                                     │
│  POST /api/engine/decide     ← Main decision        │
│  POST /api/engine/predict    ← Hybrid ML predict    │
│  POST /api/engine/train      ← Training trigger     │
│  GET  /api/features          ← Feature store        │
│  POST /api/features          ← Feature ingestion    │
│  GET  /api/vector/search     ← ANN similarity       │
│  GET  /api/experiments       ← A/B multi-model      │
│  GET  /api/runtime/flags     ← Distributed flags    │
│  GET  /api/admin/health      ← System health        │
│  GET  /api/admin/queue/status← Queue observability  │
│  *    /api/admin/model/*     ← Registry + Monitor   │
│  GET  /api/admin/segments    ← K-Means clusters     │
└──────────────────────┬──────────────────────────────┘
           ┌───────────┼───────────┐
           │           │           │
┌──────────▼──┐ ┌──────▼──┐ ┌────▼────────────────┐
│  POSTGRESQL │ │  REDIS  │ │  IN-MEMORY (Vercel)  │
│  (Neon)     │ │(Upstash)│ │                      │
│             │ │         │ │  Circuit Breaker      │
│  41 tables  │ │ BullMQ  │ │  Model Server Cache  │
│  pgvector   │ │ Queues  │ │  GBT Model           │
│  IVFFLAT    │ │ Workers │ │  Centroids (K-Means) │
│  Embeddings │ │ 3 types │ │  Rate Limiter        │
│  Registry   │ │         │ │  Nonce Cache         │
│  Segments   │ └─────────┘ └──────────────────────┘
└─────────────┘
```

## Environment Variables Required

```env
# Database (Neon / Supabase)
DATABASE_URL=postgresql://...

# Security
NOLIX_API_SECRET=your_api_secret_here      # read tier
NOLIX_SYNC_SECRET=your_sync_secret_here    # admin tier
NOLIX_CRON_SECRET=your_cron_secret_here    # write tier

# Redis (Optional — Upstash recommended for Vercel)
REDIS_URL=rediss://default:TOKEN@host.upstash.io:6380

# Alerts
NOLIX_ALERT_WEBHOOK=https://hooks.slack.com/services/...

# Shopify
SHOPIFY_WEBHOOK_SECRET=...
```

## DB Tables (41 total after STEP 15)

### Core ML
- `nolix_model_registry`    — versioned models, staging/production
- `nolix_feature_snapshots` — point-in-time features (PART 3)
- `nolix_gbt_models`        — GBT model storage

### Intelligence
- `nolix_embeddings`        — visitor vectors (pgvector)
- `nolix_visitor_segments`  — K-Means cluster assignments
- `nolix_experiments`       — A/B multi-model experiments
- `nolix_experiment_results`— impression + conversion data

### Reliability
- `nolix_event_queue`       — persistent job queue (SKIP LOCKED)
- `nolix_event_dedup`       — idempotency (SHA-256 event IDs)
- `nolix_dead_letter`       — failed events after 5 retries
- `nolix_queue_metrics`     — queue visibility snapshots
- `nolix_training_backlog`  — events stored when training OFF

### Observability
- `nolix_system_health`     — health snapshots
- `nolix_system_metrics`    — named metric timeseries
- `nolix_monitor_reports`   — ML monitoring (drift, AUC, PSI)
- `nolix_audit_log`         — security audit trail
- `nolix_runtime_flags`     — distributed kill-switches
- `nolix_runtime_audit`     — flag change history

### Analytics
- `nolix_events`            — raw behavioral events
- `nolix_ab_sessions`       — A/B session tracking
- `nolix_ab_conversions`    — conversion attribution
- `nolix_training_logs`     — training run history
- `nolix_calibration_log`   — prediction calibration

## Worker Topology (Redis mode)

```
nolix-ingestion worker (concurrency=5)
  └── Receives events → validates → dedup → feature store

nolix-training worker (concurrency=2)
  └── Online training → GBT → model registry

nolix-embedding worker (concurrency=5)
  └── Vector storage → pgvector → K-Means update
```

## Vector Search Architecture

```
visitor_features[8d]
       │
       ▼
pgvector IVFFLAT index (lists=100)
   vector_cosine_ops
       │
       ▼
findSimilarUsers() → top-20 by cosine similarity
       │
       ▼
similarity_boost (0-15%) → added to final_score
```

## Decision Flow

```
Browser Event
    │
    ▼
GATE -1A: Runtime Flag Kill-Switch (ai_enabled=false → BLOCK ALL)
    │
    ▼
GATE -1B: Circuit Breaker (OPEN → BLOCK, HALF_OPEN → 10% sample)
    │
    ▼
Feature Extraction (featureMapToVector — same as training)
    │
    ▼
Hybrid Predict:
  ├── Logistic Regression (model server, 35%)
  ├── GBT (gradient boosted, 30%)
  ├── Similarity Boost (pgvector ANN, 20%)
  ├── Revenue Rank (multi-objective, 10%)
  └── Fraud Penalty (bot detection, -5%)
    │
    ▼
Economic Decision (intervene / wait)
    │
    ▼
A/B Experiment Bucket Assignment
    │
    ▼
Popup / Intervention
```

## Security Architecture

```
Request → x-nolix-key header
    │
    ▼
getAccessTier(key):
  NOLIX_SYNC_SECRET  → admin (read+write+promote+rollback)
  NOLIX_CRON_SECRET  → write (train, drain)
  NOLIX_API_SECRET   → read  (predict, features)
    │
    ▼
checkRateLimit(clientId, endpoint)
  predict:       100/min
  train:          10/min
  admin:          30/min
  vector_search:  50/min
    │
    ▼
verifySignature (optional HMAC-SHA256 for high-security endpoints)
    │
    ▼
Process Request → auditLog()
```

## Cron Schedule (Vercel Cron)

```
vercel.json:
{
  "crons": [
    { "path": "/api/cron/health",   "schedule": "*/5 * * * *"  },  // 5 min
    { "path": "/api/cron/train",    "schedule": "0 * * * *"    },  // 1 hour
    { "path": "/api/cron/monitor",  "schedule": "0 */6 * * *"  },  // 6 hours
    { "path": "/api/cron/segment",  "schedule": "0 */6 * * *"  }   // 6 hours
  ]
}
```

## pgvector Setup (Run Once in Neon/Supabase)

```sql
-- scripts/pgvector-production.sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE nolix_embeddings ADD COLUMN IF NOT EXISTS vector_native vector(8);
UPDATE nolix_embeddings SET vector_native = vector_8d::vector WHERE vector_native IS NULL;
DROP INDEX IF EXISTS idx_nolix_emb_vector_cos;
CREATE INDEX idx_nolix_emb_vector_cos ON nolix_embeddings
  USING ivfflat (vector_native vector_cosine_ops) WITH (lists = 100);
ANALYZE nolix_embeddings;
-- Reindex when rows grow 10x:
-- REINDEX INDEX CONCURRENTLY idx_nolix_emb_vector_cos;
```

## Known Limitations (Honest Assessment)

| Component | Current State | Production-Grade? |
|---|---|---|
| LR Model | CPU JS Logistic Regression | ⚠️ 80% — no GPU |
| GBT | CPU JS Decision Stumps | ⚠️ 70% — not XGBoost |
| Redis | DB queue fallback (if no REDIS_URL) | ⚠️ Needs REDIS_URL |
| pgvector | Script ready, needs manual SQL run | ⚠️ Needs activation |
| GPU | None — pure JS | ❌ |
| Distributed training | Single process | ⚠️ |
| Feature versioning | Schema version number only | ⚠️ |
| Point-in-time replay | Column-level via timestamp | ✅ |
| Security | HMAC + rate limits + audit | ✅ |
| Monitoring | PSI + AUC + drift + webhooks | ✅ |
| Segmentation | K-Means++ 5 clusters | ✅ |
| Experiments | z-test 95% CI auto-winner | ✅ |
