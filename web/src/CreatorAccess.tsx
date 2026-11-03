import { useEffect, useMemo, useState } from 'react'
import { Crown, RotateCcw } from 'lucide-react'
import { useTranslation } from './ui/nui/i18n'
import { fetchNui } from './ui/nui/fetchNui'
import { cx } from './ui/nui/cx'
import { PanelBody, PanelFooter } from './ui/components/Panel/Panel'
import { Button, ButtonRow } from './ui/components/Button/Button'
import { Badge } from './ui/components/Badge/Badge'
import { SectionTitle } from './ui/components/SectionTitle/SectionTitle'
import { ConfirmDialog } from './ui/components/Dialog/Dialog'
import { useResult } from './lib'
import type { JobDetail } from './Creator'

// Pages: the parts of the boss menu this job can use (bosses too). Ranks: what each rank gets without being given
// access one by one. Both are saved together.
export default function CreatorAccess({ detail, onSaved, onBusy }: { detail: JobDetail; onSaved: (d: JobDetail) => void; onBusy: (open: boolean) => void }) {
  const { t } = useTranslation()
  const result = useResult()
  const initialPages = useMemo(() => Object.fromEntries(detail.pages.map((p) => [p.name, p.on])), [detail])
  const initialRanks = useMemo(() => Object.fromEntries(detail.grades.filter((g) => !g.isBoss).map((g) => [g.grade, g.perms])), [detail])
  const [pages, setPages] = useState<Record<string, boolean>>(initialPages)
  const [ranks, setRanks] = useState<Record<number, string[]>>(initialRanks)
  const [busy, setBusy] = useState(false)
  const [reset, setReset] = useState<'pages' | 'ranks' | null>(null)

  useEffect(() => {
    setPages(initialPages)
    setRanks(initialRanks)
  }, [initialPages, initialRanks])

  const pagesChanged = JSON.stringify(pages) !== JSON.stringify(initialPages)
  const ranksChanged = JSON.stringify(ranks) !== JSON.stringify(initialRanks)
  const changed = pagesChanged || ranksChanged
  useEffect(() => onBusy(reset !== null), [reset, onBusy])

  // A page that needs another one is off when that one is off (deposit needs the economy page).
  const pageOn = (name: string): boolean => {
    const p = detail.pages.find((x) => x.name === name)
    if (!p || pages[name] === false) return false
    return p.needs ? pageOn(p.needs) : true
  }
  const usable = detail.pages.filter((p) => pageOn(p.name))

  const toggleRank = (grade: number, perm: string) => {
    const cur = new Set(ranks[grade] ?? [])
    if (cur.has(perm)) cur.delete(perm)
    else cur.add(perm)
    setRanks({ ...ranks, [grade]: Array.from(cur).sort() })
  }

  const save = async () => {
    setBusy(true)
    const r = await fetchNui<JobDetail & { error?: string }>('creatorJobSave', {
      job: detail.job,
      data: { pages, ranks: ranksChanged || detail.ranksCustom ? ranks : undefined },
    })
    setBusy(false)
    if (result(r, t('saved'))) onSaved(r)
  }

  const pagesCustom = detail.pages.some((p) => !p.on)

  return (
    <>
      <PanelBody scroll className="stack-lg cw-access">
        <div className="stack">
          <div className="row-between">
            <SectionTitle>{t('creator_pages')}</SectionTitle>
            {pagesCustom && (
              <Button size="sm" variant="ghost" onClick={() => setReset('pages')}>
                <RotateCcw size={13} /> {t('creator_all_on')}
              </Button>
            )}
          </div>
          <p className="body small-text">{t('creator_pages_hint')}</p>
          <div className="perm-grid cw-perm-grid">
            {detail.pages.map((p) => {
              const on = pages[p.name] !== false
              const blocked = on && !pageOn(p.name)
              return (
                <label key={p.name} className={cx('perm', on && !blocked && 'on', blocked && 'blocked')}>
                  <input type="checkbox" checked={on} onChange={() => setPages({ ...pages, [p.name]: !on })} />
                  <span className="perm-box" />
                  <span>{t(`perm_${p.name}`)}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="stack">
          <div className="row-between">
            <SectionTitle>{t('creator_ranks')}</SectionTitle>
            <span className="cw-row">
              <Badge tone={detail.ranksCustom ? 'accent' : undefined}>{detail.ranksCustom ? t('shop_custom') : t('shop_from_config')}</Badge>
              {detail.ranksCustom && (
                <Button size="sm" variant="ghost" onClick={() => setReset('ranks')}>
                  <RotateCcw size={13} /> {t('shop_reset')}
                </Button>
              )}
            </span>
          </div>
          <p className="body small-text">{t('creator_ranks_hint')}</p>
          {detail.grades.map((g) => (
            <div key={g.grade} className="cw-rank">
              <div className="cw-rank-head">
                <span className="creator-item-name truncate">{g.label}</span>
                <span className="label num">{g.grade}</span>
              </div>
              {g.isBoss ? (
                <span className="label cw-rank-boss">
                  <Crown size={13} /> {t('creator_boss_all')}
                </span>
              ) : (
                <div className="cw-chips">
                  {usable.map((p) => {
                    const on = (ranks[g.grade] ?? []).includes(p.name)
                    return (
                      <button key={p.name} type="button" className={cx('cw-chip', on && 'on')} onClick={() => toggleRank(g.grade, p.name)}>
                        {t(`perm_${p.name}`)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </PanelBody>
      <PanelFooter>
        <ButtonRow>
          <Button
            variant="ghost"
            disabled={!changed || busy}
            onClick={() => {
              setPages(initialPages)
              setRanks(initialRanks)
            }}
          >
            {t('cancel')}
          </Button>
          <Button disabled={!changed || busy} onClick={save}>
            {t('save')}
          </Button>
        </ButtonRow>
      </PanelFooter>

      {reset && (
        <ConfirmDialog
          tone="danger"
          title={reset === 'pages' ? t('creator_all_on') : t('shop_reset')}
          text={reset === 'pages' ? t('creator_pages_reset_text') : t('creator_ranks_reset_text')}
          confirmLabel={t('shop_reset')}
          cancelLabel={t('cancel')}
          busy={busy}
          onCancel={() => setReset(null)}
          onConfirm={async () => {
            setBusy(true)
            const r = await fetchNui<JobDetail & { error?: string }>('creatorJobReset', { job: detail.job, what: reset })
            setBusy(false)
            setReset(null)
            if (result(r, t('saved'))) onSaved(r)
          }}
        />
      )}
    </>
  )
}
