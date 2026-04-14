// ============================================================
// CONFIGURACIÓN DEL CRM
// ============================================================
//
// URL del Apps Script desplegado (backend de Google Sheets).
// Si cambia la implementación, actualizar también en api/proxy.js.
//
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_23_qeSIefcroRVovHosH68fccOWudjyhEEMQ9urQEwyDDY4OqyKHM19OK9fwlNUJiQ/exec'

// ============================================================
// ETAPAS DEL PIPELINE (7 etapas)
// ============================================================
export const STAGES = [
  { id: 'Agendado',        label: 'Agendado',        color: '#3b82f6', bg: '#eff6ff' },
  { id: 'J1 Realizada',    label: 'J1 Realizada',    color: '#6366f1', bg: '#eef2ff' },
  { id: 'Calificado',      label: 'Calificado',      color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'J2 Agendada',     label: 'J2 Agendada',     color: '#a855f7', bg: '#faf5ff' },
  { id: 'J2 Realizada',    label: 'J2 Realizada',    color: '#d946ef', bg: '#fdf4ff' },
  { id: 'Cerrado Ganado',  label: 'Cerrado Ganado',  color: '#10b981', bg: '#ecfdf5' },
  { id: 'Cerrado Perdido', label: 'Cerrado Perdido', color: '#64748b', bg: '#f1f5f9' },
]

// Stages "cerrados" — no entran en pipeline ponderado ni alertas de actividad
export const CLOSED_STAGES = new Set(['Cerrado Ganado', 'Cerrado Perdido'])

// ============================================================
// RAZONES DE PÉRDIDA (obligatorias al mover a Cerrado Perdido)
// ============================================================
export const RAZONES_PERDIDA = [
  'No calificó',
  'Fantasmeó',
  'Precio',
  'Timing',
  'Competencia',
  'Sin respuesta',
  'Otro',
]

// ============================================================
// PROBABILIDADES PONDERADAS POR ETAPA (para pipeline forecast)
// ============================================================
export const PROBABILIDADES_PONDERADAS = {
  'Agendado':        0.10,
  'J1 Realizada':    0.25,
  'Calificado':      0.40,
  'J2 Agendada':     0.65,
  'J2 Realizada':    0.85,
  'Cerrado Ganado':  1.00,
  'Cerrado Perdido': 0.00,
}

// ============================================================
// TIPOS DE PROGRAMA (para badge en card y dropdown en form)
// ============================================================
export const TIPOS_PROGRAMA = ['Ejecutivo', 'Empresarial']

// ============================================================
// POLÍTICA DE INACTIVIDAD — días máximos sin actividad por etapa.
// Si una card excede estos días, se marca con indicador visual.
// `null` = no aplicar alerta (stages cerrados).
// ============================================================
export const DIAS_INACTIVIDAD_POR_ETAPA = {
  'Agendado':        7,
  'J1 Realizada':    7,
  'Calificado':     14,
  'J2 Agendada':    14,
  'J2 Realizada':   14,
  'Cerrado Ganado':  null,
  'Cerrado Perdido': null,
}

// ============================================================
// LISTAS AUXILIARES (formularios)
// ============================================================
export const METODOS_PROSPECCION = [
  'Circulo Rojo',
  'Landing VSL',
  'Organico Redes',
  'Referido',
  'Otro',
]

export const PROBABILIDADES = [
  'Mas de 70%',
  'Alto',
  'Medio',
  'Bajo',
]

export const POTENCIALES = ['A', 'B', 'C']

// ============================================================
// HELPERS — fechas y métricas derivadas de oportunidades
// ============================================================

// Parsea "dd/mm/yyyy" (ignora cualquier hora posterior) a Date.
// Retorna null si la fecha es inválida o vacía.
export function parseDate(str) {
  if (!str || typeof str !== 'string') return null
  const datePart = str.split(' ')[0]
  const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10))
  return isNaN(d.getTime()) ? null : d
}

// Días enteros entre una fecha y hoy. null si fecha inválida.
export function diasDesde(fechaStr) {
  const d = parseDate(fechaStr)
  if (!d) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((hoy - d) / (1000 * 60 * 60 * 24))
}

// Edad de la oportunidad (días desde primer contacto).
// Fallback a fechaActualizacion si no hay primer contacto.
export function getEdadDias(opp) {
  return diasDesde(opp.fechaPrimerContacto) ?? diasDesde(opp.fechaActualizacion)
}

// Días sin actividad (desde ultimaActividad o fechaActualizacion).
export function getDiasSinActividad(opp) {
  return diasDesde(opp.ultimaActividad) ?? diasDesde(opp.fechaActualizacion)
}

// ¿La oportunidad está inactiva según política de su etapa?
// Retorna false si la etapa no tiene límite o no hay fecha.
export function estaInactiva(opp) {
  const limite = DIAS_INACTIVIDAD_POR_ETAPA[opp.estadoActual]
  if (limite == null) return false
  const dias = getDiasSinActividad(opp)
  return dias != null && dias > limite
}

// Valor ponderado de una oportunidad (monto * probabilidad de etapa).
export function getValorPonderado(opp) {
  const p = PROBABILIDADES_PONDERADAS[opp.estadoActual] ?? 0
  return (opp.monto || 0) * p
}

// Suma ponderada total de un array de oportunidades (solo activas).
export function getPipelinePonderado(opps) {
  return opps
    .filter(o => !CLOSED_STAGES.has(o.estadoActual))
    .reduce((sum, o) => sum + getValorPonderado(o), 0)
}

// ============================================================
// CARTERA — clientes activos con programa en curso
// ============================================================

// Estados posibles de un cliente en cartera.
// Solo "Activo" cuenta contra la capacidad máxima.
export const ESTADOS_CARTERA = ['Activo', 'Graduado', 'Pausado', 'Cancelado']

export const ESTADOS_CARTERA_ACTIVOS = new Set(['Activo'])

export const ESTADO_CARTERA_COLORS = {
  'Activo':    { bg: '#ecfdf5', color: '#059669' },
  'Graduado':  { bg: '#eef2ff', color: '#4f46e5' },
  'Pausado':   { bg: '#fef3c7', color: '#b45309' },
  'Cancelado': { bg: '#fee2e2', color: '#dc2626' },
}

// Defaults locales (el backend puede sobreescribir via /settings).
// Fuente de verdad: getDefaultSettings() en Code.v2.gs.
export const SETTINGS_DEFAULTS = {
  capacidadMaxima:          14,
  precioEjecutivoDefault:   3700,
  precioEmpresarialDefault: 7500,
  semanasEjecutivoDefault:  12,
  semanasEmpresarialDefault: 16,
}

// Formatea Date → "dd/mm/yyyy". '' si inválida.
export function formatFecha(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Devuelve la semana actual del programa (1-indexed).
// Ej: si hoy es día 15 desde fechaInicio, semana = ceil(15/7) = 3.
// Clamped a [1, semanasPrograma]; null si no hay fechaInicio.
export function getSemanaActual(cliente) {
  const dias = diasDesde(cliente.fechaInicio)
  if (dias == null) return null
  const total = parseFloat(cliente.semanasPrograma) || 0
  const semana = Math.max(1, Math.floor(dias / 7) + 1)
  return total > 0 ? Math.min(semana, total) : semana
}

// Fecha estimada de graduación: fechaInicio + semanasPrograma * 7 días.
// Retorna Date o null si faltan datos.
export function getFechaGraduacionEstimada(cliente) {
  const inicio = parseDate(cliente.fechaInicio)
  const semanas = parseFloat(cliente.semanasPrograma) || 0
  if (!inicio || semanas <= 0) return null
  const d = new Date(inicio)
  d.setDate(d.getDate() + Math.round(semanas * 7))
  return d
}

// Progreso en porcentaje [0, 100]. null si no hay datos.
export function getProgresoPrograma(cliente) {
  const total = parseFloat(cliente.semanasPrograma) || 0
  const semana = getSemanaActual(cliente)
  if (!total || semana == null) return null
  return Math.round((semana / total) * 100)
}

// ¿El cliente ocupa slot de capacidad?
export function ocupaCapacidad(cliente) {
  return ESTADOS_CARTERA_ACTIVOS.has(cliente.estado)
}

// Cuenta slots ocupados en una lista de cartera.
export function getOcupacionCartera(clientes) {
  return clientes.filter(ocupaCapacidad).length
}
