import { useState } from 'react'
import { useCRM } from '../context/CRMContext'
import { Trophy, X, Briefcase } from 'lucide-react'

// ============================================================
// CartPromptModal — se muestra cuando una oportunidad pasa a
// "Cerrado Ganado". Ofrece agregar el cliente a Cartera.
//
// FASE C: el botón "Agregar a Cartera" invoca confirmAddToCartera,
// que construye el cliente desde opp y lo persiste.
// ============================================================

export default function CartPromptModal() {
  const { cartPrompt, dismissCartPrompt, confirmAddToCartera, settings, cartera } = useCRM()
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')

  if (!cartPrompt) return null
  const { opp } = cartPrompt

  const ocupados = cartera.filter(c => c.estado === 'Activo').length
  const capacidadMaxima = settings?.capacidadMaxima || 14
  const slotsLibres = Math.max(0, capacidadMaxima - ocupados)
  const sinCapacidad = slotsLibres === 0

  const handleAgregar = async () => {
    setErr('')
    setAdding(true)
    try {
      await confirmAddToCartera()
    } catch (e) {
      setErr(e.message || 'Error al agregar a cartera')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismissCartPrompt}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-fade-in">
        {/* Close */}
        <button
          onClick={dismissCartPrompt}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg"
          aria-label="Cerrar"
        >
          <X size={18} className="text-slate-400" />
        </button>

        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy size={32} className="text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">¡Cerrado Ganado!</h3>
          <p className="text-sm text-slate-500 mt-1">
            {opp?.nombre}{opp?.empresa ? ` · ${opp.empresa}` : ''}
          </p>
          {opp?.monto > 0 && (
            <p className="text-lg font-semibold text-emerald-600 mt-2">
              ${opp.monto.toLocaleString('es-MX')}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-6 pb-2 space-y-3">
          <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
            ¿Quieres agregar este cliente a tu <b>Cartera</b> para comenzar a
            registrar su programa?
          </div>

          {/* Capacidad actual */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-500">Cartera actual</span>
            <span className={`font-semibold ${sinCapacidad ? 'text-red-500' : 'text-slate-700'}`}>
              {ocupados} / {capacidadMaxima} · {slotsLibres} {slotsLibres === 1 ? 'slot libre' : 'slots libres'}
            </span>
          </div>

          {sinCapacidad && (
            <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">
              No hay slots libres. Gradúa o pausa a un cliente antes de agregar uno nuevo.
            </div>
          )}

          {err && (
            <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{err}</div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-5 flex items-center gap-3">
          <button
            onClick={dismissCartPrompt}
            disabled={adding}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            Por ahora no
          </button>
          <button
            onClick={handleAgregar}
            disabled={adding || sinCapacidad}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
          >
            <Briefcase size={16} />
            {adding ? 'Agregando...' : 'Agregar a Cartera'}
          </button>
        </div>
      </div>
    </div>
  )
}
