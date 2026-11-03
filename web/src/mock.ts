// Browser only (npm run dev): sample data so the menu can be worked on without the game.
import { mockNui } from './ui/nui/fetchNui'
import { debugNui } from './ui/nui/useNuiEvent'

const now = Math.floor(Date.now() / 1000)
const days = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const time = now - (n - 1 - i) * 86400
    return { day: new Date(time * 1000).toISOString().slice(0, 10), time, income: Math.round(Math.random() * 40000), expenses: Math.round(Math.random() * 25000), seconds: Math.round(Math.random() * 60000) }
  })

const grades = [
  { grade: 0, name: 'recruit', label: 'Recruit', salary: 200, employees: 3 },
  { grade: 1, name: 'officer', label: 'Officer', salary: 400, employees: 5 },
  { grade: 2, name: 'sergeant', label: 'Sergeant', salary: 600, employees: 2 },
  { grade: 3, name: 'boss', label: 'Chief', salary: 1000, isBoss: true, employees: 1 },
]
const employees = [
  { identifier: 'a', name: 'Peter Svensson', grade: 3, gradeLabel: 'Chief', gradeSalary: 1000, isBoss: true, online: true, onDuty: true, phone: '555-0101', perms: [], manageable: false, duty: { today: 3600, week: 54000, month: 180000, total: 400000, shifts: 40, average: 10000 } },
  { identifier: 'b', name: 'Anna Berg', grade: 2, gradeLabel: 'Sergeant', gradeSalary: 600, salary: 750, online: true, onDuty: false, phone: '555-0142', perms: ['hire', 'employees'], manageable: true, duty: { today: 0, week: 30000, month: 90000, total: 200000, shifts: 22, average: 9000 } },
  { identifier: 'c', name: 'Johan Lind', grade: 1, gradeLabel: 'Officer', gradeSalary: 400, online: false, lastSeen: now - 7200, perms: [], manageable: true, duty: { today: 0, week: 12000, month: 40000, total: 90000, shifts: 12, average: 7500 } },
]
const logs = [
  { id: 3, category: 'money', action: 'deposit', actor_name: 'Peter Svensson', amount: 25000, created_at: now - 600 },
  { id: 2, category: 'staff', action: 'hire', actor_name: 'Peter Svensson', target_name: 'Johan Lind', details: 'Officer', created_at: now - 3600 },
  { id: 1, category: 'vehicle', action: 'vehicle', actor_name: 'Anna Berg', target_name: 'Police Cruiser', amount: 25000, details: 'LSPD1234', created_at: now - 86400 },
]

const responses: Record<string, unknown> = {
  dashboard: { balance: 184500, employees: 11, online: 4, onDuty: 3, payroll: 5600, vehicles: 6, income: 120000, expenses: 64000, days: days(7), grades: grades.map((g) => ({ label: g.label, count: g.employees, grade: g.grade })), activity: logs, onlineList: employees.filter((e) => e.online).map((e) => ({ name: e.name, gradeLabel: e.gradeLabel, onDuty: e.onDuty })), duty: { week: 96000, top: [{ name: 'Peter Svensson', seconds: 54000 }, { name: 'Anna Berg', seconds: 30000 }] } },
  employees: { employees, grades },
  grades: { grades },
  nearby: { players: [{ source: 4, name: 'Lisa Ek', job: 'Unemployed', distance: 2.1 }] },
  economy: { balance: 184500, income: 210000, expenses: 98000, days: days(14), transactions: logs, account: 'bank', playerBalance: 52000 },
  vehicles: { shop: [{ index: 1, model: 'police', label: 'Police Cruiser', price: 25000, grade: 0, category: 'Patrol', image: 'https://picsum.photos/seed/cruiser/640/360', locked: false }, { index: 2, model: 'fbi', label: 'Unmarked Buffalo', price: 60000, grade: 3, category: 'Unmarked', locked: true }], fleet: [{ id: 1, model: 'police', label: 'Police Cruiser', plate: 'LSPD1234', price: 25000, bought_by_name: 'Anna Berg', created_at: now - 86400 }], balance: 184500, mode: 'spawn', canSpawn: true },
  items: { shop: [{ index: 1, name: 'radio', label: 'Radio', price: 250, grade: 0, category: 'Equipment', max: 50, locked: false }, { index: 2, name: 'bandage', label: 'Bandage', price: 50, grade: 0, category: 'Medical', max: 50, locked: false }, { index: 3, name: 'armour', label: 'Body Armour', price: 1500, grade: 1, category: 'Equipment', max: 50, locked: false }, { index: 4, name: 'WEAPON_PISTOL', label: 'Pistol', price: 5000, grade: 4, category: 'Weapons', max: 1, locked: true }], recent: [{ id: 9, actor_name: 'Anna Berg', target_name: '10x Bandage', amount: 500, created_at: now - 1800 }], balance: 184500 },
  duty: { employees, days: days(14) },
  dutyShifts: { shifts: [{ index: 1, key: now - 9000, startTime: now - 9000, duration: 7200 }, { index: 2, key: now - 99000, startTime: now - 99000, duration: 14400, edited: { by: 'Peter Svensson', at: now, originalDuration: 30000 } }], manageable: true },
  logs: { logs },
}

export function installMocks(isScreen: boolean) {
  if (isScreen) {
    setTimeout(() => window.postMessage({ action: 'screen', data: { jobLabel: 'LSPD', job: 'police', label: 'Chief office', clock: { h: 14, m: 5 }, canUse: true, prompt: 'Walk up to log in', locked: 'Locked', inUse: 'Logged in', title: 'Boss Menu' } }, '*'), 100)
    return
  }
  mockNui('call', (d) => {
    const { name } = d as { name: string }
    return responses[name] ?? { ok: true }
  })
  const allPerms = ['dashboard', 'employees', 'hire', 'fire', 'promote', 'grades', 'salaries', 'bonuses', 'vehicles', 'items', 'economy', 'deposit', 'withdraw', 'duty', 'logs', 'access']
  const params = new URLSearchParams(window.location.search)
  if (params.has('creator')) {
    const shopLists: Record<string, unknown[]> = {
      vehicle: [{ model: 'police', label: 'Police Cruiser', price: 25000, grade: 0, category: 'Patrol', image: 'https://picsum.photos/seed/cruiser/640/360' }, { model: 'fbi', label: 'Unmarked Buffalo', price: 60000, grade: 3, category: 'Unmarked' }],
      item: [{ name: 'radio', label: 'Radio', price: 250, grade: 0, category: 'Equipment' }],
    }
    const jobSummaries = [
      { name: 'ambulance', label: 'EMS', computers: 0, vehicles: 1, items: 2, pagesOff: 0 },
      { name: 'mechanic', label: 'Mechanic', computers: 0, vehicles: 2, items: 1, pagesOff: 0 },
      { name: 'police', label: 'LSPD', computers: 2, vehicles: 2, items: 1, pagesOff: 1 },
    ]
    const needs: Record<string, string> = { hire: 'employees', fire: 'employees', promote: 'employees', bonuses: 'employees', access: 'employees', deposit: 'economy', withdraw: 'economy' }
    let pagesOff: Record<string, boolean> = { duty: false }
    const ranks: Record<number, string[]> = { 0: [], 1: ['dashboard'], 2: ['dashboard', 'employees', 'hire'], 3: ['dashboard', 'economy', 'employees', 'hire'] }
    const jobDetail = (job: string) => ({
      ok: true,
      job,
      label: jobSummaries.find((j) => j.name === job)?.label ?? job,
      computers:
        job === 'police'
          ? [
              { id: 1, job: 'police', label: 'Chief office', model: 'prop_monitor_w_large', coords: { x: 0, y: 0, z: 0, w: 0 }, spawn: { x: 0, y: 0, z: 0, w: 0 } },
              { id: -1, job: 'police', label: 'Front desk', model: 'prop_monitor_w_large', coords: { x: 0, y: 0, z: 0, w: 0 }, static: true },
            ]
          : [],
      grades: [
        { grade: 4, label: 'Chief', isBoss: true, perms: [] },
        { grade: 3, label: 'Captain', isBoss: false, perms: ranks[3] },
        { grade: 2, label: 'Sergeant', isBoss: false, perms: ranks[2] },
        { grade: 1, label: 'Officer', isBoss: false, perms: ranks[1] },
        { grade: 0, label: 'Cadet', isBoss: false, perms: ranks[0] },
      ],
      pages: allPerms.map((name) => ({ name, on: pagesOff[name] !== false, needs: needs[name] })),
      ranksCustom: job === 'police',
      custom: job === 'police',
    })
    mockNui('creatorJobs', () => ({ ok: true, jobs: jobSummaries }))
    mockNui('creatorJob', (d) => jobDetail((d as { job: string }).job))
    mockNui('creatorJobSave', (d) => {
      const { job, data } = d as { job: string; data: { pages: Record<string, boolean>; ranks?: Record<number, string[]> } }
      pagesOff = data.pages
      Object.assign(ranks, data.ranks ?? {})
      return jobDetail(job)
    })
    mockNui('creatorJobReset', (d) => {
      pagesOff = {}
      return jobDetail((d as { job: string }).job)
    })
    mockNui('creatorShop', (d) => ({ ok: true, list: shopLists[(d as { kind: string }).kind] }))
    mockNui('creatorShopSave', (d) => { const { kind, list } = d as { kind: string; list: unknown[] }; shopLists[kind] = list; return { ok: true, list } })
    debugNui('creator', { computers: [{ id: 1, job: 'police', jobLabel: 'LSPD', label: 'Chief office', model: 'prop_monitor_w_large', coords: { x: 0, y: 0, z: 0, w: 0 }, spawn: { x: 0, y: 0, z: 0, w: 0 } }], jobs: [{ name: 'ambulance', label: 'EMS' }, { name: 'police', label: 'LSPD' }, { name: 'mechanic', label: 'Mechanic' }], models: [{ model: 'prop_monitor_w_large', label: 'Wide monitor' }], vehicleSpawn: true, shops: { vehicle: true, item: true }, currency: '$' }, 100)
    return
  }
  debugNui(
    'open',
    {
      mode: 'fullscreen',
      boot: {
        me: { name: 'Peter Svensson', identifier: 'a', grade: 3, gradeLabel: 'Chief', isBoss: true },
        job: { name: 'police', label: 'LSPD' },
        perms: allPerms,
        allPerms,
        currency: '$',
        duty: true,
        settings: { maxBonus: 50000, maxSalary: 25000, maxIndividual: 10000, individual: true, maxTransaction: 1000000, maxGrades: 20, hireById: true, vehicleMode: 'spawn', dutyEdit: true, dutyRemove: true, dutyAdd: true, dutyForceOff: true, maxShiftHours: 24, gradeSalaries: true },
      },
    },
    100,
  )
}
