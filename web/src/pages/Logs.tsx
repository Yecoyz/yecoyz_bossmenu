import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { useTranslation } from '../ui/nui/i18n'
import { call, type LogRow } from '../api'
import { dateTime, useLogText, useMoney } from '../lib'
import { Segmented } from '../ui/components/Segmented/Segmented'
import { EmptyState } from '../ui/components/EmptyState/EmptyState'
import { Badge } from '../ui/components/Badge/Badge'

const CATEGORIES = ['all', 'staff', 'money', 'grade', 'vehicle', 'item', 'duty', 'access'] as const

export default function Logs() {
  const { t } = useTranslation()
  const money = useMoney()
  const logText = useLogText()
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all')
  const [rows, setRows] = useState<LogRow[] | null>(null)

  useEffect(() => {
    setRows(null)
    call<{ logs: LogRow[] }>('logs', category).then((r) => setRows(r.logs ?? []))
  }, [category])

  return (
    <section className="card logs">
      <div className="card-head">
        <Segmented variant="accent" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: t(`logs_${c}`) }))} />
      </div>
      <div className="rows">
        {rows === null && <div className="loading" />}
        {rows?.length === 0 && <EmptyState icon={<Activity size={18} />} text={t('logs_empty')} />}
        {rows?.map((row) => (
          <div key={row.id} className="row log-cols static">
            <span className="label num">{dateTime(row.created_at)}</span>
            <Badge>{t(`logs_${row.category}`)}</Badge>
            <span className="truncate">
              <b>{row.actor_name}</b> {logText(row)}
              {row.details && <span className="muted"> · {row.details}</span>}
            </span>
            <span className="num">{row.amount ? money(row.amount) : ''}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
