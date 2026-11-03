import { fetchNui } from './ui/nui/fetchNui'

export interface Grade {
  grade: number
  name: string
  label: string
  salary: number
  isBoss?: boolean
  employees?: number
}

export interface DutyStats {
  today: number
  week: number
  month: number
  total: number
  shifts: number
  average: number
  lastShift?: number
  onDuty?: boolean
}

export interface Employee {
  identifier: string
  name: string
  grade: number
  gradeLabel: string
  gradeSalary: number
  isBoss?: boolean
  online: boolean
  source?: number
  onDuty?: boolean
  phone?: string
  lastSeen?: number
  salary?: number
  perms: string[]
  manageable?: boolean
  duty?: DutyStats
}

export interface LogRow {
  id: number
  category: string
  action: string
  actor_name?: string
  target_name?: string
  amount?: number
  details?: string
  created_at: number
}

export interface Boot {
  me: { name: string; identifier: string; grade: number; gradeLabel: string; isBoss: boolean }
  job: { name: string; label: string }
  perms: string[]
  allPerms: string[]
  currency: string
  duty: boolean
  settings: {
    maxBonus: number
    maxSalary: number
    maxIndividual: number
    individual: boolean
    maxTransaction: number
    maxGrades: number
    hireById: boolean
    vehicleMode: 'spawn' | 'garage'
    dutyEdit: boolean
    dutyRemove: boolean
    dutyAdd: boolean
    dutyForceOff: boolean
    maxShiftHours: number
    gradeSalaries: boolean
  }
}

export type Result<T = object> = T & { error?: string; ok?: boolean }

// Calls the server action of the same name (client/computer.lua passes it on, the server checks access).
export function call<T = object>(name: string, ...args: unknown[]): Promise<Result<T>> {
  return fetchNui<Result<T>>('call', { name, args }).catch(() => ({ error: 'timeout' }) as Result<T>)
}
