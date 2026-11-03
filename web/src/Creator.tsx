import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, Car, MapPin, Monitor, Move, Package, Plus, Search, Settings2, ShieldCheck, Trash2, X } from 'lucide-react'
import { useTranslation } from './ui/nui/i18n'
import { useNuiEvent } from './ui/nui/useNuiEvent'
import { useKey } from './ui/nui/useKey'
import { fetchNui } from './ui/nui/fetchNui'
import { cx } from './ui/nui/cx'
import { PanelBody, PanelFooter } from './ui/components/Panel/Panel'
import { Button, ButtonRow } from './ui/components/Button/Button'
import { IconButton } from './ui/components/IconButton/IconButton'
import { Field, Input } from './ui/components/Input/Input'
import { Badge } from './ui/components/Badge/Badge'
import { EmptyState } from './ui/components/EmptyState/EmptyState'
import { ConfirmDialog } from './ui/components/Dialog/Dialog'
import { Tabs } from './ui/components/Tabs/Tabs'
import { useResult } from './lib'
import CreatorShop from './CreatorShop'
import CreatorAccess from './CreatorAccess'

type Vec4 = { x: number; y: number; z: number; w: number }
export interface Computer {
  id: number
  job: string
  jobLabel?: string
  label?: string
  model: string
  coords: Vec4
  spawn?: Vec4
  static?: boolean
}
export interface CreatorData {
  computers: Computer[]
  jobs: { name: string; label: string }[]
  models: { model: string; label: string }[]
  vehicleSpawn: boolean
  shops?: { vehicle: boolean; item: boolean }
  currency?: string
}
export interface JobSummary {
  name: string
  label: string
  computers: number
  vehicles: number
  items: number
  pagesOff: number
}
export interface JobGrade {
  grade: number
  label: string
  isBoss: boolean
  perms: string[]
}
export interface JobDetail {
  job: string
  label: string
  computers: Computer[]
  grades: JobGrade[]
  pages: { name: string; on: boolean; needs?: string }[]
  ranksCustom: boolean
  custom: boolean
}

type Tab = 'computers' | 'vehicle' | 'item' | 'access'

// Admin window in the middle of the screen: every job on the left; the chosen job's computers, shops and access on
// the right. It is only hidden (not closed) while placing something in the world, so nothing is lost.
export default function Creator({ data: initial }: { data: CreatorData }) {
  const { t } = useTranslation()
  const [data, setData] = useState(initial)
  const [hidden, setHidden] = useState(false)
  const [jobs, setJobs] = useState<JobSummary[] | null>(null)
  const [job, setJob] = useState<string | null>(null)
  const [detail, setDetail] = useState<JobDetail | null>(null)
  const [tab, setTab] = useState<Tab>('computers')
  const [search, setSearch] = useState('')
  // A form, dialog or unsaved change inside a tab takes Escape first.
  const [busyTab, setBusyTab] = useState(false)
  const onBusyTab = useCallback((open: boolean) => setBusyTab(open), [])

  const loadJobs = useCallback(() => {
    fetchNui<{ error?: string; jobs?: JobSummary[] }>('creatorJobs').then((r) => r.jobs && setJobs(r.jobs))
  }, [])
  const loadDetail = useCallback((name: string) => {
    fetchNui<JobDetail & { error?: string }>('creatorJob', { job: name }).then((r) => !r.error && setDetail(r))
  }, [])
  useEffect(loadJobs, [loadJobs])
  useEffect(() => {
    setDetail(null)
    setBusyTab(false)
    if (job) loadDetail(job)
  }, [job, loadDetail])

  // After something changed (a computer placed, a list saved), the summaries on the left follow.
  const refresh = useCallback(() => {
    loadJobs()
    if (job) loadDetail(job)
  }, [job, loadJobs, loadDetail])

  useNuiEvent('creatorHide', () => setHidden(true))
  useNuiEvent<{ computers?: Computer[] } | null>('creatorShow', (d) => {
    setHidden(false)
    if (d?.computers) {
      setData((cur) => ({ ...cur, computers: d.computers! }))
      refresh()
    }
  })
  useNuiEvent<CreatorData>('creator', (d) => {
    setData(d)
    setHidden(false)
    loadJobs()
  })

  const close = () => fetchNui('creatorClose')
  useKey('Escape', close, !hidden && !busyTab)

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (jobs ?? []).filter((j) => !q || j.label.toLowerCase().includes(q) || j.name.toLowerCase().includes(q))
  }, [jobs, search])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [{ id: 'computers', label: t('creator_tab_computers'), icon: <Monitor size={15} /> }]
  if (data.shops?.vehicle) tabs.push({ id: 'vehicle', label: t('creator_tab_vehicles'), icon: <Car size={15} /> })
  if (data.shops?.item) tabs.push({ id: 'item', label: t('creator_tab_items'), icon: <Package size={15} /> })
  tabs.push({ id: 'access', label: t('creator_tab_access'), icon: <ShieldCheck size={15} /> })

  const summary = jobs?.find((j) => j.name === job)

  return (
    <div className="creator-screen" style={hidden ? { display: 'none' } : undefined}>
      <div className="backdrop" />
      <div className="cw animate-fade-up">
        <aside className="os-side cw-side">
          <div className="os-brand">
            <div className="os-brand-icon">
              <Settings2 size={20} />
            </div>
            <div className="os-brand-text">
              <span className="title truncate">{t('creator_title')}</span>
              <span className="label">{t('creator_subtitle')}</span>
            </div>
          </div>
          <div className="cw-search">
            <Search size={14} />
            <input className="input" placeholder={t('creator_search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <nav className="cw-jobs">
            {jobs === null && <div className="loading" />}
            {shown.map((j) => (
              <button key={j.name} type="button" className={cx('cw-job', job === j.name && 'active')} onClick={() => setJob(j.name)}>
                <span className="truncate cw-job-name">{j.label}</span>
                <span className="label truncate">
                  {j.name} · {t('creator_count_computers', j.computers)}
                </span>
              </button>
            ))}
            {jobs && shown.length === 0 && <span className="label cw-none">{t('creator_no_jobs')}</span>}
          </nav>
        </aside>

        <main className="os-main cw-main">
          <header className="os-top">
            <div className="cw-title">
              {job ? (
                <>
                  <h1 className="title truncate">{summary?.label ?? detail?.label ?? job}</h1>
                  <span className="label">{job}</span>
                </>
              ) : (
                <h1 className="title">{t('creator_title')}</h1>
              )}
            </div>
            <button className="os-logout" title={t('close')} onClick={close}>
              <X size={16} />
            </button>
          </header>

          {!job ? (
            <div className="cw-empty">
              <EmptyState icon={<Briefcase size={20} />} text={t('creator_pick_job')} />
            </div>
          ) : (
            <>
              <div className="cw-stats">
                <Stat icon={<Monitor size={15} />} value={summary?.computers ?? '-'} label={t('creator_tab_computers')} />
                {data.shops?.vehicle && <Stat icon={<Car size={15} />} value={summary?.vehicles ?? '-'} label={t('creator_tab_vehicles')} />}
                {data.shops?.item && <Stat icon={<Package size={15} />} value={summary?.items ?? '-'} label={t('creator_tab_items')} />}
                <Stat icon={<Briefcase size={15} />} value={detail?.grades.length ?? '-'} label={t('creator_ranks')} />
              </div>
              <Tabs items={tabs} value={tab} onChange={setTab} />
              <div className="cw-content">
                {tab === 'computers' && (
                  <CreatorComputers key={job} job={job} jobLabel={summary?.label ?? job} data={data} computers={detail?.computers ?? null} onChanged={refresh} onBusy={onBusyTab} />
                )}
                {(tab === 'vehicle' || tab === 'item') && (
                  <CreatorShop key={tab + job} kind={tab} job={job} grades={detail?.grades ?? []} currency={data.currency ?? '$'} onBusy={onBusyTab} onChanged={loadJobs} />
                )}
                {tab === 'access' && detail && <CreatorAccess key={job} detail={detail} onSaved={(d) => { setDetail(d); loadJobs() }} onBusy={onBusyTab} />}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="cw-stat">
      <span className="cw-stat-icon">{icon}</span>
      <span className="cw-stat-value num">{value}</span>
      <span className="label">{label}</span>
    </div>
  )
}

// The boss menu computers of one job: go to, move, delete, and place new ones.
function CreatorComputers({
  job,
  jobLabel,
  data,
  computers,
  onChanged,
  onBusy,
}: {
  job: string
  jobLabel: string
  data: CreatorData
  computers: Computer[] | null
  onChanged: () => void
  onBusy: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const result = useResult()
  const [form, setForm] = useState<Partial<Computer> | null>(null)
  const [remove, setRemove] = useState<Computer | null>(null)

  useEffect(() => onBusy(form !== null || remove !== null), [form, remove, onBusy])
  useKey('Escape', () => setForm(null), form !== null && remove === null)

  const place = (step: 'computer' | 'spawn' | 'both') => {
    if (!form?.model) return
    fetchNui('creatorPlace', { ...form, job, step })
  }

  if (form) {
    return (
      <>
        <PanelBody scroll className="stack-lg cw-form">
          <p className="body small-text">{t('creator_hint_job', jobLabel)}</p>
          <Field label={t('creator_label')}>
            <Input maxLength={64} value={form.label ?? ''} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </Field>
          <Field label={t('creator_model')}>
            <select className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
              {data.models.map((m) => (
                <option key={m.model} value={m.model}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          {form.id && data.vehicleSpawn && (
            <div className="row-between">
              <span className="label">
                {t('creator_spawn')}: {form.spawn ? t('creator_spawn_set') : t('creator_spawn_none')}
              </span>
              <Button size="sm" variant="ghost" onClick={() => place('spawn')}>
                <Car size={14} /> {t('creator_move')}
              </Button>
            </div>
          )}
        </PanelBody>
        <PanelFooter>
          <ButtonRow>
            <Button variant="ghost" onClick={() => setForm(null)}>
              {t('cancel')}
            </Button>
            {form.id && (
              <Button
                variant="outline"
                onClick={async () => {
                  const r = await fetchNui<{ error?: string; computers?: Computer[] }>('creatorSave', { ...form, job, spawn: form.spawn ?? false })
                  if (result(r, t('creator_saved'))) {
                    setForm(null)
                    onChanged()
                  }
                }}
              >
                {t('save')}
              </Button>
            )}
            <Button disabled={!form.model} onClick={() => place(form.id ? 'computer' : 'both')}>
              <Move size={14} /> {form.id ? t('creator_move') : t('creator_place')}
            </Button>
          </ButtonRow>
        </PanelFooter>
      </>
    )
  }

  return (
    <>
      <PanelBody scroll className="creator-list">
        {computers === null && <div className="loading" />}
        {computers && computers.length === 0 && <EmptyState icon={<Monitor size={18} />} text={t('creator_empty')} />}
        {computers?.map((c) => (
          <div key={c.id} className="creator-item">
            <div className="creator-thumb">
              <Monitor size={16} />
            </div>
            <div className="creator-item-text">
              <span className="truncate creator-item-name">{c.label || jobLabel}</span>
              <span className="label truncate">
                #{c.id} · {data.models.find((m) => m.model === c.model)?.label ?? c.model}
                {c.spawn ? ' · ' + t('creator_spawn') : ''}
              </span>
            </div>
            {c.static && <Badge>{t('creator_static')}</Badge>}
            <IconButton label={t('creator_teleport')} onClick={() => fetchNui('creatorTeleport', { id: c.id })}>
              <MapPin size={14} />
            </IconButton>
            {!c.static && (
              <>
                <IconButton label={t('creator_edit')} onClick={() => setForm({ ...c })}>
                  <Move size={14} />
                </IconButton>
                <IconButton label={t('creator_delete')} onClick={() => setRemove(c)}>
                  <Trash2 size={14} />
                </IconButton>
              </>
            )}
          </div>
        ))}
      </PanelBody>
      <PanelFooter>
        <Button block onClick={() => setForm({ model: data.models[0]?.model })}>
          <Plus size={15} /> {t('creator_new')}
        </Button>
      </PanelFooter>
      {remove && (
        <ConfirmDialog
          tone="danger"
          title={t('creator_delete')}
          text={t('creator_delete_text')}
          confirmLabel={t('creator_delete')}
          cancelLabel={t('cancel')}
          onCancel={() => setRemove(null)}
          onConfirm={async () => {
            const r = await fetchNui<{ error?: string }>('creatorDelete', { id: remove.id })
            setRemove(null)
            if (result(r)) onChanged()
          }}
        />
      )}
    </>
  )
}
