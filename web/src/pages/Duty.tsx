import { useCallback, useEffect, useState } from 'react'
import { Clock, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useTranslation } from '../ui/nui/i18n'
import { call, type DutyStats } from '../api'
import { dateTime, hours, useBoot, useResult } from '../lib'
import { BarChart, dayPoints } from '../Chart'
import { StatusDot } from '../ui/components/StatusDot/StatusDot'
import { EmptyState } from '../ui/components/EmptyState/EmptyState'
import { Badge } from '../ui/components/Badge/Badge'
import { Button, ButtonRow } from '../ui/components/Button/Button'
import { IconButton } from '../ui/components/IconButton/IconButton'
import { Dialog, ConfirmDialog } from '../ui/components/Dialog/Dialog'
import { Field, FieldRow, Input } from '../ui/components/Input/Input'
import { cx } from '../ui/nui/cx'

interface DutyEmployee {
  identifier: string
  name: string
  gradeLabel: string
  online: boolean
  onDuty?: boolean
  stats?: DutyStats
  manageable: boolean
}

interface Shift {
  index: number
  key: number
  startTime: number
  duration: number
  edited?: { by: string; at: number; originalDuration: number }
  manual?: boolean
}

export default function Duty() {
  const { t } = useTranslation()
  const [data, setData] = useState<{ employees: DutyEmployee[]; days: { day: string; time: number; seconds: number }[] } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(() => {
    call<NonNullable<typeof data>>('duty').then((r) => !r.error && setData(r))
  }, [])
  useEffect(load, [load])

  if (!data) return <div className="loading" />
  const sorted = data.employees.slice().sort((a, b) => (b.stats?.week ?? 0) - (a.stats?.week ?? 0))
  const current = data.employees.find((e) => e.identifier === selected) ?? null

  return (
    <div className="duty">
      <section className="card duty-chart">
        <div className="card-head">
          <span className="title">{t('duty_chart')}</span>
        </div>
        <BarChart data={dayPoints(data.days, (d: { seconds: number }) => d.seconds)} format={hours} height={96} />
      </section>
      <div className="split duty-split">
        <section className="card split-list">
          <div className="table-head duty-cols">
            <span className="label">{t('employee')}</span>
            <span className="label">{t('duty_today')}</span>
            <span className="label">{t('duty_week')}</span>
            <span className="label">{t('duty_month')}</span>
            <span className="label">{t('duty_shifts')}</span>
          </div>
          <div className="rows">
            {sorted.map((e) => (
              <button key={e.identifier} className={cx('row duty-cols', selected === e.identifier && 'active')} onClick={() => setSelected(e.identifier)}>
                <span className="row-name">
                  <StatusDot on={e.onDuty} />
                  <span className="truncate">{e.name}</span>
                </span>
                <span className="num muted">{hours(e.stats?.today)}</span>
                <span className="num">{hours(e.stats?.week)}</span>
                <span className="num muted">{hours(e.stats?.month)}</span>
                <span className="num muted">{e.stats?.shifts ?? 0}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="card split-detail">
          {current ? <Shifts key={current.identifier} e={current} reload={load} /> : <EmptyState icon={<Clock size={18} />} text={t('duty_select')} />}
        </section>
      </div>
    </div>
  )
}

function Shifts({ e, reload }: { e: DutyEmployee; reload: () => void }) {
  const { t } = useTranslation()
  const boot = useBoot()
  const result = useResult()
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [edit, setEdit] = useState<Shift | 'new' | null>(null)
  const [remove, setRemove] = useState<Shift | null>(null)
  const [forceOff, setForceOff] = useState(false)
  const s = boot.settings

  const load = useCallback(() => {
    call<{ shifts: Shift[] }>('dutyShifts', e.identifier).then((r) => setShifts(r.shifts ?? []))
  }, [e.identifier])
  useEffect(load, [load])

  const changed = () => {
    load()
    reload()
  }

  return (
    <div className="detail">
      <div className="detail-head">
        <div className="detail-name">
          <span className="title truncate">{e.name}</span>
          <span className="label">
            {e.gradeLabel} · {e.onDuty ? t('on_duty') : e.online ? t('off_duty') : t('offline')}
          </span>
        </div>
        {s.dutyForceOff && e.manageable && e.onDuty && (
          <Button size="sm" variant="outline-danger" onClick={() => setForceOff(true)}>
            <Power size={14} /> {t('duty_force_off')}
          </Button>
        )}
      </div>
      <div className="info-grid">
        <div>
          <span className="label">{t('duty_total')}</span>
          <span className="num">{hours(e.stats?.total)}</span>
        </div>
        <div>
          <span className="label">{t('duty_shifts')}</span>
          <span className="num">{e.stats?.shifts ?? 0}</span>
        </div>
        <div>
          <span className="label">{t('duty_average')}</span>
          <span className="num">{hours(e.stats?.average)}</span>
        </div>
      </div>
      <div className="card-head sub">
        <span className="label">{t('duty_shift_list')}</span>
        {s.dutyAdd && e.manageable && (
          <Button size="sm" variant="ghost" onClick={() => setEdit('new')}>
            <Plus size={14} /> {t('duty_add')}
          </Button>
        )}
      </div>
      <div className="rows shift-rows">
        {shifts === null && <div className="loading small" />}
        {shifts?.length === 0 && <div className="muted small-text">{t('duty_no_shifts')}</div>}
        {shifts?.map((sh) => (
          <div key={`${sh.index}-${sh.key}`} className="row shift-row static">
            <div className="shift-main">
              <span className="num">{dateTime(sh.startTime)}</span>
              <span className="num shift-len">{hours(sh.duration)}</span>
              {sh.manual ? <Badge tone="warn">{t('duty_manual')}</Badge> : sh.edited && <Badge tone="warn">{t('duty_edited')}</Badge>}
            </div>
            {sh.edited && !sh.manual && <span className="label">{t('duty_original', hours(sh.edited.originalDuration))} · {sh.edited.by}</span>}
            {e.manageable && (
              <span className="row-actions">
                {s.dutyEdit && (
                  <IconButton label={t('duty_edit')} onClick={() => setEdit(sh)}>
                    <Pencil size={13} />
                  </IconButton>
                )}
                {s.dutyRemove && (
                  <IconButton label={t('duty_remove')} onClick={() => setRemove(sh)}>
                    <Trash2 size={13} />
                  </IconButton>
                )}
              </span>
            )}
          </div>
        ))}
      </div>

      {edit && <ShiftDialog e={e} shift={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onDone={changed} />}
      {remove && (
        <ConfirmDialog
          tone="danger"
          title={t('duty_remove')}
          text={t('duty_remove_text', e.name)}
          confirmLabel={t('duty_remove')}
          cancelLabel={t('cancel')}
          backdrop={false}
          onCancel={() => setRemove(null)}
          onConfirm={async () => {
            if (result(await call('dutyRemove', e.identifier, remove.index, remove.key), t('saved'))) changed()
            setRemove(null)
          }}
        />
      )}
      {forceOff && (
        <ConfirmDialog
          tone="danger"
          title={t('duty_force_off')}
          text={t('duty_force_off_text', e.name)}
          confirmLabel={t('duty_force_off')}
          cancelLabel={t('cancel')}
          backdrop={false}
          onCancel={() => setForceOff(false)}
          onConfirm={async () => {
            if (result(await call('dutyForceOff', e.identifier), t('saved'))) changed()
            setForceOff(false)
          }}
        />
      )}
    </div>
  )
}

function toLocalInput(epoch: number) {
  const d = new Date(epoch * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

function ShiftDialog({ e, shift, onClose, onDone }: { e: DutyEmployee; shift: Shift | null; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const boot = useBoot()
  const result = useResult()
  const startDefault = toLocalInput(shift?.startTime ?? Math.floor(Date.now() / 1000) - 3 * 3600)
  const [date, setDate] = useState(startDefault.date)
  const [time, setTime] = useState(startDefault.time)
  const [h, setH] = useState(String(Math.floor((shift?.duration ?? 7200) / 3600)))
  const [m, setM] = useState(String(Math.floor(((shift?.duration ?? 7200) % 3600) / 60)))
  const [busy, setBusy] = useState(false)
  const duration = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60
  const valid = duration >= 60 && duration <= boot.settings.maxShiftHours * 3600

  const save = async () => {
    setBusy(true)
    let r
    if (shift) {
      r = await call('dutyEdit', e.identifier, shift.index, shift.key, duration)
    } else {
      const start = Math.floor(new Date(`${date}T${time}:00`).getTime() / 1000)
      r = await call('dutyAdd', e.identifier, start, duration)
    }
    setBusy(false)
    if (result(r, t('saved'))) {
      onDone()
      onClose()
    }
  }

  return (
    <Dialog
      title={shift ? t('duty_edit') : t('duty_add')}
      meta={e.name}
      onClose={onClose}
      backdrop={false}
      footer={
        <ButtonRow>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button disabled={!valid || busy} onClick={save}>{t('save')}</Button>
        </ButtonRow>
      }
    >
      <div className="stack-lg">
        {shift ? (
          <Field label={t('duty_start')}>
            <div className="num muted">{dateTime(shift.startTime)}</div>
          </Field>
        ) : (
          <FieldRow>
            <Field label={t('duty_date')}>
              <Input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
            </Field>
            <Field label={t('duty_time')}>
              <Input type="time" value={time} onChange={(ev) => setTime(ev.target.value)} />
            </Field>
          </FieldRow>
        )}
        <FieldRow>
          <Field label={t('duty_hours')}>
            <Input type="number" min={0} max={boot.settings.maxShiftHours} value={h} onChange={(ev) => setH(ev.target.value)} />
          </Field>
          <Field label={t('duty_minutes')}>
            <Input type="number" min={0} max={59} value={m} onChange={(ev) => setM(ev.target.value)} />
          </Field>
        </FieldRow>
      </div>
    </Dialog>
  )
}
