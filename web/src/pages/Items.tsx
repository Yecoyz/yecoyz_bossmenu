import { useCallback, useEffect, useMemo, useState } from 'react'
import { Lock, Minus, Package, Plus } from 'lucide-react'
import { useTranslation } from '../ui/nui/i18n'
import { call } from '../api'
import { dateTime, useMoney, useResult } from '../lib'
import { Button } from '../ui/components/Button/Button'
import { IconButton } from '../ui/components/IconButton/IconButton'
import { ConfirmDialog } from '../ui/components/Dialog/Dialog'
import { EmptyState } from '../ui/components/EmptyState/EmptyState'
import { Segmented } from '../ui/components/Segmented/Segmented'

interface ShopItem {
  index: number
  name: string
  label: string
  price: number
  grade: number
  category: string
  max: number
  image?: string
  locked: boolean
}

interface ItemData {
  shop: ShopItem[]
  recent: { id: number; actor_name: string; target_name: string; amount: number; created_at: number }[]
  balance?: number
  images?: string
}

// The inventory's picture of the item, or a box icon when there is none.
// The picture set in the creator, else the inventory's picture of the item, else a box icon.
function ItemImage({ name, path, image, locked }: { name: string; path?: string; image?: string; locked: boolean }) {
  const [failed, setFailed] = useState(false)
  if (locked) return <Lock size={22} />
  const src = image || (path ? path.replace('%s', name) : undefined)
  if (!src || failed) return <Package size={24} />
  return <img src={src} alt="" onError={() => setFailed(true)} />
}

export default function Items() {
  const { t } = useTranslation()
  const money = useMoney()
  const result = useResult()
  const [data, setData] = useState<ItemData | null>(null)
  const [category, setCategory] = useState('all')
  const [amounts, setAmounts] = useState<Record<number, number>>({})
  const [buy, setBuy] = useState<{ item: ShopItem; amount: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    call<ItemData>('items').then((r) => !r.error && setData(r))
  }, [])
  useEffect(load, [load])

  const categories = useMemo(() => Array.from(new Set((data?.shop ?? []).map((v) => v.category))), [data])
  if (!data) return <div className="loading" />
  const shown = data.shop.filter((v) => category === 'all' || v.category === category)
  const amountOf = (v: ShopItem) => amounts[v.index] ?? 1
  const setAmount = (v: ShopItem, n: number) => setAmounts((a) => ({ ...a, [v.index]: Math.max(1, Math.min(v.max, Math.floor(n) || 1)) }))

  return (
    <div className="veh">
      <section className="card veh-shop">
        <div className="card-head">
          <span className="title">{t('item_shop')}</span>
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
        <p className="note">{t('item_note')}</p>
        {shown.length === 0 ? (
          <EmptyState icon={<Package size={18} />} text={t('item_empty')} />
        ) : (
          <div className="veh-grid">
            {shown.map((v) => {
              const amount = amountOf(v)
              return (
                <div key={v.index} className={`veh-card${v.locked ? ' locked' : ''}`}>
                  <div className="veh-icon item-icon">
                    <ItemImage name={v.name} path={data.images} image={v.image} locked={v.locked} />
                  </div>
                  <div className="veh-info">
                    <span className="veh-name truncate">{v.label}</span>
                    <span className="label num">{t('item_each', money(v.price))}</span>
                  </div>
                  <div className="veh-buy">
                    <div className="item-qty">
                      <IconButton size="sm" label="-" disabled={v.locked || amount <= 1} onClick={() => setAmount(v, amount - 1)}>
                        <Minus size={14} />
                      </IconButton>
                      <input
                        className="input item-qty-input num"
                        value={amount}
                        disabled={v.locked || v.max <= 1}
                        aria-label={t('item_amount')}
                        onChange={(e) => setAmount(v, Number(e.target.value.replace(/\D/g, '')))}
                      />
                      <IconButton size="sm" label="+" disabled={v.locked || amount >= v.max} onClick={() => setAmount(v, amount + 1)}>
                        <Plus size={14} />
                      </IconButton>
                    </div>
                    <Button size="sm" variant="outline" disabled={v.locked} onClick={() => setBuy({ item: v, amount })}>
                      {v.locked ? t('item_rank_needed', v.grade) : `${t('item_buy')} · ${money(v.price * amount)}`}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card veh-fleet">
        <div className="card-head">
          <span className="title">{t('item_recent')}</span>
          <span className="label num">{data.recent.length}</span>
        </div>
        <div className="rows">
          {data.recent.length === 0 && <EmptyState icon={<Package size={18} />} text={t('item_no_recent')} />}
          {data.recent.map((r) => (
            <div key={r.id} className="row fleet-row static">
              <div className="fleet-main">
                <span className="truncate">{r.target_name}</span>
                <span className="num">{money(r.amount)}</span>
              </div>
              <span className="label truncate">
                {r.actor_name} · {dateTime(r.created_at)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {buy && (
        <ConfirmDialog
          title={t('item_buy_title')}
          text={t('item_buy_text', buy.amount, buy.item.label)}
          amount={money(buy.item.price * buy.amount)}
          confirmLabel={t('item_buy')}
          cancelLabel={t('cancel')}
          busy={busy}
          backdrop={false}
          onCancel={() => setBuy(null)}
          onConfirm={async () => {
            setBusy(true)
            const r = await call('buyItem', buy.item.index, buy.amount, buy.item.name)
            setBusy(false)
            if (result(r, t('item_bought', buy.amount, buy.item.label))) load()
            setBuy(null)
          }}
        />
      )}
    </div>
  )
}
