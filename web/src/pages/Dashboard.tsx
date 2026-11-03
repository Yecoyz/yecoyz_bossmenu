import { useEffect, useState } from 'react'
import { useTranslation } from '../ui/nui/i18n'
import { call, type LogRow } from '../api'
import { ago, hours, useCan, useLogText, useMoney } from '../lib'
import { BarChart, BarList, dayPoints } from '../Chart'
import { StatusDot } from '../ui/components/StatusDot/StatusDot'
import { EmptyState } from '../ui/components/EmptyState/EmptyState'
import { Activity, Users } from 'lucide-react'

interface DashData {
  balance?: number
  employees: number
  online: number
  onDuty: number
  payroll: number
  vehicles: number
  income: number
  expenses: number
  days: { day: string; time: number; income: number; expenses: number }[]
  grades: { label: string; count: number }[]
  activity: LogRow[]
  onlineList: { name: string; gradeLabel: string; onDuty: boolean }[]
  duty?: { week: number; top: { name: string; seconds: number; gradeLabel: string }[] }
}

export default function Dashboard({ go }: { go: (page: 'economy' | 'employees' | 'duty' | 'logs') => void }) {
  const { t } = useTranslation()
  const money = useMoney()
  const can = useCan()
  const logText = useLogText()
  const [data, setData] = useState<DashData | null>(null)

  useEffect(() => {
    call<DashData>('dashboard').then((r) => !r.error && setData(r))
  }, [])

  if (!data) return <div className="loading" />

  const tiles = [
    data.balance !== undefined && { label: t('dash_balance'), value: money(data.balance), accent: true, go: can('economy') ? 'economy' : undefined },
    { label: t('dash_employees'), value: data.employees, go: can('employees') ? 'employees' : undefined },
    { label: t('dash_online'), value: data.online },
    { label: t('dash_on_duty'), value: data.onDuty },
    { label: t('dash_payroll'), value: money(data.payroll) },
    data.duty && { label: t('dash_hours_week'), value: hours(data.duty.week), go: 'duty' },
  ].filter(Boolean) as { label: string; value: string | number; accent?: boolean; go?: 'economy' | 'employees' | 'duty' }[]

  return (
    <div className="dash">
      <div className="tiles" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
        {tiles.map((tile) => (
          <button key={tile.label} className={`tile${tile.go ? ' link' : ''}`} onClick={() => tile.go && go(tile.go)} disabled={!tile.go}>
            <span className="label">{tile.label}</span>
            <span className={`tile-value num${tile.accent ? ' accent' : ''}`}>{tile.value}</span>
          </button>
        ))}
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card-head">
            <span className="title">{t('dash_income')}</span>
            <span className="label num">
              {t('dash_week')} · {money(data.income)}
            </span>
          </div>
          <BarChart data={dayPoints(data.days, (d: { income: number }) => d.income)} format={money} height={110} />
        </section>
        <section className="card">
          <div className="card-head">
            <span className="title">{t('dash_expenses')}</span>
            <span className="label num">
              {t('dash_week')} · {money(data.expenses)}
            </span>
          </div>
          <BarChart data={dayPoints(data.days, (d: { expenses: number }) => d.expenses)} format={money} height={110} />
        </section>
        <section className="card">
          <div className="card-head">
            <span className="title">{t('dash_ranks')}</span>
          </div>
          <BarList items={data.grades.slice().reverse().map((g) => ({ label: g.label, value: g.count }))} />
        </section>

        <section className="card">
          <div className="card-head">
            <span className="title">{t('dash_online_now')}</span>
            <span className="label num">{data.onlineList.length}</span>
          </div>
          {data.onlineList.length === 0 ? (
            <EmptyState icon={<Users size={18} />} text={t('nobody_online')} />
          ) : (
            <div className="mini-list">
              {data.onlineList.map((p, i) => (
                <div key={i} className="mini-row">
                  <StatusDot on={p.onDuty} />
                  <span className="truncate">{p.name}</span>
                  <span className="label">{p.gradeLabel}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        {data.duty ? (
          <section className="card">
            <div className="card-head">
              <span className="title">{t('dash_top')}</span>
            </div>
            {data.duty.top.length === 0 ? (
              <EmptyState icon={<Users size={18} />} text={t('duty_no_shifts')} />
            ) : (
              <div className="mini-list">
                {data.duty.top.map((p, i) => (
                  <div key={i} className="mini-row">
                    <span className="rank num">{i + 1}</span>
                    <span className="truncate">{p.name}</span>
                    <span className="num mini-value">{hours(p.seconds)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="card">
            <div className="card-head">
              <span className="title">{t('dash_vehicles')}</span>
            </div>
            <div className="big-number num">{data.vehicles}</div>
          </section>
        )}
        <section className="card">
          <div className="card-head">
            <span className="title">{t('dash_activity')}</span>
            {can('logs') && (
              <button className="link-btn" onClick={() => go('logs')}>
                {t('nav_logs')}
              </button>
            )}
          </div>
          {data.activity.length === 0 ? (
            <EmptyState icon={<Activity size={18} />} text={t('no_activity')} />
          ) : (
            <div className="mini-list">
              {data.activity.map((row) => (
                <div key={row.id} className="mini-row activity">
                  <span className="truncate">
                    <b>{row.actor_name}</b> {logText(row)}
                    {row.amount ? <span className="num"> · {money(row.amount)}</span> : null}
                  </span>
                  <span className="label num">{ago(row.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
