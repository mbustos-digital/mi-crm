import { useMemo } from 'react'
import { useCRM } from '../context/CRMContext'
import {
  ESTADO_CARTERA_COLORS,
  getOcupacionCartera,
  getSemanaActual,
  getProgresoPrograma,
} from '../config'
import {
  Plus, Users, Building2, Phone, Mail, Briefcase, Award,
  MessageSquare, UserPlus, DollarSign,
} from 'lucide-react'

// ============================================================
// Cartera — lista de clientes activos con programa en curso.
// Muestra medidor de capacidad (ocupación / capacidadMaxima),
// y un grid con una card por cliente.
// ============================================================

const TIPO_PROGRAMA_COLORS = {
  Ejecutivo:   { bg: '#eef2ff', color: '#4f46e5' },
  Empresarial: { bg: '#fef3c7', color: '#b45309' },
}

function CapacityBar({ ocupados, max }) {
  const pct = Math.min(100, Math.round((ocupados / Math.max(max, 1)) * 100))
  const libres = Math.max(0, max - ocupados)
  const color =
    pct >= 100 ? '#ef4444' :
    pct >= 85  ? '#f59e0b' :
                 '#10b981'

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Capacidad de cartera</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {ocupados} de {max} slots ocupados · {libres} {libres === 1 ? 'libre' : 'libres'}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold" style={{ color }}>{pct}%</div>
        </div>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {/* Slot visual: un cuadrito por slot */}
      <div className="flex gap-1 mt-3">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-2 rounded-sm"
            style={{ backgroundColor: i < ocupados ? color : '#e2e8f0' }}
          />
        ))}
      </div>
    </div>
  )
}

function ClienteCard({ cliente, onEdit }) {
  const estadoInfo = ESTADO_CARTERA_COLORS[cliente.estado] || ESTADO_CARTERA_COLORS['Activo']
  const tipoInfo = TIPO_PROGRAMA_COLORS[cliente.tipoPrograma]
  const semana = getSemanaActual(cliente)
  const progreso = getProgresoPrograma(cliente)
  const totalSemanas = parseFloat(cliente.semanasPrograma) || 0

  return (
    <div
      onClick={() => onEdit(cliente)}
      className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Header: nombre + estado */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-slate-800 text-sm leading-tight">{cliente.nombre}</h4>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2"
          style={{ backgroundColor: estadoInfo.bg, color: estadoInfo.color }}
        >
          {cliente.estado || 'Activo'}
        </span>
      </div>

      {/* Empresa */}
      {cliente.empresa && (
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
          <Building2 size={11} />
          <span className="truncate">{cliente.empresa}</span>
        </div>
      )}

      {/* Badge tipo programa + monto */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {cliente.tipoPrograma && (
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{ backgroundColor: tipoInfo?.bg || '#f1f5f9', color: tipoInfo?.color || '#64748b' }}
          >
            <Briefcase size={10} />
            {cliente.tipoPrograma}
          </span>
        )}
        {cliente.montoContrato > 0 && (
          <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
            <DollarSign size={10} />
            {Number(cliente.montoContrato).toLocaleString('es-MX')}
          </span>
        )}
      </div>

      {/* Progreso del programa */}
      {totalSemanas > 0 && semana != null && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span>Semana {semana} de {totalSemanas}</span>
            <span className="font-medium">{progreso}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>
      )}

      {/* Outcomes */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400">
        {cliente.testimonialObtenido === 'Si' && (
          <span className="flex items-center gap-1 text-amber-600">
            <MessageSquare size={10} />
            Testimonio
          </span>
        )}
        {cliente.candidatoReferido === 'Si' && (
          <span className="flex items-center gap-1 text-indigo-600">
            <UserPlus size={10} />
            Referido
          </span>
        )}
        {parseFloat(cliente.referidosGenerados) > 0 && (
          <span className="flex items-center gap-1 text-emerald-600">
            <Award size={10} />
            {cliente.referidosGenerados} ref
          </span>
        )}
      </div>

      {/* Contacto quick actions */}
      {(cliente.whatsapp || cliente.correo) && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
          {cliente.whatsapp && (
            <a
              href={`https://wa.me/${cliente.whatsapp.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener"
              onClick={e => e.stopPropagation()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100"
            >
              <Phone size={12} />
              WhatsApp
            </a>
          )}
          {cliente.correo && (
            <a
              href={`mailto:${cliente.correo}`}
              onClick={e => e.stopPropagation()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100"
            >
              <Mail size={12} />
              Email
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function Cartera() {
  const {
    cartera,
    loadingCartera,
    settings,
    openNewCliente,
    openEditCliente,
  } = useCRM()

  // Ordenar: Activos primero, luego Pausados, Graduados, Cancelados.
  // Dentro de cada grupo, por nombre alfabético.
  const sortedCartera = useMemo(() => {
    const orden = { 'Activo': 0, 'Pausado': 1, 'Graduado': 2, 'Cancelado': 3 }
    return [...cartera].sort((a, b) => {
      const oa = orden[a.estado] ?? 99
      const ob = orden[b.estado] ?? 99
      if (oa !== ob) return oa - ob
      return (a.nombre || '').localeCompare(b.nombre || '')
    })
  }, [cartera])

  const ocupados = useMemo(() => getOcupacionCartera(cartera), [cartera])
  const capacidadMaxima = settings?.capacidadMaxima || 14

  if (loadingCartera) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Cartera</h2>
          <p className="text-sm text-slate-500 mt-1">
            {cartera.length} {cartera.length === 1 ? 'cliente' : 'clientes'} en total
          </p>
        </div>
        <button
          onClick={openNewCliente}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nuevo cliente
        </button>
      </div>

      {/* Capacity bar */}
      <CapacityBar ocupados={ocupados} max={capacidadMaxima} />

      {/* Grid de clientes */}
      {sortedCartera.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-indigo-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Cartera vacía</h3>
          <p className="text-sm text-slate-500 mb-4">
            Agrega clientes al ganar oportunidades o manualmente.
          </p>
          <button
            onClick={openNewCliente}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-sm font-medium"
          >
            <Plus size={14} />
            Agregar cliente manual
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCartera.map(cliente => (
            <ClienteCard
              key={cliente.row}
              cliente={cliente}
              onEdit={openEditCliente}
            />
          ))}
        </div>
      )}
    </div>
  )
}
