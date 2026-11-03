import { useCallback, useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react'
import { useTranslation } from '../ui/nui/i18n'
import { call, type LogRow } from '../api'
import { dateTime, useBoot, useCan, useLogText, useMoney, useResult } from '../lib'
import { BarChart, dayPoints } from '../Chart'
import { Button } from '../ui/components/Button/Button'
import { Input } from '../ui/components/Input/Input'
import { Segmented } from '../ui/components/Segmented/Segmented'
import { EmptyState } from '../ui/components/EmptyState/EmptyState'

interface EcoData {
  balance: number
  income: number
  expenses: number
  days: { day: string; time: number; income: number; expenses: number }[]
  transactions: LogRow[]
  account: string
  playerBalance: number
}

const SIGN: Record<string, number> = { deposit: 1, withdraw: -1, bonus: -1, vehicle: -1, item: -1 }

export default function Economy() {
  const { t } = useTranslation()
  const boot = useBoot()
  const can = useCan()
  const money = useMoney()
  const result = useResult()
  const logText = useLogText()
  const [data, setData] = useState<EcoData | null>(null)
  const [kind, setKind] = useState<'deposit' | 'withdraw'>(can('deposit') ? 'deposit' : 'withdraw')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [series, setSeries] = useState<'income' | 'expenses'>('income')

  const load = useCallback(() => {
    call<EcoData>('economy').then((r) => !r.error && setData(r))
  }, [])
  useEffect(load, [load])

  if (!data) return <div className="loading" />

  const value = Number(amount)
  const max = kind === 'deposit' ? Math.min(boot.settings.maxTransaction, data.playerBalance) : Math.min(boot.settings.maxTransaction, data.balance)
  const valid = value > 0 && value <= max
  const moneyActions = (can('deposit') ? 1 : 0) + (can('withdraw') ? 1 : 0)

  const submit = async () => {
    setBusy(true)
    const r = await call<{ balance: number; playerBalance: number }>(kind, value, note)
    setBusy(false)
    if (result(r, t('eco_done'))) {
      setAmount('')
      setNote('')
      load()
    }
  }

  return (
    <div className="eco">
      <div className="eco-top">
        <section className="card eco-balance">
          <span className="label">{t('eco_balance')}</span>
          <span className="eco-amount num">{money(data.balance)}</span>
          <div className="eco-sub">
            <span className="num">
              <ArrowDownLeft size={13} /> {money(data.income)} <span className="label">{t('eco_income')}</span>
            </span>
            <span className="num">
              <ArrowUpRight size={13} /> {money(data.expenses)} <span className="label">{t('eco_expenses')}</span>
            </span>
          </div>
        </section>

        {moneyActions > 0 && (
          <section className="card eco-form">
            {moneyActions > 1 && (
              <Segmented
                variant="neutral"
                value={kind}
                onChange={(v) => setKind(v)}
                options={[
                  { value: 'deposit', label: t('eco_deposit') },
                  { value: 'withdraw', label: t('eco_withdraw') },
                ]}
              />
            )}
            <div className="inline">
              <Input type="number" placeholder={t('amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button variant="ghost" onClick={() => setAmount(String(Math.max(0, max)))}>Max</Button>
            </div>
            <Input placeholder={t('bonus_note')} maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="row-between">
              <span className="label num">{t('eco_your_balance', data.account, money(data.playerBalance))}</span>
              <Button disabled={!valid || busy} onClick={submit}>
                {kind === 'deposit' ? t('eco_deposit') : t('eco_withdraw')}
              </Button>
            </div>
          </section>
        )}

        <section className="card eco-chart">
          <div className="card-head">
            <span className="title">{t('eco_chart')}</span>
            <Segmented
              variant="accent"
              value={series}
              onChange={setSeries}
              options={[
                { value: 'income', label: t('dash_income') },
                { value: 'expenses', label: t('dash_expenses') },
              ]}
            />
          </div>
          <BarChart data={dayPoints(data.days, (d: EcoData['days'][number]) => d[series])} format={money} height={120} />
        </section>
      </div>

      <section className="card eco-history">
        <div className="card-head">
          <span className="title">{t('eco_history')}</span>
          <span className="label num">{data.transactions.length}</span>
        </div>
        <div className="rows">
          {data.transactions.length === 0 && <EmptyState icon={<Receipt size={18} />} text={t('eco_no_transactions')} />}
          {data.transactions.map((row) => {
            const sign = SIGN[row.action] ?? 0
            return (
              <div key={row.id} className="row tx-cols static">
                <span className="label num">{dateTime(row.created_at)}</span>
                <span className="truncate">
                  <b>{row.actor_name}</b> {logText(row)}
                  {row.details && <span className="muted"> · {row.details}</span>}
                </span>
                <span className={`num tx-amount ${sign > 0 ? 'in' : 'out'}`}>
                  {sign > 0 ? '+' : '−'}
                  {money(row.amount)}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
