# GetFlowFi

Tracker de finanzas personales simple, en español y pensado para COP. Registra ingresos y gastos en segundos, define un presupuesto mensual fijo por categoría y hazle seguimiento con gráficas.

**Modelo de datos** (ver `PROJECT_PLAN` en el Segundo Cerebro para el roadmap completo):

- **Transacciones:** solo `income` | `expense`. La categoría se guarda por **ID interno** (`transporte`, `salidas`…) y se traduce solo al mostrar.
- **Balance (= ahorros):** ingresos históricos − gastos históricos, nunca filtrado por mes.
- **Presupuesto:** monto mensual fijo por categoría (`budget_plan.budgets`). El gastado del mes se calcula al vuelo desde las transacciones — sin resets, sin borrar historial.
- **Bolsillos (Fase post-launch):** `saving_goals` reconvertida a bolsillos virtuales.

## Stack

React 19 · Vite 6 · Tailwind 4 · Recharts · Framer Motion · Supabase (auth + Postgres con RLS)

## Correr localmente

1. `npm install`
2. Copia `.env.example` a `.env` y llena las llaves de Supabase (Project Settings → API)
3. Si es un proyecto Supabase nuevo: pega `supabase_schema.sql` en el SQL Editor y córrelo una vez
4. `npm run dev` → http://localhost:3000

## Scripts

- `npm run dev` — servidor de desarrollo (puerto 3000)
- `npm run build` — build de producción a `dist/`
- `npm run lint` — chequeo de tipos (`tsc --noEmit`)

## Migraciones

Los cambios de datos posteriores al schema inicial viven en archivos `supabase_migration_*.sql` — correr en orden de fecha en el SQL Editor de Supabase.
