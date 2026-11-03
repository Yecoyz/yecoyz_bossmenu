import { useCallback, useEffect, useMemo, useState } from 'react'
import { Gift, KeyRound, Phone, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react'
import { useTranslation } from '../ui/nui/i18n'
import { call, type Employee, type Grade } from '../api'
import { ago, hours, useBoot, useCan, useMoney, useResult } from '../lib'
import { SearchInput, Field, Input } from '../ui/components/Input/Input'
import { Button, ButtonRow } from '../ui/components/Button/Button'
import { Badge } from '../ui/components/Badge/Badge'
import { StatusDot } from '../ui/components/StatusDot/StatusDot'
import { EmptyState } from '../ui/components/EmptyState/EmptyState'
import { Dialog, ConfirmDialog } from '../ui/components/Dialog/Dialog'
import { cx } from '../ui/nui/cx'

type DialogKind = null | 'hire' | 'fire' | 'bonus' | 'access'

export default function Employees() {
  const { t } = useTranslation()
  const can = useCan()
  const money = useMoney()
  const [list, setList] = useState<Employee[] | null>(null)
  const [grades, setGrades] = useState<Grade[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogKind>(null)

  const load = useCallback(() => {
    call<{ employees: Employee[]; grades: Grade[] }>('employees').then((r) => {
      if (r.error) return
      setList(r.employees)
      setGrades(r.grades)
    })
  }, [])
  useEffect(load, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (list ?? []).filter((e) => !q || e.name.toLowerCase().includes(q) || e.gradeLabel.toLowerCase().includes(q))
  }, [list, search])

  const current = list?.find((e) => e.identifier === selected) ?? null

  if (!list) return <div className="loading" />

  return (
    <div className="split">
      <section className="card split-list">
        <div className="list-tools">
          <SearchInput placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          {can('hire') && (
            <Button onClick={() => setDialog('hire')}>
              <UserPlus size={15} /> {t('hire')}
            </Button>
          )}
        </div>
        <div className="table-head emp-cols">
          <span className="label">{t('employee')}</span>
          <span className="label">{t('rank')}</span>
          <span className="label">{t('salary')}</span>
          <span className="label">{t('duty_week')}</span>
        </div>
        <div className="rows">
          {filtered.length === 0 && <EmptyState icon={<Users size={18} />} text={t('no_employees')} />}
          {filtered.map((e) => (
            <button key={e.identifier} className={cx('row emp-cols', selected === e.identifier && 'active')} onClick={() => setSelected(e.identifier)}>
              <span className="row-name">
                <StatusDot on={e.online} />
                <span className="truncate">{e.name}</span>
              </span>
              <span className="truncate">
                {e.gradeLabel} {e.isBoss && <Badge tone="accent">{t('boss')}</Badge>}
              </span>
              <span className="num">{money(e.salary ?? e.gradeSalary)}</span>
              <span className="num muted">{e.duty ? hours(e.duty.week) : e.onDuty ? t('on_duty') : '-'}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card split-detail">
        {current ? (
          <Detail key={current.identifier} e={current} grades={grades} reload={load} openDialog={setDialog} />
        ) : (
          <EmptyState icon={<Users size={18} />} text={t('details')} />
        )}
      </section>

      {dialog === 'hire' && <HireDialog grades={grades} onClose={() => setDialog(null)} onDone={load} />}
      {dialog === 'fire' && current && (
        <FireDialog e={current} onClose={() => setDialog(null)} onDone={() => { setSelected(null); load() }} />
      )}
      {dialog === 'bonus' && current && <BonusDialog e={current} onClose={() => setDialog(null)} />}
      {dialog === 'access' && current && <AccessDialog e={current} onClose={() => setDialog(null)} onDone={load} />}
    </div>
  )
}

function Detail({ e, grades, reload, openDialog }: { e: Employee; grades: Grade[]; reload: () => void; openDialog: (d: DialogKind) => void }) {
  const { t } = useTranslation()
  const boot = useBoot()
  const can = useCan()
  const money = useMoney()
  const result = useResult()
  const [grade, setGrade] = useState(e.grade)
  const [salary, setSalary] = useState(e.salary ? String(e.salary) : '')
  const [busy, setBusy] = useState(false)
  const isMe = e.identifier === boot.me.identifier
  const manage = !!e.manageable

  // Ranks the user may give: below their own unless they are a boss.
  const giveable = grades.filter((g) => boot.me.isBoss || g.grade < boot.me.grade)

  const saveGrade = async () => {
    setBusy(true)
    if (result(await call('setGrade', e.identifier, grade), t('saved'))) reload()
    setBusy(false)
  }
  const saveSalary = async (reset?: boolean) => {
    setBusy(true)
    const value = reset ? null : Number(salary)
    if (result(await call('setSalary', e.identifier, value), t('saved'))) {
      if (reset) setSalary('')
      reload()
    }
    setBusy(false)
  }

  return (
    <div className="detail">
      <div className="detail-head">
        <div className="detail-avatar title">{e.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</div>
        <div className="detail-name">
          <span className="title truncate">{e.name}</span>
          <span className="label">
            {e.gradeLabel} · {e.online ? (e.onDuty ? t('on_duty') : t('online')) : t('offline')}
            {isMe && ` · ${t('you')}`}
          </span>
        </div>
      </div>

      <div className="info-grid">
        <div>
          <span className="label">
            <Phone size={11} /> {t('phone')}
          </span>
          <span className="plate">{e.phone || '-'}</span>
        </div>
        <div>
          <span className="label">{t('last_seen')}</span>
          <span className="num">{e.online ? t('online') : ago(e.lastSeen, t('never'))}</span>
        </div>
        <div>
          <span className="label">{t('rank_salary')}</span>
          <span className="num">{money(e.gradeSalary)}</span>
        </div>
        {e.duty && (
          <div>
            <span className="label">{t('duty_month')}</span>
            <span className="num">{hours(e.duty.month)}</span>
          </div>
        )}
      </div>

      {can('promote') && manage && (
        <Field label={t('change_rank')}>
          <div className="inline">
            <select className="input" value={grade} onChange={(ev) => setGrade(Number(ev.target.value))}>
              {giveable.map((g) => (
                <option key={g.grade} value={g.grade}>
                  {g.grade} · {g.label}
                </option>
              ))}
              {!giveable.some((g) => g.grade === e.grade) && <option value={e.grade}>{e.gradeLabel}</option>}
            </select>
            <Button variant="outline" disabled={busy || grade === e.grade} onClick={saveGrade}>
              {t('save')}
            </Button>
          </div>
        </Field>
      )}

      {can('salaries') && boot.settings.individual && (manage || (boot.me.isBoss && isMe)) && (
        <Field label={t('personal_salary')} hint={t('personal_salary_hint', money(e.gradeSalary))}>
          <div className="inline">
            <Input type="number" min={e.gradeSalary} max={boot.settings.maxIndividual} placeholder={String(e.gradeSalary)} value={salary} onChange={(ev) => setSalary(ev.target.value)} />
            {e.salary !== undefined && e.salary !== null && (
              <Button variant="ghost" disabled={busy} onClick={() => saveSalary(true)}>
                {t('reset')}
              </Button>
            )}
            <Button variant="outline" disabled={busy || salary === '' || Number(salary) === e.salary} onClick={() => saveSalary()}>
              {t('save')}
            </Button>
          </div>
        </Field>
      )}

      <div className="detail-actions">
        {can('bonuses') && !isMe && (
          <Button variant="outline" onClick={() => openDialog('bonus')}>
            <Gift size={15} /> {t('bonus')}
          </Button>
        )}
        {can('access') && manage && !e.isBoss && (
          <Button variant="outline" onClick={() => openDialog('access')}>
            <KeyRound size={15} /> {t('access')}
          </Button>
        )}
        {can('fire') && manage && (
          <Button variant="outline-danger" onClick={() => openDialog('fire')}>
            <UserMinus size={15} /> {t('fire')}
          </Button>
        )}
      </div>
      {e.isBoss && (
        <div className="note">
          <ShieldCheck size={14} /> {t('access_full')}
        </div>
      )}
      {!e.isBoss && e.perms.length > 0 && (
        <div className="perm-chips">
          {e.perms.map((p) => (
            <Badge key={p}>{t(`perm_${p}`)}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function HireDialog({ grades, onClose, onDone }: { grades: Grade[]; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const boot = useBoot()
  const result = useResult()
  const [players, setPlayers] = useState<{ source: number; name: string; job?: string; distance: number }[] | null>(null)
  const giveable = grades.filter((g) => boot.me.isBoss || g.grade < boot.me.grade)
  const [grade, setGrade] = useState(giveable[0]?.grade ?? 0)
  const [target, setTarget] = useState<number | null>(null)
  const [byId, setById] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    call<{ players: typeof players }>('nearby').then((r) => setPlayers(r.players ?? []))
  }, [])

  const chosen = target ?? (byId ? Number(byId) : null)
  const hire = async () => {
    if (!chosen) return
    setBusy(true)
    const r = await call<{ name: string }>('hire', chosen, grade)
    setBusy(false)
    if (result(r, t('hired', r.name ?? ''))) {
      onDone()
      onClose()
    }
  }

  return (
    <Dialog
      title={t('hire_title')}
      width={440}
      onClose={onClose}
      backdrop={false}
      footer={
        <ButtonRow>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button disabled={!chosen || busy} onClick={hire}>{t('hire')}</Button>
        </ButtonRow>
      }
    >
      <div className="stack-lg">
        <div className="stack">
          <span className="label">{t('hire_nearby')}</span>
          {players === null ? (
            <div className="loading small" />
          ) : players.length === 0 ? (
            <div className="muted small-text">{t('hire_none')}</div>
          ) : (
            <div className="pick-list">
              {players.map((p) => (
                <button key={p.source} className={cx('pick', target === p.source && 'active')} onClick={() => { setTarget(p.source); setById('') }}>
                  <span className="truncate">{p.name}</span>
                  <span className="label num">
                    #{p.source} · {p.distance}m
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {boot.settings.hireById && (
          <Field label={t('hire_by_id')}>
            <Input type="number" value={byId} onChange={(e) => { setById(e.target.value); setTarget(null) }} />
          </Field>
        )}
        <Field label={t('hire_rank')}>
          <select className="input" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            {giveable.map((g) => (
              <option key={g.grade} value={g.grade}>
                {g.grade} · {g.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Dialog>
  )
}

function FireDialog({ e, onClose, onDone }: { e: Employee; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const result = useResult()
  const [busy, setBusy] = useState(false)
  return (
    <ConfirmDialog
      tone="danger"
      title={t('fire_title')}
      text={t('fire_text', e.name)}
      confirmLabel={t('fire')}
      cancelLabel={t('cancel')}
      busy={busy}
      backdrop={false}
      onCancel={onClose}
      onConfirm={async () => {
        setBusy(true)
        const ok = result(await call('fire', e.identifier), t('fired', e.name))
        setBusy(false)
        if (ok) { onDone(); onClose() }
      }}
    />
  )
}

function BonusDialog({ e, onClose }: { e: Employee; onClose: () => void }) {
  const { t } = useTranslation()
  const boot = useBoot()
  const money = useMoney()
  const result = useResult()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const value = Number(amount)
  const valid = value > 0 && value <= boot.settings.maxBonus

  const send = async () => {
    setBusy(true)
    const r = await call<{ queued?: boolean }>('bonus', e.identifier, value, note)
    setBusy(false)
    if (result(r, r.queued ? t('bonus_queued', e.name) : t('bonus_sent', e.name))) onClose()
  }

  return (
    <Dialog
      title={t('bonus_title')}
      meta={e.name}
      onClose={onClose}
      backdrop={false}
      footer={
        <ButtonRow>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button disabled={!valid || busy} onClick={send}>{t('bonus')}</Button>
        </ButtonRow>
      }
    >
      <div className="stack-lg">
        <Field label={t('amount')} hint={`Max ${money(boot.settings.maxBonus)}`}>
          <Input type="number" autoFocus value={amount} onChange={(ev) => setAmount(ev.target.value)} />
        </Field>
        <div className="quick">
          {[500, 1000, 2500, 5000].filter((v) => v <= boot.settings.maxBonus).map((v) => (
            <button key={v} className="quick-btn num" onClick={() => setAmount(String(v))}>{money(v)}</button>
          ))}
        </div>
        <Field label={t('bonus_note')}>
          <Input maxLength={80} value={note} onChange={(ev) => setNote(ev.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

function AccessDialog({ e, onClose, onDone }: { e: Employee; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const boot = useBoot()
  const result = useResult()
  const [set, setSet] = useState<Set<string>>(new Set(e.perms))
  const [busy, setBusy] = useState(false)
  // Only what the user has themselves can be given.
  const perms = boot.allPerms.filter((p) => boot.perms.includes(p))

  const toggle = (p: string) => {
    const next = new Set(set)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    setSet(next)
  }
  const save = async () => {
    setBusy(true)
    const ok = result(await call('setAccess', e.identifier, Array.from(set)), t('saved'))
    setBusy(false)
    if (ok) { onDone(); onClose() }
  }

  return (
    <Dialog
      title={t('access_title')}
      meta={e.name}
      width={460}
      onClose={onClose}
      backdrop={false}
      footer={
        <ButtonRow>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button disabled={busy} onClick={save}>{t('save')}</Button>
        </ButtonRow>
      }
    >
      <p className="body small-text">{t('access_hint', e.name)}</p>
      <div className="perm-grid">
        {perms.map((p) => (
          <label key={p} className={cx('perm', set.has(p) && 'on')}>
            <input type="checkbox" checked={set.has(p)} onChange={() => toggle(p)} />
            <span className="perm-box" />
            <span>{t(`perm_${p}`)}</span>
          </label>
        ))}
      </div>
    </Dialog>
  )
}
