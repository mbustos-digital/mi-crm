// ============================================================
// API — capa de acceso al backend (Apps Script vía proxy Vercel)
// ============================================================
//
// Toda comunicación con Google Sheets pasa por el proxy server-side
// /api/proxy (Vercel Function). La URL real del Apps Script vive
// únicamente como variable de entorno en Vercel (APPS_SCRIPT_URL),
// nunca en el bundle público del frontend.
//
// Soporta 3 sheets: pipeline (default), cartera, settings.
// ============================================================

// ------------------------------------------------------------
// Cache en localStorage — mitiga latencia Apps Script
// Un key separado por sheet, TTL 5 min.
// ------------------------------------------------------------
const CACHE_TTL = 5 * 60 * 1000

const CACHE_KEYS = {
  pipeline: 'crm_opportunities_cache',
  cartera:  'crm_cartera_cache',
  settings: 'crm_settings_cache',
}

function getCache(sheet) {
  try {
    const key = CACHE_KEYS[sheet]
    if (!key) return null
    const cached = localStorage.getItem(key)
    if (!cached) return null
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp > CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

function setCache(sheet, data) {
  try {
    const key = CACHE_KEYS[sheet]
    if (!key) return
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch { /* ignore quota errors */ }
}

function clearCacheKey(sheet) {
  const key = CACHE_KEYS[sheet]
  if (key) localStorage.removeItem(key)
}

// Público — limpia cache de pipeline (usado por el botón de refresh).
export function clearCache() {
  clearCacheKey('pipeline')
}

// Limpia todos los caches (usado al cerrar sesión o resync global).
export function clearAllCaches() {
  Object.keys(CACHE_KEYS).forEach(clearCacheKey)
}

// ------------------------------------------------------------
// Transporte — siempre vía /api/proxy (server-side Vercel)
// ------------------------------------------------------------
const PROXY_URL = '/api/proxy'

async function callAppsScript({ action, sheet = 'pipeline', payload = null }) {
  // POST: para operaciones con payload (add/update/delete).
  // Evita problemas de encoding en URL y límites de longitud.
  if (payload) {
    const payloadObj = typeof payload === 'string' ? JSON.parse(payload) : payload
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet, action, payload: payloadObj }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data
  }

  // GET: para getAll y operaciones sin payload.
  // Timestamp para cache-busting (navegador/CDN).
  const params = { sheet, action, _t: Date.now() }
  const url = `${PROXY_URL}?${new URLSearchParams(params).toString()}`
  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

// ============================================================
// PIPELINE — oportunidades
// ============================================================

export async function fetchOpportunities() {
  const cached = getCache('pipeline')
  if (cached) return cached

  try {
    const data = await callAppsScript({ sheet: 'pipeline', action: 'getAll' })
    setCache('pipeline', data)
    return data
  } catch (err) {
    console.error('Error fetching opportunities:', err)
    try {
      const stale = localStorage.getItem(CACHE_KEYS.pipeline)
      if (stale) return JSON.parse(stale).data
    } catch { /* ignore */ }
    throw err
  }
}

export async function addOpportunity(opportunity) {
  clearCacheKey('pipeline')
  return callAppsScript({
    sheet: 'pipeline',
    action: 'add',
    payload: { opportunity },
  })
}

export async function updateOpportunity(row, opportunity) {
  clearCacheKey('pipeline')
  return callAppsScript({
    sheet: 'pipeline',
    action: 'update',
    payload: { row, opportunity },
  })
}

export async function deleteOpportunity(row) {
  clearCacheKey('pipeline')
  return callAppsScript({
    sheet: 'pipeline',
    action: 'delete',
    payload: { row },
  })
}

// ============================================================
// CARTERA — clientes activos con programa en curso
// ============================================================

export async function fetchCartera() {
  const cached = getCache('cartera')
  if (cached) return cached

  try {
    const data = await callAppsScript({ sheet: 'cartera', action: 'getAll' })
    setCache('cartera', data)
    return data
  } catch (err) {
    console.error('Error fetching cartera:', err)
    try {
      const stale = localStorage.getItem(CACHE_KEYS.cartera)
      if (stale) return JSON.parse(stale).data
    } catch { /* ignore */ }
    throw err
  }
}

export async function addToCartera(cliente) {
  clearCacheKey('cartera')
  return callAppsScript({
    sheet: 'cartera',
    action: 'add',
    payload: { cliente },
  })
}

export async function updateCartera(row, cliente) {
  clearCacheKey('cartera')
  return callAppsScript({
    sheet: 'cartera',
    action: 'update',
    payload: { row, cliente },
  })
}

export async function deleteCartera(row) {
  clearCacheKey('cartera')
  return callAppsScript({
    sheet: 'cartera',
    action: 'delete',
    payload: { row },
  })
}

// ============================================================
// SETTINGS — configuración global (capacidad, defaults)
// ============================================================

export async function fetchSettings() {
  const cached = getCache('settings')
  if (cached) return cached

  try {
    const data = await callAppsScript({ sheet: 'settings', action: 'get' })
    setCache('settings', data)
    return data
  } catch (err) {
    console.error('Error fetching settings:', err)
    // Settings tiene defaults razonables en frontend — no es crítico.
    throw err
  }
}

export async function updateSettings(settings) {
  clearCacheKey('settings')
  return callAppsScript({
    sheet: 'settings',
    action: 'update',
    payload: { settings },
  })
}
