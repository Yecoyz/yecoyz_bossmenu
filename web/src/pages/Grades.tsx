import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '../ui/nui/i18n'
import { call, type Grade } from '../api'
import { useBoot, useCan, useMoney, useResult } from '../lib'
import { Button, ButtonRow } from '../ui/components/Button/Button'
import { IconButton } from '../ui/components/IconButton/IconButton'
import { Badge } from '../ui/components/Badge/Badge'
import { Dialog, ConfirmDialog } from '../ui/components/Dialog/Dialog'
import { Field, Input } from '../ui/components/Input/Input'

export default function Grades() {
  const { t } = useTranslation()
  const boot = useBoot()
  const can = useCan()
  const money = useMoney()
  const result = useResult()
  const [grades, setGrades] = useState<Grade[] | null>(null)
  const [edit, setEdit] = useState<Grade | 'new' | null>(null)
  const [remove, setRemove] = useState<Grade | null>(null)

  const load = useCallback(() => {
    call<{ grades: Grade[] }>('grades').then((r) => !r.error && setGrades(r.grades))
  }, [])
  useEffect(load, [load])

  if (!grades) return <div className="loading" />
  const mayEdit = (g: Grade) => boot.me.isBoss || g.grade < boot.me.grade
  // A rank swaps places with the one above/below it. Boss ranks don't move and nothing goes above them,
  // but a rank that ended up above a boss rank can move down past it.
  const neighbour = (g: Grade, dir: 1 | -1) => grades[grades.findIndex((x) => x.grade === g.grade) + dir]
  const mayMove = (g: Grade, dir: 1 | -1) => {
    const other = neighbour(g, dir)
    return can('grades') && !!other && !g.isBoss && (!other.isBoss || dir === -1) && mayEdit(g) && mayEdit(other)
  }
  const move = async (g: Grade, dir: 1 | -1) => {
    if (result(await call('moveGrade', g.grade, dir), t('grade_moved'))) load()
  }

  return (
    <section className="card">
      <div className="card-head">
        <span className="title">{t('grades_title')}</span>
        <div className="inline">
          <span className="label num">
            {grades.length} / {boot.settings.maxGrades}
          </span>
          {can('grades') && grades.length < boot.settings.maxGrades && (
            <Button size="sm" onClick={() => setEdit('new')}>
              <Plus size={14} /> {t('grade_new')}
            </Button>
          )}
        </div>
      </div>
      <div className="table-head grade-cols">
        <span className="label">{t('grade_level')}</span>
        <span className="label">{t('grade_name')}</span>
        <span className="label">{t('salary')}</span>
        <span className="label">{t('grade_staff')}</span>
        <span />
      </div>
      <div className="rows">
        {grades.slice().reverse().map((g) => (
          <div key={g.grade} className="row grade-cols static">
            <span className="num muted">{g.grade}</span>
            <span className="truncate">
              {g.label} {g.isBoss && <Badge tone="accent">{t('boss')}</Badge>}
            </span>
            <span className="num">{money(g.salary)}</span>
            <span className="num muted">{g.employees ?? 0}</span>
            <span className="row-actions">
              {can('grades') && (
                <>
                  <IconButton label={t('grade_up')} disabled={!mayMove(g, 1)} onClick={() => move(g, 1)}>
                    <ChevronUp size={14} />
                  </IconButton>
                  <IconButton label={t('grade_down')} disabled={!mayMove(g, -1)} onClick={() => move(g, -1)}>
                    <ChevronDown size={14} />
                  </IconButton>
                </>
              )}
              {mayEdit(g) && (can('grades') || (can('salaries') && boot.settings.gradeSalaries)) && (
                <IconButton label={t('grade_edit')} onClick={() => setEdit(g)}>
                  <Pencil size={14} />
                </IconButton>
              )}
              {mayEdit(g) && can('grades') && !g.isBoss && (
                <IconButton label={t('grade_delete')} onClick={() => setRemove(g)}>
                  <Trash2 size={14} />
                </IconButton>
              )}
            </span>
          </div>
        ))}
      </div>

      {edit && <GradeDialog grade={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onDone={load} />}
      {remove && (
        <ConfirmDialog
          tone="danger"
          title={t('grade_delete')}
          text={t('grade_delete_text', remove.label)}
          confirmLabel={t('grade_delete')}
          cancelLabel={t('cancel')}
          backdrop={false}
          onCancel={() => setRemove(null)}
          onConfirm={async () => {
            if (result(await call('deleteGrade', remove.grade), t('grade_deleted'))) load()
            setRemove(null)
          }}
        />
      )}
    </section>
  )
}

function GradeDialog({ grade, onClose, onDone }: { grade: Grade | null; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const boot = useBoot()
  const can = useCan()
  const result = useResult()
  const [label, setLabel] = useState(grade?.label ?? '')
  const [salary, setSalary] = useState(String(grade?.salary ?? 0))
  const [busy, setBusy] = useState(false)
  const canName = can('grades')
  const canSalary = can('salaries') && boot.settings.gradeSalaries

  const save = async () => {
    setBusy(true)
    const ok = result(await call('saveGrade', { grade: grade?.grade, label, salary: Number(salary) }), t('saved'))
    setBusy(false)
    if (ok) { onDone(); onClose() }
  }

  return (
    <Dialog
      title={grade ? t('grade_edit') : t('grade_new')}
      meta={grade ? `#${grade.grade}` : undefined}
      onClose={onClose}
      backdrop={false}
      footer={
        <ButtonRow>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button disabled={busy || !label.trim()} onClick={save}>{t('save')}</Button>
        </ButtonRow>
      }
    >
      <div className="stack-lg">
        <Field label={t('grade_name')}>
          <Input autoFocus maxLength={32} value={label} disabled={!canName} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        {(canSalary || !grade) && (
          <Field label={t('salary')}>
            <Input type="number" min={0} max={boot.settings.maxSalary} value={salary} disabled={!canSalary} onChange={(e) => setSalary(e.target.value)} />
          </Field>
        )}
      </div>
    </Dialog>
  )
}
