// ============================================================
// VALIDATIONS AUDIT — Pipeline tab (standalone)
// ============================================================
//
// Compara las reglas de data validation de cada columna con
// dropdown contra la fuente de verdad (config.js del frontend).
// Sirve para detectar mismatches del tipo "frontend permite C
// pero el Sheet rechaza todo lo que no sea A o B".
//
// USO (standalone — no requiere Code.v2.gs):
//   1) Ve a https://script.google.com
//   2) Clic en "+ Nuevo proyecto"
//   3) Borra el contenido default, pega este archivo entero
//   4) Guarda (Cmd+S) — ponle nombre "CRM Validations Audit"
//   5) Menú desplegable arriba: elige auditValidations
//   6) Clic Run (▶️). Autoriza permisos la primera vez.
//   7) Ve al icono ⌚ Executions del sidebar izq → clic en la
//      última ejecución → ve los Logs.
// ============================================================

// --- Constantes standalone ---
const SHEET_ID_AUDIT = '1Zoh1CIvUZIQa--5GYHWw4SaMAD9co19waAxS5Hr5_yE'
const PIPELINE_TAB_AUDIT = 'Versión Dueño de negocio'
const PIPELINE_DATA_START_ROW_AUDIT = 4

// Valores esperados — DEBEN coincidir con src/config.js del frontend.
// Si cambias estos, recuerda actualizar config.js también.
const EXPECTED_VALIDATIONS = [
  {
    col: 6, // F
    name: 'metodoProspeccion',
    values: ['Circulo Rojo', 'Landing VSL', 'Organico Redes', 'Referido', 'Otro'],
  },
  {
    col: 7, // G
    name: 'estadoActual',
    values: [
      'Agendado',
      'J1 Realizada',
      'Calificado',
      'J2 Agendada',
      'J2 Realizada',
      'Cerrado Ganado',
      'Cerrado Perdido',
      'No Show',
    ],
  },
  {
    col: 8, // H
    name: 'probabilidad',
    values: ['Mas de 70%', 'Alto', 'Medio', 'Bajo'],
  },
  {
    col: 9, // I
    name: 'potencial',
    values: ['A', 'B'],
  },
  {
    col: 13, // M
    name: 'tipoPrograma',
    values: ['Ejecutivo', 'Empresarial'],
  },
  {
    col: 20, // T
    name: 'razonPerdida',
    values: [
      'No calificó',
      'Fantasmeó',
      'Precio',
      'Timing',
      'Competencia',
      'Sin respuesta',
      'Otro',
    ],
  },
]

/**
 * Lee la regla de validación actual de una columna (fila 4, la primera con data).
 * Retorna la lista de valores permitidos o null si no hay regla LIST_OF_VALUES.
 */
function getValidationValues(sheet, colIndex) {
  const cell = sheet.getRange(PIPELINE_DATA_START_ROW_AUDIT, colIndex, 1, 1)
  const rule = cell.getDataValidation()
  if (!rule) return null
  const criteria = rule.getCriteriaType()
  const args = rule.getCriteriaValues()
  // Apps Script tipos: VALUE_IN_LIST (lista directa) y VALUE_IN_RANGE (rango)
  if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    return args[0] // array de strings
  }
  if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    const range = args[0]
    return range.getValues().flat().filter(v => v !== '' && v != null).map(String)
  }
  return null // otro tipo (número, fecha, regex, etc.)
}

/**
 * Compara dos arrays de strings como conjuntos.
 * Retorna { missing, extra } — valores que faltan y que sobran en sheet.
 */
function diffSets(expected, actual) {
  const exp = new Set(expected)
  const act = new Set(actual || [])
  const missing = [...exp].filter(v => !act.has(v))
  const extra = [...act].filter(v => !exp.has(v))
  return { missing, extra }
}

/**
 * AUDIT — lee las reglas actuales y compara con EXPECTED_VALIDATIONS.
 * Solo reporta, NO modifica nada.
 */
function auditValidations() {
  const ss = SpreadsheetApp.openById(SHEET_ID_AUDIT)
  const sheet = ss.getSheetByName(PIPELINE_TAB_AUDIT)
  if (!sheet) {
    Logger.log('❌ No se encontró tab: ' + PIPELINE_TAB_AUDIT)
    return
  }

  Logger.log('═══════════════════════════════════════════')
  Logger.log('AUDIT de validaciones — tab: ' + PIPELINE_TAB_AUDIT)
  Logger.log('═══════════════════════════════════════════')

  let okCount = 0
  let mismatchCount = 0

  for (const cfg of EXPECTED_VALIDATIONS) {
    const letter = columnToLetter_(cfg.col)
    const actual = getValidationValues(sheet, cfg.col)

    if (actual === null) {
      Logger.log(`⚠️  Col ${letter} (${cfg.name}): NO tiene validación (debería tener ${cfg.values.length} valores)`)
      mismatchCount++
      continue
    }

    const diff = diffSets(cfg.values, actual)
    if (diff.missing.length === 0 && diff.extra.length === 0) {
      Logger.log(`✅  Col ${letter} (${cfg.name}): OK — ${actual.length} valores coinciden`)
      okCount++
    } else {
      Logger.log(`❌  Col ${letter} (${cfg.name}): MISMATCH`)
      Logger.log(`     Sheet tiene: [${actual.join(', ')}]`)
      Logger.log(`     Frontend esperaba: [${cfg.values.join(', ')}]`)
      if (diff.missing.length) Logger.log(`     Falta en Sheet: [${diff.missing.join(', ')}]`)
      if (diff.extra.length) Logger.log(`     Sobra en Sheet: [${diff.extra.join(', ')}]`)
      mismatchCount++
    }
  }

  Logger.log('───────────────────────────────────────────')
  Logger.log(`Total: ${okCount} OK · ${mismatchCount} con problemas`)
  if (mismatchCount > 0) {
    Logger.log('')
    Logger.log('👉 Para aplicar el fix: corre fixValidations()')
  } else {
    Logger.log('')
    Logger.log('🎉 Todo alineado — no hay nada que corregir.')
  }
}

/**
 * FIX — actualiza las validaciones del Pipeline para que coincidan
 * con EXPECTED_VALIDATIONS. Afecta desde fila 4 hasta la última fila
 * que tenga datos + 200 filas de buffer para futuras entradas.
 *
 * Confirma en el log qué se cambió. NO toca data existente; solo la
 * regla de validación.
 */
function fixValidations() {
  const ss = SpreadsheetApp.openById(SHEET_ID_AUDIT)
  const sheet = ss.getSheetByName(PIPELINE_TAB_AUDIT)
  if (!sheet) {
    Logger.log('❌ No se encontró tab: ' + PIPELINE_TAB_AUDIT)
    return
  }

  const lastRow = Math.max(sheet.getLastRow(), PIPELINE_DATA_START_ROW_AUDIT)
  const bufferRows = 200
  const numRows = lastRow - PIPELINE_DATA_START_ROW_AUDIT + 1 + bufferRows

  Logger.log('═══════════════════════════════════════════')
  Logger.log('FIX de validaciones — tab: ' + PIPELINE_TAB_AUDIT)
  Logger.log(`Rango: fila ${PIPELINE_DATA_START_ROW_AUDIT} a ${PIPELINE_DATA_START_ROW_AUDIT + numRows - 1}`)
  Logger.log('═══════════════════════════════════════════')

  for (const cfg of EXPECTED_VALIDATIONS) {
    const letter = columnToLetter_(cfg.col)
    const range = sheet.getRange(PIPELINE_DATA_START_ROW_AUDIT, cfg.col, numRows, 1)
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(cfg.values, true) // true = mostrar dropdown
      .setAllowInvalid(true) // advertir, no bloquear (permite blanco)
      .setHelpText(`Valor esperado: ${cfg.values.join(' / ')}`)
      .build()
    range.setDataValidation(rule)
    Logger.log(`✅  Col ${letter} (${cfg.name}): validación actualizada con ${cfg.values.length} valores`)
  }

  Logger.log('───────────────────────────────────────────')
  Logger.log('🎉 Fix completado. Corre auditValidations() para verificar.')
}

/**
 * Helper: convierte índice de columna 1-based a letra (1 → A, 9 → I, 13 → M).
 */
function columnToLetter_(col) {
  let letter = ''
  let n = col
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}
