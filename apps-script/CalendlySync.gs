// ============================================================
// CALENDLY → CRM AUTO-SYNC
// ============================================================
//
// Este script revisa tu Google Calendar cada 10 minutos,
// detecta nuevas citas de Calendly, y agrega automáticamente
// el contacto a tu hoja de CRM como "Oportunidad".
//
// INSTRUCCIONES:
// 1. Abre tu proyecto de Apps Script (el mismo donde está Code.gs)
// 2. Crea un nuevo archivo llamado "CalendlySync"
// 3. Pega TODO este código
// 4. Ejecuta la función "setupCalendlyTrigger" UNA SOLA VEZ
//    (esto crea el trigger automático cada 10 minutos)
// 5. La primera vez te pedirá permisos - acéptalos
//
// Para probar manualmente: ejecuta "syncCalendlyEvents"
// Para ver el log: Ver > Registros de ejecución
// ============================================================

const MY_EMAIL = 'mbustos@elevate.com.mx'
const MY_NAME_SUFFIX = ' y Mauricio Bustos Eguia'
const CALENDLY_MARKER = 'Desarrollado por Calendly.com'

// Propiedad para rastrear última sincronización
const LAST_SYNC_KEY = 'lastCalendlySync'

/**
 * Ejecutar UNA VEZ para crear el trigger automático cada 10 min
 */
function setupCalendlyTrigger() {
  // Eliminar triggers anteriores de esta función
  const triggers = ScriptApp.getProjectTriggers()
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'syncCalendlyEvents') {
      ScriptApp.deleteTrigger(t)
    }
  })

  // Crear nuevo trigger cada 10 minutos
  ScriptApp.newTrigger('syncCalendlyEvents')
    .timeBased()
    .everyMinutes(10)
    .create()

  Logger.log('Trigger creado: syncCalendlyEvents se ejecutará cada 10 minutos')
}

/**
 * Función principal de sincronización
 * Se ejecuta automáticamente cada 10 minutos
 */
function syncCalendlyEvents() {
  const props = PropertiesService.getScriptProperties()

  // Obtener fecha de última sincronización (o hace 24 horas si es la primera vez)
  let lastSync = props.getProperty(LAST_SYNC_KEY)
  let fromDate
  if (lastSync) {
    fromDate = new Date(lastSync)
  } else {
    // Primera ejecución: buscar eventos de los últimos 30 días
    fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 30)
  }

  const now = new Date()
  // Buscar eventos hasta 30 días en el futuro (para citas agendadas a futuro)
  const toDate = new Date()
  toDate.setDate(toDate.getDate() + 30)

  Logger.log(`Buscando eventos de Calendly desde ${fromDate.toISOString()} hasta ${toDate.toISOString()}`)

  // Buscar eventos en el calendario
  const calendar = CalendarApp.getCalendarById(MY_EMAIL)
  if (!calendar) {
    Logger.log('No se encontró el calendario: ' + MY_EMAIL)
    return
  }

  const events = calendar.getEvents(fromDate, toDate, { search: 'Calendly' })
  Logger.log(`Encontrados ${events.length} eventos con "Calendly"`)

  // Obtener contactos existentes en el CRM para evitar duplicados
  const existingContacts = getExistingContacts()
  let addedCount = 0

  for (const event of events) {
    const description = event.getDescription() || ''

    // Verificar que sea un evento de Calendly
    if (!description.includes(CALENDLY_MARKER)) continue

    // Verificar que el evento fue creado después de la última sincronización
    const createdDate = event.getDateCreated()
    if (lastSync && createdDate <= new Date(lastSync)) continue

    // Extraer datos del contacto
    const contactData = extractContactData(event)
    if (!contactData || !contactData.nombre) continue

    // Verificar si ya existe en el CRM (por teléfono o nombre)
    if (isContactDuplicate(contactData, existingContacts)) {
      Logger.log(`Contacto ya existe: ${contactData.nombre}`)
      continue
    }

    // Agregar al CRM
    addContactToCRM(contactData)
    existingContacts.push(contactData) // Evitar duplicados dentro del mismo batch
    addedCount++
    Logger.log(`Nuevo contacto agregado: ${contactData.nombre}`)
  }

  // Actualizar timestamp de última sincronización
  props.setProperty(LAST_SYNC_KEY, now.toISOString())

  Logger.log(`Sincronización completada. ${addedCount} contacto(s) nuevo(s) agregado(s).`)
}

/**
 * Extrae datos del contacto desde un evento de Calendly
 */
function extractContactData(event) {
  const title = event.getTitle() || ''
  const description = event.getDescription() || ''
  const guests = event.getGuestList()

  // Extraer nombre (formato: "Nombre Apellido y Mauricio Bustos Eguia")
  let nombre = title
  if (title.includes(MY_NAME_SUFFIX)) {
    nombre = title.replace(MY_NAME_SUFFIX, '').trim()
  } else if (title.includes(' y ')) {
    nombre = title.split(' y ')[0].trim()
  }

  if (!nombre) return null

  // Extraer email del invitado (el que NO es el mío)
  let correo = ''
  for (const guest of guests) {
    const email = guest.getEmail()
    if (email && email !== MY_EMAIL) {
      correo = email
      break
    }
  }

  // Extraer teléfono de la descripción
  const phoneMatch = description.match(/¿Cual es tu número de teléfono\?\s*:\s*([^\n]+)/)
  let whatsapp = phoneMatch ? phoneMatch[1].trim() : ''
  // Limpiar formato del teléfono
  whatsapp = whatsapp.replace(/\s+/g, '').replace(/-/g, '')
  if (whatsapp && !whatsapp.startsWith('+')) {
    whatsapp = '+' + whatsapp
  }

  // Extraer respuestas del formulario para las notas
  let notas = ''
  const questionPatterns = [
    /¿(?:Que|Qué) quieres lograr[^?]*\?\s*:\s*([^\n]+)/i,
    /¿Por que estas interesado[^?]*\?\s*:\s*([^\n]+)/i,
  ]
  for (const pattern of questionPatterns) {
    const match = description.match(pattern)
    if (match && match[1].trim()) {
      notas = match[1].trim()
      break
    }
  }

  // Extraer tipo de evento para las notas
  const eventTypeMatch = description.match(/Nombre del evento\n([^\n]+)/)
  const eventType = eventTypeMatch ? eventTypeMatch[1].trim() : ''
  if (eventType && notas) {
    notas = `[${eventType}] ${notas}`
  } else if (eventType) {
    notas = `[${eventType}]`
  }

  // Determinar método de prospección basado en el tipo de evento
  // Como vienen del funnel: redes → landing → Calendly
  let metodoProspeccion = 'Landing VSL'

  // Fecha del evento como fecha de primer contacto
  const eventDate = event.getStartTime()
  const fechaPrimerContacto = Utilities.formatDate(eventDate, Session.getScriptTimeZone(), 'dd/MM/yyyy')
  const fechaActualizacion = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')

  // Fecha de próximo seguimiento = fecha del evento (día de la llamada)
  const proximoSeguimiento = fechaPrimerContacto

  return {
    nombre,
    correo,
    whatsapp,
    notas,
    metodoProspeccion,
    fechaPrimerContacto,
    fechaActualizacion,
    estadoActual: 'Oportunidad',
    probabilidad: '',
    potencial: '',
    monto: 0,
    proximoSeguimiento,
  }
}

/**
 * Obtiene los contactos existentes del CRM
 */
function getExistingContacts() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME)
  const lastRow = sheet.getLastRow()
  if (lastRow < DATA_START_ROW) return []

  const range = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, NUM_COLUMNS)
  const values = range.getValues()

  return values
    .filter(row => row[2] && row[2].toString().trim() !== '')
    .map(row => ({
      nombre: (row[2] || '').toString().trim().toLowerCase(),
      whatsapp: (row[3] || '').toString().replace(/[^0-9+]/g, ''),
      correo: (row[4] || '').toString().trim().toLowerCase(),
    }))
}

/**
 * Verifica si un contacto ya existe en el CRM
 */
function isContactDuplicate(contact, existingContacts) {
  const nombre = contact.nombre.toLowerCase()
  const whatsapp = contact.whatsapp.replace(/[^0-9+]/g, '')
  const correo = contact.correo.toLowerCase()

  for (const existing of existingContacts) {
    // Coincidencia por teléfono (últimos 10 dígitos)
    if (whatsapp && existing.whatsapp) {
      const newDigits = whatsapp.replace(/[^0-9]/g, '').slice(-10)
      const existingDigits = existing.whatsapp.replace(/[^0-9]/g, '').slice(-10)
      if (newDigits === existingDigits && newDigits.length >= 8) return true
    }

    // Coincidencia por email
    if (correo && existing.correo && correo === existing.correo) return true

    // Coincidencia por nombre exacto
    if (nombre && existing.nombre && nombre === existing.nombre) return true
  }

  return false
}

/**
 * Agrega un contacto nuevo al CRM
 */
function addContactToCRM(contact) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME)

  // Buscar primera fila vacía
  const lastRow = Math.max(sheet.getLastRow(), DATA_START_ROW)
  const nameCol = sheet.getRange(DATA_START_ROW, 3, lastRow - DATA_START_ROW + 50, 1).getValues()

  let targetRow = DATA_START_ROW
  for (let i = 0; i < nameCol.length; i++) {
    if (!nameCol[i][0] || nameCol[i][0].toString().trim() === '') {
      targetRow = DATA_START_ROW + i
      break
    }
    targetRow = DATA_START_ROW + i + 1
  }

  const values = [
    parseInputDate(contact.fechaPrimerContacto) || new Date(),
    parseInputDate(contact.fechaActualizacion) || new Date(),
    contact.nombre,
    contact.whatsapp,
    contact.correo,
    contact.metodoProspeccion,
    contact.estadoActual,
    contact.probabilidad,
    contact.potencial,
    contact.monto,
    contact.notas,
    parseInputDate(contact.proximoSeguimiento) || '',
  ]

  sheet.getRange(targetRow, 1, 1, NUM_COLUMNS).setValues([values])
}

/**
 * Función de prueba: simula la sincronización sin guardar el timestamp
 */
function testSync() {
  const props = PropertiesService.getScriptProperties()
  // Buscar eventos de los últimos 90 días
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 90)
  const toDate = new Date()
  toDate.setDate(toDate.getDate() + 30)

  const calendar = CalendarApp.getCalendarById(MY_EMAIL)
  const events = calendar.getEvents(fromDate, toDate, { search: 'Calendly' })

  Logger.log(`Encontrados ${events.length} eventos de Calendly`)

  const existingContacts = getExistingContacts()
  Logger.log(`Contactos existentes en CRM: ${existingContacts.length}`)

  for (const event of events) {
    const description = event.getDescription() || ''
    if (!description.includes(CALENDLY_MARKER)) continue

    const contact = extractContactData(event)
    if (!contact) continue

    const isDupe = isContactDuplicate(contact, existingContacts)
    Logger.log(`${contact.nombre} | ${contact.whatsapp} | ${contact.correo} | ${isDupe ? 'YA EXISTE' : 'NUEVO'}`)
  }
}

/**
 * Resetear timestamp para re-sincronizar todo
 */
function resetSync() {
  PropertiesService.getScriptProperties().deleteProperty(LAST_SYNC_KEY)
  Logger.log('Timestamp reseteado. La próxima sincronización buscará eventos de los últimos 30 días.')
}
