import { useState } from 'react'
import { useCRM } from '../context/CRMContext'
import { ESTADOS_CARTERA, TIPOS_PROGRAMA } from '../config'
import { X, Save, Trash2, MessageCircle, Phone } from 'lucide-react'

// ============================================================
// ClienteForm — modal para crear/editar un cliente de Cartera.
// Se muestra cuando showClienteForm = true en CRMContext.
// ============================================================

// Fecha actual en dd/mm/yyyy
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

export default function ClienteForm() {
  const {
    editingCliente,
    settings,
    closeClienteForm,
    handleAddCliente,
    handleUpdateCliente,
    handleDeleteCliente,
  } = useCRM()

  const isEditing = !!editingCliente && editingCliente.row != null

  // Semanas default según tipo de programa (para nuevos clientes)
  const semanasDefaultFor = (tipo) =>
    tipo === 'Empresarial'
      ? settings?.semanasEmpresarialDefault || 16
      : settings?.semanasEjecutivoDefault || 12

  const [form, setForm] = useState({
    nombre:               editingCliente?.nombre || '',
    empresa:              editingCliente?.empresa || '',
    correo:               editingCliente?.correo || '',
    whatsapp:             editingCliente?.whatsapp || '',
    tipoPrograma:         editingCliente?.tipoPrograma || 'Ejecutivo',
    fechaInicio:          editingCliente?.fechaInicio || (isEditing ? '' : hoyStr()),
    semanasPrograma:      editingCliente?.semanasPrograma ?? semanasDefaultFor(editingCliente?.tipoPrograma || 'Ejecutivo'),
    estado:               editingCliente?.estado || 'Activo',
    fechaGraduacionReal:  editingCliente?.fechaGraduacionReal || '',
    resultadoDocumentado: editingCliente?.resultadoDocumentado || '',
    testimonialObtenido:  editingCliente?.testimonialObtenido || 'No',
    candidatoReferido:    editingCliente?.candidatoReferido || 'No',
    referidosGenerados:   editingCliente?.referidosGenerados ?? 0,
    montoContrato:        editingCliente?.montoContrato ?? 0,
    notas:                editingCliente?.notas || '',
    idOrigenPipeline:     editingCliente?.idOrigenPipeline ?? 0,
    fechaCreacion:        editingCliente?.fechaCreacion || hoyStr(),
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  // Al cambiar tipo de programa en un cliente nuevo, actualiza semanas default.
  const setTipo = (tipo) => {
    setForm(f => ({
      ...f,
      tipoPrograma: tipo,
      semanasPrograma: isEditing ? f.semanasPrograma : semanasDefaultFor(tipo),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.nombre.trim()) {
      setError('El nombre es requerido')
      return
    }
    if (!form.tipoPrograma) {
      setError('Selecciona un tipo de programa')
      return
    }

    setSaving(true)
    try {
      const data = {
        ...form,
        semanasPrograma:    parseFloat(form.semanasPrograma) || 0,
        referidosGenerados: parseFloat(form.referidosGenerados) || 0,
        montoContrato:      parseFloat(form.montoContrato) || 0,
        idOrigenPipeline:   parseFloat(form.idOrigenPipeline) || 0,
      }
      if (isEditing) {
        await handleUpdateCliente(editingCliente.row, data)
      } else {
        await handleAddCliente(data)
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
      await handleDeleteCliente(editingCliente.row)
      closeClienteForm()
    } catch {
      setError('Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeClienteForm} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-slide-in flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-lg font-bold text-slate-800">
            {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h3>
          <button onClick={closeClienteForm} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {/* Quick actions */}
          {isEditing && editingCliente.whatsapp && (
            <div className="flex gap-2">
              <a
                href={`https://wa.me/${editingCliente.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-600 rounded-xl text-sm font-medium hover:bg-green-100"
              >
                <MessageCircle size={16} />
                WhatsApp
              </a>
              <a
                href={`tel:${editingCliente.whatsapp}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100"
              >
                <Phone size={16} />
                Llamar
              </a>
            </div>
          )}

          {/* ===== Datos básicos ===== */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-3 tracking-wide">Datos básicos</h4>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => set('nombre', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nombre"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Empresa</label>
                <input
                  type="text"
                  value={form.empresa}
                  onChange={e => set('empresa', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Empresa"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp</label>
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={e => set('whatsapp', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="+52..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo</label>
                <input
                  type="email"
                  value={form.correo}
                  onChange={e => set('correo', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="email@..."
                />
              </div>
            </div>
          </div>

          {/* ===== Programa ===== */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-3 tracking-wide">Programa</h4>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo Programa *</label>
                <select
                  value={form.tipoPrograma}
                  onChange={e => setTipo(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {TIPOS_PROGRAMA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Estado</label>
                <select
                  value={form.estado}
                  onChange={e => set('estado', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {ESTADOS_CARTERA.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha Inicio</label>
                <input
                  type="date"
                  value={toInputDate(form.fechaInicio)}
                  onChange={e => set('fechaInicio', fromInputDate(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Semanas</label>
                <input
                  type="number"
                  value={form.semanasPrograma}
                  onChange={e => set('semanasPrograma', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="0"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Monto ($)</label>
                <input
                  type="number"
                  value={form.montoContrato}
                  onChange={e => set('montoContrato', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="0"
                  step="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha Graduación Real</label>
              <input
                type="date"
                value={toInputDate(form.fechaGraduacionReal)}
                onChange={e => set('fechaGraduacionReal', fromInputDate(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* ===== Outcomes ===== */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-3 tracking-wide">Resultados</h4>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Resultado Documentado</label>
              <textarea
                value={form.resultadoDocumentado}
                onChange={e => set('resultadoDocumentado', e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-3"
                placeholder="Métricas, KPIs, antes/después..."
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Testimonial</label>
                <select
                  value={form.testimonialObtenido}
                  onChange={e => set('testimonialObtenido', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="No">No</option>
                  <option value="Si">Si</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Referido</label>
                <select
                  value={form.candidatoReferido}
                  onChange={e => set('candidatoReferido', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="No">No</option>
                  <option value="Si">Si</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5"># Referidos</label>
                <input
                  type="number"
                  value={form.referidosGenerados}
                  onChange={e => set('referidosGenerados', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="0"
                  step="1"
                />
              </div>
            </div>
          </div>

          {/* ===== Notas ===== */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas</label>
            <textarea
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Notas internas del cliente..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl py-3 font-medium transition-colors"
            >
              <Save size={16} />
              {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Cliente'}
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
