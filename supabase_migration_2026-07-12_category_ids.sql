-- GetFlowFi — Migración: categorías de texto libre → IDs internos
-- Fecha: 2026-07-12
-- Correr UNA VEZ en: Supabase Dashboard → SQL Editor → Run (es idempotente, re-correrla no daña nada).
--
-- Contexto: hasta ahora las transacciones guardaban la etiqueta visible
-- ("Transporte" o "Transportation" según el idioma activo al guardar).
-- Desde hoy la app guarda el ID interno y traduce solo al mostrar.
-- Este script convierte el histórico. Las categorías que no matcheen
-- (de versiones muy viejas de la app) quedan como están: la UI las muestra
-- tal cual como texto, no se pierde nada.

-- ─── GASTOS ───────────────────────────────────────────────────────────────────
UPDATE transactions SET category = 'transporte'        WHERE category IN ('Transporte', 'Transportation');
UPDATE transactions SET category = 'salidas'           WHERE category IN ('Salidas', 'Going Out');
UPDATE transactions SET category = 'viajes'            WHERE category IN ('Viajes', 'Travel');
UPDATE transactions SET category = 'gastos_personales' WHERE category IN ('Gastos Personales', 'Personal');
UPDATE transactions SET category = 'imprevistos'       WHERE category IN ('Imprevistos / Otros', 'Unexpected / Other');
UPDATE transactions SET category = 'salud'             WHERE category IN ('Salud', 'Health');
UPDATE transactions SET category = 'suscripciones'     WHERE category IN ('Suscripciones', 'Subscriptions');
UPDATE transactions SET category = 'gastos_hogar'      WHERE category IN ('Gastos Hogar', 'Home Expenses');

-- ─── INGRESOS ─────────────────────────────────────────────────────────────────
UPDATE transactions SET category = 'salario'        WHERE category IN ('Salario', 'Salary');
UPDATE transactions SET category = 'freelance'      WHERE category = 'Freelance';
UPDATE transactions SET category = 'inversion'      WHERE category IN ('Inversión', 'Investment') AND type = 'income';
UPDATE transactions SET category = 'regalo'         WHERE category IN ('Regalo', 'Gift');
UPDATE transactions SET category = 'negocio'        WHERE category IN ('Negocio', 'Business');
UPDATE transactions SET category = 'otros_ingresos' WHERE category IN ('Otros', 'Other') AND type = 'income';

-- ─── VERIFICACIÓN ─────────────────────────────────────────────────────────────
-- Después de correr, esto lista lo que quedó sin mapear (esperado: solo
-- categorías legacy tipo 'Alimentación', 'Ahorro General', o filas type='saving').
SELECT category, type, COUNT(*) AS filas
FROM transactions
WHERE category NOT IN (
  'transporte','salidas','viajes','gastos_personales','imprevistos','salud','suscripciones','gastos_hogar',
  'salario','freelance','inversion','regalo','negocio','otros_ingresos'
)
GROUP BY category, type
ORDER BY filas DESC;
