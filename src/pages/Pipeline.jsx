import { useState } from 'react'
import { useCRM } from '../context/CRMContext'
import {
  STAGES,
  getEdadDias,
  estaInactiva,
  CLOSED_STAGES,
} from '../config'
import { GripVertical, DollarSign, Building2, Clock, AlertTriangle, CalendarClock, Briefcase } from 'lucide-react'

// ============================================================
// OpportunityCard — KanbanCard compacta, muestra:
//   - Nombre + Empresa
//   - Badge de tipoPrograma (Ejecutivo/Empresarial)
//   - Monto
//   - Edad (días desde primer contacto)
//   - Próximo seguimiento (si existe)
//   - Indicador de inactividad si supera DIAS_INACTIVIDAD_POR_ETAPA
// ============================================================

const TIPO_PROGRAMA_COLORS = {
  Ejecutivo:    { bg: '#eef2ff', color: '#4f46e5' },
  Empresarial:  { bg: '#fef3c7', color: '#b45309' },
}

function OpportunityCard({ opp, onEdit, onImportCartera, alreadyImported }) {
  const edad = getEdadDias(opp)
  const inactiva = estaInactiva(opp)
  const tipoColor = TIPO_PROGRAMA_COLORS[opp.tipoPrograma]
  const showCarteraBtn = opp.estadoActual === 'Cerrado Ganado' && !alreadyImported

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ row: opp.row }))
        e.currentTarget.classList.add('dragging')
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
      onClick={() => onEdit(opp)}
      className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer hover:shadow-md transition-all group animate-fade-in ${
        inactiva ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-100'
      }`}
    >
      {/* Header: nombre + drag handle */}
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-semibold text-slate-800 text-sm leading-tight flex-1">{opp.nombre}</h4>
        <GripVertical size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
      </div>

      {/* Empresa */}
      {opp.empresa && (
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
          <Building2 size={11} />
          <span className="truncate">{opp.empresa}</span>
        </div>
      )}

      {/* Badges: tipoPrograma + inactividad */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {opp.tipoPrograma && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: tipoColor?.bg || '#f1f5f9', color: tipoColor?.color || '#64748b' }}
          >
            {opp.tipoPrograma}
          </span>
        )}
        {inactiva && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex items-center gap-1">
            <AlertTriangle size={10} />
            Inactiva
          </span>
        )}
      </div>

      {/* Monto */}
      {opp.monto > 0 && (
        <div className="flex items-center gap-1 text-emerald-600 font-semibold text-sm mb-2">
          <DollarSign size={14} />
          {opp.monto.toLocaleString('es-MX')}
        </div>
      )}

      {/* Footer: edad + próximo seguimiento */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 gap-2">
        {edad !== null && !CLOSED_STAGES.has(opp.estadoActual) && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {edad === 0 ? 'Hoy' : `${edad}d`}
          </span>
        )}
        {opp.proximoSeguimiento && (
          <span className="flex items-center gap-1 truncate">
            <CalendarClock size={10} />
            {opp.proximoSeguimiento}
          </span>
        )}
      </div>

      {/* Botón → Cartera (solo en Cerrado Ganado no importados) */}
      {showCarteraBtn && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onImportCartera?.(opp)
          }}
          className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-semibold hover:bg-emerald-100 transition-colors"
        >
          <Briefcase size={11} />
          → Cartera
        </button>
      )}
    </div>
  )
}

export default function Pipeline() {
  const { opportunities, loading, openEdit, handleStageChange, cartera, openCartPromptForOpp } = useCRM()
  const [dragOverStage, setDragOverStage] = useState(null)

  // Set de row-ids ya importados a cartera (vía idOrigenPipeline)
  const importedRows = new Set(
    (cartera || []).map(c => c.idOrigenPipeline).filter(Boolean)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const handleDragOver = (e, stageId) => {
    e.preventDefault()
    setDragOverStage(stageId)
  }

  const handleDragLeave = () => setDragOverStage(null)

  const handleDrop = (e, stageId) => {
    e.preventDefault()
    setDragOverStage(null)
    try {
      const { row } = JSON.parse(e.dataTransfer.getData('text/plain'))
      const opp = opportunities.find(o => o.row === row)
      if (opp && opp.estadoActual !== stageId) {
        handleStageChange(row, stageId)
      }
    } catch (err) {
      console.error('Error en drag-drop:', err)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Pipeline</h2>
        <p className="text-sm text-slate-500 mt-1">
          {opportunities.length} oportunidades en total
        </p>
      </div>

      <div className="pipeline-container scrollbar-thin">
        {STAGES.map(stage => {
          const stageOpps = opportunities.filter(o => o.estadoActual === stage.id)
          const totalMonto = stageOpps.reduce((sum, o) => sum + (o.monto || 0), 0)

          return (
            <div key={stage.id} className="pipeline-column">
              {/* Column Header */}
              <div
                className="rounded-t-xl px-4 py-3 mb-0"
                style={{ backgroundColor: stage.color }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white text-sm">{stage.label}</h3>
                  <span className="bg-white/20 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {stageOpps.length}
                  </span>
                </div>
                {totalMonto > 0 && (
                  <p className="text-white/80 text-xs mt-1">
                    ${totalMonto.toLocaleString('es-MX')}
                  </p>
                )}
              </div>

              {/* Cards Container */}
              <div
                className={`rounded-b-xl p-2 space-y-2 min-h-[200px] transition-colors ${
                  dragOverStage === stage.id ? 'drag-over' : 'bg-slate-100/60'
                }`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {stageOpps.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Sin oportunidades
                  </div>
                ) : (
                  stageOpps.map(opp => (
                    <OpportunityCard
                      key={opp.row}
                      opp={opp}
                      onEdit={openEdit}
                      onImportCartera={openCartPromptForOpp}
                      alreadyImported={importedRows.has(opp.row)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
