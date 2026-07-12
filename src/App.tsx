/**
 * GetFlowFi — Tracker de finanzas simple
 * Modelo: 2 tipos de transacción (ingreso/gasto), balance = ahorros (all-time),
 * presupuesto mensual fijo por categoría, bolsillos virtuales (Fase 3).
 * Ver PROJECT_PLAN.md en la raíz del proyecto.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard, ArrowUpCircle, ArrowDownCircle, PiggyBank, Plus,
  TrendingUp, Wallet, Calendar, ChevronRight, Coffee, ShoppingBag,
  Car, Home, Smartphone, Heart, Zap, Briefcase, Utensils,
  GraduationCap, Plane, Gamepad2, Gift, Trash2, Pencil, X,
  AlertTriangle, Globe, Check, BarChart3, Bell, Shield, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  onAuthStateChange, signInWithEmail, signUpWithEmail, signOut,
  fetchTransactions, saveTransaction, updateTransaction, deleteTransaction,
  fetchGoals, saveGoal, updateGoal, deleteGoal,
  fetchBudgetPlan, upsertBudgetPlan,
  migrateLocalStorageToSupabase,
} from './lib/db';
import type { TxRow, GoalRow, BudgetRow } from './lib/database.types';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// ─── TYPES ────────────────────────────────────────────────────────────────────
type View = 'dashboard' | 'income' | 'expenses' | 'savings' | 'budgets';
type Lang = 'es' | 'en';
type ModalMode = 'closed' | 'selection' | 'income-form' | 'expense-form' | 'edit-form' | 'goal-form';

interface Transaction {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
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

interface BudgetPlan {
  income: number;
  frequency: 'semanal' | 'quincenal' | 'mensual'; // sin uso — se limpia junto con la DB en Fase 5
  budgets: Record<string, number>; // monto mensual fijo por categoría
  setupDone: boolean;
  currentMonth: string; // sin uso — se limpia junto con la DB en Fase 5
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
// Las transacciones guardan SIEMPRE el `id` (nunca la etiqueta visible).
// La etiqueta se resuelve al mostrar según el idioma activo.
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

const INCOME_CATEGORIES = [
  { id: 'salario', es: 'Salario', en: 'Salary', icon: Briefcase },
  { id: 'freelance', es: 'Freelance', en: 'Freelance', icon: Briefcase },
  { id: 'inversion', es: 'Inversión', en: 'Investment', icon: TrendingUp },
  { id: 'regalo', es: 'Regalo', en: 'Gift', icon: Gift },
  { id: 'negocio', es: 'Negocio', en: 'Business', icon: Briefcase },
  { id: 'otros_ingresos', es: 'Otros', en: 'Other', icon: Wallet },
];

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

function catById(id: string) {
  return ALL_CATEGORIES.find(c => c.id === id);
}

// Fallback: filas viejas (pre-migración) pueden traer la etiqueta como texto libre.
function categoryLabel(id: string, lang: Lang): string {
  return catById(id)?.[lang] ?? id;
}


// ─── i18n ─────────────────────────────────────────────────────────────────────
const T = {
  es: {
    appName: 'FinanzaFlow',
    dashboard: 'Resumen', income: 'Ingresos', expenses: 'Gastos',
    savings: 'Metas', budgets: 'Presupuesto',
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
    savings: 'Goals', budgets: 'Budget',
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

// Estado inicial real: sin presupuesto configurado hasta que el usuario lo cree.
const EMPTY_BUDGET_PLAN: BudgetPlan = {
  income: 0,
  frequency: 'mensual',
  budgets: {},
  setupDone: false,
  currentMonth: currentMonthKey,
};

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

// Ícono por ID de categoría; si es texto libre viejo, cae al matcher por keywords.
function getCategoryVisual(catId: string, size = 16) {
  const cat = catById(catId);
  if (cat) { const Icon = cat.icon; return <Icon size={size} />; }
  return getCategoryIcon(catId, size);
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

// ─── DB ROW MAPPERS ───────────────────────────────────────────────────────────
// Convert Supabase snake_case rows → app camelCase objects

// Las transacciones tipo 'saving' (modelo viejo) se filtran antes de llamar este mapper.
function dbRowToTransaction(row: TxRow): Transaction {
  return { id: row.id, amount: row.amount, category: row.category, description: row.description, date: row.date, type: row.type as 'income' | 'expense' };
}
function dbRowToGoal(row: GoalRow): SavingGoal {
  return { id: row.id, name: row.name, targetAmount: row.target_amount, currentAmount: row.current_amount, deadline: row.deadline, emoji: row.emoji, color: row.color };
}
function dbRowToBudgetPlan(row: BudgetRow): BudgetPlan {
  return { income: row.income, frequency: row.frequency, budgets: (row.budgets as Record<string, number>) || {}, setupDone: row.setup_done, currentMonth: row.current_month };
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handle = async () => {
    if (!email || !password) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password);
        setSuccess('Cuenta creada. Revisa tu correo para confirmar. / Account created. Check your email.');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center p-4">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap'); body { font-family: 'DM Sans', sans-serif; }`}</style>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 bg-[#6366f1] rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <TrendingUp className="text-white" size={20} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>GetFlowFi</h1>
        </div>
        <div className="bg-white rounded-[20px] border border-black/[0.06] shadow-sm p-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-center">{mode === 'signin' ? 'Iniciar sesión / Sign in' : 'Crear cuenta / Sign up'}</h2>
          <input
            type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <input
            type="password" placeholder={mode === 'signin' ? 'Contraseña / Password' : 'Contraseña (mín. 6 caracteres)'} value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handle()}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          {success && <p className="text-green-600 text-xs text-center">{success}</p>}
          <button onClick={handle} disabled={loading}
            className="w-full bg-[#6366f1] text-white py-3 rounded-2xl font-semibold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-60">
            {loading ? '...' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
          </button>
          <button onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess(''); }}
            className="text-xs text-zinc-500 hover:text-indigo-600 transition-colors text-center">
            {mode === 'signin' ? '¿No tienes cuenta? Crear una / No account? Sign up' : '¿Ya tienes cuenta? Iniciar sesión / Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useLocalStorage<Lang>('ff_lang', 'es');
  // Auth
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Data — loaded from Supabase once authenticated
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan>(EMPTY_BUDGET_PLAN);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingGoal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth().toString());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [alerts, setAlerts] = useState<string[]>([]);
  const [showAllTx, setShowAllTx] = useState(false);

  const t = T[lang];

  const [form, setForm] = useState({ amount: '', category: '', date: new Date().toISOString().split('T')[0], description: '' });
  const [goalForm, setGoalForm] = useState({ name: '', targetAmount: '', currentAmount: '', deadline: '', emoji: '🎯', color: GOAL_COLORS[0] });

  // ── Auth: listen for sign-in / sign-out ──
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((id, email) => {
      setUserId(id);
      setUserEmail(email);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Data: load from Supabase whenever userId changes ──
  useEffect(() => {
    if (!userId) return;
    (async () => {
      await migrateLocalStorageToSupabase(userId);
      const [txs, gls, plan] = await Promise.all([
        fetchTransactions(userId),
        fetchGoals(userId),
        fetchBudgetPlan(userId),
      ]);
      // Transacciones 'saving' del modelo viejo quedan ocultas (no se borran de la DB)
      setTransactions(txs.filter(r => r.type !== 'saving').map(dbRowToTransaction));
      setGoals(gls.map(dbRowToGoal));
      if (plan) setBudgetPlan(dbRowToBudgetPlan(plan));
    })();
  }, [userId]);

  // ── Período filtrado (para vistas y resúmenes del mes) ──
  const filteredByPeriod = useMemo(() => transactions.filter(tx => {
    const d = new Date(tx.date);
    const mMatch = filterMonth === 'all' || d.getMonth().toString() === filterMonth;
    return mMatch && d.getFullYear().toString() === filterYear;
  }), [transactions, filterMonth, filterYear]);

  // Resumen del período seleccionado (por defecto: mes actual)
  const stats = useMemo(() => {
    const income = filteredByPeriod.filter(tx => tx.type === 'income').reduce((a, tx) => a + tx.amount, 0);
    const expenses = filteredByPeriod.filter(tx => tx.type === 'expense').reduce((a, tx) => a + tx.amount, 0);
    return { income, expenses, net: income - expenses };
  }, [filteredByPeriod]);

  // Balance total (= tus ahorros): TODO el historial, nunca filtrado por mes
  const totalBalance = useMemo(() => {
    return transactions.reduce((a, tx) => a + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
  }, [transactions]);

  // Gastado por categoría en el período seleccionado (vs presupuesto mensual)
  const spentPerCategory = useMemo(() => {
    const spent: Record<string, number> = {};
    EXPENSE_CATEGORIES.forEach(c => { spent[c.id] = 0; });
    filteredByPeriod.filter(tx => tx.type === 'expense').forEach(tx => {
      // Match por ID (modelo actual); etiquetas es/en cubren filas pre-migración
      const matchedCat = EXPENSE_CATEGORIES.find(c => c.id === tx.category || c.es === tx.category || c.en === tx.category);
      if (matchedCat) {
        spent[matchedCat.id] = (spent[matchedCat.id] || 0) + tx.amount;
      }
    });
    return spent;
  }, [filteredByPeriod]);

  // Budget alerts: gastado ≥ 90% del presupuesto mensual de la categoría
  useEffect(() => {
    const newAlerts: string[] = [];
    EXPENSE_CATEGORIES.forEach(cat => {
      const budget = budgetPlan.budgets[cat.id] || 0;
      const spent = spentPerCategory[cat.id] || 0;
      if (budget > 0 && spent >= budget * 0.9) {
        newAlerts.push(cat[lang]);
      }
    });
    setAlerts(newAlerts);
  }, [budgetPlan.budgets, spentPerCategory, lang]);

  const filteredTransactions = useMemo(() => {
    let base = [...filteredByPeriod];
    if (activeView === 'income') base = base.filter(tx => tx.type === 'income');
    else if (activeView === 'expenses') base = base.filter(tx => tx.type === 'expense');
    return base.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeView, filteredByPeriod]);

  const chartData = useMemo(() => t.months.map((name, i) => {
    const yearTx = transactions.filter(tx => new Date(tx.date).getFullYear().toString() === filterYear);
    return {
      name,
      income: yearTx.filter(tx => tx.type === 'income' && new Date(tx.date).getMonth() === i).reduce((a, tx) => a + tx.amount, 0),
      expense: yearTx.filter(tx => tx.type === 'expense' && new Date(tx.date).getMonth() === i).reduce((a, tx) => a + tx.amount, 0),
    };
  }).slice(0, new Date().getMonth() + 1), [transactions, filterYear, t]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredByPeriod.filter(tx => tx.type === 'expense').forEach(tx => {
      const label = categoryLabel(tx.category, lang);
      map[label] = (map[label] || 0) + tx.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredByPeriod, lang]);

  // Handlers
  const openAdd = (type: 'income' | 'expense') => {
    setEditingTransaction(null);
    const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setForm({ amount: '', category: cats[0].id, date: new Date().toISOString().split('T')[0], description: '' });
    setModalMode(`${type}-form` as ModalMode);
  };

  const openEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setForm({ amount: tx.amount.toString(), category: tx.category, date: tx.date, description: tx.description });
    setModalMode('edit-form');
  };

  // Se registra y listo — sin distribución, sin modales extra.
  const handleSaveTransaction = async (type: 'income' | 'expense') => {
    if (!form.amount || !form.category || !userId) return;
    const amount = parseFloat(form.amount);
    const txFields = { amount, category: form.category, date: form.date, description: form.description };

    if (editingTransaction) {
      setTransactions(prev => prev.map(tx => tx.id === editingTransaction.id ? { ...tx, ...txFields } : tx));
      await updateTransaction(editingTransaction.id, txFields);
    } else {
      const newId = crypto.randomUUID();
      const newTx: Transaction = { id: newId, ...txFields, type };
      setTransactions(prev => [newTx, ...prev]);
      await saveTransaction(userId, { id: newId, ...txFields, type });
    }
    setModalMode('closed');
  };

  const handleDelete = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    setDeleteConfirm(null);
    await deleteTransaction(id);
  };

  const handleSaveGoal = async () => {
    if (!goalForm.name || !goalForm.targetAmount || !userId) return;
    const goalData = { name: goalForm.name, targetAmount: parseFloat(goalForm.targetAmount), currentAmount: parseFloat(goalForm.currentAmount || '0'), deadline: goalForm.deadline, emoji: goalForm.emoji, color: goalForm.color };
    if (editingGoal) {
      setGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, ...goalData } : g));
      await updateGoal(editingGoal.id, { name: goalData.name, target_amount: goalData.targetAmount, current_amount: goalData.currentAmount, deadline: goalData.deadline, emoji: goalData.emoji, color: goalData.color });
    } else {
      const newId = crypto.randomUUID();
      setGoals(prev => [...prev, { id: newId, ...goalData }]);
      await saveGoal(userId, { id: newId, name: goalData.name, target_amount: goalData.targetAmount, current_amount: goalData.currentAmount, deadline: goalData.deadline, emoji: goalData.emoji, color: goalData.color });
    }
    setModalMode('closed');
    setEditingGoal(null);
  };

  // Editar el presupuesto mensual de una categoría — sync a Supabase
  const updateBudgetPlanAmount = async (catId: string, newAmount: number) => {
    const next: BudgetPlan = { ...budgetPlan, budgets: { ...budgetPlan.budgets, [catId]: newAmount }, setupDone: true };
    setBudgetPlan(next);
    if (userId) {
      await upsertBudgetPlan(userId, { income: next.income, frequency: next.frequency, budgets: next.budgets, setup_done: next.setupDone, current_month: next.currentMonth });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setTransactions([]);
    setGoals([]);
    setBudgetPlan(EMPTY_BUDGET_PLAN);
    setActiveView('dashboard');
  };

  const currentTypeForForm: 'income' | 'expense' = modalMode === 'income-form' ? 'income' : modalMode === 'expense-form' ? 'expense' : (editingTransaction?.type || 'income');
  const formCats = currentTypeForForm === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const pieData = useMemo(() => {
    if (activeView === 'expenses') return categoryData;
    const map: Record<string, number> = {};
    filteredTransactions.forEach(tx => {
      const label = categoryLabel(tx.category, lang);
      map[label] = (map[label] || 0) + tx.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [activeView, categoryData, filteredTransactions, lang]);

  // Auth gate — show loading or login before the main app
  if (authLoading) return (
    <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
  if (!userId) return <LoginScreen />;

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

        {/* Balance card — balance total all-time (= tus ahorros) */}
        <div className="mt-auto rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
          <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-1">{t.totalBalance}</p>
          <p className="text-2xl font-display font-bold text-white">{totalBalance < 0 ? '-' : ''}{fmtCOP(totalBalance)}</p>
        </div>

        {/* Cuenta: email + cerrar sesión + idioma */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-400 truncate px-1">{userEmail}</p>
          <div className="flex gap-2">
            <button onClick={() => setLang(l => l === 'es' ? 'en' : 'es')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-zinc-600 transition-all">
              <Globe size={13} /> {lang.toUpperCase()}
            </button>
            <button onClick={handleSignOut}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-500 transition-all">
              <LogOut size={13} /> {lang === 'es' ? 'Salir' : 'Sign out'}
            </button>
          </div>
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
            <button onClick={handleSignOut} className="md:hidden p-2 rounded-xl bg-red-50 text-red-500"><LogOut size={16} /></button>
            <button onClick={() => {
              if (activeView === 'income') openAdd('income');
              else if (activeView === 'expenses') openAdd('expense');
              else if (activeView === 'savings') { setEditingGoal(null); setGoalForm({ name: '', targetAmount: '', currentAmount: '', deadline: '', emoji: '🎯', color: GOAL_COLORS[0] }); setModalMode('goal-form'); }
              else setModalMode('selection');
            }} className="bg-[#6366f1] text-white px-4 py-2 rounded-xl flex items-center gap-1.5 font-semibold text-sm hover:bg-indigo-600 transition-all active:scale-95 shadow-md shadow-indigo-200">
              <Plus size={16} />
              <span className="hidden sm:inline">{activeView === 'savings' ? t.addGoal : t.newRecord}</span>
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

          {/* Stats */}
          {(activeView === 'dashboard' || activeView === 'budgets') && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <StatCard label={t.income} value={stats.income} icon={ArrowUpCircle} accent="#10b981" bg="#f0fdf4" active={false} onClick={() => setActiveView('income')} />
              <StatCard label={t.expenses} value={stats.expenses} icon={ArrowDownCircle} accent="#ef4444" bg="#fef2f2" active={false} onClick={() => setActiveView('expenses')} />
              <StatCard label={t.totalBalance} value={totalBalance} icon={Wallet} accent={totalBalance >= 0 ? '#0f0f0f' : '#ef4444'} bg="#f9fafb" active={false} onClick={() => setActiveView('dashboard')} />
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
                          const allocated = budgetPlan.budgets[cat.id] || 0;
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
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} dy={8} />
                            <YAxis hide />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v: any) => [`$${Number(v).toLocaleString('es-CO')}`, '']} />
                            <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#gi)" strokeWidth={2} />
                            <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#ge)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex gap-4 mt-2 justify-center">
                        {[['#10b981', t.income], ['#ef4444', t.expenses]].map(([color, label]) => (
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
                          {filteredByPeriod.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map(tx => (
                            <TxRow key={tx.id} tx={tx} lang={lang} onEdit={openEdit} onDelete={id => setDeleteConfirm(id)} />
                          ))}
                          {filteredByPeriod.length === 0 && <EmptyState label={t.noTransactions} desc={t.noTransactionsDesc} onAdd={() => setModalMode('selection')} btnLabel={t.addNow} />}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {(['income', 'expense'] as const).map(type => {
                            const typeTxs = filteredByPeriod.filter(tx => tx.type === type).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                            if (typeTxs.length === 0) return null;
                            const typeColor = type === 'income' ? '#10b981' : '#ef4444';
                            const typeLabel = type === 'income' ? t.income : t.expenses;
                            const typeTotal = typeTxs.reduce((a, tx) => a + tx.amount, 0);
                            return (
                              <div key={type} className="mb-4">
                                <div className="flex items-center justify-between mb-2 px-2">
                                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: typeColor }}>{typeLabel}</span>
                                  <span className="text-xs font-bold" style={{ color: typeColor }}>{type === 'income' ? '+' : '-'}{fmtCOP(typeTotal)}</span>
                                </div>
                                {typeTxs.map(tx => (
                                  <TxRow key={tx.id} tx={tx} lang={lang} onEdit={openEdit} onDelete={id => setDeleteConfirm(id)} />
                                ))}
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
                            onDelete={() => { setGoals(prev => prev.filter(x => x.id !== g.id)); deleteGoal(g.id); }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── INCOME / EXPENSES ── */}
              {(activeView === 'income' || activeView === 'expenses') && (
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
                      ) : <EmptyState label={t.noTransactions} desc={t.noTransactionsDesc} onAdd={() => openAdd(activeView === 'income' ? 'income' : 'expense')} btnLabel={t.addNow} />}
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
                            <Bar dataKey={activeView === 'income' ? 'income' : 'expense'} fill={activeView === 'income' ? '#10b981' : '#ef4444'} radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                      <h3 className="font-display font-bold text-base">{t.listOf} {activeView === 'income' ? t.income : t.expenses}</h3>
                      <span className="text-xs text-zinc-400 bg-zinc-50 px-2 py-1 rounded-lg">{filteredTransactions.length} {t.records}</span>
                    </div>
                    <div className="p-4 space-y-1">
                      {filteredTransactions.length > 0
                        ? filteredTransactions.map(tx => (
                            <TxRow key={tx.id} tx={tx} lang={lang} onEdit={openEdit} onDelete={id => setDeleteConfirm(id)} />
                          ))
                        : <EmptyState label={t.noRecords} desc={t.noRecordsDesc} onAdd={() => openAdd(activeView === 'income' ? 'income' : 'expense')} btnLabel={t.createFirst} />}
                    </div>
                  </div>
                </div>
              )}

              {/* ── METAS (Fase 3: se convierte en Bolsillos) ── */}
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
                          onDelete={() => { setGoals(prev => prev.filter(x => x.id !== g.id)); deleteGoal(g.id); }} />
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

              {/* ── PRESUPUESTO ── monto mensual fijo por categoría, gastado del período vs presupuesto */}
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

                  <div className="card p-6">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-display font-bold text-base">{t.budgets}</h3>
                    </div>
                    <p className="text-xs text-zinc-400 mb-4">{lang === 'es' ? 'Define tu presupuesto mensual por categoría. Se aplica todos los meses automáticamente.' : 'Set your monthly budget per category. It applies every month automatically.'}</p>
                    <div className="space-y-4">
                      {EXPENSE_CATEGORIES.map(cat => {
                        const budget = budgetPlan.budgets[cat.id] || 0;
                        const spent = spentPerCategory[cat.id] || 0;
                        const remaining = budget - spent;
                        const pct = budget > 0 ? (spent / budget) * 100 : 0;
                        const Icon = cat.icon;
                        return (
                          <div key={cat.id} className="p-4 bg-zinc-50/50 rounded-2xl border border-zinc-100">
                            <div className="flex items-center gap-3 mb-2.5">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: getBarBg(pct), color: getBarColor(pct) }}><Icon size={17} /></div>
                              <div className="flex-1">
                                <p className="font-semibold text-sm">{cat[lang]}</p>
                                <p className="text-xs text-zinc-400">{t.spent}: {fmtCOP(spent)}{budget > 0 && ` / ${fmtCOP(budget)}`}</p>
                              </div>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">$</span>
                                <input
                                  type="text"
                                  value={budget ? budget.toLocaleString('es-CO') : ''}
                                  placeholder="0"
                                  onChange={e => {
                                    const num = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                                    updateBudgetPlanAmount(cat.id, num);
                                  }}
                                  className="w-32 bg-white border border-zinc-200 rounded-lg py-1.5 pl-5 pr-2 text-sm font-bold text-right focus:ring-2 focus:ring-indigo-300 outline-none"
                                />
                              </div>
                            </div>
                            {budget > 0 && (
                              <>
                                <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
                                    className="h-full rounded-full" style={{ background: getBarColor(pct) }} />
                                </div>
                                {remaining < 0 && (
                                  <p className="text-xs text-red-500 mt-2 font-medium">
                                    ⚠️ {t.overBudgetWarning} {cat[lang]} {lang === 'es' ? 'por' : 'by'} {fmtCOP(Math.abs(remaining))}.
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
        {modalMode !== 'closed' && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={() => setModalMode('closed')}>
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">

              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-lg">
                  {modalMode === 'selection' ? t.whatRecord : modalMode === 'income-form' ? t.registerIncome : modalMode === 'expense-form' ? t.registerExpense : modalMode === 'edit-form' ? t.edit : t.savingGoals}
                </h3>
                <button onClick={() => setModalMode('closed')} className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 transition-all"><X size={18} /></button>
              </div>

              {/* Selection */}
              {modalMode === 'selection' && (
                <div className="grid gap-3">
                  {([
                    ['income', '#10b981', '#f0fdf4', ArrowUpCircle, t.income, t.moneyIn],
                    ['expense', '#ef4444', '#fef2f2', ArrowDownCircle, t.expenses, t.moneyOut],
                  ] as const).map(([type, color, bg, Icon, label, desc]) => (
                    <button key={type} onClick={() => openAdd(type)}
                      className="flex items-center gap-4 p-4 rounded-2xl border-2 border-transparent hover:border-current transition-all text-left"
                      style={{ background: bg, color }}>
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0" style={{ background: color }}><Icon size={20} /></div>
                      <div><p className="font-bold">{label}</p><p className="text-xs opacity-70">{desc}</p></div>
                    </button>
                  ))}
                </div>
              )}

              {/* Transaction Form */}
              {(modalMode === 'income-form' || modalMode === 'expense-form' || modalMode === 'edit-form') && (
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
                        {/* Transacción vieja con categoría de texto libre: se muestra tal cual hasta que el usuario elija una del listado */}
                        {form.category && !catById(form.category) && <option value={form.category}>{form.category}</option>}
                        {formCats.map(c => <option key={c.id} value={c.id}>{c[lang]}</option>)}
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
                      style={{ background: currentTypeForForm === 'income' ? '#10b981' : '#ef4444' }}>
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
            </motion.div>
          </div>
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

function TxRow({ tx, lang, onEdit, onDelete }: { key?: React.Key; tx: Transaction; lang: Lang; onEdit: (tx: Transaction) => void; onDelete: (id: string) => void }) {
  const color = tx.type === 'income' ? '#10b981' : '#ef4444';
  const bg = tx.type === 'income' ? '#f0fdf4' : '#fef2f2';
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-zinc-50 group transition-all">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg, color }}>{getCategoryVisual(tx.category)}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{categoryLabel(tx.category, lang)}</p>
        <p className="text-xs text-zinc-400 truncate">{tx.description || '—'}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-bold text-sm" style={{ color }}>{tx.type === 'income' ? '+' : '-'}{fmtCOP(tx.amount)}</p>
        <p className="text-[10px] text-zinc-400">{tx.date}</p>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(tx)} className="p-1.5 rounded-lg hover:bg-indigo-100 text-zinc-300 hover:text-indigo-600 transition-all"><Pencil size={12} /></button>
        <button onClick={() => onDelete(tx.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-zinc-300 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function GoalCard({ goal, onEdit, onDelete, progressLabel, completedLabel }: { key?: React.Key; goal: SavingGoal; onEdit: () => void; onDelete: () => void; progressLabel: string; completedLabel: string }) {
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
