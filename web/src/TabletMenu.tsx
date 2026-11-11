import { useMemo, useState } from 'react'
import { Building2 } from 'lucide-react'
import { useTranslation } from './ui/nui/i18n'
import { isBrowser } from './ui/nui/env'
import { cx } from './ui/nui/cx'
import { IconTile } from './ui/components/IconTile/IconTile'
import { Avatar } from './ui/components/Avatar/Avatar'
import { Badge } from './ui/components/Badge/Badge'
import { useBoot, useCan } from './lib'
import { PAGES, type Page } from './Menu'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Grades from './pages/Grades'
import Economy from './pages/Economy'
import Vehicles from './pages/Vehicles'
import Items from './pages/Items'
import Duty from './pages/Duty'
import Logs from './pages/Logs'

// The menu laid out like the other yecoyz tablet apps (yecoyz_duty): a side panel with the app header, the player's
// card and the pages, and the page itself on the right. Same pages as the computer menu.
export default function TabletMenu() {
  const { t } = useTranslation()
  const boot = useBoot()
  const can = useCan()
  const pages = useMemo(() => PAGES.filter((p) => p.perms.some(can)), [boot]) // eslint-disable-line react-hooks/exhaustive-deps
  // Browser preview only (npm run dev): ?page=employees starts on that page.
  const start = isBrowser ? (new URLSearchParams(window.location.search).get('page') as Page | null) : null
  const [page, setPage] = useState<Page>(start && pages.some((p) => p.id === start) ? start : (pages[0]?.id ?? 'dashboard'))

  return (
    <div className="tablet-menu">
      <aside className="tablet-side">
        <header className="tablet-header">
          <IconTile>
            <Building2 size={18} />
          </IconTile>
          <h1 className="title truncate">{t('title')}</h1>
        </header>

        <section className="tablet-profile">
          <Avatar large />
          <div className="tablet-profile-info">
            <h2 className="title truncate">{boot.me.name}</h2>
            <div className="tablet-meta">
              <span className="label truncate">{boot.job.label}</span>
              <Badge>{boot.me.gradeLabel}</Badge>
              {boot.me.isBoss && <Badge tone="accent">{t('boss')}</Badge>}
            </div>
          </div>
        </section>

        <nav className="tablet-nav">
          <span className="label">{t('tablet_pages')}</span>
          {pages.map((p) => (
            <button key={p.id} type="button" className={cx('tablet-nav-item', page === p.id && 'active')} onClick={() => setPage(p.id)}>
              {p.icon}
              <span>{t(`nav_${p.id}`)}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="tablet-main">
        <header className="tablet-header">
          <h1 className="title">{t(`nav_${page}`)}</h1>
          <span className="label">{boot.job.label}</span>
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
