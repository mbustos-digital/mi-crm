// ============================================================
// GOOGLE APPS SCRIPT - Mi CRM v2.0
// Soporta: Pipeline (24 col) + Cartera (17 col) + Settings
// ============================================================
//
// INSTRUCCIONES DE DESPLIEGUE:
// 1. Abre https://script.google.com
// 2. Abre tu proyecto existente "CalendlySync"
// 3. Selecciona TODO el contenido de Code.gs y bórralo
// 4. Pega TODO este código
// 5. Guarda (Ctrl+S)
// 6. Implementar > Nueva implementación (NO editar existente)
// 7. Tipo: "App web" · Ejecutar como: Yo · Acceso: Cualquier persona
// 8. Clic "Implementar" — COPIA la URL resultante
// 9. Pega la URL aquí en el chat
//
// ============================================================

const SHEET_ID = '1Zoh1CIvUZIQa--5GYHWw4SaMAD9co19waAxS5Hr5_yE'

// Pestanas - construidas con String.fromCharCode para evitar corrupcion al pegar.
// 243 = o-acute (o con tilde), 241 = n-tilde. Source 100% ASCII, a prueba de paste.
var _O_ACUTE = String.fromCharCode(243)
var _N_TILDE = String.fromCharCode(241)
var PIPELINE_TAB = 'Versi' + _O_ACUTE + 'n Due' + _N_TILDE + 'o de negocio'
var PIPELINE_BACKUP_TAB = PIPELINE_TAB + ' - Backup Pre-Migration'
var CARTERA_TAB = 'Cartera'
var SETTINGS_TAB = 'Settings'

// Pipeline: header fila 3, datos desde fila 4, 25 columnas (A-Y)
const PIPELINE_HEADER_ROW = 3
const PIPELINE_DATA_START_ROW = 4
const PIPELINE_NUM_COLUMNS = 25

// Cartera: header fila 1, datos desde fila 2, 17 columnas (A-Q)
const CARTERA_HEADER_ROW = 1
const CARTERA_DATA_START_ROW = 2
const CARTERA_NUM_COLUMNS = 17

// ============ ROUTING ============

function doGet(e) {
  try {
    const sheet = e.parameter.sheet || 'pipeline'
    const action = e.parameter.action || 'getAll'

    // Acciones globales (sin pestaña)
    if (action === 'migrate')      return jsonResponse(doMigration())
    if (action === 'backup')       return jsonResponse(doBackup())
    if (action === 'debug')        return jsonResponse(doDebug())
    if (action === 'fixDataShift') return jsonResponse(doFixDataShift())

    if (sheet === 'pipeline') return handlePipelineGet(action, e.parameter)
    if (sheet === 'cartera')  return handleCarteraGet(action, e.parameter)
    if (sheet === 'settings') return handleSettingsGet(action, e.parameter)

    return jsonResponse({ error: 'Sheet no válido: ' + sheet })
  } catch (err) {
    return jsonResponse({ error: err.message, stack: err.stack })
  }
}

// Diagnóstico: expone el valor real de PIPELINE_TAB y las pestañas disponibles
// para verificar que el código desplegado coincide con el código local.
function doDebug() {
  const ss = SpreadsheetApp.openById(SHEET_ID)
  const sheets = ss.getSheets().map(function(s) { return s.getName() })
  const codes = []
  for (var i = 0; i < PIPELINE_TAB.length; i++) {
    codes.push(PIPELINE_TAB.charCodeAt(i))
  }
  // Header row 3, primeras 30 columnas, para verificar alineación
  const pipelineSheet = getSheet(PIPELINE_TAB)
  const headers = pipelineSheet.getRange(PIPELINE_HEADER_ROW, 1, 1, 30).getValues()[0]
  return {
    pipelineTab: PIPELINE_TAB,
    pipelineTabLength: PIPELINE_TAB.length,
    pipelineTabCharCodes: codes,
    pipelineNumColumns: PIPELINE_NUM_COLUMNS,
    pipelineHeaders: headers,
    availableSheets: sheets,
    deployedVersionMarker: 'v5-empresa-shift-2026-04-14'
  }
}

// One-shot: corrige el shift de una columna causado por eliminar col S "Fecha J2 Agendada"
// del spreadsheet después de la migración. Mueve datos S→T, U→V, W→X y limpia los sources.
// Idempotente: si el destino ya tiene valor, no sobreescribe (y si el source está vacío, no hace nada).
function doFixDataShift() {
  const sheet = getSheet(PIPELINE_TAB)
  const lastRow = sheet.getLastRow()
  if (lastRow < PIPELINE_DATA_START_ROW) {
    return { success: true, message: 'No hay datos', totalRows: 0 }
  }

  // Cols S..X = columnas 19..24 (1-based), ancho 6
  const range = sheet.getRange(PIPELINE_DATA_START_ROW, 19, lastRow - PIPELINE_DATA_START_ROW + 1, 6)
  const values = range.getValues()

  let movedS = 0, movedU = 0, movedW = 0, unchanged = 0

  for (let i = 0; i < values.length; i++) {
    const row = values[i]
    // row[0]=S, row[1]=T, row[2]=U, row[3]=V, row[4]=W, row[5]=X
    let changed = false

    // S → T (razonPerdida): solo si T está vacío
    if (row[0] !== '' && row[0] != null && (row[1] === '' || row[1] == null)) {
      row[1] = row[0]
      row[0] = ''
      movedS++
      changed = true
    }
    // U → V (ultimaActividad)
    if (row[2] !== '' && row[2] != null && (row[3] === '' || row[3] == null)) {
      row[3] = row[2]
      row[2] = ''
      movedU++
      changed = true
    }
    // W → X (fechaCierre)
    if (row[4] !== '' && row[4] != null && (row[5] === '' || row[5] == null)) {
      row[5] = row[4]
      row[4] = ''
      movedW++
      changed = true
    }

    if (!changed) unchanged++
  }

  range.setValues(values)
  return {
    success: true,
    movedS_to_T: movedS,
    movedU_to_V: movedU,
    movedW_to_X: movedW,
    unchanged: unchanged,
    totalRows: values.length,
    message: 'Shift completado: ' + movedS + ' razones, ' + movedU + ' actividades, ' + movedW + ' fechas cierre.'
  }
}

function doPost(e) {
  try {
    const raw = JSON.parse(e.postData.contents)
    const sheet = raw.sheet || 'pipeline'
    const action = raw.action

    // Backward-compat: si viene {action, payload: {...}} usa payload; si no, usa raw
    const data = raw.payload || raw

    if (action === 'migrate') return jsonResponse(doMigration())
    if (action === 'backup')  return jsonResponse(doBackup())

    if (sheet === 'pipeline') return handlePipelineAction(action, data)
    if (sheet === 'cartera')  return handleCarteraAction(action, data)
    if (sheet === 'settings') return handleSettingsAction(action, data)

    return jsonResponse({ error: 'Sheet no válido: ' + sheet })
  } catch (err) {
    return jsonResponse({ error: err.message, stack: err.stack })
  }
}

// ============ PIPELINE ============

function handlePipelineGet(action, params) {
  if (action === 'getAll') return jsonResponse(getAllPipeline())
  // GET mutations (legacy): action + payload
  const payload = params.payload ? JSON.parse(params.payload) : {}
  return handlePipelineAction(action, payload)
}

function handlePipelineAction(action, data) {
  if (action === 'getAll') return jsonResponse(getAllPipeline())
  if (action === 'add')    return jsonResponse(addPipeline(data.opportunity || data))
  if (action === 'update') return jsonResponse(updatePipeline(data.row, data.opportunity || data))
  if (action === 'delete') return jsonResponse(deletePipeline(data.row))
  return jsonResponse({ error: 'Acción pipeline no válida: ' + action })
}

function getAllPipeline() {
  const sheet = getSheet(PIPELINE_TAB)
  const lastRow = sheet.getLastRow()
  if (lastRow < PIPELINE_DATA_START_ROW) return []

  const range = sheet.getRange(
    PIPELINE_DATA_START_ROW, 1,
    lastRow - PIPELINE_DATA_START_ROW + 1,
    PIPELINE_NUM_COLUMNS
  )
  const values = range.getValues()

  return values
    .map((row, i) => rowToPipeline(row, i + PIPELINE_DATA_START_ROW))
    .filter(opp => opp.nombre && opp.nombre.trim() !== '')
}

function rowToPipeline(row, rowNum) {
  return {
    row: rowNum,
    fechaPrimerContacto: formatDate(row[0]),
    fechaActualizacion: formatDate(row[1]),
    nombre: row[2] || '',
    whatsapp: row[3] ? row[3].toString() : '',
    correo: row[4] || '',
    metodoProspeccion: row[5] || '',
    estadoActual: row[6] || '',
    probabilidad: row[7] || '',
    potencial: row[8] || '',
    monto: parseFloat(row[9]) || 0,
    notas: row[10] || '',
    proximoSeguimiento: formatDate(row[11]),
    tipoPrograma: row[12] || '',
    precioPrograma: parseFloat(row[13]) || 0,
    descuentoAplicado: parseFloat(row[14]) || 0,
    razonDescuento: row[15] || '',
    fechaJunta1: formatDate(row[16]),
    fechaJunta2: formatDate(row[17]),
    showJunta1: row[18] || '',
    razonPerdida: row[19] || '',
    notasPerdida: row[20] || '',
    ultimaActividad: formatTimestamp(row[21]),
    estadoSeguimiento: row[22] || '',
    fechaCierre: formatDate(row[23]),
    empresa: row[24] || '',
  }
}

function pipelineToRow(opp) {
  return [
    parseInputDate(opp.fechaPrimerContacto),
    parseInputDate(opp.fechaActualizacion) || new Date(),
    opp.nombre || '',
    opp.whatsapp || '',
    opp.correo || '',
    opp.metodoProspeccion || '',
    opp.estadoActual || 'Agendado',
    opp.probabilidad || '',
    opp.potencial || '',
    parseFloat(opp.monto) || 0,
    opp.notas || '',
    parseInputDate(opp.proximoSeguimiento),
    opp.tipoPrograma || '',
    parseFloat(opp.precioPrograma) || 0,
    parseFloat(opp.descuentoAplicado) || 0,
    opp.razonDescuento || '',
    parseInputDate(opp.fechaJunta1),
    parseInputDate(opp.fechaJunta2),
    opp.showJunta1 || '',
    opp.razonPerdida || '',
    opp.notasPerdida || '',
    new Date(), // ultimaActividad siempre actual
    opp.estadoSeguimiento || '',
    parseInputDate(opp.fechaCierre),
    opp.empresa || '',
  ]
}

function addPipeline(opp) {
  const sheet = getSheet(PIPELINE_TAB)
  const lastRow = Math.max(sheet.getLastRow(), PIPELINE_DATA_START_ROW)
  const searchRange = sheet.getRange(
    PIPELINE_DATA_START_ROW, 3,
    Math.max(lastRow - PIPELINE_DATA_START_ROW + 50, 50), 1
  )
  const nameCol = searchRange.getValues()

  let targetRow = PIPELINE_DATA_START_ROW
  for (let i = 0; i < nameCol.length; i++) {
    if (!nameCol[i][0] || nameCol[i][0].toString().trim() === '') {
      targetRow = PIPELINE_DATA_START_ROW + i
      break
    }
    targetRow = PIPELINE_DATA_START_ROW + i + 1
  }

  const values = pipelineToRow(opp)
  sheet.getRange(targetRow, 1, 1, PIPELINE_NUM_COLUMNS).setValues([values])
  return { success: true, row: targetRow }
}

function updatePipeline(row, opp) {
  const sheet = getSheet(PIPELINE_TAB)
  const values = pipelineToRow(opp)
  sheet.getRange(row, 1, 1, PIPELINE_NUM_COLUMNS).setValues([values])
  return { success: true }
}

function deletePipeline(row) {
  const sheet = getSheet(PIPELINE_TAB)
  sheet.getRange(row, 1, 1, PIPELINE_NUM_COLUMNS).clearContent()
  return { success: true }
}

// ============ CARTERA ============

function handleCarteraGet(action, params) {
  if (action === 'getAll') return jsonResponse(getAllCartera())
  const payload = params.payload ? JSON.parse(params.payload) : {}
  return handleCarteraAction(action, payload)
}

function handleCarteraAction(action, data) {
  if (action === 'getAll') return jsonResponse(getAllCartera())
  if (action === 'add')    return jsonResponse(addCartera(data.cliente || data))
  if (action === 'update') return jsonResponse(updateCartera(data.row, data.cliente || data))
  if (action === 'delete') return jsonResponse(deleteCartera(data.row))
  return jsonResponse({ error: 'Acción cartera no válida: ' + action })
}

function getAllCartera() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CARTERA_TAB)
  if (!sheet) return []

  const lastRow = sheet.getLastRow()
  if (lastRow < CARTERA_DATA_START_ROW) return []

  const range = sheet.getRange(
    CARTERA_DATA_START_ROW, 1,
    lastRow - CARTERA_DATA_START_ROW + 1,
    CARTERA_NUM_COLUMNS
  )
  const values = range.getValues()

  return values
    .map((row, i) => rowToCartera(row, i + CARTERA_DATA_START_ROW))
    .filter(c => c.nombre && c.nombre.trim() !== '')
}

function rowToCartera(row, rowNum) {
  return {
    row: rowNum,
    nombre: row[0] || '',
    empresa: row[1] || '',
    correo: row[2] || '',
    whatsapp: row[3] ? row[3].toString() : '',
    tipoPrograma: row[4] || '',
    fechaInicio: formatDate(row[5]),
    semanasPrograma: parseFloat(row[6]) || 0,
    estado: row[7] || '',
    fechaGraduacionReal: formatDate(row[8]),
    resultadoDocumentado: row[9] || '',
    testimonialObtenido: row[10] || '',
    candidatoReferido: row[11] || '',
    referidosGenerados: parseFloat(row[12]) || 0,
    montoContrato: parseFloat(row[13]) || 0,
    notas: row[14] || '',
    idOrigenPipeline: parseFloat(row[15]) || 0,
    fechaCreacion: formatTimestamp(row[16]),
  }
}

function carteraToRow(c) {
  return [
    c.nombre || '',
    c.empresa || '',
    c.correo || '',
    c.whatsapp || '',
    c.tipoPrograma || '',
    parseInputDate(c.fechaInicio),
    parseFloat(c.semanasPrograma) || 0,
    c.estado || 'Activo',
    parseInputDate(c.fechaGraduacionReal),
    c.resultadoDocumentado || '',
    c.testimonialObtenido || 'No',
    c.candidatoReferido || 'No',
    parseFloat(c.referidosGenerados) || 0,
    parseFloat(c.montoContrato) || 0,
    c.notas || '',
    parseFloat(c.idOrigenPipeline) || 0,
    c.fechaCreacion ? parseInputDate(c.fechaCreacion) : new Date(),
  ]
}

function addCartera(c) {
  const sheet = getSheet(CARTERA_TAB)
  const lastRow = Math.max(sheet.getLastRow(), CARTERA_DATA_START_ROW - 1)
  const targetRow = lastRow + 1
  if (!c.fechaCreacion) c.fechaCreacion = formatDate(new Date())
  const values = carteraToRow(c)
  sheet.getRange(targetRow, 1, 1, CARTERA_NUM_COLUMNS).setValues([values])
  return { success: true, row: targetRow }
}

function updateCartera(row, c) {
  const sheet = getSheet(CARTERA_TAB)
  const values = carteraToRow(c)
  sheet.getRange(row, 1, 1, CARTERA_NUM_COLUMNS).setValues([values])
  return { success: true }
}

function deleteCartera(row) {
  const sheet = getSheet(CARTERA_TAB)
  sheet.getRange(row, 1, 1, CARTERA_NUM_COLUMNS).clearContent()
  return { success: true }
}

// ============ SETTINGS ============

function handleSettingsGet(action, params) {
  if (action === 'get' || action === 'getAll') return jsonResponse(getSettings())
  const payload = params.payload ? JSON.parse(params.payload) : {}
  return handleSettingsAction(action, payload)
}

function handleSettingsAction(action, data) {
  if (action === 'get' || action === 'getAll') return jsonResponse(getSettings())
  if (action === 'update') return jsonResponse(updateSettings(data.settings || data))
  return jsonResponse({ error: 'Acción settings no válida: ' + action })
}

function getDefaultSettings() {
  return {
    capacidadMaxima: 14,
    precioEjecutivoDefault: 3700,
    precioEmpresarialDefault: 7500,
    semanasEjecutivoDefault: 12,
    semanasEmpresarialDefault: 16,
  }
}

function getSettings() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SETTINGS_TAB)
  if (!sheet) return getDefaultSettings()

  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return getDefaultSettings()

  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues()
  const settings = getDefaultSettings()
  values.forEach(function(r) {
    const key = r[0]
    const value = r[1]
    if (key) {
      const num = parseFloat(value)
      settings[key] = isNaN(num) ? value : num
    }
  })
  return settings
}

function updateSettings(newSettings) {
  const sheet = getSheet(SETTINGS_TAB)
  const current = getSettings()
  const merged = Object.assign({}, current, newSettings)
  const rows = Object.keys(merged).map(function(k) { return [k, merged[k]] })
  // Limpiar antes de escribir (en caso de menos filas)
  const lastRow = sheet.getLastRow()
  if (lastRow >= 2) sheet.getRange(2, 1, lastRow - 1, 2).clearContent()
  sheet.getRange(2, 1, rows.length, 2).setValues(rows)
  return { success: true, settings: merged }
}

// ============ BACKUP & MIGRATION ============

function doBackup() {
  const ss = SpreadsheetApp.openById(SHEET_ID)
  const source = ss.getSheetByName(PIPELINE_TAB)
  if (!source) return { error: 'Pestaña origen no encontrada: ' + PIPELINE_TAB }

  const existing = ss.getSheetByName(PIPELINE_BACKUP_TAB)
  if (existing) {
    return { success: true, message: 'Backup ya existe, no se sobreescribió.' }
  }

  const backup = source.copyTo(ss)
  backup.setName(PIPELINE_BACKUP_TAB)
  return { success: true, message: 'Backup creado: ' + PIPELINE_BACKUP_TAB }
}

/**
 * Migración idempotente del viejo esquema (5 etapas) al nuevo (7 etapas).
 * Mapeo:
 *   "No responde"  → "Cerrado Perdido" + razonPerdida="Sin respuesta" + fechaCierre
 *   "Oportunidad"  → "Agendado"
 *   "Calificados"  → "Calificado"
 *   "Propuesta"    → "J2 Agendada"
 *   "Cerrado"      → "Cerrado Ganado" + fechaCierre
 */
function doMigration() {
  const backupResult = doBackup()
  if (backupResult.error) return { error: 'Falló backup: ' + backupResult.error }

  const sheet = getSheet(PIPELINE_TAB)
  const lastRow = sheet.getLastRow()
  if (lastRow < PIPELINE_DATA_START_ROW) {
    return { success: true, migrated: 0, message: 'No hay datos para migrar' }
  }

  const range = sheet.getRange(
    PIPELINE_DATA_START_ROW, 1,
    lastRow - PIPELINE_DATA_START_ROW + 1,
    PIPELINE_NUM_COLUMNS
  )
  const values = range.getValues()

  const newStages = [
    'Agendado', 'J1 Realizada', 'Calificado',
    'J2 Agendada', 'J2 Realizada',
    'Cerrado Ganado', 'Cerrado Perdido'
  ]

  let migrated = 0
  let skipped = 0

  for (let i = 0; i < values.length; i++) {
    const row = values[i]
    const nombre = row[2]
    if (!nombre || nombre.toString().trim() === '') continue

    const estadoViejo = (row[6] || '').toString().trim()

    // Idempotente: si ya está en el nuevo esquema, saltar
    if (newStages.indexOf(estadoViejo) !== -1) { skipped++; continue }

    const fechaActualizacion = row[1]
    let estadoNuevo = ''
    let razonPerdida = ''
    let fechaCierre = ''

    if (estadoViejo === 'No responde') {
      estadoNuevo = 'Cerrado Perdido'
      razonPerdida = 'Sin respuesta'
      fechaCierre = fechaActualizacion
    } else if (estadoViejo === 'Oportunidad') {
      estadoNuevo = 'Agendado'
    } else if (estadoViejo === 'Calificados') {
      estadoNuevo = 'Calificado'
    } else if (estadoViejo === 'Propuesta') {
      estadoNuevo = 'J2 Agendada'
    } else if (estadoViejo === 'Cerrado') {
      estadoNuevo = 'Cerrado Ganado'
      fechaCierre = fechaActualizacion
    } else {
      skipped++
      continue
    }

    row[6]  = estadoNuevo                        // G - estadoActual
    row[19] = razonPerdida                       // T - razonPerdida
    row[21] = fechaActualizacion || new Date()   // V - ultimaActividad
    if (fechaCierre) row[23] = fechaCierre       // X - fechaCierre

    migrated++
  }

  range.setValues(values)

  return {
    success: true,
    migrated: migrated,
    skipped: skipped,
    total: values.length,
    message: 'Migración completada: ' + migrated + ' migrados, ' + skipped + ' saltados de ' + values.length + ' filas.'
  }
}

// ============ HELPERS ============

function getSheet(tabName) {
  const ss = SpreadsheetApp.openById(SHEET_ID)
  // 1. Intento exacto
  let sheet = ss.getSheetByName(tabName)
  if (sheet) return sheet

  // 2. Fallback: buscar por nombre normalizado (sin acentos, minúsculas, trim)
  const normalize = function(s) {
    return (s || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim()
  }
  const target = normalize(tabName)
  const sheets = ss.getSheets()
  for (let i = 0; i < sheets.length; i++) {
    if (normalize(sheets[i].getName()) === target) return sheets[i]
  }

  // 3. No encontrada: lanzar error con lista de pestañas disponibles para debug
  const available = sheets.map(function(s) { return '"' + s.getName() + '"' }).join(', ')
  throw new Error('Pestaña no encontrada: "' + tabName + '". Disponibles: [' + available + ']')
}

function formatDate(value) {
  if (!value) return ''
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return ''
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy')
  }
  return value.toString()
}

function formatTimestamp(value) {
  if (!value) return ''
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return ''
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss')
  }
  return value.toString()
}

function parseInputDate(str) {
  if (!str) return ''
  if (str instanceof Date) return str
  const s = str.toString()
  const datePart = s.split(' ')[0]
  const parts = datePart.split('/')
  if (parts.length !== 3) return str
  const day = parseInt(parts[0])
  const month = parseInt(parts[1]) - 1
  const year = parseInt(parts[2].length === 2 ? '20' + parts[2] : parts[2])
  return new Date(year, month, day)
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}

// ============ TESTS (ejecutar manualmente desde el editor) ============

function testGetAllPipeline() {
  const data = getAllPipeline()
  Logger.log('Total Pipeline: ' + data.length)
  if (data.length > 0) Logger.log(JSON.stringify(data[0]))
}

function testGetAllCartera() {
  const data = getAllCartera()
  Logger.log('Total Cartera: ' + data.length)
}

function testGetSettings() {
  Logger.log(JSON.stringify(getSettings()))
}

function testBackup() {
  Logger.log(JSON.stringify(doBackup()))
}

function testMigration() {
  Logger.log(JSON.stringify(doMigration()))
}
