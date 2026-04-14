import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  fetchOpportunities,
  addOpportunity,
  updateOpportunity,
  deleteOpportunity,
  clearCache,
  fetchCartera,
  addToCartera,
  updateCartera as apiUpdateCartera,
  deleteCartera as apiDeleteCartera,
  fetchSettings,
} from '../api'
import { SETTINGS_DEFAULTS } from '../config'

const CRMContext = createContext(null)

export function useCRM() {
  const ctx = useContext(CRMContext)
  if (!ctx) throw new Error('useCRM must be used within CRMProvider')
  return ctx
}

// Helper: formatea fecha actual en "dd/mm/yyyy"
function hoyStr() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function CRMProvider({ children }) {
  // ----- Pipeline -----
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingOpp, setEditingOpp] = useState(null)
  const [showForm, setShowForm] = useState(false)

  // Hints de UI para el formulario (no se persisten, solo guían al modal)
  // forceTab: 'general' | 'seguimiento' | 'cierre' | null
  // requireRazon: si true, el form bloquea guardado hasta elegir razonPerdida
  const [formHints, setFormHints] = useState({ forceTab: null, requireRazon: false })

  // Prompt "¿Agregar a Cartera?" al mover a Cerrado Ganado. null = oculto.
  const [cartPrompt, setCartPrompt] = useState(null)

  // ----- Cartera -----
  const [cartera, setCartera] = useState([])
  const [loadingCartera, setLoadingCartera] = useState(true)
  const [editingCliente, setEditingCliente] = useState(null)
  const [showClienteForm, setShowClienteForm] = useState(false)

  // ----- Settings (capacidadMaxima, precios/semanas default) -----
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS)

  // ============================================================
  // Loaders
  // ============================================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchOpportunities()
      setOpportunities(data)
    } catch (err) {
      setError('Error al cargar datos. Verifica tu conexión.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCartera = useCallback(async () => {
    try {
      setLoadingCartera(true)
      const data = await fetchCartera()
      setCartera(data)
    } catch (err) {
      console.error('Error cargando cartera:', err)
    } finally {
      setLoadingCartera(false)
    }
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const data = await fetchSettings()
      setSettings({ ...SETTINGS_DEFAULTS, ...data })
    } catch (err) {
      console.error('Error cargando settings:', err)
      // Mantiene defaults locales
    }
  }, [])

  useEffect(() => {
    loadData()
    loadCartera()
    loadSettings()
  }, [loadData, loadCartera, loadSettings])

  // ============================================================
  // PIPELINE handlers
  // ============================================================

  const resetFormState = () => {
    setShowForm(false)
    setEditingOpp(null)
    setFormHints({ forceTab: null, requireRazon: false })
  }

  const handleAdd = async (opp) => {
    await addOpportunity(opp)
    await loadData()
    resetFormState()
  }

  const handleUpdate = async (row, opp) => {
    await updateOpportunity(row, opp)
    await loadData()
    resetFormState()
  }

  const handleDelete = async (row) => {
    await deleteOpportunity(row)
    await loadData()
  }

  // Cambio de etapa con reglas de Cerrado Perdido / Cerrado Ganado.
  const handleStageChange = async (row, newStage) => {
    const opp = opportunities.find(o => o.row === row)
    if (!opp) return

    // REGLA — Cerrado Perdido:
    // Abre el modal en Tab "Cierre" con razonPerdida obligatoria.
    // NO persiste el cambio hasta que el usuario complete y guarde.
    if (newStage === 'Cerrado Perdido') {
      setEditingOpp({ ...opp, estadoActual: newStage, fechaActualizacion: hoyStr() })
      setFormHints({ forceTab: 'cierre', requireRazon: true })
      setShowForm(true)
      return
    }

    // Todos los demás stages: persiste el cambio directo.
    const updatedOpp = { ...opp, estadoActual: newStage, fechaActualizacion: hoyStr() }
    await updateOpportunity(row, updatedOpp)
    await loadData()

    // REGLA — Cerrado Ganado:
    // Después de guardar, abre el prompt "¿Agregar a Cartera?"
    if (newStage === 'Cerrado Ganado') {
      setCartPrompt({ opp: updatedOpp })
    }
  }

  const openNew = () => {
    setEditingOpp(null)
    setFormHints({ forceTab: null, requireRazon: false })
    setShowForm(true)
  }

  const openEdit = (opp) => {
    setEditingOpp(opp)
    setFormHints({ forceTab: null, requireRazon: false })
    setShowForm(true)
  }

  const closeForm = () => {
    resetFormState()
  }

  const refresh = () => {
    clearCache()
    loadData()
    loadCartera()
    loadSettings()
  }

  // ============================================================
  // CARTERA handlers
  // ============================================================

  const resetClienteFormState = () => {
    setShowClienteForm(false)
    setEditingCliente(null)
  }

  const openNewCliente = () => {
    setEditingCliente(null)
    setShowClienteForm(true)
  }

  const openEditCliente = (cliente) => {
    setEditingCliente(cliente)
    setShowClienteForm(true)
  }

  const closeClienteForm = () => {
    resetClienteFormState()
  }

  const handleAddCliente = async (cliente) => {
    await addToCartera(cliente)
    await loadCartera()
    resetClienteFormState()
  }

  const handleUpdateCliente = async (row, cliente) => {
    await apiUpdateCartera(row, cliente)
    await loadCartera()
    resetClienteFormState()
  }

  const handleDeleteCliente = async (row) => {
    await apiDeleteCartera(row)
    await loadCartera()
  }

  // ============================================================
  // Flujo "¿Agregar a Cartera?" tras Cerrado Ganado
  // ============================================================

  const dismissCartPrompt = () => setCartPrompt(null)

  // Abre el CartPromptModal manualmente para una opp existente en
  // Cerrado Ganado. Usado por los botones "→ Cartera" en Pipeline/Lista
  // y por la sección de importables del empty state de Cartera.
  const openCartPromptForOpp = (opp) => {
    if (!opp) return
    setCartPrompt({ opp })
  }

  // Construye cliente desde opp y lo agrega a cartera.
  // - tipoPrograma / empresa / contacto: del opp
  // - semanasPrograma: usa el default de settings según tipoPrograma
  // - montoContrato: del opp.monto
  // - fechaInicio / fechaCreacion: hoy
  // - estado: 'Activo'
  // - idOrigenPipeline: row del opp (trazabilidad)
  const confirmAddToCartera = async () => {
    if (!cartPrompt?.opp) {
      setCartPrompt(null)
      return
    }
    const opp = cartPrompt.opp
    const semanasDefault =
      opp.tipoPrograma === 'Empresarial'
        ? settings.semanasEmpresarialDefault
        : settings.semanasEjecutivoDefault

    const cliente = {
      nombre:              opp.nombre || '',
      empresa:             opp.empresa || '',
      correo:              opp.correo || '',
      whatsapp:            opp.whatsapp || '',
      tipoPrograma:        opp.tipoPrograma || 'Ejecutivo',
      fechaInicio:         hoyStr(),
      semanasPrograma:     semanasDefault,
      estado:              'Activo',
      fechaGraduacionReal: '',
      resultadoDocumentado: '',
      testimonialObtenido: 'No',
      candidatoReferido:   'No',
      referidosGenerados:  0,
      montoContrato:       parseFloat(opp.monto) || 0,
      notas:               '',
      idOrigenPipeline:    opp.row || 0,
      fechaCreacion:       hoyStr(),
    }

    try {
      await addToCartera(cliente)
      await loadCartera()
    } catch (err) {
      console.error('Error agregando a cartera:', err)
      // No cerramos el prompt si falló; el usuario ve el error en consola
      return
    }
    setCartPrompt(null)
  }

  // ============================================================
  // Context value
  // ============================================================

  const value = {
    // Pipeline
    opportunities,
    loading,
    error,
    editingOpp,
    showForm,
    formHints,
    cartPrompt,
    handleAdd,
    handleUpdate,
    handleDelete,
    handleStageChange,
    openNew,
    openEdit,
    closeForm,
    refresh,

    // Cartera
    cartera,
    loadingCartera,
    editingCliente,
    showClienteForm,
    openNewCliente,
    openEditCliente,
    closeClienteForm,
    handleAddCliente,
    handleUpdateCliente,
    handleDeleteCliente,

    // Settings
    settings,

    // Cart prompt
    dismissCartPrompt,
    confirmAddToCartera,
    openCartPromptForOpp,
  }

  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>
}
