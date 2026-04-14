import { useMemo } from 'react'
import { useCRM } from '../context/CRMContext'
import { STAGES, CLOSED_STAGES } from '../config'
import { AlertTriangle, Clock, CalendarDays, MessageCircle, Phone, ChevronRight } from 'lucide-react'

function parseDate(str) {
  if (!str) return null
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const year = parseInt(parts[2].length === 2 ? '20' + parts[2] : parts[2])
  return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]))
}

function daysBetween(d1, d2) {
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}

function AlertCard({ opp, type, daysInfo, onEdit }) {
  const stage = STAGES.find(s => s.id === opp.estadoActual)

  return (
    <div
      onClick={() => onEdit(opp)}
      className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          type === 'overdue' ? 'bg-red-100' : type === 'today' ? 'bg-amber-100' : 'bg-blue-100'
        }`}>
          {type === 'overdue' ? (
            <AlertTriangle size={18} className="text-red-500" />
          ) : type === 'today' ? (
            <Clock size={18} className="text-amber-500" />
          ) : (
            <CalendarDays size={18} className="text-blue-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-slate-800 text-sm truncate">{opp.nombre}</h4>
            <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: stage?.bg || '#f1f5f9', color: stage?.color || '#64748b' }}
            >
              {stage?.label || opp.estadoActual}
            </span>
            <span className={`text-xs font-medium ${
              type === 'overdue' ? 'text-red-500' : type === 'today' ? 'text-amber-500' : 'text-blue-500'
            }`}>
              {daysInfo}
            </span>
          </div>

          {opp.notas && (
            <p className="text-xs text-slate-500 line-clamp-1 mb-2">{opp.notas}</p>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2">
            {opp.whatsapp && (
              <a
                href={`https://wa.me/${opp.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100"
              >
                <MessageCircle size={12} />
                WhatsApp
              </a>
            )}
            {opp.whatsapp && (
              <a
                href={`tel:${opp.whatsapp}`}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100"
              >
                <Phone size={12} />
                Llamar
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Alerts() {
  const { opportunities, loading, openEdit } = useCRM()

  const { overdue, today, upcoming, sinSeguimiento } = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const overdue = []
    const today = []
    const upcoming = []
    const sinSeguimiento = []

    opportunities.forEach(opp => {
      if (CLOSED_STAGES.has(opp.estadoActual)) return

      if (!opp.proximoSeguimiento) {
        // Check if they haven't been contacted in > 7 days
        // Prefer ultimaActividad; fallback a fechaActualizacion
        const lastDate = parseDate(opp.ultimaActividad) || parseDate(opp.fechaActualizacion)
        if (lastDate) {
          const days = daysBetween(lastDate, now)
          if (days > 7) {
            sinSeguimiento.push({ opp, days })
          }
        } else {
          sinSeguimiento.push({ opp, days: null })
        }
        return
      }

      const seguDate = parseDate(opp.proximoSeguimiento)
      if (!seguDate) return

      const diff = daysBetween(now, seguDate)

      if (diff < 0) {
        overdue.push({ opp, days: Math.abs(diff) })
      } else if (diff === 0) {
        today.push({ opp })
      } else if (diff <= 7) {
        upcoming.push({ opp, days: diff })
      }
    })

    overdue.sort((a, b) => b.days - a.days)
    upcoming.sort((a, b) => a.days - b.days)
    sinSeguimiento.sort((a, b) => (b.days || 999) - (a.days || 999))

    return { overdue, today, upcoming, sinSeguimiento }
  }, [opportunities])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const totalAlerts = overdue.length + today.length

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Alertas de Seguimiento</h2>
        <p className="text-sm text-slate-500 mt-1">
          {totalAlerts > 0
            ? `${totalAlerts} seguimiento${totalAlerts > 1 ? 's' : ''} requieren atención`
            : 'Todo al día'
          }
        </p>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-500" />
            <h3 className="font-semibold text-red-600">Vencidos ({overdue.length})</h3>
          </div>
          <div className="space-y-3">
            {overdue.map(({ opp, days }) => (
              <AlertCard
                key={opp.row}
                opp={opp}
                type="overdue"
                daysInfo={`Vencido hace ${days} día${days > 1 ? 's' : ''}`}
                onEdit={openEdit}
              />
            ))}
          </div>
        </section>
      )}

      {/* Today */}
      {today.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={18} className="text-amber-500" />
            <h3 className="font-semibold text-amber-600">Hoy ({today.length})</h3>
          </div>
          <div className="space-y-3">
            {today.map(({ opp }) => (
              <AlertCard
                key={opp.row}
                opp={opp}
                type="today"
                daysInfo="Seguimiento para hoy"
                onEdit={openEdit}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={18} className="text-blue-500" />
            <h3 className="font-semibold text-blue-600">Próximos 7 días ({upcoming.length})</h3>
          </div>
          <div className="space-y-3">
            {upcoming.map(({ opp, days }) => (
              <AlertCard
                key={opp.row}
                opp={opp}
                type="upcoming"
                daysInfo={days === 1 ? 'Mañana' : `En ${days} días`}
                onEdit={openEdit}
              />
            ))}
          </div>
        </section>
      )}

      {/* Sin Seguimiento Programado */}
      {sinSeguimiento.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={18} className="text-slate-400" />
            <h3 className="font-semibold text-slate-600">Sin seguimiento programado ({sinSeguimiento.length})</h3>
          </div>
          <div className="space-y-3">
            {sinSeguimiento.map(({ opp, days }) => (
              <AlertCard
                key={opp.row}
                opp={opp}
                type="upcoming"
                daysInfo={days ? `${days} días sin contacto` : 'Sin fecha de contacto'}
                onEdit={openEdit}
              />
            ))}
          </div>
        </section>
      )}

      {overdue.length === 0 && today.length === 0 && upcoming.length === 0 && sinSeguimiento.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarDays size={24} className="text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Todo al día</h3>
          <p className="text-sm text-slate-500">No hay seguimientos pendientes</p>
        </div>
      )}
    </div>
  )
}
