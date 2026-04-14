// ============================================================
// GOOGLE APPS SCRIPT - Backend para Mi CRM
// ============================================================
//
// INSTRUCCIONES DE DESPLIEGUE:
// 1. Abre https://script.google.com
// 2. Crea un nuevo proyecto y nómbralo "Mi CRM API"
// 3. Pega TODO este código en el archivo Code.gs
// 4. Ve a Implementar > Nueva implementación
// 5. Tipo: "App web"
// 6. Ejecutar como: "Yo" (tu cuenta)
// 7. Quién tiene acceso: "Cualquier persona"
// 8. Clic en "Implementar"
// 9. Copia la URL del despliegue
// 10. Pega la URL en src/config.js de tu app React
//
// IMPORTANTE: Si haces cambios aquí, debes crear una NUEVA
// implementación (no editar la existente) para que se reflejen.
// ============================================================

const SHEET_ID = '1Zoh1CIvUZIQa--5GYHWw4SaMAD9co19waAxS5Hr5_yE'
const TAB_NAME = 'Versión Dueño de negocio'
const HEADER_ROW = 3
const DATA_START_ROW = 4
const NUM_COLUMNS = 12 // A-L (A=1, L=12)

// Columnas: A=FechaPrimerContacto, B=FechaActualizacion, C=Nombre,
// D=Whatsapp, E=Correo, F=MetodoProspeccion, G=EstadoActual,
// H=Probabilidad, I=Potencial, J=Monto, K=Notas, L=ProximoSeguimiento

function doGet(e) {
  try {
    const action = e.parameter.action || 'getAll'

    if (action === 'getAll') {
      return jsonResponse(getAllOpportunities())
    }

    // Mutaciones via GET (evita CORS con Apps Script)
    const payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : {}

    if (action === 'add') {
      return jsonResponse(addOpportunity(payload.opportunity))
    } else if (action === 'update') {
      return jsonResponse(updateOpportunity(payload.row, payload.opportunity))
    } else if (action === 'delete') {
      return jsonResponse(deleteOpportunity(payload.row))
    }

    return jsonResponse({ error: 'Acción no válida' })
  } catch (err) {
    return jsonResponse({ error: err.message })
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents)
    const action = data.action

    if (action === 'add') {
      return jsonResponse(addOpportunity(data.opportunity))
    } else if (action === 'update') {
      return jsonResponse(updateOpportunity(data.row, data.opportunity))
    } else if (action === 'delete') {
      return jsonResponse(deleteOpportunity(data.row))
    }

    return jsonResponse({ error: 'Acción no válida' })
  } catch (err) {
    return jsonResponse({ error: err.message })
  }
}

function getAllOpportunities() {
  const sheet = getSheet()
  const lastRow = sheet.getLastRow()

  if (lastRow < DATA_START_ROW) return []

  const range = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, NUM_COLUMNS)
  const values = range.getValues()

  return values
    .map((row, index) => ({
      row: index + DATA_START_ROW,
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
    }))
    .filter(opp => opp.nombre && opp.nombre.trim() !== '')
}

function addOpportunity(opp) {
  const sheet = getSheet()

  // Buscar primera fila vacía (donde nombre está vacío)
  const lastRow = Math.max(sheet.getLastRow(), DATA_START_ROW)
  const searchRange = sheet.getRange(DATA_START_ROW, 3, lastRow - DATA_START_ROW + 50, 1)
  const nameCol = searchRange.getValues()

  let targetRow = DATA_START_ROW
  for (let i = 0; i < nameCol.length; i++) {
    if (!nameCol[i][0] || nameCol[i][0].toString().trim() === '') {
      targetRow = DATA_START_ROW + i
      break
    }
    targetRow = DATA_START_ROW + i + 1
  }

  const values = oppToRow(opp)
  sheet.getRange(targetRow, 1, 1, NUM_COLUMNS).setValues([values])

  return { success: true, row: targetRow }
}

function updateOpportunity(row, opp) {
  const sheet = getSheet()
  const values = oppToRow(opp)
  sheet.getRange(row, 1, 1, NUM_COLUMNS).setValues([values])
  return { success: true }
}

function deleteOpportunity(row) {
  const sheet = getSheet()
  // Limpiar contenido en vez de eliminar fila (preserva formato)
  sheet.getRange(row, 1, 1, NUM_COLUMNS).clearContent()
  return { success: true }
}

// ============ Helpers ============

function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID)
  return ss.getSheetByName(TAB_NAME)
}

function oppToRow(opp) {
  return [
    parseInputDate(opp.fechaPrimerContacto),
    parseInputDate(opp.fechaActualizacion) || new Date(),
    opp.nombre || '',
    opp.whatsapp || '',
    opp.correo || '',
    opp.metodoProspeccion || '',
    opp.estadoActual || 'Oportunidad',
    opp.probabilidad || '',
    opp.potencial || '',
    parseFloat(opp.monto) || 0,
    opp.notas || '',
    parseInputDate(opp.proximoSeguimiento),
  ]
}

function formatDate(value) {
  if (!value) return ''
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return ''
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy')
  }
  return value.toString()
}

function parseInputDate(str) {
  if (!str) return ''
  // Formato esperado: dd/MM/yyyy
  const parts = str.split('/')
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

// ============ Test (ejecutar manualmente) ============

function testGetAll() {
  const data = getAllOpportunities()
  Logger.log('Total oportunidades: ' + data.length)
  Logger.log(JSON.stringify(data[0]))
}
