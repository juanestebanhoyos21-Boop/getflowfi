// ─── GetFlowFi Database Layer ─────────────────────────────────────────────────
// All Supabase queries live here. App.tsx never imports supabase directly —
// it only calls these typed functions.
//
// Naming convention:
//   fetch*   → SELECT (returns data or throws)
//   save*    → INSERT
//   update*  → UPDATE
//   delete*  → DELETE
//   upsert*  → INSERT ... ON CONFLICT UPDATE

import { supabase } from './supabase';
import type { TxRow, GoalRow, BudgetRow } from './database.types';

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthStateChange(
  callback: (userId: string | null, email: string | null, event: string) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user?.id ?? null, session?.user?.email ?? null, event);
  });
}

/**
 * Verifica que haya una sesión viva ANTES de consultar datos.
 * supabase-js renueva el token aquí si hace falta; si el refresh token está
 * vencido (la app quedó suspendida > 1h) devuelve null en vez de dejar que las
 * queries fallen en silencio contra RLS.
 */
export async function hasValidSession(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

export async function fetchTransactions(userId: string): Promise<TxRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveTransaction(
  userId: string,
  tx: Omit<TxRow, 'user_id' | 'created_at'>
): Promise<TxRow> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...tx, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransaction(
  txId: string,
  updates: Partial<Omit<TxRow, 'id' | 'user_id' | 'created_at'>>
): Promise<TxRow> {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', txId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(txId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', txId);
  if (error) throw error;
}

// ─── SAVING GOALS ─────────────────────────────────────────────────────────────

export async function fetchGoals(userId: string): Promise<GoalRow[]> {
  const { data, error } = await supabase
    .from('saving_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveGoal(
  userId: string,
  goal: Omit<GoalRow, 'user_id' | 'created_at'>
): Promise<GoalRow> {
  const { data, error } = await supabase
    .from('saving_goals')
    .insert({ ...goal, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGoal(
  goalId: string,
  updates: Partial<Omit<GoalRow, 'id' | 'user_id' | 'created_at'>>
): Promise<GoalRow> {
  const { data, error } = await supabase
    .from('saving_goals')
    .update(updates)
    .eq('id', goalId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase
    .from('saving_goals')
    .delete()
    .eq('id', goalId);
  if (error) throw error;
}

// ─── BUDGET PLAN ──────────────────────────────────────────────────────────────
// One row per user. Always upsert — never insert a second row.

export async function fetchBudgetPlan(userId: string): Promise<BudgetRow | null> {
  const { data, error } = await supabase
    .from('budget_plan')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertBudgetPlan(
  userId: string,
  plan: Omit<BudgetRow, 'id' | 'user_id' | 'updated_at'>
): Promise<BudgetRow> {
  const { data, error } = await supabase
    .from('budget_plan')
    .upsert({ ...plan, user_id: userId }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// income_records: sin CRUD — la tabla solo se conserva hasta el drop de Fase 5.
// La migración de localStorage (abajo) aún escribe en ella para no perder datos viejos.

// ─── MIGRATION: localStorage → Supabase ───────────────────────────────────────
// Called once on first sign-in if the user has existing localStorage data.
// After migration, localStorage keys are cleared.

export async function migrateLocalStorageToSupabase(userId: string): Promise<void> {
  const LS_KEYS = {
    transactions: 'ff_transactions',
    goals: 'ff_goals',
    budgetPlan: 'ff_budget_plan',
    incomeRecords: 'ff_income_records',
    migrated: 'ff_migrated_to_supabase',
  };

  // Don't run twice
  if (localStorage.getItem(LS_KEYS.migrated)) return;

  const rawTx      = localStorage.getItem(LS_KEYS.transactions);
  const rawGoals   = localStorage.getItem(LS_KEYS.goals);
  const rawPlan    = localStorage.getItem(LS_KEYS.budgetPlan);
  const rawIncome  = localStorage.getItem(LS_KEYS.incomeRecords);

  // Migrate transactions
  if (rawTx) {
    const txs = JSON.parse(rawTx) as Array<Record<string, unknown>>;
    if (txs.length > 0) {
      const rows = txs.map(tx => ({
        id: tx.id as string,
        user_id: userId,
        amount: tx.amount as number,
        category: tx.category as string,
        description: (tx.description as string) || '',
        date: tx.date as string,
        type: tx.type as 'income' | 'expense' | 'saving',
      }));
      await supabase.from('transactions').upsert(rows, { onConflict: 'id' });
    }
  }

  // Migrate saving goals
  if (rawGoals) {
    const goals = JSON.parse(rawGoals) as Array<Record<string, unknown>>;
    if (goals.length > 0) {
      const rows = goals.map(g => ({
        id: g.id as string,
        user_id: userId,
        name: g.name as string,
        target_amount: g.targetAmount as number,
        current_amount: g.currentAmount as number,
        deadline: (g.deadline as string) || '',
        emoji: (g.emoji as string) || '🎯',
        color: (g.color as string) || '#6366f1',
      }));
      await supabase.from('saving_goals').upsert(rows, { onConflict: 'id' });
    }
  }

  // Migrate budget plan
  if (rawPlan) {
    const plan = JSON.parse(rawPlan) as Record<string, unknown>;
    await supabase.from('budget_plan').upsert({
      user_id: userId,
      income: plan.income as number,
      frequency: ((plan.frequency as string) || 'mensual') as 'semanal' | 'quincenal' | 'mensual',
      budgets: (plan.budgets as Record<string, number>) || {},
      setup_done: (plan.setupDone as boolean) || false,
      current_month: (plan.currentMonth as string) || '',
    }, { onConflict: 'user_id' });
  }

  // Migrate income records
  if (rawIncome) {
    const records = JSON.parse(rawIncome) as Array<Record<string, unknown>>;
    if (records.length > 0) {
      const rows = records.map(r => ({
        id: r.id as string,
        user_id: userId,
        amount: r.amount as number,
        date: r.date as string,
        description: (r.description as string) || '',
        distributed: (r.distributed as boolean) || false,
        allocations: (r.allocations as Record<string, number>) || {},
      }));
      await supabase.from('income_records').upsert(rows, { onConflict: 'id' });
    }
  }

  // Mark as migrated so this never runs again
  localStorage.setItem(LS_KEYS.migrated, 'true');
}
