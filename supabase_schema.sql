-- GetFlowFi — Supabase Schema
-- Paste this entire file into: Supabase Dashboard → SQL Editor → Run
-- Run it once. Safe to re-run (uses IF NOT EXISTS / OR REPLACE).

-- ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  category     TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  date         DATE NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense', 'saving')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SAVING GOALS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saving_goals (
  id             UUID PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  target_amount  NUMERIC(14, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  deadline       TEXT NOT NULL DEFAULT '',
  emoji          TEXT NOT NULL DEFAULT '🎯',
  color          TEXT NOT NULL DEFAULT '#6366f1',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── BUDGET PLAN ──────────────────────────────────────────────────────────────
-- One row per user. The UNIQUE constraint on user_id makes upsert work correctly.
CREATE TABLE IF NOT EXISTS budget_plan (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  income        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  frequency     TEXT NOT NULL DEFAULT 'mensual' CHECK (frequency IN ('semanal', 'quincenal', 'mensual')),
  budgets       JSONB NOT NULL DEFAULT '{}',
  setup_done    BOOLEAN NOT NULL DEFAULT FALSE,
  current_month TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION update_budget_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_budget_plan_timestamp ON budget_plan;
CREATE TRIGGER set_budget_plan_timestamp
  BEFORE UPDATE ON budget_plan
  FOR EACH ROW EXECUTE FUNCTION update_budget_plan_timestamp();

-- ─── INCOME RECORDS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS income_records (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  date         DATE NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  distributed  BOOLEAN NOT NULL DEFAULT FALSE,
  allocations  JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
-- Speed up the most common queries (filter by user + date range)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_income_records_user_date
  ON income_records(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_saving_goals_user
  ON saving_goals(user_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- CRITICAL: Each user can only see and modify their own rows.

ALTER TABLE transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE saving_goals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_plan    ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_records ENABLE ROW LEVEL SECURITY;

-- transactions
DROP POLICY IF EXISTS "Users manage own transactions" ON transactions;
CREATE POLICY "Users manage own transactions"
  ON transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- saving_goals
DROP POLICY IF EXISTS "Users manage own goals" ON saving_goals;
CREATE POLICY "Users manage own goals"
  ON saving_goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- budget_plan
DROP POLICY IF EXISTS "Users manage own budget plan" ON budget_plan;
CREATE POLICY "Users manage own budget plan"
  ON budget_plan FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- income_records
DROP POLICY IF EXISTS "Users manage own income records" ON income_records;
CREATE POLICY "Users manage own income records"
  ON income_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
