// ─── GetFlowFi Date Helpers ───────────────────────────────────────────────────
// La columna `date` de transactions es DATE (un día del calendario, SIN zona
// horaria). Postgres no la convierte ni al escribir ni al leer: guarda y devuelve
// el mismo string "YYYY-MM-DD". Por eso el día tiene que calcularse SIEMPRE con el
// reloj local del dispositivo y nunca pasar por UTC.
//
// El bug que esto reemplaza:
//   new Date().toISOString().split('T')[0]  → devuelve el día en UTC. En Bogotá
//   (UTC-5) un gasto de las 8 p.m. quedaba fechado al día siguiente; en Tokio
//   (UTC+9) uno de las 8 a.m. quedaba fechado el día anterior.
//
//   new Date("2026-07-01").getMonth()  → parsea como medianoche UTC pero lee en
//   local, así que en offsets negativos el día 1 caía en el mes anterior y
//   desaparecía del filtro mensual.
//
// Ambos helpers son agnósticos de zona horaria: funcionan igual en cualquier país.

/** "Hoy" según el reloj local del dispositivo, en formato YYYY-MM-DD. */
export function todayLocal(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Parsea "YYYY-MM-DD" como fecha LOCAL (medianoche local, no UTC), de modo que
 * getMonth()/getFullYear()/getDate() devuelvan exactamente el día guardado en
 * cualquier zona horaria. Aguanta también los países donde el horario de verano
 * se salta la medianoche: JS ajusta a la 1 a.m. y el día del calendario se mantiene.
 */
export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
