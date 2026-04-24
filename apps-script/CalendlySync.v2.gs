// ============================================================
// CALENDLY → CRM AUTO-SYNC (standalone, Pipeline v2 schema)
// ============================================================
//
// Reemplaza al CalendlySync.gs viejo que escribía en schema v1
// (12 columnas, estado 'Oportunidad'). Este escribe en el schema
// v2 (25 columnas, estado 'Agendado') que es lo que espera la app.
//
// USO (reemplazar proyecto existente):
//   1) Ve a https://script.google.com
//   2) Abre el proyecto "CalendlySync" existente
//   3) Borra TODO el contenido de Code.gs y pega este archivo completo
//   4) Guarda (Cmd+S)
//   5) Primera vez — corre setupCalendlyTrigger() UNA sola vez para
//      instalar el trigger automático cada 10 min.
//   6) Para recuperar leads perdidos — corre backfillCalendly() UNA
//      vez; escanea los últimos 60 días y agrega los que falten.
//   7) De ahí en adelante syncCalendlyEvents() corre solo cada 10 min.
//
// FUNCIONES DISPONIBLES:
//   - setupCalendlyTrigger(): instala el trigger cada 10 min (run once)
//   - syncCalendlyEvents():   corrida incremental (la usa el trigger)
//   - backfillCalendly():     scan deep de últimos 60 días (recovery)
//   - testSync():             dry-run — lista eventos sin agregar nada
//   - resetSync():            borra timestamp — próximo sync busca 30d
//
// ============================================================

// --- Config del Sheet ---
const SHEET_ID = '1Zoh1CIvUZIQa--5GYHWw4SaMAD9co19waAxS5Hr5_yE'
const PIPELINE_TAB = 'Versión Dueño de negocio'
const PIPELINE_DATA_START_ROW = 4
const PIPELINE_NUM_COLUMNS = 25

// --- Config de Calendly/Calendar ---
const MY_EMAIL = 'mbustos@elevate.com.mx'
const MY_NAME_SUFFIX = ' y Mauricio Bustos Eguia'
const CALENDLY_MARKER = 'Desarrollado por Calendly.com'
const LAST_SYNC_KEY = 'lastCalendlySync'

// Default para nuevos leads de Calendly
const DEFAULT_STATE = 'Agendado'
const DEFAULT_METHOD = 'Landing VSL'

// ============================================================
// TRIGGER SETUP — correr UNA vez
// ============================================================

function setupCalendlyTrigger() {
  // Limpiar triggers anteriores de syncCalendlyEvents (por si los hay)
  const triggers = ScriptApp.getProjectTriggers()
  let removed = 0
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'syncCalendlyEvents') {
      ScriptApp.deleteTrigger(t); removed++
    }
  })

  ScriptApp.newTrigger('syncCalendlyEvents')
    .timeBased()
    .everyMinutes(10)
    .create()

  Logger.log(`Triggers anteriores removidos: ${removed}`)
  Logger.log('Nuevo trigger creado: syncCalendlyEvents se ejecutará cada 10 minutos')
}

// ============================================================
// SYNC PRINCIPAL — lo llama el trigger cada 10 min
// ============================================================

function syncCalendlyEvents() {
  const props = PropertiesService.getScriptProperties()
  const lastSync = props.getProperty(LAST_SYNC_KEY)

  // Primera vez o reset: busca últimos 30 días
  const fromDate = lastSync ? new Date(lastSync) : daysAgo_(30)
  const toDate = daysAhead_(30)
  const now = new Date()

  const { added, skipped } = runSync_(fromDate, toDate, lastSync ? new Date(lastSync) : null)

  props.setProperty(LAST_SYNC_KEY, now.toISOString())
  Logger.log(`Sync OK · agregados ${added} · ya existían ${skipped}`)
}

// ============================================================
// BACKFILL — recovery one-shot de los últimos 60 días
// ============================================================

function backfillCalendly() {
  const fromDate = daysAgo_(60)
  const toDate = daysAhead_(30)
  Logger.log(`BACKFILL desde ${fromDate.toISOString()} hasta ${toDate.toISOString()}`)
  const { added, skipped } = runSync_(fromDate, toDate, null)
  Logger.log(`Backfill completado · agregados ${added} · ya existían ${skipped}`)
}

// ============================================================
// TEST — dry-run sin agregar
// ============================================================

function testSync() {
  const fromDate = daysAgo_(90)
  const toDate = daysAhead_(30)
  const calendar = CalendarApp.getCalendarById(MY_EMAIL)
  if (!calendar) { Logger.log('❌ No se encontró calendario: ' + MY_EMAIL); return }

  const events = calendar.getEvents(fromDate, toDate, { search: 'Calendly' })
  Logger.log(`Eventos con "Calendly" encontrados: ${events.length}`)

  const existing = getExistingContacts_()
  Logger.log(`Contactos en Pipeline: ${existing.length}`)

  let dupes = 0, nuevos = 0, skipped = 0
  for (const event of events) {
    const desc = event.getDescription() || ''
    if (!desc.includes(CALENDLY_MARKER)) { skipped++; continue }
    const data = extractContactData_(event)
    if (!data || !data.nombre) { skipped++; continue }
    const isDupe = isDuplicate_(data, existing)
    if (isDupe) dupes++
    else nuevos++
    Logger.log(`${isDupe ? '🔁' : '✨'} ${data.nombre} | ${data.whatsapp} | ${data.correo} | ${data.fechaPrimerContacto}`)
  }
  Logger.log(`Resumen · nuevos que se agregarían: ${nuevos} · duplicados: ${dupes} · no-Calendly: ${skipped}`)
}

// ============================================================
// RESET — borrar timestamp (el próximo sync re-scanea 30d)
// ============================================================

function resetSync() {
  PropertiesService.getScriptProperties().deleteProperty(LAST_SYNC_KEY)
  Logger.log('Timestamp reseteado. Próximo syncCalendlyEvents escanea últimos 30 días.')
}

// ============================================================
// INTERNALS
// ============================================================

function runSync_(fromDate, toDate, onlyCreatedAfter) {
  const calendar = CalendarApp.getCalendarById(MY_EMAIL)
  if (!calendar) { Logger.log('❌ No se encontró calendario: ' + MY_EMAIL); return { added: 0, skipped: 0 } }

  const events = calendar.getEvents(fromDate, toDate, { search: 'Calendly' })
  const existing = getExistingContacts_()
  let added = 0, skipped = 0

  for (const event of events) {
    const desc = event.getDescription() || ''
    if (!desc.includes(CALENDLY_MARKER)) continue

    // Filtro incremental: solo eventos creados después de onlyCreatedAfter
    if (onlyCreatedAfter) {
      const created = event.getDateCreated()
      if (created <= onlyCreatedAfter) continue
    }

    const data = extractContactData_(event)
    if (!data || !data.nombre) continue

    if (isDuplicate_(data, existing)) { skipped++; continue }

    addContactToPipeline_(data)
    existing.push({
      nombre: data.nombre.toLowerCase(),
      whatsapp: data.whatsapp.replace(/[^0-9+]/g, ''),
      correo: data.correo.toLowerCase(),
    })
    added++
    Logger.log(`✨ Agregado: ${data.nombre} | junta ${data.fechaPrimerContacto}`)
  }

  return { added, skipped }
}

function extractContactData_(event) {
  const title = event.getTitle() || ''
  const description = event.getDescription() || ''
  const guests = event.getGuestList()

  // Nombre: quita " y Mauricio Bustos Eguia"
  let nombre = title
  if (title.includes(MY_NAME_SUFFIX)) {
    nombre = title.replace(MY_NAME_SUFFIX, '').trim()
  } else if (title.includes(' y ')) {
    nombre = title.split(' y ')[0].trim()
  }
  if (!nombre) return null

  // Email del invitado que NO es el mío
  let correo = ''
  for (const guest of guests) {
    const email = guest.getEmail()
    if (email && email.toLowerCase() !== MY_EMAIL.toLowerCase()) {
      correo = email; break
    }
  }

  // Teléfono: busca en descripción varias variantes
  let whatsapp = ''
  const phonePatterns = [
    /¿Cual es tu n[úu]mero de tel[eé]fono\?\s*:\s*([^\n]+)/i,
    /¿Cu[aá]l es tu n[úu]mero de tel[eé]fono\?\s*:\s*([^\n]+)/i,
    /tel[eé]fono\s*:\s*([+\d\s\-()]+)/i,
  ]
  for (const rx of phonePatterns) {
    const m = description.match(rx)
    if (m && m[1]) { whatsapp = m[1].trim(); break }
  }
  whatsapp = whatsapp.replace(/\s+/g, '').replace(/-/g, '').replace(/\(|\)/g, '')
  if (whatsapp && !whatsapp.startsWith('+')) whatsapp = '+' + whatsapp

  // Notas: toma la primera respuesta a pregunta "qué quieres lograr..." o similar
  let notas = ''
  const notePatterns = [
    /¿(?:Que|Qué) quieres lograr[^?]*\?\s*:\s*([^\n]+)/i,
    /¿Por qu[eé] est[aá]s interesado[^?]*\?\s*:\s*([^\n]+)/i,
    /¿Cu[aá]l es tu mayor reto[^?]*\?\s*:\s*([^\n]+)/i,
  ]
  for (const rx of notePatterns) {
    const m = description.match(rx)
    if (m && m[1] && m[1].trim()) { notas = m[1].trim(); break }
  }

  // Tipo de evento (si Calendly lo incluye en la descripción)
  const eventTypeMatch = description.match(/Nombre del evento\s*\n([^\n]+)/)
  const eventType = eventTypeMatch ? eventTypeMatch[1].trim() : ''
  if (eventType && notas) notas = `[${eventType}] ${notas}`
  else if (eventType) notas = `[${eventType}]`

  const tz = Session.getScriptTimeZone()
  const eventDate = event.getStartTime()
  const fechaPrimerContacto = Utilities.formatDate(eventDate, tz, 'dd/MM/yyyy')
  const fechaActualizacion = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy')

  return {
    nombre,
    correo,
    whatsapp,
    notas,
    metodoProspeccion: DEFAULT_METHOD,
    estadoActual: DEFAULT_STATE,
    fechaPrimerContacto,
    fechaActualizacion,
    proximoSeguimiento: fechaPrimerContacto,
    fechaJunta1: fechaPrimerContacto,
  }
}

function getExistingContacts_() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(PIPELINE_TAB)
  const lastRow = sheet.getLastRow()
  if (lastRow < PIPELINE_DATA_START_ROW) return []
  const values = sheet.getRange(
    PIPELINE_DATA_START_ROW, 1,
    lastRow - PIPELINE_DATA_START_ROW + 1,
    PIPELINE_NUM_COLUMNS
  ).getValues()
  return values
    .filter(row => row[2] && row[2].toString().trim() !== '')
    .map(row => ({
      nombre:   (row[2] || '').toString().trim().toLowerCase(),
      whatsapp: (row[3] || '').toString().replace(/[^0-9+]/g, ''),
      correo:   (row[4] || '').toString().trim().toLowerCase(),
    }))
}

function isDuplicate_(data, existing) {
  const nombre = data.nombre.toLowerCase()
  const whatsapp = data.whatsapp.replace(/[^0-9+]/g, '')
  const correo = data.correo.toLowerCase()

  for (const e of existing) {
    // Match por últimos 10 dígitos del teléfono (maneja lada +52 variable)
    if (whatsapp && e.whatsapp) {
      const a = whatsapp.replace(/[^0-9]/g, '').slice(-10)
      const b = e.whatsapp.replace(/[^0-9]/g, '').slice(-10)
      if (a === b && a.length >= 8) return true
    }
    // Match por email
    if (correo && e.correo && correo === e.correo) return true
    // Match por nombre exacto (fallback)
    if (nombre && e.nombre && nombre === e.nombre) return true
  }
  return false
}

function addContactToPipeline_(c) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(PIPELINE_TAB)
  const lastRow = Math.max(sheet.getLastRow(), PIPELINE_DATA_START_ROW)

  // Busca primera fila vacía (columna C / nombre vacía)
  const searchRange = sheet.getRange(
    PIPELINE_DATA_START_ROW, 3,
    Math.max(lastRow - PIPELINE_DATA_START_ROW + 50, 50), 1
  )
  const nameCol = searchRange.getValues()
  let targetRow = PIPELINE_DATA_START_ROW
  for (let i = 0; i < nameCol.length; i++) {
    if (!nameCol[i][0] || nameCol[i][0].toString().trim() === '') {
      targetRow = PIPELINE_DATA_START_ROW + i; break
    }
    targetRow = PIPELINE_DATA_START_ROW + i + 1
  }

  // Schema v2 — 25 columnas en el orden de pipelineToRow de Code.v2.gs
  const values = [
    parseDdmmyyyy_(c.fechaPrimerContacto),     // A (1) fechaPrimerContacto
    parseDdmmyyyy_(c.fechaActualizacion) || new Date(), // B (2) fechaActualizacion
    c.nombre,                                   // C (3) nombre
    c.whatsapp,                                 // D (4) whatsapp
    c.correo,                                   // E (5) correo
    c.metodoProspeccion,                        // F (6) metodoProspeccion
    c.estadoActual,                             // G (7) estadoActual
    '',                                         // H (8) probabilidad
    '',                                         // I (9) potencial
    0,                                          // J (10) monto
    c.notas,                                    // K (11) notas
    parseDdmmyyyy_(c.proximoSeguimiento),       // L (12) proximoSeguimiento
    '',                                         // M (13) tipoPrograma
    0,                                          // N (14) precioPrograma
    0,                                          // O (15) descuentoAplicado
    '',                                         // P (16) razonDescuento
    parseDdmmyyyy_(c.fechaJunta1),              // Q (17) fechaJunta1
    '',                                         // R (18) fechaJunta2
    '',                                         // S (19) showJunta1
    '',                                         // T (20) razonPerdida
    '',                                         // U (21) notasPerdida
    new Date(),                                 // V (22) ultimaActividad
    '',                                         // W (23) estadoSeguimiento
    '',                                         // X (24) fechaCierre
    '',                                         // Y (25) empresa
  ]
  sheet.getRange(targetRow, 1, 1, PIPELINE_NUM_COLUMNS).setValues([values])
}

// --- Helpers ---

function parseDdmmyyyy_(str) {
  if (!str || typeof str !== 'string') return ''
  const m = str.split(' ')[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return ''
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10))
}

function daysAgo_(days) {
  const d = new Date(); d.setDate(d.getDate() - days); return d
}

function daysAhead_(days) {
  const d = new Date(); d.setDate(d.getDate() + days); return d
}
