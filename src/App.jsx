import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Columns3, List, BarChart3, Bell, Plus, RefreshCw, Briefcase } from 'lucide-react'
import { useCRM } from './context/CRMContext'
import { CLOSED_STAGES } from './config'
import Pipeline from './pages/Pipeline'
import Opportunities from './pages/Opportunities'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import Cartera from './pages/Cartera'
import OpportunityForm from './components/OpportunityForm'
import ClienteForm from './components/ClienteForm'
import CartPromptModal from './components/CartPromptModal'

const navItems = [
  { to: '/pipeline',  icon: Columns3,  label: 'Pipeline'  },
  { to: '/lista',     icon: List,      label: 'Lista'     },
  { to: '/cartera',   icon: Briefcase, label: 'Cartera'   },
  { to: '/dashboard', icon: BarChart3, label: 'Dashboard' },
  { to: '/alertas',   icon: Bell,      label: 'Alertas'   },
]

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        }`
      }
    >
      <Icon size={20} />
      <span className="text-sm font-medium">{label}</span>
    </NavLink>
  )
}

function MobileNavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
          isActive ? 'text-indigo-400' : 'text-slate-400'
        }`
      }
    >
      <Icon size={20} />
      <span className="text-[10px] font-medium">{label}</span>
    </NavLink>
  )
}

export default function App() {
  const { openNew, refresh, showForm, showClienteForm, opportunities } = useCRM()

  // Count alertas pendientes
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const alertCount = opportunities.filter(o => {
    if (!o.proximoSeguimiento || CLOSED_STAGES.has(o.estadoActual)) return false
    const parts = o.proximoSeguimiento.split('/')
    if (parts.length !== 3) return false
    const d = new Date(
      parseInt(parts[2].length === 2 ? '20' + parts[2] : parts[2]),
      parseInt(parts[1]) - 1,
      parseInt(parts[0])
    )
    return d <= today
  }).length

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="desktop-sidebar w-64 bg-crm-dark flex flex-col shrink-0">
        <div className="p-6">
          <h1 className="text-xl font-bold text-white">Mi CRM</h1>
          <p className="text-xs text-slate-400 mt-1">Mauricio Bustos</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => (
            <div key={item.to} className="relative">
              <NavItem {...item} />
              {item.to === '/alertas' && alertCount > 0 && (
                <span className="absolute top-2 right-3 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {alertCount}
                </span>
              )}
            </div>
          ))}
        </nav>
        <div className="p-3 space-y-2">
          <button
            onClick={openNew}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-3 font-medium transition-colors"
          >
            <Plus size={18} />
            Nueva Oportunidad
          </button>
          <button
            onClick={refresh}
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white rounded-lg py-2 text-sm transition-colors"
          >
            <RefreshCw size={14} />
            Sincronizar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content flex-1 overflow-auto">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-40 bg-crm-dark text-white px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">Mi CRM</h1>
          <div className="flex gap-2">
            <button onClick={refresh} className="p-2 hover:bg-slate-700 rounded-lg">
              <RefreshCw size={18} />
            </button>
            <button onClick={openNew} className="p-2 bg-indigo-600 rounded-lg">
              <Plus size={18} />
            </button>
          </div>
        </header>

        <div className="p-4 md:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/pipeline" replace />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/lista" element={<Opportunities />} />
            <Route path="/cartera" element={<Cartera />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/alertas" element={<Alerts />} />
          </Routes>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-40 bg-crm-dark border-t border-slate-700 justify-around items-center px-2 py-1 safe-area-inset-bottom">
        {navItems.map(item => (
          <div key={item.to} className="relative">
            <MobileNavItem {...item} />
            {item.to === '/alertas' && alertCount > 0 && (
              <span className="absolute -top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {alertCount}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* Form Modal */}
      {showForm && <OpportunityForm />}

      {/* Cliente Form (cartera) */}
      {showClienteForm && <ClienteForm />}

      {/* Prompt "¿Agregar a Cartera?" al cerrar ganado */}
      <CartPromptModal />
    </div>
  )
}
