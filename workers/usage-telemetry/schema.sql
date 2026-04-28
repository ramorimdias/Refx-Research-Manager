CREATE TABLE IF NOT EXISTS install_heartbeats (
  install_id TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  app_version TEXT,
  platform TEXT,
  locale TEXT,
  last_event TEXT
);

CREATE INDEX IF NOT EXISTS idx_install_heartbeats_last_seen_at
ON install_heartbeats(last_seen_at);
