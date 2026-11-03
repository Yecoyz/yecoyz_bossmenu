import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Activity, Briefcase, Building2, Car, Clock, LayoutDashboard, LogOut, Package, Users, Wallet } from 'lucide-react'
import { useTranslation } from './ui/nui/i18n'
import { useKey } from './ui/nui/useKey'
import { useBoot, useCan } from './lib'
import { cx } from './ui/nui/cx'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Grades from './pages/Grades'
import Economy from './pages/Economy'
import Vehicles from './pages/Vehicles'
import Items from './pages/Items'
import Duty from './pages/Duty'
import Logs from './pages/Logs'

export type Page = 'dashboard' | 'employees' | 'grades' | 'economy' | 'vehicles' | 'items' | 'duty' | 'logs'

const PAGES: { id: Page; icon: ReactNode; perms: string[] }[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={17} />, perms: ['dashboard'] },
  { id: 'employees', icon: <Users size={17} />, perms: ['employees'] },
  { id: 'grades', icon: <Briefcase size={17} />, perms: ['grades', 'salaries'] },
  { id: 'economy', icon: <Wallet size={17} />, perms: ['economy'] },
  { id: 'vehicles', icon: <Car size={17} />, perms: ['vehicles'] },
  { id: 'items', icon: <Package size={17} />, perms: ['items'] },
  { id: 'duty', icon: <Clock size={17} />, perms: ['duty'] },
  { id: 'logs', icon: <Activity size={17} />, perms: ['logs'] },
]

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// mirror: the copy on the monitor's DUI. It follows `page` and can't be closed.
export default function Menu({ onClose, mirror, page: mirrorPage, onPage }: { onClose: () => void; mirror?: boolean; page?: Page; onPage?: (p: Page) => void }) {
  const { t } = useTranslation()
  const boot = useBoot()
  const can = useCan()
  const clock = useClock()
  const pages = useMemo(() => PAGES.filter((p) => p.perms.some(can)), [boot]) // eslint-disable-line react-hooks/exhaustive-deps
  const [ownPage, setOwnPage] = useState<Page>(pages[0]?.id ?? 'dashboard')
  const page = mirror && mirrorPage && pages.some((p) => p.id === mirrorPage) ? mirrorPage : ownPage
  const setPage = (p: Page) => {
    setOwnPage(p)
    onPage?.(p)
  }

  // Esc closes the menu, unless a dialog is open (the dialog closes first).
  useKey('Escape', () => {
    if (!document.querySelector('.dialog-backdrop')) onClose()
  }, !mirror)

  return (
    <div className="os">
      <aside className="os-side">
        <div className="os-brand">
          <div className="os-brand-icon">
            <Building2 size={20} />
          </div>
          <div className="os-brand-text">
            <span className="title truncate">{boot.job.label}</span>
            <span className="label">{t('title')}</span>
          </div>
        </div>
        <nav className="os-nav">
          {pages.map((p) => (
            <button key={p.id} className={cx('os-nav-item', page === p.id && 'active')} onClick={() => setPage(p.id)}>
              {p.icon}
              <span>{t(`nav_${p.id}`)}</span>
            </button>
          ))}
        </nav>
        <div className="os-user">
          <div className="os-user-text">
            <span className="os-user-name truncate">{boot.me.name}</span>
            <span className="label truncate">{boot.me.isBoss ? `${boot.me.gradeLabel} · ${t('boss')}` : boot.me.gradeLabel}</span>
          </div>
          <button className="os-logout" title={t('logout')} onClick={onClose}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="os-main">
        <header className="os-top">
          <h1 className="title">{t(`nav_${page}`)}</h1>
          <span className="os-clock num">{clock}</span>
        </header>
        <div className="os-content">
          {page === 'dashboard' && <Dashboard go={setPage} />}
          {page === 'employees' && <Employees />}
          {page === 'grades' && <Grades />}
          {page === 'economy' && <Economy />}
          {page === 'vehicles' && <Vehicles />}
          {page === 'items' && <Items />}
          {page === 'duty' && <Duty />}
          {page === 'logs' && <Logs />}
        </div>
      </main>
    </div>
  )
}
