// GetFlowFi — Supabase Database Types
// Matches the schema in supabase_schema.sql exactly.
// Update this file if you change the schema.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          category: string
          description: string
          date: string
          type: 'income' | 'expense' | 'saving'
          created_at: string
        }
        Insert: {
          id: string
          user_id: string
          amount: number
          category: string
          description?: string
          date: string
          type: 'income' | 'expense' | 'saving'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          category?: string
          description?: string
          date?: string
          type?: 'income' | 'expense' | 'saving'
          created_at?: string
        }
        Relationships: []
      }
      saving_goals: {
        Row: {
          id: string
          user_id: string
          name: string
          target_amount: number
          current_amount: number
          deadline: string
          emoji: string
          color: string
          created_at: string
        }
        Insert: {
          id: string
          user_id: string
          name: string
          target_amount: number
          current_amount?: number
          deadline?: string
          emoji?: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          target_amount?: number
          current_amount?: number
          deadline?: string
          emoji?: string
          color?: string
          created_at?: string
        }
        Relationships: []
      }
      budget_plan: {
        Row: {
          id: string
          user_id: string
          income: number
          frequency: 'semanal' | 'quincenal' | 'mensual'
          budgets: Json
          setup_done: boolean
          current_month: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          income?: number
          frequency?: 'semanal' | 'quincenal' | 'mensual'
          budgets?: Json
          setup_done?: boolean
          current_month?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          income?: number
          frequency?: 'semanal' | 'quincenal' | 'mensual'
          budgets?: Json
          setup_done?: boolean
          current_month?: string
          updated_at?: string
        }
        Relationships: []
      }
      income_records: {
        Row: {
          id: string
          user_id: string
          amount: number
          date: string
          description: string
          distributed: boolean
          allocations: Json
          created_at: string
        }
        Insert: {
          id: string
          user_id: string
          amount: number
          date: string
          description?: string
          distributed?: boolean
          allocations?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          date?: string
          description?: string
          distributed?: boolean
          allocations?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

// Convenience row types for use in App.tsx and db.ts
export type TxRow     = Database['public']['Tables']['transactions']['Row']
export type GoalRow   = Database['public']['Tables']['saving_goals']['Row']
export type BudgetRow = Database['public']['Tables']['budget_plan']['Row']
export type IncomeRow = Database['public']['Tables']['income_records']['Row']
