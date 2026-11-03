import { useCallback, useEffect, useState } from 'react'
import { Car, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from './ui/nui/i18n'
import { useKey } from './ui/nui/useKey'
import { fetchNui } from './ui/nui/fetchNui'
import { PanelBody, PanelFooter } from './ui/components/Panel/Panel'
import { Button, ButtonRow } from './ui/components/Button/Button'
import { IconButton } from './ui/components/IconButton/IconButton'
import { Field, FieldRow, Input } from './ui/components/Input/Input'
import { EmptyState } from './ui/components/EmptyState/EmptyState'
import { ConfirmDialog } from './ui/components/Dialog/Dialog'
import { useResult } from './lib'
import type { JobGrade } from './Creator'

export type ShopKind = 'vehicle' | 'item'

export interface ShopEntry {
  model?: string
  name?: string
  label?: string
  price: number
  grade: number
  category?: string
  image?: string
  max?: number
  garage?: string
  useGrade?: number
}

type ShopResult = { error?: string; list?: ShopEntry[] }

const num = (v: string) => (v === '' ? undefined : Math.max(0, Math.floor(Number(v.replace(/\D/g, '')) || 0)))

function Thumb({ entry, kind }: { entry: ShopEntry; kind: ShopKind }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="creator-thumb">
      {entry.image && !failed ? (
        <img src={entry.image} alt="" onError={() => setFailed(true)} />
      ) : kind === 'vehicle' ? (
        <Car size={16} />
      ) : (
        <Package size={16} />
      )}
    </div>
  )
}

// The vehicle or item list of one job (saved in the database): add, edit and remove entries. Every change saves the
// whole list.
export default function CreatorShop({
  kind,
  job,
  grades,
  currency,
  onBusy,
  onChanged,
}: {
  kind: ShopKind
  job: string
  grades: JobGrade[]
  currency: string
  onBusy: (open: boolean) => void
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const result = useResult()
  const [list, setList] = useState<ShopEntry[] | null>(null)
  const [form, setForm] = useState<{ index: number; entry: ShopEntry } | null>(null)
  const [remove, setRemove] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const apply = (r: ShopResult) => {
    if (r.list) setList(r.list)
  }

  const load = useCallback(() => {
    setList(null)
    fetchNui<ShopResult>('creatorShop', { kind, job }).then((r) => !r.error && apply(r))
  }, [kind, job])
  useEffect(load, [load])

  useEffect(() => onBusy(form !== null || remove !== null), [form, remove, onBusy])
  useKey('Escape', () => setForm(null), form !== null && remove === null)

  // Rank names of this job, highest first; a number that isn't a rank (anymore) still shows.
  const rankName = (g: number | undefined) => grades.find((r) => r.grade === g)?.label ?? t('shop_rank', g ?? 0)
  const rankSelect = (value: number | undefined, onChange: (v?: number) => void, optional = false) => (
    <select className="input" value={value ?? ''} onChange={(ev) => onChange(ev.target.value === '' ? undefined : Number(ev.target.value))}>
      {optional && <option value="">-</option>}
      {value !== undefined && !grades.some((g) => g.grade === value) && <option value={value}>{t('shop_rank', value)}</option>}
      {[...grades].sort((a, b) => a.grade - b.grade).map((g) => (
        <option key={g.grade} value={g.grade}>
          {g.label} ({g.grade})
        </option>
      ))}
    </select>
  )

  const save = async (next: ShopEntry[], message = t('shop_saved')) => {
    setBusy(true)
    const r = await fetchNui<ShopResult>('creatorShopSave', { kind, job, list: next })
    setBusy(false)
    if (result(r, message)) {
      apply(r)
      onChanged()
      return true
    }
    return false
  }

  const key = kind === 'vehicle' ? 'model' : 'name'
  const money = (n: number) => `${currency}${Math.round(n).toLocaleString('en-US')}`

  if (form) {
    const e = form.entry
    const set = (patch: Partial<ShopEntry>) => setForm({ ...form, entry: { ...e, ...patch } })
    const valid = !!e[key] && e.price !== undefined && !Number.isNaN(e.price)
    return (
      <>
        <PanelBody scroll className="stack-lg cw-form">
          <Field label={kind === 'vehicle' ? t('shop_model') : t('shop_item')}>
            <Input maxLength={kind === 'vehicle' ? 32 : 64} value={e[key] ?? ''} onChange={(ev) => set({ [key]: ev.target.value.trim() })} />
          </Field>
          <Field label={t('shop_label')}>
            <Input maxLength={48} value={e.label ?? ''} onChange={(ev) => set({ label: ev.target.value })} />
          </Field>
          <FieldRow>
            <Field label={t('shop_price')}>
              <Input inputMode="numeric" value={e.price ?? ''} onChange={(ev) => set({ price: num(ev.target.value) ?? 0 })} />
            </Field>
            <Field label={t('shop_grade')}>
              {rankSelect(e.grade ?? 0, (v) => set({ grade: v ?? 0 }))}
            </Field>
          </FieldRow>
          <Field label={t('shop_category')}>
            <Input maxLength={32} value={e.category ?? ''} onChange={(ev) => set({ category: ev.target.value })} />
          </Field>
          {kind === 'item' ? (
            <Field label={t('shop_max')}>
              <Input inputMode="numeric" value={e.max ?? ''} onChange={(ev) => set({ max: num(ev.target.value) })} />
            </Field>
          ) : (
            <FieldRow>
              <Field label={t('shop_garage')}>
                <Input maxLength={64} value={e.garage ?? ''} onChange={(ev) => set({ garage: ev.target.value || undefined })} />
              </Field>
              <Field label={t('shop_use_grade')}>
                {rankSelect(e.useGrade, (v) => set({ useGrade: v }), true)}
              </Field>
            </FieldRow>
          )}
          <Field label={t('shop_image')} hint={t('shop_image_hint')}>
            <Input maxLength={512} value={e.image ?? ''} onChange={(ev) => set({ image: ev.target.value.trim() || undefined })} />
          </Field>
          {e.image && (
            <div className="creator-preview">
              <img src={e.image} alt="" />
            </div>
          )}
        </PanelBody>
        <PanelFooter>
          <ButtonRow>
            <Button variant="ghost" onClick={() => setForm(null)}>
              {t('cancel')}
            </Button>
            <Button
              disabled={!valid || busy}
              onClick={async () => {
                const next = [...(list ?? [])]
                if (form.index < 0) next.push(e)
                else next[form.index] = e
                if (await save(next)) setForm(null)
              }}
            >
              {t('save')}
            </Button>
          </ButtonRow>
        </PanelFooter>
      </>
    )
  }

  return (
    <>
      <PanelBody scroll className="creator-list">
        {list === null && <div className="loading" />}
        {list && list.length === 0 && <EmptyState icon={kind === 'vehicle' ? <Car size={18} /> : <Package size={18} />} text={t('shop_empty')} />}
        {list?.map((entry, i) => (
          <div key={i + ':' + entry[key]} className="creator-item creator-shop-item">
            <Thumb entry={entry} kind={kind} />
            <div className="creator-item-text">
              <span className="truncate creator-item-name">{entry.label || entry[key]}</span>
              <span className="label truncate">
                {money(entry.price)} · {rankName(entry.grade ?? 0)}
                {entry.category ? ' · ' + entry.category : ''}
              </span>
            </div>
            <IconButton label={t('shop_edit')} onClick={() => setForm({ index: i, entry: { ...entry } })}>
              <Pencil size={14} />
            </IconButton>
            <IconButton label={t('creator_delete')} onClick={() => setRemove(i)}>
              <Trash2 size={14} />
            </IconButton>
          </div>
        ))}
      </PanelBody>
      <PanelFooter>
        <Button block disabled={list === null} onClick={() => setForm({ index: -1, entry: { price: 0, grade: 0 } })}>
          <Plus size={15} /> {kind === 'vehicle' ? t('shop_add_vehicle') : t('shop_add_item')}
        </Button>
      </PanelFooter>

      {remove !== null && list && (
        <ConfirmDialog
          tone="danger"
          title={t('creator_delete')}
          text={t('shop_delete_text', list[remove]?.label || list[remove]?.[key] || '')}
          confirmLabel={t('creator_delete')}
          cancelLabel={t('cancel')}
          busy={busy}
          onCancel={() => setRemove(null)}
          onConfirm={async () => {
            await save(list.filter((_, i) => i !== remove))
            setRemove(null)
          }}
        />
      )}
    </>
  )
}
