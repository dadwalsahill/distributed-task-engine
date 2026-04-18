CREATE DATABASE IF NOT EXISTS taskengine;
USE taskengine;

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  priority TINYINT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  payload JSON,
  status ENUM('queued','running','completed','failed','cancelled','dead_lettered') NOT NULL DEFAULT 'queued',
  client_api_key VARCHAR(64) NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  worker_id VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  wait_time_ms INT,
  execution_time_ms INT,
  INDEX idx_status (status),
  INDEX idx_priority (priority DESC),
  INDEX idx_client (client_api_key),
  INDEX idx_created (created_at DESC),
  INDEX idx_type (type)
);

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  type VARCHAR(100) NOT NULL,
  priority TINYINT NOT NULL,
  payload JSON,
  client_api_key VARCHAR(64) NOT NULL,
  retry_count INT NOT NULL DEFAULT 3,
  last_error TEXT,
  dead_lettered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_task_id (task_id),
  INDEX idx_client (client_api_key)
);