const fs = require('fs');

['.env', '.env.local'].forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('REDIS_URL')) {
      fs.appendFileSync(file, '\nREDIS_URL=rediss://default:gQAAAAAAAY71AAIocDFhMWIocDFhMWU3ZDljOTVmYzg0MGE5OTNkODlmYmQ2MmJmOTM3M3AxMTAyMTMz@useful-ray-102133.upstash.io:6379\n');
      console.log('Added REDIS_URL to ' + file);
    }
  } catch (e) {
    console.error('Error with ' + file + ':', e.message);
  }
});

const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'support',
  user: 'support',
  password: 'nolix_admin_123'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');
    
    const sqls = [
      'CREATE EXTENSION IF NOT EXISTS vector;',
      'ALTER TABLE nolix_embeddings ADD COLUMN IF NOT EXISTS vector_native vector(8);',
      'UPDATE nolix_embeddings SET vector_native = vector_8d::vector WHERE vector_native IS NULL;',
      'CREATE INDEX IF NOT EXISTS idx_nolix_emb_vector_cos ON nolix_embeddings USING ivfflat (vector_native vector_cosine_ops) WITH (lists = 100);',
      'ANALYZE nolix_embeddings;',
      
      `CREATE TABLE IF NOT EXISTS nolix_decisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trace_id TEXT,
        visitor_id TEXT,
        intent TEXT,
        friction TEXT,
        ml_boost FLOAT,
        final_score FLOAT,
        action TEXT,
        reasoning JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );`
    ];
    
    for (let sql of sqls) {
      try {
        await client.query(sql);
        console.log('Executed:', sql.substring(0, 50));
      } catch (e) {
        console.error('Error executing:', sql.substring(0, 50), e.message);
      }
    }
  } finally {
    await client.end();
    console.log('Done DB Schema Setup');
  }
}

run();
