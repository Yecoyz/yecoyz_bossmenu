import { useCallback, useEffect, useMemo, useState } from 'react'
import { Car, Lock } from 'lucide-react'
import { useTranslation } from '../ui/nui/i18n'
import { call } from '../api'
import { dateTime, useMoney, useResult } from '../lib'
import { Button } from '../ui/components/Button/Button'
import { ConfirmDialog } from '../ui/components/Dialog/Dialog'
import { EmptyState } from '../ui/components/EmptyState/EmptyState'
import { Segmented } from '../ui/components/Segmented/Segmented'
import { ShopPhoto } from '../lib'

interface ShopItem {
  index: number
  model: string
  label: string
  price: number
  grade: number
  category: string
  image?: string
  locked: boolean
}

interface VehData {
  shop: ShopItem[]
  fleet: { id: number; model: string; label: string; plate: string; price: number; bought_by_name: string; created_at: number }[]
  balance?: number
  mode: 'spawn' | 'garage'
  owner?: 'job' | 'player'
  canSpawn: boolean
}

export default function Vehicles() {
  const { t } = useTranslation()
  const money = useMoney()
  const result = useResult()
  const [data, setData] = useState<VehData | null>(null)
  const [category, setCategory] = useState('all')
  const [buy, setBuy] = useState<ShopItem | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    call<VehData>('vehicles').then((r) => !r.error && setData(r))
  }, [])
  useEffect(load, [load])

  const categories = useMemo(() => Array.from(new Set((data?.shop ?? []).map((v) => v.category))), [data])
  if (!data) return <div className="loading" />
  const shown = data.shop.filter((v) => category === 'all' || v.category === category)

  return (
    <div className="veh">
      <section className="card veh-shop">
        <div className="card-head">
          <span className="title">{t('veh_shop')}</span>
          {data.balance !== undefined && <span className="label num">{t('eco_balance')} · {money(data.balance)}</span>}
        </div>
        {categories.length > 1 && (
          <Segmented
            variant="accent"
            value={category}
            onChange={setCategory}
            options={[{ value: 'all', label: t('logs_all') }, ...categories.map((c) => ({ value: c, label: c }))]}
          />
        )}
        <p className="note">{data.mode === 'spawn' ? (data.canSpawn ? t('veh_mode_spawn') : t('veh_no_spawn')) : t(data.owner === 'player' ? 'veh_mode_garage' : 'veh_mode_job_garage')}</p>
        {shown.length === 0 ? (
          <EmptyState icon={<Car size={18} />} text={t('veh_empty')} />
        ) : (
          <div className="veh-grid">
            {shown.map((v) => (
              <div key={v.index} className={`veh-card${v.locked ? ' locked' : ''}${v.image ? ' has-photo' : ''}`}>
                {v.image ? <ShopPhoto src={v.image} /> : <div className="veh-icon">{v.locked ? <Lock size={22} /> : <Car size={26} />}</div>}
                <div className="veh-info">
                  <span className="veh-name truncate">{v.label}</span>
                  <span className="label plate">{v.model}</span>
                </div>
                <div className="veh-buy">
                  <span className="num veh-price">{money(v.price)}</span>
                  <Button size="sm" variant="outline" disabled={v.locked || !data.canSpawn} onClick={() => setBuy(v)}>
                    {v.locked ? t('veh_rank_needed', v.grade) : t('veh_buy')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card veh-fleet">
        <div className="card-head">
          <span className="title">{t('veh_fleet')}</span>
          <span className="label num">{data.fleet.length}</span>
        </div>
        <div className="rows">
          {data.fleet.length === 0 && <EmptyState icon={<Car size={18} />} text={t('veh_no_fleet')} />}
          {data.fleet.map((f) => (
            <div key={f.id} className="row fleet-row static">
              <div className="fleet-main">
                <span className="truncate">{f.label}</span>
                <span className="plate fleet-plate">{f.plate}</span>
              </div>
              <span className="label truncate">
                {f.bought_by_name} · {dateTime(f.created_at)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {buy && (
        <ConfirmDialog
          title={t('veh_buy_title')}
          text={t('veh_buy_text', buy.label)}
          amount={money(buy.price)}
          confirmLabel={t('veh_buy')}
          cancelLabel={t('cancel')}
          busy={busy}
          backdrop={false}
          onCancel={() => setBuy(null)}
          onConfirm={async () => {
            setBusy(true)
            const r = await call<{ plate: string; garage?: string }>('buyVehicle', buy.index, buy.model)
            setBusy(false)
            const done = r.garage ? t('veh_bought_garage', buy.label, r.plate ?? '', r.garage) : t('veh_bought', buy.label, r.plate ?? '')
            if (result(r, done)) load()
            setBuy(null)
          }}
        />
      )}
    </div>
  )
}
