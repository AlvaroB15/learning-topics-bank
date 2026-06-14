-- ============================================================
-- BANKING API - SCHEMA
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'customer', -- customer | teller | admin
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE accounts (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID           NOT NULL REFERENCES users(id),
  account_number VARCHAR(20)    UNIQUE NOT NULL,
  type           VARCHAR(50)    NOT NULL,                 -- checking | savings
  balance        NUMERIC(20, 4) NOT NULL DEFAULT 0,
  currency       VARCHAR(3)     NOT NULL DEFAULT 'PEN',
  status         VARCHAR(50)    NOT NULL DEFAULT 'active', -- active | blocked | closed
  daily_limit    NUMERIC(20, 4) NOT NULL DEFAULT 50000,
  version        INTEGER        NOT NULL DEFAULT 0,        -- optimistic locking
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_balance_positive CHECK (balance >= 0),
  CONSTRAINT chk_daily_limit_positive CHECK (daily_limit > 0)
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE transactions (
  id                     UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key        VARCHAR(255)   UNIQUE,
  type                   VARCHAR(50)    NOT NULL, -- transfer | deposit | withdrawal
  status                 VARCHAR(50)    NOT NULL DEFAULT 'pending',
  source_account_id      UUID           REFERENCES accounts(id),
  destination_account_id UUID           REFERENCES accounts(id),
  amount                 NUMERIC(20, 4) NOT NULL,
  currency               VARCHAR(3)     NOT NULL DEFAULT 'PEN',
  description            TEXT,
  metadata               JSONB,
  created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_amount_positive CHECK (amount > 0)
);

-- ============================================================
-- DAILY TRANSACTION TOTALS (control de límite diario)
-- ============================================================
CREATE TABLE daily_transaction_totals (
  account_id   UUID           NOT NULL REFERENCES accounts(id),
  date         DATE           NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(20, 4) NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, date)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_accounts_user_id     ON accounts(user_id);
CREATE INDEX idx_accounts_number      ON accounts(account_number);
CREATE INDEX idx_txn_source           ON transactions(source_account_id);
CREATE INDEX idx_txn_destination      ON transactions(destination_account_id);
CREATE INDEX idx_txn_idempotency      ON transactions(idempotency_key);
CREATE INDEX idx_txn_created_at       ON transactions(created_at DESC);
CREATE INDEX idx_daily_totals_account ON daily_transaction_totals(account_id, date);
CREATE INDEX idx_audit_entity         ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user           ON audit_log(user_id);

-- ============================================================
-- TRIGGERS - updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
