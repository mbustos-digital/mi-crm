import { useMemo } from 'react'
import { useCRM } from '../context/CRMContext'
import {
  STAGES,
  CLOSED_STAGES,
  PROBABILIDADES_PONDERADAS,
  TIPOS_PROGRAMA,
  ESTADOS_CARTERA,
  ESTADO_CARTERA_COLORS,
  getValorPonderado,
  getPipelinePonderado,
  getOcupacionCartera,
  estaInactiva,
} from '../config'
import {
  TrendingUp, Users, DollarSign, Target, BarChart3,
  Percent, Star, Award, AlertCircle, Briefcase,
  MessageSquare, UserPlus, Gauge,
} from 'lucide-react'

// ============================================================
// Dashboard — KPIs operativos de Pipeline + Cartera.
// Incluye:
//  - Panel de Capacidad Operativa (cartera vs capacidadMaxima)
//  - KPIs de Pipeline (8 cards) + Embudo ponderado
//  - KPIs de Cartera (4 cards) + distribuciones
// ============================================================

function StatCard({ icon: Icon, label, value, subvalue, color }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <span className="text-sm text-slate-500 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {subvalue && <div className="text-xs text-slate-400 mt-1">{subvalue}</div>}
    </div>
  )
}

function BarChart({ data, maxValue, colorFn }) {
  return (
    <div className="space-y-3">
      {data.map(item => (
        <div key={item.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-600">{item.label}</span>
            <span className="text-sm font-semibold text-slate-700">{item.value}</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`,
                backgroundColor: colorFn?.(item) || '#6366f1',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// FunnelChart — muestra para cada stage: count, monto bruto y monto ponderado
function FunnelChart({ stages }) {
  const maxCount = Math.max(...stages.map(s => s.count), 1)
  return (
    <div className="space-y-2">
      {stages.map((stage, i) => (
        <div key={stage.id} className="flex items-center gap-3">
          <div className="w-32 text-right">
            <span className="text-xs font-medium text-slate-600">{stage.label}</span>
          </div>
          <div className="flex-1 relative">
            <div
              className="h-10 rounded-lg flex items-center px-3 transition-all duration-500"
              style={{
                width: `${Math.max((stage.count / maxCount) * 100, 12)}%`,
                backgroundColor: stage.color,
                opacity: 0.85 + (i * 0.02),
              }}
            >
              <span className="text-white text-xs font-bold">{stage.count}</span>
            </div>
          </div>
          <div className="w-48 text-right">
            <span className="text-xs text-slate-500">
              ${stage.monto.toLocaleString('es-MX')}
            </span>
            {stage.montoPonderado > 0 && (
              <span className="text-[10px] text-indigo-500 font-medium ml-1">
                (×{Math.round((PROBABILIDADES_PONDERADAS[stage.id] || 0) * 100)}% = ${stage.montoPonderado.toLocaleString('es-MX')})
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// CapacityPanel — tarjeta prominente con medidor de ocupación de cartera.
// Color: verde <85%, ámbar 85-99%, rojo ≥100%.
function CapacityPanel({ ocupados, max, slotsLibres, ingresosEnCurso }) {
  const pct = Math.min(100, Math.round((ocupados / Math.max(max, 1)) * 100))
  const color =
    pct >= 100 ? '#ef4444' :
    pct >= 85  ? '#f59e0b' :
                 '#10b981'

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mb-8">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <Gauge size={24} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Capacidad Operativa</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {ocupados} de {max} slots activos · {slotsLibres} {slotsLibres === 1 ? 'libre' : 'libres'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold leading-none" style={{ color }}>{pct}%</div>
          {ingresosEnCurso > 0 && (
            <div className="text-xs text-slate-500 mt-1">
              ${ingresosEnCurso.toLocaleString('es-MX')} en curso
            </div>
          )}
        </div>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {/* Slots individuales */}
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

export default function Dashboard() {
  const {
    opportunities,
    cartera,
    settings,
    loading,
    loadingCartera,
  } = useCRM()

  const stats = useMemo(() => {
    // ============================================================
    // PIPELINE
    // ============================================================
    const total = opportunities.length
    const activas = opportunities.filter(o => !CLOSED_STAGES.has(o.estadoActual))
    const ganadas = opportunities.filter(o => o.estadoActual === 'Cerrado Ganado')
    const perdidas = opportunities.filter(o => o.estadoActual === 'Cerrado Perdido')

    const valorActivo = activas.reduce((sum, o) => sum + (o.monto || 0), 0)
    const valorGanado = ganadas.reduce((sum, o) => sum + (o.monto || 0), 0)
    const pipelinePonderado = getPipelinePonderado(opportunities)
    const inactivas = activas.filter(estaInactiva)

    const pipelineStages = STAGES.map(stage => {
      const opps = opportunities.filter(o => o.estadoActual === stage.id)
      const monto = opps.reduce((sum, o) => sum + (o.monto || 0), 0)
      const montoPonderado = opps.reduce((sum, o) => sum + getValorPonderado(o), 0)
      return {
        id: stage.id,
        label: stage.label,
        color: stage.color,
        count: opps.length,
        monto,
        montoPonderado,
      }
    })

    // Distribución por método de prospección
    const methods = {}
    opportunities.forEach(o => {
      const m = o.metodoProspeccion || 'Sin método'
      methods[m] = (methods[m] || 0) + 1
    })
    const byMethod = Object.entries(methods)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    // Distribución pipeline por tipo de programa
    const progs = {}
    TIPOS_PROGRAMA.forEach(t => { progs[t] = 0 })
    progs['Sin definir'] = 0
    opportunities.forEach(o => {
      const t = o.tipoPrograma || 'Sin definir'
      progs[t] = (progs[t] || 0) + 1
    })
    const byTipoPrograma = Object.entries(progs)
      .map(([label, value]) => ({ label, value }))
      .filter(d => d.value > 0)

    // Distribución por potencial
    const pots = {}
    opportunities.forEach(o => {
      const p = o.potencial || 'Sin definir'
      pots[p] = (pots[p] || 0) + 1
    })
    const byPotencial = Object.entries(pots)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    // KPIs derivados
    const totalCerradas = ganadas.length + perdidas.length
    const bateo = totalCerradas > 0 ? Math.round((ganadas.length / totalCerradas) * 100) : 0
    const ticketPromedio = ganadas.length > 0 ? Math.round(valorGanado / ganadas.length) : 0

    const calificados = opportunities.filter(o => o.estadoActual === 'Calificado').length
    const j2Agendadas = opportunities.filter(o => o.estadoActual === 'J2 Agendada').length
    const j2Realizadas = opportunities.filter(o => o.estadoActual === 'J2 Realizada').length
    const denomCierre = ganadas.length + calificados + j2Agendadas + j2Realizadas
    const cierreCalificado = denomCierre > 0 ? Math.round((ganadas.length / denomCierre) * 100) : 0

    // ============================================================
    // CARTERA
    // ============================================================
    const ocupados = getOcupacionCartera(cartera)
    const capacidadMaxima = settings?.capacidadMaxima || 14
    const slotsLibres = Math.max(0, capacidadMaxima - ocupados)

    const activosCartera = cartera.filter(c => c.estado === 'Activo')
    const graduadosCount = cartera.filter(c => c.estado === 'Graduado').length
    const pausadosCount = cartera.filter(c => c.estado === 'Pausado').length

    const ingresosEnCurso = activosCartera.reduce(
      (s, c) => s + (parseFloat(c.montoContrato) || 0),
      0
    )

    const testimonios = cartera.filter(c => c.testimonialObtenido === 'Si').length
    const candidatosReferidos = cartera.filter(c => c.candidatoReferido === 'Si').length
    const totalReferidos = cartera.reduce(
      (s, c) => s + (parseFloat(c.referidosGenerados) || 0),
      0
    )

    // Distribución cartera por estado
    const carteraEstadoMap = {}
    ESTADOS_CARTERA.forEach(e => { carteraEstadoMap[e] = 0 })
    cartera.forEach(c => {
      const e = c.estado || 'Activo'
      carteraEstadoMap[e] = (carteraEstadoMap[e] || 0) + 1
    })
    const carteraEstadoData = ESTADOS_CARTERA
      .map(e => ({ label: e, value: carteraEstadoMap[e] || 0 }))
      .filter(d => d.value > 0)

    // Distribución cartera por tipo de programa
    const carteraProgs = { 'Ejecutivo': 0, 'Empresarial': 0, 'Sin definir': 0 }
    cartera.forEach(c => {
      const t = c.tipoPrograma || 'Sin definir'
      carteraProgs[t] = (carteraProgs[t] || 0) + 1
    })
    const carteraTipoProgramaData = Object.entries(carteraProgs)
      .map(([label, value]) => ({ label, value }))
      .filter(d => d.value > 0)

    return {
      // Pipeline
      total,
      activasCount: activas.length,
      ganadasCount: ganadas.length,
      perdidasCount: perdidas.length,
      valorActivo,
      valorGanado,
      pipelinePonderado,
      inactivasCount: inactivas.length,
      pipelineStages,
      byMethod,
      byTipoPrograma,
      byPotencial,
      bateo,
      ticketPromedio,
      cierreCalificado,
      denomCierre,

      // Cartera
      carteraTotal: cartera.length,
      ocupados,
      capacidadMaxima,
      slotsLibres,
      activosCount: activosCartera.length,
      graduadosCount,
      pausadosCount,
      ingresosEnCurso,
      testimonios,
      candidatosReferidos,
      totalReferidos,
      carteraEstadoData,
      carteraTipoProgramaData,
    }
  }, [opportunities, cartera, settings])

  if (loading || loadingCartera) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const methodColors = {
    'Circulo Rojo':    '#ef4444',
    'Landing VSL':     '#6366f1',
    'Organico Redes':  '#10b981',
    'Referido':        '#f59e0b',
    'Otro':            '#64748b',
    'Sin método':      '#94a3b8',
  }

  const tipoProgramaColors = {
    'Ejecutivo':    '#4f46e5',
    'Empresarial':  '#b45309',
    'Sin definir':  '#94a3b8',
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">Resumen de pipeline y cartera</p>
      </div>

      {/* Panel de Capacidad Operativa (prominente) */}
      <CapacityPanel
        ocupados={stats.ocupados}
        max={stats.capacidadMaxima}
        slotsLibres={stats.slotsLibres}
        ingresosEnCurso={stats.ingresosEnCurso}
      />

      {/* ============================================================
          SECCIÓN PIPELINE
          ============================================================ */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Pipeline
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Activas"
            value={stats.activasCount}
            subvalue={`${stats.total} total`}
            color="bg-indigo-500"
          />
          <StatCard
            icon={DollarSign}
            label="Pipeline Bruto"
            value={`$${stats.valorActivo.toLocaleString('es-MX')}`}
            subvalue="Monto de activas"
            color="bg-blue-500"
          />
          <StatCard
            icon={TrendingUp}
            label="Pipeline Ponderado"
            value={`$${Math.round(stats.pipelinePonderado).toLocaleString('es-MX')}`}
            subvalue="Monto × probabilidad"
            color="bg-violet-500"
          />
          <StatCard
            icon={AlertCircle}
            label="Inactivas"
            value={stats.inactivasCount}
            subvalue="Superan límite de etapa"
            color="bg-orange-500"
          />
          <StatCard
            icon={Percent}
            label="% Bateo"
            value={`${stats.bateo}%`}
            subvalue={`${stats.ganadasCount} / ${stats.ganadasCount + stats.perdidasCount} cerradas`}
            color="bg-rose-500"
          />
          <StatCard
            icon={Award}
            label="Cierre / Calificado"
            value={`${stats.cierreCalificado}%`}
            subvalue={`${stats.ganadasCount} / ${stats.denomCierre} calificados+`}
            color="bg-teal-500"
          />
          <StatCard
            icon={Target}
            label="Ganadas"
            value={stats.ganadasCount}
            subvalue={
              stats.ticketPromedio > 0
                ? `Ticket prom: $${stats.ticketPromedio.toLocaleString('es-MX')}`
                : ''
            }
            color="bg-emerald-500"
          />
          <StatCard
            icon={Star}
            label="Ingresos Cerrados"
            value={`$${stats.valorGanado.toLocaleString('es-MX')}`}
            subvalue="Histórico de ganadas"
            color="bg-amber-500"
          />
        </div>
      </div>

      {/* Embudo Pipeline */}
      <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm mb-8">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <BarChart3 size={20} className="text-indigo-500" />
          Embudo de Ventas (con ponderación)
        </h3>
        <FunnelChart stages={stats.pipelineStages} />
      </div>

      {/* ============================================================
          SECCIÓN CARTERA
          ============================================================ */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Cartera
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Briefcase}
            label="Clientes Activos"
            value={`${stats.activosCount} / ${stats.capacidadMaxima}`}
            subvalue={`${stats.slotsLibres} ${stats.slotsLibres === 1 ? 'slot libre' : 'slots libres'}`}
            color="bg-indigo-500"
          />
          <StatCard
            icon={DollarSign}
            label="Ingresos en Curso"
            value={`$${stats.ingresosEnCurso.toLocaleString('es-MX')}`}
            subvalue="Suma contratos activos"
            color="bg-emerald-500"
          />
          <StatCard
            icon={MessageSquare}
            label="Testimonios"
            value={stats.testimonios}
            subvalue={`${stats.graduadosCount} ${stats.graduadosCount === 1 ? 'graduado' : 'graduados'}`}
            color="bg-amber-500"
          />
          <StatCard
            icon={UserPlus}
            label="Referidos Generados"
            value={stats.totalReferidos}
            subvalue={`${stats.candidatosReferidos} ${stats.candidatosReferidos === 1 ? 'candidato' : 'candidatos'} referido`}
            color="bg-violet-500"
          />
        </div>
      </div>

      {/* ============================================================
          DISTRIBUCIONES — Pipeline
          ============================================================ */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Pipeline · Por Método</h3>
          <BarChart
            data={stats.byMethod}
            maxValue={Math.max(...stats.byMethod.map(d => d.value), 1)}
            colorFn={(item) => methodColors[item.label] || '#64748b'}
          />
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Briefcase size={14} className="text-indigo-500" />
            Pipeline · Por Tipo de Programa
          </h3>
          <BarChart
            data={stats.byTipoPrograma}
            maxValue={Math.max(...stats.byTipoPrograma.map(d => d.value), 1)}
            colorFn={(item) => tipoProgramaColors[item.label] || '#6366f1'}
          />
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Pipeline · Por Potencial</h3>
          <BarChart
            data={stats.byPotencial}
            maxValue={Math.max(...stats.byPotencial.map(d => d.value), 1)}
            colorFn={(item) => {
              const colors = { 'A': '#10b981', 'B': '#f59e0b', 'C': '#ef4444', 'Sin definir': '#94a3b8' }
              return colors[item.label] || '#6366f1'
            }}
          />
        </div>
      </div>

      {/* ============================================================
          DISTRIBUCIONES — Cartera (solo si hay clientes)
          ============================================================ */}
      {stats.carteraTotal > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Briefcase size={14} className="text-indigo-500" />
              Cartera · Por Estado
            </h3>
            <BarChart
              data={stats.carteraEstadoData}
              maxValue={Math.max(...stats.carteraEstadoData.map(d => d.value), 1)}
              colorFn={(item) => ESTADO_CARTERA_COLORS[item.label]?.color || '#6366f1'}
            />
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Briefcase size={14} className="text-indigo-500" />
              Cartera · Por Tipo de Programa
            </h3>
            <BarChart
              data={stats.carteraTipoProgramaData}
              maxValue={Math.max(...stats.carteraTipoProgramaData.map(d => d.value), 1)}
              colorFn={(item) => tipoProgramaColors[item.label] || '#6366f1'}
            />
          </div>
        </div>
      )}
    </div>
  )
}
