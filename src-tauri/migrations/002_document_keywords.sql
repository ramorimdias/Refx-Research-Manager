CREATE TABLE IF NOT EXISTS document_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  summary TEXT,
  source TEXT NOT NULL,
  confidence REAL,
  api_tier TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX IF NOT EXISTS idx_document_keywords_document_id
ON document_keywords(document_id);

CREATE INDEX IF NOT EXISTS idx_document_keywords_keyword
ON document_keywords(keyword);
