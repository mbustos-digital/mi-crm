import { useState, useMemo } from 'react'
import { useCRM } from '../context/CRMContext'
import { STAGES, METODOS_PROSPECCION, PROBABILIDADES } from '../config'
import { Search, Filter, Phone, Mail, ChevronDown, X, ArrowUpDown, Briefcase } from 'lucide-react'

export default function Opportunities() {
  const { opportunities, loading, openEdit, cartera, openCartPromptForOpp } = useCRM()
  const importedRows = useMemo(
    () => new Set((cartera || []).map(c => c.idOrigenPipeline).filter(Boolean)),
    [cartera]
  )
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [filterProb, setFilterProb] = useState('')
  const [sortBy, setSortBy] = useState('fechaActualizacion')
  const [sortDir, setSortDir] = useState('desc')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    let result = [...opportunities]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(o =>
        o.nombre?.toLowerCase().includes(q) ||
        o.empresa?.toLowerCase().includes(q) ||
        o.notas?.toLowerCase().includes(q) ||
        o.correo?.toLowerCase().includes(q) ||
        o.whatsapp?.includes(q)
      )
    }

    if (filterStage) result = result.filter(o => o.estadoActual === filterStage)
    if (filterMethod) result = result.filter(o => o.metodoProspeccion === filterMethod)
    if (filterProb) result = result.filter(o => o.probabilidad === filterProb)

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortBy] || ''
      let bVal = b[sortBy] || ''

      if (sortBy === 'monto') {
        aVal = a.monto || 0
        bVal = b.monto || 0
      } else if (sortBy === 'fechaActualizacion' || sortBy === 'fechaPrimerContacto') {
        // Parse dd/MM/yyyy
        const parseDate = (str) => {
          if (!str) return 0
          const p = str.split('/')
          if (p.length !== 3) return 0
          return new Date(parseInt(p[2].length === 2 ? '20' + p[2] : p[2]), parseInt(p[1]) - 1, parseInt(p[0])).getTime()
        }
        aVal = parseDate(aVal)
        bVal = parseDate(bVal)
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [opportunities, search, filterStage, filterMethod, filterProb, sortBy, sortDir])

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  const activeFilters = [filterStage, filterMethod, filterProb].filter(Boolean).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const stageInfo = (id) => STAGES.find(s => s.id === id) || { label: id, color: '#64748b', bg: '#f1f5f9' }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Oportunidades</h2>
        <p className="text-sm text-slate-500 mt-1">{filtered.length} de {opportunities.length} registros</p>
      </div>

      {/* Search & Filters */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, notas, correo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              activeFilters > 0
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter size={16} />
            Filtros
            {activeFilters > 0 && (
              <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilters}</span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 animate-fade-in">
            <select
              value={filterStage}
              onChange={e => setFilterStage(e.target.value)}
              className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm"
            >
              <option value="">Todos los estados</option>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select
              value={filterMethod}
              onChange={e => setFilterMethod(e.target.value)}
              className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm"
            >
              <option value="">Todos los métodos</option>
              {METODOS_PROSPECCION.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={filterProb}
              onChange={e => setFilterProb(e.target.value)}
              className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm"
            >
              <option value="">Toda probabilidad</option>
              {PROBABILIDADES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {activeFilters > 0 && (
              <button
                onClick={() => { setFilterStage(''); setFilterMethod(''); setFilterProb('') }}
                className="flex items-center gap-1 px-3 py-2 text-red-500 text-sm hover:bg-red-50 rounded-lg"
              >
                <X size={14} />
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table - Desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => toggleSort('nombre')}>
                  <span className="flex items-center gap-1">Nombre <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Empresa</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Método</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Prob.</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Pot.</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => toggleSort('monto')}>
                  <span className="flex items-center gap-1 justify-end">Monto <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => toggleSort('fechaActualizacion')}>
                  <span className="flex items-center gap-1">Actualizado <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Contacto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(opp => {
                const si = stageInfo(opp.estadoActual)
                return (
                  <tr
                    key={opp.row}
                    onClick={() => openEdit(opp)}
                    className="border-b border-slate-50 hover:bg-indigo-50/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{opp.nombre}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{opp.empresa || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: si.bg, color: si.color }}
                      >
                        {si.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{opp.metodoProspeccion}</td>
                    <td className="px-4 py-3">
                      {opp.probabilidad && (
                        <span className={`text-xs font-medium ${
                          opp.probabilidad === 'Alto' || opp.probabilidad === 'Mas de 70%'
                            ? 'text-emerald-600'
                            : opp.probabilidad === 'Medio' ? 'text-amber-600' : 'text-red-500'
                        }`}>{opp.probabilidad}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{opp.potencial}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                      {opp.monto > 0 ? `$${opp.monto.toLocaleString('es-MX')}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{opp.fechaActualizacion}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 items-center">
                        {opp.whatsapp && (
                          <a
                            href={`https://wa.me/${opp.whatsapp.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener"
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                          >
                            <Phone size={14} />
                          </a>
                        )}
                        {opp.correo && (
                          <a
                            href={`mailto:${opp.correo}`}
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                          >
                            <Mail size={14} />
                          </a>
                        )}
                        {opp.estadoActual === 'Cerrado Ganado' && !importedRows.has(opp.row) && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              openCartPromptForOpp(opp)
                            }}
                            title="Agregar a Cartera"
                            className="flex items-center gap-1 px-2 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-semibold hover:bg-emerald-100 transition-colors"
                          >
                            <Briefcase size={12} />
                            Cartera
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards - Mobile */}
      <div className="md:hidden space-y-3">
        {filtered.map(opp => {
          const si = stageInfo(opp.estadoActual)
          return (
            <div
              key={opp.row}
              onClick={() => openEdit(opp)}
              className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm active:bg-slate-50"
            >
              <div className="flex items-start justify-between mb-1">
                <h4 className="font-semibold text-slate-800">{opp.nombre}</h4>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2"
                  style={{ backgroundColor: si.bg, color: si.color }}
                >
                  {si.label}
                </span>
              </div>
              {opp.empresa && (
                <p className="text-xs text-slate-500 mb-2">{opp.empresa}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{opp.metodoProspeccion}</span>
                {opp.probabilidad && <span className="font-medium">{opp.probabilidad}</span>}
                {opp.monto > 0 && <span className="font-semibold text-emerald-600">${opp.monto.toLocaleString('es-MX')}</span>}
              </div>
              {opp.notas && (
                <p className="text-xs text-slate-400 mt-2 line-clamp-1">{opp.notas}</p>
              )}
              {opp.estadoActual === 'Cerrado Ganado' && !importedRows.has(opp.row) && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    openCartPromptForOpp(opp)
                  }}
                  className="mt-3 w-full flex items-center justify-center gap-1 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <Briefcase size={12} />
                  → Cartera
                </button>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          No se encontraron oportunidades
        </div>
      )}
    </div>
  )
}
