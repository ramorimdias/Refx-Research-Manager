ALTER TABLE document_keywords ADD COLUMN score REAL;
ALTER TABLE document_keywords ADD COLUMN api_mode TEXT NOT NULL DEFAULT 'local';

UPDATE document_keywords
SET score = confidence
WHERE score IS NULL;

UPDATE document_keywords
SET api_mode = COALESCE(api_tier, 'local')
WHERE api_mode IS NULL OR api_mode = '';

CREATE TABLE IF NOT EXISTS app_usage_counters (
  counter_key TEXT PRIMARY KEY,
  counter_value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
