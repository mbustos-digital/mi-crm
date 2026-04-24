import { useState, useEffect } from 'react'
import { useCRM } from '../context/CRMContext'
import {
  STAGES,
  METODOS_PROSPECCION,
  PROBABILIDADES,
  POTENCIALES,
  TIPOS_PROGRAMA,
  RAZONES_PERDIDA,
} from '../config'
import { X, Save, Trash2, MessageCircle, Phone } from 'lucide-react'

// ============================================================
// OpportunityForm — modal con 3 tabs (General / Seguimiento / Cierre)
// ============================================================
//
// Lee `formHints` del contexto:
//   - forceTab:      'general' | 'seguimiento' | 'cierre' | null
//                    si viene seteado, fuerza apertura en ese tab.
//   - requireRazon:  si true, bloquea guardado hasta elegir razonPerdida.
//                    Se activa cuando el usuario mueve una card a
//                    "Cerrado Perdido" desde el Kanban.
// ============================================================

const DEFAULT_STAGE = 'Agendado'

const TABS = [
  { id: 'general',     label: 'General'     },
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'cierre',      label: 'Cierre'      },
]

// Fecha actual en formato dd/mm/yyyy (coincide con parseDate en config.js)
function hoyStr() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// dd/mm/yyyy → yyyy-mm-dd (para input[type=date])
function toInputDate(str) {
  if (!str) return ''
  const p = str.split(' ')[0].split('/')
  if (p.length !== 3) return ''
  const year = p[2].length === 2 ? '20' + p[2] : p[2]
  return `${year}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
}

// yyyy-mm-dd → dd/mm/yyyy
function fromInputDate(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

export default function OpportunityForm() {
  const {
    editingOpp,
    formHints,
    closeForm,
    handleAdd,
    handleUpdate,
    handleDelete,
    settings,
  } = useCRM()

  const isEditing = !!editingOpp && editingOpp.row != null
  const todayStr = hoyStr()

  // Tab activo — si formHints.forceTab viene seteado, lo respeta al abrir.
  const [activeTab, setActiveTab] = useState(formHints?.forceTab || 'general')
  useEffect(() => {
    if (formHints?.forceTab) setActiveTab(formHints.forceTab)
  }, [formHints?.forceTab])

  // ----- Estado del formulario (hidrata desde editingOpp si existe) -----
  const [form, setForm] = useState({
    // General
    nombre:              editingOpp?.nombre || '',
    empresa:             editingOpp?.empresa || '',
    whatsapp:            editingOpp?.whatsapp || '',
    correo:              editingOpp?.correo || '',
    metodoProspeccion:   editingOpp?.metodoProspeccion || '',
    estadoActual:        editingOpp?.estadoActual || DEFAULT_STAGE,
    probabilidad:        editingOpp?.probabilidad || '',
    potencial:           editingOpp?.potencial || '',
    monto:               editingOpp?.monto ?? 0,
    tipoPrograma:        editingOpp?.tipoPrograma || '',
    precioPrograma:      editingOpp?.precioPrograma ?? '',
    descuentoAplicado:   editingOpp?.descuentoAplicado ?? '',
    razonDescuento:      editingOpp?.razonDescuento || '',
    fechaPrimerContacto: editingOpp?.fechaPrimerContacto || (isEditing ? '' : todayStr),
    notas:               editingOpp?.notas || '',

    // Seguimiento
    fechaJunta1:         editingOpp?.fechaJunta1 || '',
    showJunta1:          editingOpp?.showJunta1 || '',
    fechaJunta2:         editingOpp?.fechaJunta2 || '',
    ultimaActividad:     editingOpp?.ultimaActividad || '',
    proximoSeguimiento:  editingOpp?.proximoSeguimiento || '',
    estadoSeguimiento:   editingOpp?.estadoSeguimiento || '',

    // Cierre
    razonPerdida:        editingOpp?.razonPerdida || '',
    notasPerdida:        editingOpp?.notasPerdida || '',
    fechaCierre:         editingOpp?.fechaCierre || '',

    // Metadata (no editable)
    fechaActualizacion:  todayStr,
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  // ----- Auto-sync de campos de dinero -----
  //
  // REGLA 1 — monto = precioPrograma − descuentoAplicado
  //   Se recalcula cada vez que cambia precio o descuento. Si ambos están
  //   vacíos no hace nada (respeta el monto manual que ya tenga el form).
  //
  // REGLA 2 — precioPrograma default según tipoPrograma
  //   Al elegir "Ejecutivo" o "Empresarial", si el precio está vacío, se
  //   llena con el default de settings (precioEjecutivoDefault /
  //   precioEmpresarialDefault). Si el usuario ya escribió un precio, no
  //   se sobrescribe.
  useEffect(() => {
    const precioStr = form.precioPrograma
    const descuentoStr = form.descuentoAplicado
    // Si NO hay precio definido, no tocamos monto (permite entrada manual
    // directa de monto en oportunidades legacy sin precio).
    if (precioStr === '' || precioStr == null) return
    const precio = parseFloat(precioStr) || 0
    const descuento = parseFloat(descuentoStr) || 0
    const calculado = Math.max(0, precio - descuento)
    setForm(f => (f.monto === calculado ? f : { ...f, monto: calculado }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.precioPrograma, form.descuentoAplicado])

  useEffect(() => {
    if (!form.tipoPrograma) return
    if (form.precioPrograma !== '' && form.precioPrograma != null) return
    const def =
      form.tipoPrograma === 'Empresarial'
        ? settings?.precioEmpresarialDefault
        : form.tipoPrograma === 'Ejecutivo'
          ? settings?.precioEjecutivoDefault
          : null
    if (def != null) {
      setForm(f => (f.precioPrograma === '' || f.precioPrograma == null ? { ...f, precioPrograma: def } : f))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tipoPrograma])

  // ----- Submit -----
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.nombre.trim()) {
      setError('El nombre es requerido')
      setActiveTab('general')
      return
    }

    // REGLA — Cerrado Perdido requiere razonPerdida.
    // Aplica si el estadoActual es Cerrado Perdido, ya sea porque el
    // usuario lo eligió en el select o porque formHints.requireRazon
    // fue seteado al arrastrar desde el Kanban.
    const esCerradoPerdido = form.estadoActual === 'Cerrado Perdido'
    if ((esCerradoPerdido || formHints?.requireRazon) && !form.razonPerdida) {
      setError('Debes elegir una razón de pérdida antes de guardar')
      setActiveTab('cierre')
      return
    }

    setSaving(true)
    try {
      const data = {
        ...form,
        monto:             parseFloat(form.monto) || 0,
        precioPrograma:    form.precioPrograma === '' ? '' : (parseFloat(form.precioPrograma) || 0),
        descuentoAplicado: form.descuentoAplicado === '' ? '' : (parseFloat(form.descuentoAplicado) || 0),
      }
      if (isEditing) {
        await handleUpdate(editingOpp.row, data)
      } else {
        await handleAdd(data)
      }
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    try {
      await handleDelete(editingOpp.row)
      closeForm()
    } catch {
      setError('Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  // ============================================================
  // Render helpers — cada tab es una función que devuelve JSX
  // ============================================================

  const renderGeneral = () => (
    <div className="space-y-5">
      {/* Quick actions */}
      {isEditing && editingOpp.whatsapp && (
        <div className="flex gap-2">
          <a
            href={`https://wa.me/${editingOpp.whatsapp.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-600 rounded-xl text-sm font-medium hover:bg-green-100"
          >
            <MessageCircle size={16} />
            WhatsApp
          </a>
          <a
            href={`tel:${editingOpp.whatsapp}`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100"
          >
            <Phone size={16} />
            Llamar
          </a>
        </div>
      )}

      {/* Nombre + Empresa */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre *</label>
          <input
            type="text"
            value={form.nombre}
            onChange={e => set('nombre', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Nombre del contacto"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Empresa</label>
          <input
            type="text"
            value={form.empresa}
            onChange={e => set('empresa', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Nombre de la empresa"
          />
        </div>
      </div>

      {/* Contacto */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp</label>
          <input
            type="tel"
            value={form.whatsapp}
            onChange={e => set('whatsapp', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="+52..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo</label>
          <input
            type="email"
            value={form.correo}
            onChange={e => set('correo', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="email@ejemplo.com"
          />
        </div>
      </div>

      {/* Estado + Método prospección */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Estado Actual</label>
          <select
            value={form.estadoActual}
            onChange={e => set('estadoActual', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Método Prospección</label>
          <select
            value={form.metodoProspeccion}
            onChange={e => set('metodoProspeccion', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Seleccionar...</option>
            {METODOS_PROSPECCION.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Probabilidad / Potencial / Monto */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Probabilidad</label>
          <select
            value={form.probabilidad}
            onChange={e => set('probabilidad', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Sin definir</option>
            {PROBABILIDADES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Potencial</label>
          <select
            value={form.potencial}
            onChange={e => set('potencial', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Sin definir</option>
            {POTENCIALES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Monto ($)
            <span className="ml-1 text-[10px] font-normal text-slate-400">· auto</span>
          </label>
          <input
            type="number"
            value={form.monto}
            onChange={e => set('monto', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-100 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            min="0"
            step="100"
            title="Se calcula automáticamente como Precio Programa − Descuento. Puedes sobrescribir manualmente si es necesario."
          />
        </div>
      </div>

      {/* Tipo de programa + Precio + Descuento */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo Programa</label>
          <select
            value={form.tipoPrograma}
            onChange={e => set('tipoPrograma', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Sin definir</option>
            {TIPOS_PROGRAMA.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Precio Programa ($)
            {form.tipoPrograma && settings && (
              <span className="ml-1 text-[10px] font-normal text-slate-400">
                · default {form.tipoPrograma === 'Empresarial'
                  ? settings.precioEmpresarialDefault?.toLocaleString('es-MX')
                  : settings.precioEjecutivoDefault?.toLocaleString('es-MX')}
              </span>
            )}
          </label>
          <input
            type="number"
            value={form.precioPrograma}
            onChange={e => set('precioPrograma', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            min="0"
            step="100"
            placeholder={form.tipoPrograma && settings
              ? (form.tipoPrograma === 'Empresarial'
                ? String(settings.precioEmpresarialDefault ?? '')
                : String(settings.precioEjecutivoDefault ?? ''))
              : ''}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Descuento ($)</label>
          <input
            type="number"
            value={form.descuentoAplicado}
            onChange={e => set('descuentoAplicado', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            min="0"
            step="100"
          />
        </div>
      </div>

      {/* Razón descuento */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Razón del Descuento</label>
        <input
          type="text"
          value={form.razonDescuento}
          onChange={e => set('razonDescuento', e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Opcional"
        />
      </div>

      {/* Fecha primer contacto */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha Primer Contacto</label>
        <input
          type="date"
          value={toInputDate(form.fechaPrimerContacto)}
          onChange={e => set('fechaPrimerContacto', fromInputDate(e.target.value))}
          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Notas generales */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas</label>
        <textarea
          value={form.notas}
          onChange={e => set('notas', e.target.value)}
          rows={4}
          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          placeholder="Notas generales de la oportunidad..."
        />
      </div>
    </div>
  )

  const renderSeguimiento = () => (
    <div className="space-y-5">
      {/* Junta 1 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha Junta 1</label>
          <input
            type="date"
            value={toInputDate(form.fechaJunta1)}
            onChange={e => set('fechaJunta1', fromInputDate(e.target.value))}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Show Junta 1</label>
          <select
            value={form.showJunta1}
            onChange={e => set('showJunta1', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Sin definir</option>
            <option value="Si">Si</option>
            <option value="No">No</option>
          </select>
        </div>
      </div>

      {/* Junta 2 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha Junta 2</label>
        <input
          type="date"
          value={toInputDate(form.fechaJunta2)}
          onChange={e => set('fechaJunta2', fromInputDate(e.target.value))}
          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Última actividad + Próximo seguimiento */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Última Actividad</label>
          <input
            type="date"
            value={toInputDate(form.ultimaActividad)}
            onChange={e => set('ultimaActividad', fromInputDate(e.target.value))}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Próximo Seguimiento</label>
          <input
            type="date"
            value={toInputDate(form.proximoSeguimiento)}
            onChange={e => set('proximoSeguimiento', fromInputDate(e.target.value))}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Estado seguimiento (texto libre) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Estado Seguimiento</label>
        <textarea
          value={form.estadoSeguimiento}
          onChange={e => set('estadoSeguimiento', e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          placeholder="Notas específicas de la última interacción / próximo paso..."
        />
      </div>
    </div>
  )

  const renderCierre = () => {
    const razonRequerida = form.estadoActual === 'Cerrado Perdido' || formHints?.requireRazon
    return (
      <div className="space-y-5">
        {razonRequerida && (
          <div className="bg-amber-50 text-amber-700 text-sm rounded-lg px-4 py-3">
            Esta oportunidad va a <b>Cerrado Perdido</b>. Debes elegir una razón antes de guardar.
          </div>
        )}

        {/* Razón pérdida */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Razón de Pérdida {razonRequerida && <span className="text-red-500">*</span>}
          </label>
          <select
            value={form.razonPerdida}
            onChange={e => set('razonPerdida', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Seleccionar...</option>
            {RAZONES_PERDIDA.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Notas pérdida */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas de Pérdida</label>
          <textarea
            value={form.notasPerdida}
            onChange={e => set('notasPerdida', e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            placeholder="Contexto adicional, aprendizajes, etc."
          />
        </div>

        {/* Fecha cierre */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha de Cierre</label>
          <input
            type="date"
            value={toInputDate(form.fechaCierre)}
            onChange={e => set('fechaCierre', fromInputDate(e.target.value))}
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>
    )
  }

  // ============================================================
  // Layout
  // ============================================================
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeForm} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-slide-in flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-lg font-bold text-slate-800">
            {isEditing ? 'Editar Oportunidad' : 'Nueva Oportunidad'}
          </h3>
          <button onClick={closeForm} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="sticky top-[65px] bg-white border-b border-slate-100 px-6 z-10">
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {activeTab === 'general'     && renderGeneral()}
          {activeTab === 'seguimiento' && renderSeguimiento()}
          {activeTab === 'cierre'      && renderCierre()}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl py-3 font-medium transition-colors"
            >
              <Save size={16} />
              {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Oportunidad'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleDeleteClick}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
                  confirmDelete
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
              >
                <Trash2 size={16} />
                {confirmDelete ? 'Confirmar' : 'Eliminar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
