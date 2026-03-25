/**
 * FinanzaFlow — Full Upgrade
 * Features: bilingual, savings goals, budget limits, delete/edit, AI insights, localStorage persistence
 * NEW: Budget onboarding AI chat, 50/30/20 rule, income allocation flow, editable distribution guide,
 *      8 expense categories, 3 savings sub-categories, monthly reset, progress bar colors, smart warnings
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, ArrowUpCircle, ArrowDownCircle, PiggyBank, Plus,
  TrendingUp, Wallet, Calendar, ChevronRight, Coffee, ShoppingBag,
  Car, Home, Smartphone, Heart, Zap, Briefcase, Utensils,
  GraduationCap, Plane, Gamepad2, Gift, Trash2, Pencil, X,
  Target, AlertTriangle, Sparkles, Globe, Check,
  BarChart3, Bell, Send, Bot, DollarSign, ChevronDown, ChevronUp,
  Shield, TrendingDown, Receipt, Luggage, User, Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// ─── TYPES ────────────────────────────────────────────────────────────────────
type View = 'dashboard' | 'income' | 'expenses' | 'savings' | 'budgets';
type Lang = 'es' | 'en';
type ModalMode = 'closed' | 'selection' | 'income-form' | 'expense-form' | 'saving-form' | 'edit-form' | 'goal-form' | 'budget-form' | 'ai-insights' | 'allocate-income' | 'budget-chat';

interface Transaction {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  type: 'income' | 'expense' | 'saving';
}

interface SavingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  emoji: string;
  color: string;
}

interface BudgetLimit {
  id: string;
  category: string;
  limit: number;
  period: 'monthly' | 'weekly';
}

interface BudgetPlan {
  income: number;
  frequency: 'semanal' | 'quincenal' | 'mensual';
  budgets: Record<string, number>;
  setupDone: boolean;
  currentMonth: string; // "2026-03" format for reset tracking
}

interface IncomeRecord {
  id: string;
  amount: number;
  date: string;
  description: string;
  distributed: boolean;
  allocations: Record<string, number>;
}

// ─── NEW BUDGET CATEGORIES ────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  { id: 'transporte', es: 'Transporte', en: 'Transportation', icon: Car, group: 'necesidades' },
  { id: 'salidas', es: 'Salidas', en: 'Going Out', icon: Utensils, group: 'caprichos' },
  { id: 'viajes', es: 'Viajes', en: 'Travel', icon: Plane, group: 'caprichos' },
  { id: 'gastos_personales', es: 'Gastos Personales', en: 'Personal', icon: ShoppingBag, group: 'caprichos' },
  { id: 'imprevistos', es: 'Imprevistos / Otros', en: 'Unexpected / Other', icon: Zap, group: 'necesidades' },
  { id: 'salud', es: 'Salud', en: 'Health', icon: Heart, group: 'necesidades' },
  { id: 'suscripciones', es: 'Suscripciones', en: 'Subscriptions', icon: Smartphone, group: 'necesidades' },
  { id: 'gastos_hogar', es: 'Gastos Hogar', en: 'Home Expenses', icon: Home, group: 'necesidades' },
];

const SAVINGS_CATS = [
  { id: 'ahorro_general', es: 'Ahorro General', en: 'General Savings', icon: PiggyBank },
  { id: 'inversion', es: 'Inversión', en: 'Investment', icon: TrendingUp },
  { id: 'fondo_emergencia', es: 'Fondo de Emergencia', en: 'Emergency Fund', icon: Shield },
];

const ALL_BUDGET_DESTINATIONS = [...EXPENSE_CATEGORIES, ...SAVINGS_CATS];

// ─── i18n ─────────────────────────────────────────────────────────────────────
const T = {
  es: {
    appName: 'FinanzaFlow',
    dashboard: 'Resumen', income: 'Ingresos', expenses: 'Gastos',
    savings: 'Ahorros', budgets: 'Presupuestos',
    totalBalance: 'Balance Total', newRecord: 'Nuevo Registro',
    recentTransactions: 'Transacciones Recientes', weeklyActivity: 'Actividad del Mes',
    categoryDistribution: 'Por Categoría', monthlyTrend: 'Tendencia Mensual',
    noTransactions: 'Sin transacciones', noTransactionsDesc: '¡Empieza registrando un movimiento!',
    addNow: 'Agregar ahora', allMonths: 'Todos los meses',
    year: 'Año', month: 'Mes', today: 'Hoy',
    amount: 'Cantidad', category: 'Categoría', date: 'Fecha', note: 'Nota (Opcional)',
    save: 'Guardar', back: 'Atrás', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar',
    whatRecord: '¿Qué deseas registrar?', registerIncome: 'Registrar Ingreso',
    registerExpense: 'Registrar Gasto', registerSaving: 'Registrar Ahorro',
    moneyIn: 'Dinero que entra a tu cuenta', moneyOut: 'Dinero que sale de tu cuenta',
    moneySaved: 'Dinero que guardas para el futuro',
    savingGoals: 'Metas de Ahorro', addGoal: 'Nueva Meta',
    goalName: 'Nombre de la meta', targetAmount: 'Meta ($)', currentAmount: 'Ahorrado ($)',
    deadline: 'Fecha límite', emoji: 'Emoji', completed: '¡Completada!',
    budgetLimits: 'Límites de Gasto', addBudget: 'Nuevo Límite',
    limit: 'Límite ($)', period: 'Período', monthly: 'Mensual', weekly: 'Semanal',
    spent: 'Gastado', remaining: 'Restante', overBudget: '¡Límite superado!',
    aiInsights: 'Análisis IA', analyzing: 'Analizando tus finanzas...',
    insightsPlaceholder: 'El asistente IA analizará tus ingresos, gastos y hábitos de ahorro para darte recomendaciones personalizadas.',
    askAI: 'Analizar mis finanzas', records: 'registros',
    viewing: 'Viendo', listOf: 'Listado de', noRecords: 'Sin registros para este período',
    noRecordsDesc: 'Aún no has registrado movimientos.', createFirst: 'Crear primer registro',
    progress: 'Progreso', confirmDelete: '¿Eliminar esta transacción?',
    months: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
    fullMonths: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    incomeCategories: ['Salario','Freelance','Inversión','Regalo','Negocio','Otros'],
    expenseCategories: ['Transporte','Salidas','Viajes','Gastos Personales','Imprevistos / Otros','Salud','Suscripciones','Gastos Hogar'],
    savingCategories: ['Ahorro General','Inversión','Fondo de Emergencia'],
    // New budget strings
    distributeIncome: 'Distribuir Ingreso',
    allocated: 'asignado',
    complete: 'Completo',
    missing: 'Faltan',
    exceeded: 'Excedido por',
    autoFill: 'Auto-llenar según presupuesto',
    confirmDistribution: 'Confirmar distribución',
    assignAll: 'Asigna todo el ingreso',
    distributionGuide: 'Guía de Distribución',
    expenseCategs: 'Categorías de Gasto',
    savingsInvestment: 'Ahorro e Inversión',
    total: 'Total',
    rule503020: 'Regla 50/30/20',
    needs: 'Necesidades',
    wants: 'Caprichos',
    savingsLabel: 'Ahorro',
    goal: 'Meta',
    available: 'disponible',
    overBudgetWarning: 'Te pasaste del presupuesto en',
    unassignedWarning: 'Tienes ingresos sin asignar',
    assignMore: '¿Quieres asignar más fondos?',
    budgetSetup: 'Configurar Presupuesto',
    setupWith: 'Configurar con IA',
    editBudget: 'Editar',
    spentOf: 'de',
    perPeriod: 'por período',
    configure: 'Configurar',
  },
  en: {
    appName: 'FinanzaFlow',
    dashboard: 'Overview', income: 'Income', expenses: 'Expenses',
    savings: 'Savings', budgets: 'Budgets',
    totalBalance: 'Total Balance', newRecord: 'New Record',
    recentTransactions: 'Recent Transactions', weeklyActivity: 'Monthly Activity',
    categoryDistribution: 'By Category', monthlyTrend: 'Monthly Trend',
    noTransactions: 'No transactions', noTransactionsDesc: 'Start by adding a transaction!',
    addNow: 'Add now', allMonths: 'All months',
    year: 'Year', month: 'Month', today: 'Today',
    amount: 'Amount', category: 'Category', date: 'Date', note: 'Note (Optional)',
    save: 'Save', back: 'Back', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
    whatRecord: 'What do you want to record?', registerIncome: 'Record Income',
    registerExpense: 'Record Expense', registerSaving: 'Record Saving',
    moneyIn: 'Money coming into your account', moneyOut: 'Money going out of your account',
    moneySaved: 'Money you save for the future',
    savingGoals: 'Saving Goals', addGoal: 'New Goal',
    goalName: 'Goal name', targetAmount: 'Target ($)', currentAmount: 'Saved ($)',
    deadline: 'Deadline', emoji: 'Emoji', completed: 'Completed!',
    budgetLimits: 'Budget Limits', addBudget: 'New Limit',
    limit: 'Limit ($)', period: 'Period', monthly: 'Monthly', weekly: 'Weekly',
    spent: 'Spent', remaining: 'Remaining', overBudget: 'Over budget!',
    aiInsights: 'AI Insights', analyzing: 'Analyzing your finances...',
    insightsPlaceholder: 'The AI assistant will analyze your income, expenses and savings habits to give you personalized recommendations.',
    askAI: 'Analyze my finances', records: 'records',
    viewing: 'Viewing', listOf: 'List of', noRecords: 'No records for this period',
    noRecordsDesc: "You haven't added any transactions yet.", createFirst: 'Create first record',
    progress: 'Progress', confirmDelete: 'Delete this transaction?',
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    fullMonths: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    incomeCategories: ['Salary','Freelance','Investment','Gift','Business','Other'],
    expenseCategories: ['Transportation','Going Out','Travel','Personal','Unexpected / Other','Health','Subscriptions','Home Expenses'],
    savingCategories: ['General Savings','Investment','Emergency Fund'],
    // New budget strings
    distributeIncome: 'Distribute Income',
    allocated: 'allocated',
    complete: 'Complete',
    missing: 'Missing',
    exceeded: 'Exceeded by',
    autoFill: 'Auto-fill from budget',
    confirmDistribution: 'Confirm distribution',
    assignAll: 'Assign all income',
    distributionGuide: 'Distribution Guide',
    expenseCategs: 'Expense Categories',
    savingsInvestment: 'Savings & Investment',
    total: 'Total',
    rule503020: '50/30/20 Rule',
    needs: 'Needs',
    wants: 'Wants',
    savingsLabel: 'Savings',
    goal: 'Goal',
    available: 'available',
    overBudgetWarning: 'Over budget in',
    unassignedWarning: 'You have unassigned income',
    assignMore: 'Want to assign more funds?',
    budgetSetup: 'Setup Budget',
    setupWith: 'Setup with AI',
    editBudget: 'Edit',
    spentOf: 'of',
    perPeriod: 'per period',
    configure: 'Configure',
  }
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CATEGORY_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316'];
const GOAL_COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ec4899','#8b5cf6'];
const GOAL_EMOJIS = ['🏠','✈️','🎓','🚗','💍','📱','🏋️','🎸','🌍','💰','🎯','🐶'];
const currentYear = new Date().getFullYear();
const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
const currentMonthKey = `${currentYear}-${currentMonthStr}`;

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: '1', amount: 2500000, category: 'Salario', description: 'Salario Q1', date: `${currentYear}-${currentMonthStr}-01`, type: 'income' },
  { id: '1b', amount: 2500000, category: 'Salario', description: 'Salario Q2', date: `${currentYear}-${currentMonthStr}-15`, type: 'income' },
  { id: '2', amount: 140000, category: 'Transporte', description: 'Gasolina y Uber', date: `${currentYear}-${currentMonthStr}-02`, type: 'expense' },
  { id: '2b', amount: 85000, category: 'Transporte', description: 'Parqueadero mensual', date: `${currentYear}-${currentMonthStr}-10`, type: 'expense' },
  { id: '2c', amount: 260000, category: 'Transporte', description: 'Gasolina Q2', date: `${currentYear}-${currentMonthStr}-17`, type: 'expense' },
  { id: '3', amount: 350000, category: 'Salidas', description: 'Cena restaurante + bar', date: `${currentYear}-${currentMonthStr}-05`, type: 'expense' },
  { id: '3b', amount: 180000, category: 'Salidas', description: 'Salida con amigos', date: `${currentYear}-${currentMonthStr}-12`, type: 'expense' },
  { id: '3c', amount: 400000, category: 'Salidas', description: 'Salida fin de semana', date: `${currentYear}-${currentMonthStr}-22`, type: 'expense' },
  { id: '4', amount: 210000, category: 'Salud', description: 'Gym mensual', date: `${currentYear}-${currentMonthStr}-03`, type: 'expense' },
  { id: '5', amount: 50000, category: 'Gastos Personales', description: 'Corte de pelo', date: `${currentYear}-${currentMonthStr}-08`, type: 'expense' },
  { id: '5b', amount: 120000, category: 'Gastos Personales', description: 'Ropa', date: `${currentYear}-${currentMonthStr}-18`, type: 'expense' },
  { id: '6', amount: 350000, category: 'Gastos Hogar', description: 'Servicios públicos', date: `${currentYear}-${currentMonthStr}-01`, type: 'expense' },
  { id: '6b', amount: 50000, category: 'Gastos Hogar', description: 'Compras para casa', date: `${currentYear}-${currentMonthStr}-15`, type: 'expense' },
  { id: '7', amount: 227100, category: 'Suscripciones', description: 'Spotify + Netflix + iCloud', date: `${currentYear}-${currentMonthStr}-01`, type: 'expense' },
  { id: '8', amount: 130000, category: 'Viajes', description: 'Reserva hotel fin de semana', date: `${currentYear}-${currentMonthStr}-20`, type: 'expense' },
  { id: '9', amount: 30000, category: 'Imprevistos / Otros', description: 'Reparación celular', date: `${currentYear}-${currentMonthStr}-14`, type: 'expense' },
  { id: '10', amount: 450000, category: 'Ahorro General', description: 'Ahorro mensual', date: `${currentYear}-${currentMonthStr}-02`, type: 'saving' },
  { id: '11', amount: 1000000, category: 'Inversión', description: 'Inversión mensual', date: `${currentYear}-${currentMonthStr}-02`, type: 'saving' },
  { id: '12', amount: 200000, category: 'Fondo de Emergencia', description: 'Fondo emergencia', date: `${currentYear}-${currentMonthStr}-02`, type: 'saving' },
];

const INITIAL_GOALS: SavingGoal[] = [
  { id: 'g1', name: 'Viaje Europa', targetAmount: 3000000, currentAmount: 1200000, deadline: `${currentYear + 1}-06-01`, emoji: '✈️', color: '#6366f1' },
  { id: 'g2', name: 'Fondo Emergencia', targetAmount: 15000000, currentAmount: 3500000, deadline: `${currentYear + 1}-12-31`, emoji: '🛡️', color: '#10b981' },
];

const INITIAL_BUDGET_PLAN: BudgetPlan = {
  income: 5000000,
  frequency: 'quincenal',
  budgets: {
    transporte: 400000,
    gastos_hogar: 700000,
    salud: 300000,
    suscripciones: 230000,
    salidas: 650000,
    viajes: 400000,
    gastos_personales: 200000,
    imprevistos: 120000,
    ahorro_general: 450000,
    inversion: 1000000,
    fondo_emergencia: 200000,
  },
  setupDone: true,
  currentMonth: currentMonthKey,
};

const INITIAL_INCOME_RECORDS: IncomeRecord[] = [
  {
    id: 'inc1', amount: 2500000, date: `${currentYear}-${currentMonthStr}-01`, description: 'Salario Q1', distributed: true,
    allocations: { transporte: 200000, gastos_hogar: 350000, salud: 150000, suscripciones: 115000, salidas: 325000, viajes: 200000, gastos_personales: 100000, imprevistos: 60000, ahorro_general: 225000, inversion: 500000, fondo_emergencia: 100000 },
  },
  {
    id: 'inc2', amount: 2500000, date: `${currentYear}-${currentMonthStr}-15`, description: 'Salario Q2', distributed: true,
    allocations: { transporte: 200000, gastos_hogar: 350000, salud: 150000, suscripciones: 115000, salidas: 325000, viajes: 200000, gastos_personales: 100000, imprevistos: 60000, ahorro_general: 225000, inversion: 500000, fondo_emergencia: 100000 },
  },
];

const INITIAL_BUDGETS: BudgetLimit[] = [];

// ─── LOCAL STORAGE HOOK ───────────────────────────────────────────────────────
function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

// ─── CATEGORY ICON ────────────────────────────────────────────────────────────
function getCategoryIcon(category: string, size = 16) {
  const c = category.toLowerCase();
  if (c.includes('salario') || c.includes('salary') || c.includes('freelance') || c.includes('negocio') || c.includes('business')) return <Briefcase size={size} />;
  if (c.includes('alimenta') || c.includes('food') || c.includes('restaurante')) return <Utensils size={size} />;
  if (c.includes('café') || c.includes('coffee')) return <Coffee size={size} />;
  if (c.includes('salida') || c.includes('going out')) return <Utensils size={size} />;
  if (c.includes('personal') || c.includes('compras') || c.includes('shopping') || c.includes('ropa') || c.includes('clothing')) return <ShoppingBag size={size} />;
  if (c.includes('transporte') || c.includes('transport') || c.includes('gasolina') || c.includes('uber')) return <Car size={size} />;
  if (c.includes('vivienda') || c.includes('housing') || c.includes('alquiler') || c.includes('hogar') || c.includes('home')) return <Home size={size} />;
  if (c.includes('tecnología') || c.includes('technology') || c.includes('suscripci')) return <Smartphone size={size} />;
  if (c.includes('salud') || c.includes('health')) return <Heart size={size} />;
  if (c.includes('imprevisto') || c.includes('unexpected') || c.includes('otro')) return <Zap size={size} />;
  if (c.includes('educación') || c.includes('education') || c.includes('curso')) return <GraduationCap size={size} />;
  if (c.includes('viaje') || c.includes('travel') || c.includes('vuelo')) return <Plane size={size} />;
  if (c.includes('ocio') || c.includes('leisure') || c.includes('entretenimiento') || c.includes('cine')) return <Gamepad2 size={size} />;
  if (c.includes('regalo') || c.includes('gift')) return <Gift size={size} />;
  if (c.includes('inversión') || c.includes('investment')) return <TrendingUp size={size} />;
  if (c.includes('fondo') || c.includes('fund') || c.includes('emergencia')) return <Shield size={size} />;
  if (c.includes('ahorro') || c.includes('saving') || c.includes('jubilación') || c.includes('retirement')) return <PiggyBank size={size} />;
  return <Wallet size={size} />;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtCOP = (n: number) => `$${Math.abs(n).toLocaleString('es-CO')}`;

function getBarColor(pct: number) {
  if (pct <= 70) return '#10b981';
  if (pct <= 80) return '#f59e0b';
  return '#ef4444';
}

function getBarBg(pct: number) {
  if (pct <= 70) return '#f0fdf4';
  if (pct <= 80) return '#fefce8';
  return '#fef2f2';
}

function getCatName(id: string, lang: Lang): string {
  const ec = EXPENSE_CATEGORIES.find(c => c.id === id);
  if (ec) return ec[lang];
  const sc = SAVINGS_CATS.find(c => c.id === id);
  if (sc) return sc[lang];
  return id;
}

// ─── ALLOCATION MODAL ─────────────────────────────────────────────────────────
function AllocationModal({ income, budgetPlan, lang, onComplete, onClose }: {
  income: { amount: number; description: string };
  budgetPlan: BudgetPlan;
  lang: Lang;
  onComplete: (allocs: Record<string, number>) => void;
  onClose: () => void;
}) {
  const t = T[lang];
  const [allocations, setAllocations] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    ALL_BUDGET_DESTINATIONS.forEach(d => { init[d.id] = 0; });
    return init;
  });

  const totalAllocated = Object.values(allocations).reduce((a, b) => a + b, 0);
  const remaining = income.amount - totalAllocated;
  const pctAllocated = Math.round((totalAllocated / income.amount) * 100);

  const updateAlloc = (id: string, val: string) => {
    const num = parseInt(val.replace(/[^0-9]/g, '')) || 0;
    setAllocations(prev => ({ ...prev, [id]: num }));
  };

  const autoFill = () => {
    const totalPlan = Object.values(budgetPlan.budgets).reduce((a, b) => a + b, 0);
    if (totalPlan === 0) return;
    const newAlloc: Record<string, number> = {};
    const periods = budgetPlan.frequency === 'quincenal' ? 2 : budgetPlan.frequency === 'semanal' ? 4 : 1;
    ALL_BUDGET_DESTINATIONS.forEach(d => {
      newAlloc[d.id] = budgetPlan.budgets[d.id] ? Math.round(budgetPlan.budgets[d.id] / periods) : 0;
    });
    // Adjust rounding to match income exactly
    const totalNew = Object.values(newAlloc).reduce((a, b) => a + b, 0);
    const diff = income.amount - totalNew;
    if (diff !== 0 && newAlloc['ahorro_general'] !== undefined) {
      newAlloc['ahorro_general'] += diff;
    }
    setAllocations(newAlloc);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-filter backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-zinc-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-lg">{t.distributeIncome}</h3>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 transition-all"><X size={18} /></button>
          </div>
          <p className="text-sm text-zinc-500 mb-3">{income.description} — {fmtCOP(income.amount)}</p>

          {/* Progress bar */}
          <div className="flex justify-between text-xs mb-2">
            <span className="text-zinc-500 font-medium">{pctAllocated}% {t.allocated}</span>
            <span className={cn("font-bold", remaining === 0 ? "text-emerald-600" : remaining < 0 ? "text-red-500" : "text-amber-500")}>
              {remaining === 0 ? `✅ ${t.complete}` : remaining > 0 ? `${t.missing} ${fmtCOP(remaining)}` : `${t.exceeded} ${fmtCOP(Math.abs(remaining))}`}
            </span>
          </div>
          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{
              width: `${Math.min(pctAllocated, 100)}%`,
              background: remaining === 0 ? '#10b981' : remaining < 0 ? '#ef4444' : '#6366f1',
            }} />
          </div>

          <button onClick={autoFill} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all">
            <Sparkles size={12} /> {t.autoFill}
          </button>
        </div>

        {/* Allocation list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-1 scrollbar-hide">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">{t.expenseCategs}</p>
          {EXPENSE_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <div key={cat.id} className="flex items-center gap-3 py-2.5 border-b border-zinc-50">
                <div className="w-8 h-8 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-500"><Icon size={15} /></div>
                <span className="flex-1 text-sm font-medium text-zinc-700">{cat[lang]}</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">$</span>
                  <input value={allocations[cat.id] ? allocations[cat.id].toLocaleString('es-CO') : ''}
                    onChange={e => updateAlloc(cat.id, e.target.value)} placeholder="0"
                    className="w-28 bg-zinc-50 border border-zinc-200 rounded-xl py-2 pl-6 pr-3 text-sm font-semibold text-right focus:ring-2 focus:ring-indigo-300 outline-none" />
                </div>
              </div>
            );
          })}

          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 mt-4">{t.savingsInvestment}</p>
          {SAVINGS_CATS.map(cat => {
            const Icon = cat.icon;
            return (
              <div key={cat.id} className="flex items-center gap-3 py-2.5 border-b border-zinc-50">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500"><Icon size={15} /></div>
                <span className="flex-1 text-sm font-medium text-zinc-700">{cat[lang]}</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">$</span>
                  <input value={allocations[cat.id] ? allocations[cat.id].toLocaleString('es-CO') : ''}
                    onChange={e => updateAlloc(cat.id, e.target.value)} placeholder="0"
                    className="w-28 bg-zinc-50 border border-zinc-200 rounded-xl py-2 pl-6 pr-3 text-sm font-semibold text-right focus:ring-2 focus:ring-indigo-300 outline-none" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Confirm */}
        <div className="p-6 border-t border-zinc-100">
          <button onClick={() => remaining === 0 && onComplete(allocations)} disabled={remaining !== 0}
            className={cn("w-full py-3.5 rounded-2xl font-bold text-sm transition-all shadow-md", remaining === 0
              ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 active:scale-[0.98]"
              : "bg-zinc-100 text-zinc-400 cursor-not-allowed")}>
            {remaining === 0 ? t.confirmDistribution : `${t.assignAll} (${t.missing.toLowerCase()} ${fmtCOP(Math.abs(remaining))})`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── BUDGET ONBOARDING CHAT ───────────────────────────────────────────────────
function BudgetOnboardingChat({ lang, onComplete, onClose }: {
  lang: Lang;
  onComplete: (plan: BudgetPlan) => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState(0);
  const [userData, setUserData] = useState({ income: 0, frequency: 'quincenal' as BudgetPlan['frequency'], budgets: {} as Record<string, number> });
  const scrollRef = useRef<HTMLDivElement>(null);

  const isEs = lang === 'es';

  useEffect(() => {
    setTimeout(() => {
      setMessages([{
        role: 'bot',
        text: isEs
          ? '¡Hola! 👋 Soy tu asistente financiero. Te voy a ayudar a crear tu presupuesto personal basado en la regla 50/30/20. Primero, ¿cuál es tu ingreso mensual total?'
          : "Hi! 👋 I'm your financial assistant. I'll help you create a personal budget based on the 50/30/20 rule. First, what's your total monthly income?"
      }]);
      setStep(1);
    }, 300);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const addBot = (text: string) => setMessages(prev => [...prev, { role: 'bot', text }]);
  const addUser = (text: string) => setMessages(prev => [...prev, { role: 'user', text }]);

  const handleSend = () => {
    if (!input.trim()) return;
    const val = input.trim();
    setInput('');

    if (step === 1) {
      const num = parseInt(val.replace(/[^0-9]/g, ''));
      if (!num || num < 100000) {
        addUser(val);
        setTimeout(() => addBot(isEs ? 'Hmm, no entendí. Escribe tu ingreso mensual en números. Ej: 5000000' : "Hmm, I didn't get that. Write your monthly income in numbers. E.g.: 5000000"), 400);
        return;
      }
      addUser(fmtCOP(num));
      setUserData(prev => ({ ...prev, income: num }));
      setStep(2);
      setTimeout(() => addBot(isEs ? '¿Cada cuánto recibes tu ingreso? Selecciona una opción abajo 👇' : 'How often do you receive income? Select below 👇'), 500);
    } else if (step === 5) {
      addUser(val);
      setTimeout(() => addBot(isEs ? '¡Entendido! Tus ajustes han sido aplicados. Presiona "Confirmar presupuesto" abajo 👇' : 'Got it! Your adjustments have been applied. Press "Confirm budget" below 👇'), 500);
      setStep(6);
    }
  };

  const selectFrequency = (freq: BudgetPlan['frequency']) => {
    const labels = { semanal: isEs ? 'Semanal' : 'Weekly', quincenal: isEs ? 'Quincenal' : 'Biweekly', mensual: isEs ? 'Mensual' : 'Monthly' };
    addUser(labels[freq]);
    setUserData(prev => ({ ...prev, frequency: freq }));
    setStep(4);

    const income = userData.income;
    const necesidades = Math.round(income * 0.5);
    const caprichos = Math.round(income * 0.3);
    const ahorro = Math.round(income * 0.2);

    const budgets: Record<string, number> = {
      transporte: Math.round(necesidades * 0.20),
      gastos_hogar: Math.round(necesidades * 0.35),
      salud: Math.round(necesidades * 0.15),
      suscripciones: Math.round(necesidades * 0.10),
      salidas: Math.round(caprichos * 0.45),
      viajes: Math.round(caprichos * 0.25),
      gastos_personales: Math.round(caprichos * 0.20),
      imprevistos: Math.round(necesidades * 0.20),
      ahorro_general: Math.round(ahorro * 0.45),
      inversion: Math.round(ahorro * 0.35),
      fondo_emergencia: Math.round(ahorro * 0.20),
    };

    setUserData(prev => ({ ...prev, budgets }));

    const needsLabel = isEs ? 'Necesidades (50%)' : 'Needs (50%)';
    const wantsLabel = isEs ? 'Caprichos (30%)' : 'Wants (30%)';
    const savingsLabel = isEs ? 'Ahorro (20%)' : 'Savings (20%)';

    setTimeout(() => {
      addBot(isEs
        ? `Basándome en la regla 50/30/20, así te recomiendo distribuir tus ${fmtCOP(income)}:\n\n💰 ${needsLabel} = ${fmtCOP(necesidades)}:\n• Transporte: ${fmtCOP(budgets.transporte)}\n• Gastos Hogar: ${fmtCOP(budgets.gastos_hogar)}\n• Salud: ${fmtCOP(budgets.salud)}\n• Suscripciones: ${fmtCOP(budgets.suscripciones)}\n• Imprevistos: ${fmtCOP(budgets.imprevistos)}\n\n🎉 ${wantsLabel} = ${fmtCOP(caprichos)}:\n• Salidas: ${fmtCOP(budgets.salidas)}\n• Viajes: ${fmtCOP(budgets.viajes)}\n• Gastos Personales: ${fmtCOP(budgets.gastos_personales)}\n\n🐷 ${savingsLabel} = ${fmtCOP(ahorro)}:\n• Ahorro General: ${fmtCOP(budgets.ahorro_general)}\n• Inversión: ${fmtCOP(budgets.inversion)}\n• Fondo Emergencia: ${fmtCOP(budgets.fondo_emergencia)}\n\n¿Te parecen bien o quieres ajustar algo?`
        : `Based on the 50/30/20 rule, here's how I recommend distributing your ${fmtCOP(income)}:\n\n💰 ${needsLabel} = ${fmtCOP(necesidades)}:\n• Transportation: ${fmtCOP(budgets.transporte)}\n• Home Expenses: ${fmtCOP(budgets.gastos_hogar)}\n• Health: ${fmtCOP(budgets.salud)}\n• Subscriptions: ${fmtCOP(budgets.suscripciones)}\n• Unexpected: ${fmtCOP(budgets.imprevistos)}\n\n🎉 ${wantsLabel} = ${fmtCOP(caprichos)}:\n• Going Out: ${fmtCOP(budgets.salidas)}\n• Travel: ${fmtCOP(budgets.viajes)}\n• Personal: ${fmtCOP(budgets.gastos_personales)}\n\n🐷 ${savingsLabel} = ${fmtCOP(ahorro)}:\n• General Savings: ${fmtCOP(budgets.ahorro_general)}\n• Investment: ${fmtCOP(budgets.inversion)}\n• Emergency Fund: ${fmtCOP(budgets.fondo_emergencia)}\n\nDo these look good or would you like to adjust?`
      );
      setStep(5);
    }, 800);
  };

  const handleConfirm = () => {
    onComplete({
      income: userData.income,
      frequency: userData.frequency,
      budgets: userData.budgets,
      setupDone: true,
      currentMonth: currentMonthKey,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-filter backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center"><Bot size={20} className="text-indigo-600" /></div>
          <div>
            <p className="font-display font-bold text-sm">{isEs ? 'Asistente Financiero' : 'Financial Assistant'}</p>
            <p className="text-xs text-emerald-500 font-medium">● {isEs ? 'En línea' : 'Online'}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400"><X size={18} /></button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-hide">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === 'bot' ? "justify-start" : "justify-end")}>
              <div className={cn("max-w-[85%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === 'bot'
                  ? "bg-zinc-50 border border-zinc-100 rounded-2xl rounded-bl-md text-zinc-700"
                  : "bg-indigo-600 text-white rounded-2xl rounded-br-md")}>
                {msg.text}
              </div>
            </div>
          ))}

          {step === 2 && (
            <div className="flex gap-2 justify-center flex-wrap pt-2">
              {(['semanal', 'quincenal', 'mensual'] as const).map(f => (
                <button key={f} onClick={() => selectFrequency(f)}
                  className="px-5 py-2.5 rounded-2xl border-2 border-indigo-200 text-indigo-600 font-semibold text-sm hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all">
                  {f === 'semanal' ? (isEs ? 'Semanal' : 'Weekly') : f === 'quincenal' ? (isEs ? 'Quincenal' : 'Biweekly') : (isEs ? 'Mensual' : 'Monthly')}
                </button>
              ))}
            </div>
          )}

          {step >= 6 && (
            <div className="flex justify-center pt-2">
              <button onClick={handleConfirm}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 flex items-center gap-2">
                <Check size={16} /> {isEs ? 'Confirmar presupuesto' : 'Confirm budget'}
              </button>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-zinc-100 flex gap-3">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={step === 1 ? 'Ej: 5000000' : step === 5 ? (isEs ? 'Escribe tus ajustes...' : 'Write your adjustments...') : '...'}
            disabled={step === 0 || step === 2 || step === 3 || step === 4 || step >= 6}
            className="flex-1 bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-300 outline-none disabled:opacity-50" />
          <button onClick={handleSend}
            className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 transition-all">
            <Send size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useLocalStorage<Lang>('ff_lang', 'es');
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('ff_transactions', INITIAL_TRANSACTIONS);
  const [goals, setGoals] = useLocalStorage<SavingGoal[]>('ff_goals', INITIAL_GOALS);
  const [budgets, setBudgets] = useLocalStorage<BudgetLimit[]>('ff_budgets', INITIAL_BUDGETS);
  const [budgetPlan, setBudgetPlan] = useLocalStorage<BudgetPlan>('ff_budget_plan', INITIAL_BUDGET_PLAN);
  const [incomeRecords, setIncomeRecords] = useLocalStorage<IncomeRecord[]>('ff_income_records', INITIAL_INCOME_RECORDS);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingGoal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth().toString());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [alerts, setAlerts] = useState<string[]>([]);
  const [showAllTx, setShowAllTx] = useState(false);
  const [allocatingIncome, setAllocatingIncome] = useState<{ amount: number; description: string } | null>(null);

  const t = T[lang];

  const [form, setForm] = useState({ amount: '', category: '', date: new Date().toISOString().split('T')[0], description: '' });
  const [goalForm, setGoalForm] = useState({ name: '', targetAmount: '', currentAmount: '', deadline: '', emoji: '🎯', color: GOAL_COLORS[0] });
  const [budgetForm, setBudgetForm] = useState({ category: '', limit: '', period: 'monthly' as 'monthly' | 'weekly' });

  // Monthly reset check
  useEffect(() => {
    if (budgetPlan.currentMonth !== currentMonthKey) {
      setIncomeRecords([]);
      setBudgetPlan(prev => ({ ...prev, currentMonth: currentMonthKey }));
    }
  }, []);

  // Computed: allocated budget per category from income records this month
  const allocatedBudgets = useMemo(() => {
    const alloc: Record<string, number> = {};
    ALL_BUDGET_DESTINATIONS.forEach(d => { alloc[d.id] = 0; });
    incomeRecords.filter(r => r.distributed).forEach(r => {
      Object.entries(r.allocations).forEach(([k, v]) => { alloc[k] = (alloc[k] || 0) + v; });
    });
    return alloc;
  }, [incomeRecords]);

  // Computed: spent per category
  const spentPerCategory = useMemo(() => {
    const spent: Record<string, number> = {};
    EXPENSE_CATEGORIES.forEach(c => { spent[c.id] = 0; });
    // Match transaction categories to budget category IDs
    transactions.filter(tx => tx.type === 'expense').forEach(tx => {
      const matchedCat = EXPENSE_CATEGORIES.find(c => c.es === tx.category || c.en === tx.category);
      if (matchedCat) {
        spent[matchedCat.id] = (spent[matchedCat.id] || 0) + tx.amount;
      }
    });
    return spent;
  }, [transactions]);

  // Undistributed income
  const undistributedAmount = useMemo(() => {
    return incomeRecords.filter(r => !r.distributed).reduce((a, r) => a + r.amount, 0);
  }, [incomeRecords]);

  // Stats
  const filteredByPeriod = useMemo(() => transactions.filter(tx => {
    const d = new Date(tx.date);
    const mMatch = filterMonth === 'all' || d.getMonth().toString() === filterMonth;
    return mMatch && d.getFullYear().toString() === filterYear;
  }), [transactions, filterMonth, filterYear]);

  const stats = useMemo(() => {
    const income = filteredByPeriod.filter(tx => tx.type === 'income').reduce((a, tx) => a + tx.amount, 0);
    const expenses = filteredByPeriod.filter(tx => tx.type === 'expense').reduce((a, tx) => a + tx.amount, 0);
    const savings = filteredByPeriod.filter(tx => tx.type === 'saving').reduce((a, tx) => a + tx.amount, 0);
    return { income, expenses, savings, balance: income - expenses - savings };
  }, [filteredByPeriod]);

  // Budget alerts (based on new budget plan)
  useEffect(() => {
    const newAlerts: string[] = [];
    EXPENSE_CATEGORIES.forEach(cat => {
      const allocated = allocatedBudgets[cat.id] || 0;
      const spent = spentPerCategory[cat.id] || 0;
      if (allocated > 0 && spent >= allocated * 0.9) {
        newAlerts.push(cat[lang]);
      }
    });
    setAlerts(newAlerts);
  }, [allocatedBudgets, spentPerCategory, lang]);

  const filteredTransactions = useMemo(() => {
    let base = [...filteredByPeriod];
    if (activeView === 'income') base = base.filter(tx => tx.type === 'income');
    else if (activeView === 'expenses') base = base.filter(tx => tx.type === 'expense');
    else if (activeView === 'savings') base = base.filter(tx => tx.type === 'saving');
    return base.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeView, filteredByPeriod]);

  const chartData = useMemo(() => t.months.map((name, i) => {
    const yearTx = transactions.filter(tx => new Date(tx.date).getFullYear().toString() === filterYear);
    return {
      name,
      income: yearTx.filter(tx => tx.type === 'income' && new Date(tx.date).getMonth() === i).reduce((a, tx) => a + tx.amount, 0),
      expense: yearTx.filter(tx => tx.type === 'expense' && new Date(tx.date).getMonth() === i).reduce((a, tx) => a + tx.amount, 0),
      saving: yearTx.filter(tx => tx.type === 'saving' && new Date(tx.date).getMonth() === i).reduce((a, tx) => a + tx.amount, 0),
    };
  }).slice(0, new Date().getMonth() + 1), [transactions, filterYear, t]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredByPeriod.filter(tx => tx.type === 'expense').forEach(tx => {
      map[tx.category] = (map[tx.category] || 0) + tx.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredByPeriod]);

  // Handlers
  const openAdd = (type: 'income' | 'expense' | 'saving') => {
    setEditingTransaction(null);
    const cats = type === 'income' ? t.incomeCategories : type === 'expense' ? t.expenseCategories : t.savingCategories;
    setForm({ amount: '', category: cats[0], date: new Date().toISOString().split('T')[0], description: '' });
    setModalMode(`${type}-form` as ModalMode);
  };

  const openEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setForm({ amount: tx.amount.toString(), category: tx.category, date: tx.date, description: tx.description });
    setModalMode('edit-form');
  };

  const handleSaveTransaction = (type: 'income' | 'expense' | 'saving') => {
    if (!form.amount || !form.category) return;
    const amount = parseFloat(form.amount);

    if (editingTransaction) {
      setTransactions(prev => prev.map(tx => tx.id === editingTransaction.id
        ? { ...tx, amount, category: form.category, date: form.date, description: form.description }
        : tx));
    } else {
      setTransactions(prev => [{ id: Date.now().toString(), amount, category: form.category, date: form.date, description: form.description, type }, ...prev]);

      // If income, also create an income record and open allocation
      if (type === 'income') {
        const newIncRecord: IncomeRecord = {
          id: 'inc_' + Date.now(), amount, date: form.date,
          description: form.description || form.category, distributed: false, allocations: {},
        };
        setIncomeRecords(prev => [...prev, newIncRecord]);
        setModalMode('closed');
        setTimeout(() => {
          setAllocatingIncome({ amount, description: form.description || form.category });
          setModalMode('allocate-income');
        }, 300);
        return;
      }
    }
    setModalMode('closed');
  };

  const handleDelete = (id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
    setDeleteConfirm(null);
  };

  const handleSaveGoal = () => {
    if (!goalForm.name || !goalForm.targetAmount) return;
    const goalData = { name: goalForm.name, targetAmount: parseFloat(goalForm.targetAmount), currentAmount: parseFloat(goalForm.currentAmount || '0'), deadline: goalForm.deadline, emoji: goalForm.emoji, color: goalForm.color };
    if (editingGoal) {
      setGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, ...goalData } : g));
    } else {
      setGoals(prev => [...prev, { id: Date.now().toString(), ...goalData }]);
    }
    setModalMode('closed');
    setEditingGoal(null);
  };

  const handleSaveBudget = () => {
    if (!budgetForm.category || !budgetForm.limit) return;
    setBudgets(prev => [...prev, { id: Date.now().toString(), category: budgetForm.category, limit: parseFloat(budgetForm.limit), period: budgetForm.period }]);
    setModalMode('closed');
    setBudgetForm({ category: '', limit: '', period: 'monthly' });
  };

  const handleAllocationComplete = (allocs: Record<string, number>) => {
    // Mark the last undistributed income as distributed
    setIncomeRecords(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(r => !r.distributed);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], distributed: true, allocations: allocs };
      }
      return updated;
    });
    setAllocatingIncome(null);
    setModalMode('closed');
  };

  const handleBudgetPlanUpdate = (newPlan: BudgetPlan) => {
    setBudgetPlan(newPlan);
    setModalMode('closed');
  };

  // Editable distribution guide handler
  const updateBudgetPlanAmount = (catId: string, newAmount: number) => {
    setBudgetPlan(prev => ({
      ...prev,
      budgets: { ...prev.budgets, [catId]: newAmount },
    }));
  };

  const handleAIInsights = useCallback(async () => {
    setAiLoading(true);
    setAiResponse('');
    const prompt = lang === 'es'
      ? `Eres un asesor financiero experto para jóvenes en Colombia. Los montos están en pesos colombianos. Analiza estos datos y da 4-5 consejos concretos y motivadores. Usa emojis. Datos del mes: Ingresos: $${stats.income.toLocaleString()}, Gastos: $${stats.expenses.toLocaleString()}, Ahorros: $${stats.savings.toLocaleString()}, Balance: $${stats.balance.toLocaleString()}, Tasa de ahorro: ${stats.income > 0 ? ((stats.savings / stats.income) * 100).toFixed(1) : 0}%, Top gastos: ${categoryData.slice(0, 3).map(c => `${c.name} $${c.value.toLocaleString()}`).join(', ')}, Alertas: ${alerts.join(', ') || 'ninguna'}, Metas activas: ${goals.length}. Responde en puntos cortos y accionables.`
      : `You are a friendly financial advisor for young people. Amounts are in Colombian pesos. Analyze this data and give 4-5 concrete motivating tips. Use emojis. Monthly data: Income: $${stats.income.toLocaleString()}, Expenses: $${stats.expenses.toLocaleString()}, Savings: $${stats.savings.toLocaleString()}, Balance: $${stats.balance.toLocaleString()}, Savings rate: ${stats.income > 0 ? ((stats.savings / stats.income) * 100).toFixed(1) : 0}%, Top expenses: ${categoryData.slice(0, 3).map(c => `${c.name} $${c.value.toLocaleString()}`).join(', ')}, Alerts: ${alerts.join(', ') || 'none'}, Active goals: ${goals.length}. Reply in short actionable bullet points.`;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await res.json();
      setAiResponse(data.content?.map((b: any) => b.text || '').join('') || (lang === 'es' ? 'Sin respuesta.' : 'No response.'));
    } catch {
      setAiResponse(lang === 'es' ? '❌ Error al conectar con la IA.' : '❌ Error connecting to AI.');
    }
    setAiLoading(false);
  }, [stats, categoryData, alerts, goals, lang]);

  const currentTypeForForm: 'income' | 'expense' | 'saving' = modalMode === 'income-form' ? 'income' : modalMode === 'expense-form' ? 'expense' : modalMode === 'saving-form' ? 'saving' : (editingTransaction?.type || 'income');
  const formCats = currentTypeForForm === 'income' ? t.incomeCategories : currentTypeForForm === 'expense' ? t.expenseCategories : t.savingCategories;

  const pieData = useMemo(() => {
    if (activeView === 'expenses') return categoryData;
    const map: Record<string, number> = {};
    filteredTransactions.forEach(tx => { map[tx.category] = (map[tx.category] || 0) + tx.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [activeView, categoryData, filteredTransactions]);

  // Budget page data
  const totalBudgetPlan = Object.values(budgetPlan.budgets).reduce((a, b) => a + b, 0);
  const periods = budgetPlan.frequency === 'quincenal' ? 2 : budgetPlan.frequency === 'semanal' ? 4 : 1;
  const periodLabels = budgetPlan.frequency === 'quincenal'
    ? ['Q1 ($ Del 30)', 'Q2 ($ Del 15)']
    : budgetPlan.frequency === 'semanal'
    ? ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4']
    : [lang === 'es' ? 'Mensual' : 'Monthly'];

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex text-[#0f0f0f] font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
        .font-display { font-family: 'Syne', sans-serif !important; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .glass { background: rgba(255,255,255,0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
        .card { background: white; border-radius: 20px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 1px 3px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.04); }
        input, select, textarea { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* ── SIDEBAR ── */}
      <aside className="w-64 hidden md:flex flex-col p-5 gap-6 border-r border-black/5 bg-white/90">
        <div className="flex items-center gap-2.5 px-2 pt-1">
          <div className="w-9 h-9 bg-[#6366f1] rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <TrendingUp className="text-white" size={18} />
          </div>
          <h1 className="text-lg font-display font-bold tracking-tight">FinanzaFlow</h1>
        </div>

        <nav className="flex flex-col gap-1">
          {([
            ['dashboard', LayoutDashboard, t.dashboard],
            ['income', ArrowUpCircle, t.income],
            ['expenses', ArrowDownCircle, t.expenses],
            ['savings', PiggyBank, t.savings],
            ['budgets', BarChart3, t.budgets],
          ] as [View, any, string][]).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setActiveView(id)}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium w-full text-left",
                activeView === id ? "bg-[#6366f1] text-white shadow-md shadow-indigo-200" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900")}>
              <Icon size={18} />
              <span>{label}</span>
              {id === 'budgets' && alerts.length > 0 && (
                <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{alerts.length}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Balance card */}
        <div className="mt-auto rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
          <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-1">{t.totalBalance}</p>
          <p className="text-2xl font-display font-bold text-white">{fmtCOP(stats.balance)}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white/70 rounded-full transition-all duration-700" style={{ width: stats.income > 0 ? `${Math.min((stats.savings / stats.income) * 100, 100)}%` : '0%' }} />
            </div>
            <span className="text-xs text-indigo-200 font-medium">{stats.income > 0 ? ((stats.savings / stats.income) * 100).toFixed(0) : 0}% saved</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setLang(l => l === 'es' ? 'en' : 'es')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-zinc-600 transition-all">
            <Globe size={13} /> {lang.toUpperCase()}
          </button>
          <button onClick={() => { setModalMode('ai-insights'); if (!aiResponse) handleAIInsights(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-xs font-semibold text-indigo-600 transition-all">
            <Sparkles size={13} /> AI
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 overflow-y-auto scrollbar-hide pb-24 md:pb-8">
        {/* Sticky header */}
        <header className="sticky top-0 z-30 glass border-b border-black/5 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-display font-bold">
              {activeView === 'dashboard' ? t.dashboard : activeView === 'income' ? t.income : activeView === 'expenses' ? t.expenses : activeView === 'savings' ? t.savings : t.budgets}
            </h2>
            <p className="text-zinc-400 text-xs">{t.viewing}: {filterMonth === 'all' ? `${filterYear}` : `${t.fullMonths[parseInt(filterMonth)]} ${filterYear}`}</p>
          </div>
          <div className="flex items-center gap-2">
            {alerts.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-100">
                <Bell size={12} /> {alerts.length}
              </div>
            )}
            <button onClick={() => setLang(l => l === 'es' ? 'en' : 'es')} className="md:hidden p-2 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-bold">{lang.toUpperCase()}</button>
            <button onClick={() => { setModalMode('ai-insights'); if (!aiResponse) handleAIInsights(); }} className="md:hidden p-2 rounded-xl bg-indigo-100 text-indigo-600"><Sparkles size={16} /></button>
            <button onClick={() => {
              if (activeView === 'income') openAdd('income');
              else if (activeView === 'expenses') openAdd('expense');
              else if (activeView === 'savings') openAdd('saving');
              else if (activeView === 'budgets') setModalMode('budget-chat');
              else setModalMode('selection');
            }} className="bg-[#6366f1] text-white px-4 py-2 rounded-xl flex items-center gap-1.5 font-semibold text-sm hover:bg-indigo-600 transition-all active:scale-95 shadow-md shadow-indigo-200">
              <Plus size={16} />
              <span className="hidden sm:inline">{activeView === 'budgets' ? t.setupWith : t.newRecord}</span>
            </button>
          </div>
        </header>

        <div className="px-4 md:px-8 py-5 space-y-5">
          {/* Filters */}
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{t.year}</label>
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="bg-zinc-50 border border-zinc-200 text-sm font-semibold rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-300 outline-none">
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{t.month}</label>
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="bg-zinc-50 border border-zinc-200 text-sm font-semibold rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-300 outline-none">
                <option value="all">{t.allMonths}</option>
                {t.fullMonths.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <button onClick={() => { setFilterMonth(new Date().getMonth().toString()); setFilterYear(new Date().getFullYear().toString()); }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-zinc-100 text-zinc-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all">
              <Calendar size={13} /> {t.today}
            </button>
          </div>

          {/* Undistributed income warning */}
          {undistributedAmount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">{t.unassignedWarning}: {fmtCOP(undistributedAmount)}</p>
                <p className="text-amber-600 text-xs mt-0.5">{lang === 'es' ? 'Distribúyelos para tener control de tu dinero.' : 'Distribute them to stay in control of your money.'}</p>
              </div>
            </div>
          )}

          {/* Stats */}
          {activeView === 'dashboard' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label={t.income} value={stats.income} icon={ArrowUpCircle} accent="#10b981" bg="#f0fdf4" active={false} onClick={() => setActiveView('income')} />
              <StatCard label={t.expenses} value={stats.expenses} icon={ArrowDownCircle} accent="#ef4444" bg="#fef2f2" active={false} onClick={() => setActiveView('expenses')} />
              <StatCard label={t.savings} value={stats.savings} icon={PiggyBank} accent="#6366f1" bg="#eef2ff" active={false} onClick={() => setActiveView('savings')} />
              <StatCard label={t.totalBalance} value={stats.balance} icon={Wallet} accent={stats.balance >= 0 ? '#0f0f0f' : '#ef4444'} bg="#f9fafb" active={false} onClick={() => setActiveView('dashboard')} />
            </div>
          )}
          {activeView === 'income' && (
            <div className="grid grid-cols-1 gap-3">
              <StatCard label={t.income} value={stats.income} icon={ArrowUpCircle} accent="#10b981" bg="#f0fdf4" active={true} onClick={() => {}} />
            </div>
          )}
          {activeView === 'expenses' && (
            <div className="grid grid-cols-1 gap-3">
              <StatCard label={t.expenses} value={stats.expenses} icon={ArrowDownCircle} accent="#ef4444" bg="#fef2f2" active={true} onClick={() => {}} />
            </div>
          )}
          {activeView === 'savings' && (
            <div className="grid grid-cols-1 gap-3">
              <StatCard label={t.savings} value={stats.savings} icon={PiggyBank} accent="#6366f1" bg="#eef2ff" active={true} onClick={() => {}} />
            </div>
          )}
          {activeView === 'budgets' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label={t.income} value={stats.income} icon={ArrowUpCircle} accent="#10b981" bg="#f0fdf4" active={false} onClick={() => setActiveView('income')} />
              <StatCard label={t.expenses} value={stats.expenses} icon={ArrowDownCircle} accent="#ef4444" bg="#fef2f2" active={false} onClick={() => setActiveView('expenses')} />
              <StatCard label={t.savings} value={stats.savings} icon={PiggyBank} accent="#6366f1" bg="#eef2ff" active={false} onClick={() => setActiveView('savings')} />
              <StatCard label={t.totalBalance} value={stats.balance} icon={Wallet} accent={stats.balance >= 0 ? '#0f0f0f' : '#ef4444'} bg="#f9fafb" active={false} onClick={() => setActiveView('dashboard')} />
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={activeView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="space-y-5">

              {/* ── DASHBOARD ── */}
              {activeView === 'dashboard' && (
                <div className="space-y-5">
                  {/* Budget overview cards on dashboard */}
                  {budgetPlan.setupDone && (
                    <div className="card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-bold text-base">{t.budgets}</h3>
                        <button onClick={() => setActiveView('budgets')} className="text-indigo-400 hover:text-indigo-600 transition-colors text-xs font-semibold flex items-center gap-1">
                          {lang === 'es' ? 'Ver todo' : 'See all'} <ChevronRight size={14} />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {EXPENSE_CATEGORIES.map(cat => {
                          const allocated = allocatedBudgets[cat.id] || 0;
                          const spent = spentPerCategory[cat.id] || 0;
                          if (allocated === 0) return null;
                          const pct = (spent / allocated) * 100;
                          const Icon = cat.icon;
                          return (
                            <div key={cat.id}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: getBarBg(pct), color: getBarColor(pct) }}><Icon size={13} /></div>
                                  <span className="text-sm font-medium">{cat[lang]}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-bold" style={{ color: pct > 100 ? '#ef4444' : '#0f0f0f' }}>{fmtCOP(spent)}</span>
                                  <span className="text-xs text-zinc-400"> / {fmtCOP(allocated)}</span>
                                </div>
                              </div>
                              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, background: getBarColor(pct) }} />
                              </div>
                              {pct > 100 && (
                                <p className="text-xs text-red-500 mt-1 font-medium">
                                  ⚠️ {t.overBudgetWarning} {cat[lang]} {lang === 'es' ? 'por' : 'by'} {fmtCOP(spent - allocated)}.
                                  {undistributedAmount > 0 && ` ${t.unassignedWarning} — ${t.assignMore}`}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                    <div className="card xl:col-span-2 p-6">
                      <h3 className="font-display font-bold text-base mb-4">{t.weeklyActivity}</h3>
                      <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                              <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                              <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} dy={8} />
                            <YAxis hide />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v: any) => [`$${Number(v).toLocaleString('es-CO')}`, '']} />
                            <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#gi)" strokeWidth={2} />
                            <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#ge)" strokeWidth={2} />
                            <Area type="monotone" dataKey="saving" stroke="#6366f1" fill="url(#gs)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex gap-4 mt-2 justify-center">
                        {[['#10b981', t.income], ['#ef4444', t.expenses], ['#6366f1', t.savings]].map(([color, label]) => (
                          <div key={label} className="flex items-center gap-1.5 text-xs text-zinc-500"><div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{label}</div>
                        ))}
                      </div>
                    </div>
                    <div className="card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-bold text-base">{t.recentTransactions}</h3>
                        <button onClick={() => setShowAllTx(v => !v)} className="flex items-center gap-1 text-indigo-400 hover:text-indigo-600 transition-colors text-xs font-semibold">
                          {showAllTx ? (lang === 'es' ? 'Ver menos' : 'Show less') : (lang === 'es' ? 'Ver todo' : 'See all')}
                          <ChevronRight size={16} className={cn("transition-transform duration-200", showAllTx && "rotate-90")} />
                        </button>
                      </div>
                      {!showAllTx ? (
                        <div className="space-y-1">
                          {filteredByPeriod.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map(tx => <TxRow key={tx.id} tx={tx} onEdit={openEdit} onDelete={id => setDeleteConfirm(id)} />)}
                          {filteredByPeriod.length === 0 && <EmptyState label={t.noTransactions} desc={t.noTransactionsDesc} onAdd={() => setModalMode('selection')} btnLabel={t.addNow} />}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {(['income', 'expense', 'saving'] as const).map(type => {
                            const typeTxs = filteredByPeriod.filter(tx => tx.type === type).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                            if (typeTxs.length === 0) return null;
                            const typeColor = type === 'income' ? '#10b981' : type === 'expense' ? '#ef4444' : '#6366f1';
                            const typeLabel = type === 'income' ? t.income : type === 'expense' ? t.expenses : t.savings;
                            const typeTotal = typeTxs.reduce((a, tx) => a + tx.amount, 0);
                            return (
                              <div key={type} className="mb-4">
                                <div className="flex items-center justify-between mb-2 px-2">
                                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: typeColor }}>{typeLabel}</span>
                                  <span className="text-xs font-bold" style={{ color: typeColor }}>{type === 'income' ? '+' : '-'}{fmtCOP(typeTotal)}</span>
                                </div>
                                {typeTxs.map(tx => <TxRow key={tx.id} tx={tx} onEdit={openEdit} onDelete={id => setDeleteConfirm(id)} />)}
                              </div>
                            );
                          })}
                          {filteredByPeriod.length === 0 && <EmptyState label={t.noTransactions} desc={t.noTransactionsDesc} onAdd={() => setModalMode('selection')} btnLabel={t.addNow} />}
                        </div>
                      )}
                    </div>
                  </div>

                  {goals.length > 0 && (
                    <div className="card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-bold text-base">{t.savingGoals}</h3>
                        <button onClick={() => setActiveView('savings')} className="text-indigo-400 hover:text-indigo-600 transition-colors"><ChevronRight size={18} /></button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {goals.slice(0, 4).map(g => (
                          <GoalCard key={g.id} goal={g} progressLabel={t.progress} completedLabel={t.completed}
                            onEdit={() => { setEditingGoal(g); setGoalForm({ name: g.name, targetAmount: g.targetAmount.toString(), currentAmount: g.currentAmount.toString(), deadline: g.deadline, emoji: g.emoji, color: g.color }); setModalMode('goal-form'); }}
                            onDelete={() => setGoals(prev => prev.filter(x => x.id !== g.id))} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── INCOME / EXPENSES / SAVINGS ── */}
              {(activeView === 'income' || activeView === 'expenses' || activeView === 'savings') && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="card p-6">
                      <h3 className="font-display font-bold text-base mb-4">{t.categoryDistribution}</h3>
                      {pieData.length > 0 ? (
                        <>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                                  {pieData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v: any) => [`$${Number(v).toLocaleString('es-CO')}`, '']} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {pieData.slice(0, 6).map((item, i) => (
                              <div key={item.name} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                                <span className="text-xs text-zinc-500 truncate">{item.name}</span>
                                <span className="text-xs font-bold ml-auto">{fmtCOP(item.value)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : <EmptyState label={t.noTransactions} desc={t.noTransactionsDesc} onAdd={() => openAdd(activeView === 'income' ? 'income' : activeView === 'expenses' ? 'expense' : 'saving')} btnLabel={t.addNow} />}
                    </div>

                    <div className="card p-6">
                      <h3 className="font-display font-bold text-base mb-4">{t.monthlyTrend} {filterYear}</h3>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} barSize={18}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                            <YAxis hide />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v: any) => [`$${Number(v).toLocaleString('es-CO')}`, '']} />
                            <Bar dataKey={activeView === 'income' ? 'income' : activeView === 'expenses' ? 'expense' : 'saving'} fill={activeView === 'income' ? '#10b981' : activeView === 'expenses' ? '#ef4444' : '#6366f1'} radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {activeView === 'savings' && (
                    <div className="card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-bold text-base">{t.savingGoals}</h3>
                        <button onClick={() => { setEditingGoal(null); setGoalForm({ name: '', targetAmount: '', currentAmount: '', deadline: '', emoji: '🎯', color: GOAL_COLORS[0] }); setModalMode('goal-form'); }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all">
                          <Plus size={13} /> {t.addGoal}
                        </button>
                      </div>
                      {goals.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                          {goals.map(g => (
                            <GoalCard key={g.id} goal={g} progressLabel={t.progress} completedLabel={t.completed}
                              onEdit={() => { setEditingGoal(g); setGoalForm({ name: g.name, targetAmount: g.targetAmount.toString(), currentAmount: g.currentAmount.toString(), deadline: g.deadline, emoji: g.emoji, color: g.color }); setModalMode('goal-form'); }}
                              onDelete={() => setGoals(prev => prev.filter(x => x.id !== g.id))} />
                          ))}
                        </div>
                      ) : (
                        <div className="py-10 text-center">
                          <div className="text-4xl mb-3">🎯</div>
                          <button onClick={() => { setEditingGoal(null); setGoalForm({ name: '', targetAmount: '', currentAmount: '', deadline: '', emoji: '🎯', color: GOAL_COLORS[0] }); setModalMode('goal-form'); }}
                            className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all">{t.addGoal}</button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                      <h3 className="font-display font-bold text-base">{t.listOf} {activeView === 'income' ? t.income : activeView === 'expenses' ? t.expenses : t.savings}</h3>
                      <span className="text-xs text-zinc-400 bg-zinc-50 px-2 py-1 rounded-lg">{filteredTransactions.length} {t.records}</span>
                    </div>
                    <div className="p-4 space-y-1">
                      {filteredTransactions.length > 0
                        ? filteredTransactions.map(tx => <TxRow key={tx.id} tx={tx} onEdit={openEdit} onDelete={id => setDeleteConfirm(id)} />)
                        : <EmptyState label={t.noRecords} desc={t.noRecordsDesc} onAdd={() => openAdd(activeView === 'income' ? 'income' : activeView === 'expenses' ? 'expense' : 'saving')} btnLabel={t.createFirst} />}
                    </div>
                  </div>
                </div>
              )}

              {/* ── BUDGETS ── */}
              {activeView === 'budgets' && (
                <div className="space-y-5">
                  {/* Budget alert */}
                  {alerts.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                      <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-800 text-sm">{t.overBudget}</p>
                        <p className="text-red-600 text-xs mt-0.5">{alerts.join(', ')}</p>
                      </div>
                    </div>
                  )}

                  {/* Budget categories with progress bars */}
                  <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-bold text-base">{t.expenseCategs}</h3>
                      <button onClick={() => setModalMode('budget-chat')}
                        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all">
                        <Bot size={13} /> {t.setupWith}
                      </button>
                    </div>
                    <div className="space-y-4">
                      {EXPENSE_CATEGORIES.map(cat => {
                        const allocated = allocatedBudgets[cat.id] || 0;
                        const spent = spentPerCategory[cat.id] || 0;
                        const remaining = allocated - spent;
                        const pct = allocated > 0 ? (spent / allocated) * 100 : 0;
                        const Icon = cat.icon;
                        return (
                          <div key={cat.id} className="p-4 bg-zinc-50/50 rounded-2xl border border-zinc-100">
                            <div className="flex items-center gap-3 mb-2.5">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: getBarBg(pct), color: getBarColor(pct) }}><Icon size={17} /></div>
                              <div className="flex-1">
                                <p className="font-semibold text-sm">{cat[lang]}</p>
                                <p className="text-xs text-zinc-400">{t.spent}: {fmtCOP(spent)} / {fmtCOP(allocated)}</p>
                              </div>
                              <div className="text-right">
                                <p className={cn("text-sm font-bold", remaining < 0 ? "text-red-500" : remaining < allocated * 0.2 ? "text-amber-500" : "text-emerald-600")}>
                                  {remaining < 0 ? `-${fmtCOP(Math.abs(remaining))}` : fmtCOP(remaining)}
                                </p>
                                <p className="text-[10px] text-zinc-400">{t.available}</p>
                              </div>
                            </div>
                            <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
                                className="h-full rounded-full" style={{ background: getBarColor(pct) }} />
                            </div>
                            {remaining < 0 && (
                              <p className="text-xs text-red-500 mt-2 font-medium">
                                ⚠️ {t.overBudgetWarning} {cat[lang]} {lang === 'es' ? 'por' : 'by'} {fmtCOP(Math.abs(remaining))}.
                                {undistributedAmount > 0 && ` ${t.unassignedWarning} — ${t.assignMore}`}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Savings allocated */}
                  <div className="card p-6">
                    <h3 className="font-display font-bold text-base mb-4">{t.savingsInvestment}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {SAVINGS_CATS.map(cat => {
                        const allocated = allocatedBudgets[cat.id] || 0;
                        const Icon = cat.icon;
                        return (
                          <div key={cat.id} className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600"><Icon size={17} /></div>
                            <div>
                              <p className="text-sm font-medium text-zinc-700">{cat[lang]}</p>
                              <p className="text-lg font-display font-bold text-indigo-600">{fmtCOP(allocated)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Editable Distribution Guide */}
                  <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                      <h3 className="font-display font-bold text-base">{t.distributionGuide} ({budgetPlan.frequency === 'quincenal' ? (lang === 'es' ? 'Quincenal' : 'Biweekly') : budgetPlan.frequency === 'semanal' ? (lang === 'es' ? 'Semanal' : 'Weekly') : (lang === 'es' ? 'Mensual' : 'Monthly')})</h3>
                    </div>

                    {/* Table header */}
                    <div className="grid gap-2 px-6 py-3 bg-zinc-50 border-b border-zinc-100" style={{ gridTemplateColumns: `1fr ${periodLabels.map(() => '100px').join(' ')} 100px` }}>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{t.category}</span>
                      {periodLabels.map((label, i) => (
                        <span key={i} className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-right">{label}</span>
                      ))}
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-right">{t.total}</span>
                    </div>

                    {/* Expense rows - EDITABLE */}
                    <div className="px-6 py-2 bg-indigo-50/30 border-b border-zinc-100">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">{t.expenseCategs}</span>
                    </div>
                    {EXPENSE_CATEGORIES.map((cat, idx) => {
                      const total = budgetPlan.budgets[cat.id] || 0;
                      const perPeriod = Math.round(total / periods);
                      const Icon = cat.icon;
                      return (
                        <div key={cat.id} className={cn("grid gap-2 px-6 py-2.5 border-b border-zinc-50 items-center", idx % 2 === 0 ? "" : "bg-zinc-50/30")}
                          style={{ gridTemplateColumns: `1fr ${periodLabels.map(() => '100px').join(' ')} 100px` }}>
                          <div className="flex items-center gap-2 text-sm text-zinc-700"><Icon size={13} className="text-zinc-400" /> {cat[lang]}</div>
                          {periodLabels.map((_, i) => (
                            <span key={i} className="text-sm text-zinc-500 text-right">{fmtCOP(perPeriod)}</span>
                          ))}
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">$</span>
                            <input
                              type="text"
                              value={total.toLocaleString('es-CO')}
                              onChange={e => {
                                const num = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                                updateBudgetPlanAmount(cat.id, num);
                              }}
                              className="w-full bg-white border border-zinc-200 rounded-lg py-1 pl-5 pr-2 text-sm font-bold text-right focus:ring-2 focus:ring-indigo-300 outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Savings rows - EDITABLE */}
                    <div className="px-6 py-2 bg-emerald-50/30 border-b border-zinc-100">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{t.savingsInvestment}</span>
                    </div>
                    {SAVINGS_CATS.map((cat, idx) => {
                      const total = budgetPlan.budgets[cat.id] || 0;
                      const perPeriod = Math.round(total / periods);
                      const Icon = cat.icon;
                      return (
                        <div key={cat.id} className={cn("grid gap-2 px-6 py-2.5 border-b border-zinc-50 items-center", idx % 2 === 0 ? "" : "bg-zinc-50/30")}
                          style={{ gridTemplateColumns: `1fr ${periodLabels.map(() => '100px').join(' ')} 100px` }}>
                          <div className="flex items-center gap-2 text-sm text-zinc-700"><Icon size={13} className="text-zinc-400" /> {cat[lang]}</div>
                          {periodLabels.map((_, i) => (
                            <span key={i} className="text-sm text-zinc-500 text-right">{fmtCOP(perPeriod)}</span>
                          ))}
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">$</span>
                            <input
                              type="text"
                              value={total.toLocaleString('es-CO')}
                              onChange={e => {
                                const num = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                                updateBudgetPlanAmount(cat.id, num);
                              }}
                              className="w-full bg-white border border-zinc-200 rounded-lg py-1 pl-5 pr-2 text-sm font-bold text-right focus:ring-2 focus:ring-indigo-300 outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Totals */}
                    <div className="grid gap-2 px-6 py-3 bg-zinc-50" style={{ gridTemplateColumns: `1fr ${periodLabels.map(() => '100px').join(' ')} 100px` }}>
                      <span className="text-sm font-bold text-zinc-800">{t.total}</span>
                      {periodLabels.map((_, i) => (
                        <span key={i} className="text-sm font-bold text-indigo-600 text-right">{fmtCOP(Math.round(totalBudgetPlan / periods))}</span>
                      ))}
                      <span className="text-sm font-bold text-indigo-600 text-right">{fmtCOP(totalBudgetPlan)}</span>
                    </div>
                  </div>

                  {/* 50/30/20 Rule visualization */}
                  <div className="card p-6">
                    <h3 className="font-display font-bold text-base mb-4">{t.rule503020}</h3>
                    {[
                      { label: t.needs, pct: 50, color: '#6366f1',
                        actual: EXPENSE_CATEGORIES.filter(c => c.group === 'necesidades').reduce((a, c) => a + (budgetPlan.budgets[c.id] || 0), 0) },
                      { label: t.wants, pct: 30, color: '#f59e0b',
                        actual: EXPENSE_CATEGORIES.filter(c => c.group === 'caprichos').reduce((a, c) => a + (budgetPlan.budgets[c.id] || 0), 0) },
                      { label: t.savingsLabel, pct: 20, color: '#10b981',
                        actual: SAVINGS_CATS.reduce((a, c) => a + (budgetPlan.budgets[c.id] || 0), 0) },
                    ].map(item => {
                      const ideal = budgetPlan.income * (item.pct / 100);
                      const actualPct = budgetPlan.income > 0 ? Math.round((item.actual / budgetPlan.income) * 100) : 0;
                      return (
                        <div key={item.label} className="mb-4">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-sm font-semibold">{item.label}</span>
                            <span className="text-xs text-zinc-500">
                              {actualPct}% ({fmtCOP(item.actual)}) — {t.goal}: {item.pct}% ({fmtCOP(ideal)})
                            </span>
                          </div>
                          <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden relative">
                            <div className="absolute top-0 bottom-0 w-0.5 bg-zinc-400/40 z-10" style={{ left: `${item.pct}%` }} />
                            <motion.div initial={{ width: 0 }} animate={{ width: `${actualPct}%` }} transition={{ duration: 0.8 }}
                              className="h-full rounded-full" style={{ background: item.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── MOBILE NAV ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-100 flex items-center justify-around px-2 py-2">
        {([['dashboard', LayoutDashboard], ['income', ArrowUpCircle], ['expenses', ArrowDownCircle], ['savings', PiggyBank], ['budgets', BarChart3]] as [View, any][]).map(([id, Icon]) => (
          <button key={id} onClick={() => setActiveView(id)} className={cn("relative flex flex-col items-center p-2.5 rounded-xl transition-all", activeView === id ? "text-indigo-600" : "text-zinc-400")}>
            <Icon size={20} />
            {id === 'budgets' && alerts.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
        ))}
      </nav>

      {/* ── MODALS ── */}
      <AnimatePresence>
        {modalMode !== 'closed' && modalMode !== 'allocate-income' && modalMode !== 'budget-chat' && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={() => setModalMode('closed')}>
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">

              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-lg">
                  {modalMode === 'selection' ? t.whatRecord : modalMode === 'income-form' ? t.registerIncome : modalMode === 'expense-form' ? t.registerExpense : modalMode === 'saving-form' ? t.registerSaving : modalMode === 'edit-form' ? t.edit : modalMode === 'goal-form' ? t.savingGoals : modalMode === 'budget-form' ? t.budgetLimits : t.aiInsights}
                </h3>
                <button onClick={() => setModalMode('closed')} className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 transition-all"><X size={18} /></button>
              </div>

              {/* Selection */}
              {modalMode === 'selection' && (
                <div className="grid gap-3">
                  {([
                    ['income', '#10b981', '#f0fdf4', ArrowUpCircle, t.income, t.moneyIn],
                    ['expense', '#ef4444', '#fef2f2', ArrowDownCircle, t.expenses, t.moneyOut],
                    ['saving', '#6366f1', '#eef2ff', PiggyBank, t.savings, t.moneySaved],
                  ] as const).map(([type, color, bg, Icon, label, desc]) => (
                    <button key={type} onClick={() => openAdd(type as any)}
                      className="flex items-center gap-4 p-4 rounded-2xl border-2 border-transparent hover:border-current transition-all text-left"
                      style={{ background: bg, color }}>
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0" style={{ background: color }}><Icon size={20} /></div>
                      <div><p className="font-bold">{label}</p><p className="text-xs opacity-70">{desc}</p></div>
                    </button>
                  ))}
                </div>
              )}

              {/* Transaction Form */}
              {(modalMode === 'income-form' || modalMode === 'expense-form' || modalMode === 'saving-form' || modalMode === 'edit-form') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.amount}</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                      <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" autoFocus
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 pl-8 pr-4 font-bold text-lg focus:ring-2 focus:ring-indigo-300 outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.category}</label>
                      <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-3 font-medium focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
                        {formCats.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.date}</label>
                      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-3 font-medium focus:ring-2 focus:ring-indigo-300 outline-none text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.note}</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="..."
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-300 outline-none resize-none h-20 text-sm" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setModalMode('closed')} className="flex-1 bg-zinc-100 text-zinc-700 py-3.5 rounded-2xl font-semibold hover:bg-zinc-200 transition-all">{t.cancel}</button>
                    <button onClick={() => handleSaveTransaction(currentTypeForForm)}
                      className="flex-[2] text-white py-3.5 rounded-2xl font-bold transition-all shadow-md active:scale-[0.98]"
                      style={{ background: currentTypeForForm === 'income' ? '#10b981' : currentTypeForForm === 'expense' ? '#ef4444' : '#6366f1' }}>
                      {t.save}
                    </button>
                  </div>
                </div>
              )}

              {/* Goal Form */}
              {modalMode === 'goal-form' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.emoji}</label>
                      <select value={goalForm.emoji} onChange={e => setGoalForm(f => ({ ...f, emoji: e.target.value }))}
                        className="w-16 bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-1 text-xl focus:ring-2 focus:ring-indigo-300 outline-none text-center">
                        {GOAL_EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.goalName}</label>
                      <input value={goalForm.name} onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))} placeholder="Mi meta..."
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-300 outline-none text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.targetAmount}</label>
                      <input type="number" value={goalForm.targetAmount} onChange={e => setGoalForm(f => ({ ...f, targetAmount: e.target.value }))} placeholder="5000000"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-300 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.currentAmount}</label>
                      <input type="number" value={goalForm.currentAmount} onChange={e => setGoalForm(f => ({ ...f, currentAmount: e.target.value }))} placeholder="0"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-300 outline-none text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.deadline}</label>
                      <input type="date" value={goalForm.deadline} onChange={e => setGoalForm(f => ({ ...f, deadline: e.target.value }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-300 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Color</label>
                      <div className="flex gap-2 pt-2 flex-wrap">
                        {GOAL_COLORS.map(c => (
                          <button key={c} onClick={() => setGoalForm(f => ({ ...f, color: c }))}
                            className={cn("w-6 h-6 rounded-full transition-all", goalForm.color === c ? "scale-125 ring-2 ring-offset-1 ring-current" : "")}
                            style={{ background: c }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setModalMode('closed')} className="flex-1 bg-zinc-100 text-zinc-700 py-3.5 rounded-2xl font-semibold hover:bg-zinc-200 transition-all">{t.cancel}</button>
                    <button onClick={handleSaveGoal} className="flex-[2] bg-indigo-600 text-white py-3.5 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-md">{t.save}</button>
                  </div>
                </div>
              )}

              {/* Budget Form (legacy, keeping for backward compat) */}
              {modalMode === 'budget-form' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.category}</label>
                    <select value={budgetForm.category} onChange={e => setBudgetForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
                      <option value="">-- {t.category} --</option>
                      {t.expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.limit} ($)</label>
                      <input type="number" value={budgetForm.limit} onChange={e => setBudgetForm(f => ({ ...f, limit: e.target.value }))} placeholder="500000"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-300 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{t.period}</label>
                      <select value={budgetForm.period} onChange={e => setBudgetForm(f => ({ ...f, period: e.target.value as any }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-300 outline-none text-sm">
                        <option value="monthly">{t.monthly}</option>
                        <option value="weekly">{t.weekly}</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setModalMode('closed')} className="flex-1 bg-zinc-100 text-zinc-700 py-3.5 rounded-2xl font-semibold hover:bg-zinc-200 transition-all">{t.cancel}</button>
                    <button onClick={handleSaveBudget} className="flex-[2] bg-indigo-600 text-white py-3.5 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-md">{t.save}</button>
                  </div>
                </div>
              )}

              {/* AI Insights */}
              {modalMode === 'ai-insights' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 text-center border border-indigo-100">
                    <div className="text-3xl mb-2">🤖</div>
                    <p className="text-sm text-indigo-700 font-medium">{t.insightsPlaceholder}</p>
                  </div>
                  {aiLoading && (
                    <div className="flex items-center justify-center gap-3 py-8">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <Sparkles size={20} className="text-indigo-500" />
                      </motion.div>
                      <span className="text-sm text-zinc-500">{t.analyzing}</span>
                    </div>
                  )}
                  {aiResponse && !aiLoading && (
                    <div className="bg-zinc-50 rounded-2xl p-4 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap border border-zinc-100">
                      {aiResponse}
                    </div>
                  )}
                  <button onClick={handleAIInsights} disabled={aiLoading}
                    className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-200">
                    <Sparkles size={16} />{t.askAI}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Allocation Modal */}
        {modalMode === 'allocate-income' && allocatingIncome && (
          <AllocationModal
            income={allocatingIncome}
            budgetPlan={budgetPlan}
            lang={lang}
            onComplete={handleAllocationComplete}
            onClose={() => { setAllocatingIncome(null); setModalMode('closed'); }}
          />
        )}

        {/* Budget Onboarding Chat */}
        {modalMode === 'budget-chat' && (
          <BudgetOnboardingChat
            lang={lang}
            onComplete={handleBudgetPlanUpdate}
            onClose={() => setModalMode('closed')}
          />
        )}

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-500" /></div>
              <p className="font-display font-bold text-lg mb-1">{t.confirmDelete}</p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-zinc-100 text-zinc-700 py-3 rounded-2xl font-semibold">{t.cancel}</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-bold hover:bg-red-600 transition-all">{t.delete}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SUB COMPONENTS ───────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, accent, bg, active, onClick }: { label: string; value: number; icon: any; accent: string; bg: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("card p-4 text-left transition-all hover:shadow-md w-full active:scale-[0.98]", active && "ring-2 ring-indigo-400 ring-offset-1")}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: bg, color: accent }}><Icon size={18} /></div>
        <ChevronRight size={13} className="text-zinc-300" />
      </div>
      <p className="text-zinc-500 text-xs font-medium mb-0.5">{label}</p>
      <p className="text-xl font-display font-bold" style={{ color: accent }}>{fmtCOP(value)}</p>
    </button>
  );
}

function TxRow({ tx, onEdit, onDelete }: { tx: Transaction; onEdit: (tx: Transaction) => void; onDelete: (id: string) => void }) {
  const color = tx.type === 'income' ? '#10b981' : tx.type === 'expense' ? '#ef4444' : '#6366f1';
  const bg = tx.type === 'income' ? '#f0fdf4' : tx.type === 'expense' ? '#fef2f2' : '#eef2ff';
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-zinc-50 group transition-all">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg, color }}>{getCategoryIcon(tx.category)}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{tx.category}</p>
        <p className="text-xs text-zinc-400 truncate">{tx.description || '—'}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-bold text-sm" style={{ color }}>{tx.type === 'income' ? '+' : '-'}{fmtCOP(tx.amount)}</p>
        <p className="text-[10px] text-zinc-400">{tx.date}</p>
      </div>
      <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
        <button onClick={() => onEdit(tx)} className="p-1.5 rounded-lg hover:bg-indigo-100 text-zinc-300 hover:text-indigo-600 transition-all"><Pencil size={12} /></button>
        <button onClick={() => onDelete(tx.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-zinc-300 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function GoalCard({ goal, onEdit, onDelete, progressLabel, completedLabel }: { goal: SavingGoal; onEdit: () => void; onDelete: () => void; progressLabel: string; completedLabel: string }) {
  const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  const done = pct >= 100;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{goal.emoji}</span>
          <div>
            <p className="font-semibold text-sm">{goal.name}</p>
            <p className="text-xs text-zinc-400">{goal.deadline || '—'}</p>
          </div>
        </div>
        <div className="flex gap-0.5">
          <button onClick={onEdit} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-300 hover:text-zinc-600 transition-all"><Pencil size={11} /></button>
          <button onClick={onDelete} className="p-1 rounded-lg hover:bg-red-100 text-zinc-300 hover:text-red-500 transition-all"><Trash2 size={11} /></button>
        </div>
      </div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-zinc-500">{fmtCOP(goal.currentAmount)}</span>
        <span className="font-bold">{fmtCOP(goal.targetAmount)}</span>
      </div>
      <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full" style={{ background: done ? '#10b981' : goal.color }} />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-zinc-400">{pct.toFixed(0)}% {progressLabel}</span>
        {done && <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check size={10} />{completedLabel}</span>}
      </div>
    </div>
  );
}

function EmptyState({ label, desc, onAdd, btnLabel }: { label: string; desc: string; onAdd: () => void; btnLabel: string }) {
  return (
    <div className="py-12 flex flex-col items-center text-center">
      <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center mb-3 text-zinc-300"><Wallet size={26} /></div>
      <p className="font-display font-semibold text-zinc-800">{label}</p>
      <p className="text-zinc-400 text-sm mt-1 mb-5">{desc}</p>
      <button onClick={onAdd} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">{btnLabel}</button>
    </div>
  );
}
