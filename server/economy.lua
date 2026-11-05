-- Company account, dashboard and the activity log.

-- Money in (+) and out (-) of the company account per action.
local MONEY_SIGN = { deposit = 1, withdraw = -1, bonus = -1, vehicle = -1, item = -1 }

local function dayKey(t) return os.date('%Y-%m-%d', t) end

-- Income and expenses per day for the last `days` days, oldest first.
local function moneyByDay(job, days)
    local since = os.time() - days * 86400
    local rows = MySQL.query.await([[
        SELECT `action`, `amount`, `created_at` FROM `yecoyz_bossmenu_logs`
        WHERE `job` = ? AND `category` IN ('money', 'vehicle', 'item') AND `amount` IS NOT NULL AND `created_at` >= ?
    ]], { job, since }) or {}
    local byDay = {}
    for _, row in ipairs(rows) do
        local sign = MONEY_SIGN[row.action]
        if sign then
            local key = dayKey(row.created_at)
            byDay[key] = byDay[key] or { income = 0, expenses = 0 }
            if sign > 0 then byDay[key].income = byDay[key].income + row.amount
            else byDay[key].expenses = byDay[key].expenses + row.amount end
        end
    end
    local list = {}
    for i = days - 1, 0, -1 do
        local t = os.time() - i * 86400
        local key = dayKey(t)
        local d = byDay[key] or { income = 0, expenses = 0 }
        list[#list + 1] = { day = key, time = t, income = d.income, expenses = d.expenses }
    end
    return list
end

local function logRows(job, filter, limit, since)
    local where, args = { '`job` = ?' }, { job }
    if filter then
        local marks = {}
        for _, c in ipairs(filter) do marks[#marks + 1] = '?'; args[#args + 1] = c end
        where[#where + 1] = ('`category` IN (%s)'):format(table.concat(marks, ','))
    end
    if since then where[#where + 1] = '`created_at` >= ?'; args[#args + 1] = since end
    args[#args + 1] = limit
    return MySQL.query.await(('SELECT `id`, `category`, `action`, `actor_name`, `target_name`, `amount`, `details`, `created_at` FROM `yecoyz_bossmenu_logs` WHERE %s ORDER BY `created_at` DESC, `id` DESC LIMIT ?'):format(table.concat(where, ' AND ')), args) or {}
end

Action('economy', 'economy', function(source, access)
    local since = os.time() - Config.Economy.HistoryDays * 86400
    local days = moneyByDay(access.job, 14)
    local income, expenses = 0, 0
    for _, d in ipairs(days) do income = income + d.income; expenses = expenses + d.expenses end
    return {
        balance = Core.GetSocietyMoney(access.job),
        days = days,
        income = income,
        expenses = expenses,
        transactions = logRows(access.job, { 'money', 'vehicle', 'item' }, 200, since),
        account = Config.Economy.PlayerAccount,
        playerBalance = Core.GetMoney(source, Config.Economy.PlayerAccount),
    }
end)

local lastTransaction = {} -- [source] = os.time() of the player's last deposit/withdrawal

local function moneyAction(kind)
    return function(source, access, amount, note)
        if Busy(source) then return Err('busy') end
        local cooldown = Config.Economy.Cooldown or 0
        if cooldown > 0 and lastTransaction[source] and os.time() - lastTransaction[source] < cooldown then
            return Err('money_cooldown')
        end
        amount = math.floor(tonumber(amount) or 0)
        if amount <= 0 or amount > Config.Economy.MaxTransaction then return Err('invalid_amount') end
        if type(note) == 'string' then note = note:gsub('[%c<>]', ''):sub(1, 80) else note = nil end
        local account = Config.Economy.PlayerAccount

        if kind == 'deposit' then
            if not Core.RemoveMoney(source, amount, account, 'Company deposit') then return Err('player_no_money') end
            if not Core.AddSocietyMoney(access.job, amount) then
                Core.AddMoney(source, amount, account, 'Company deposit refund')
                return Err('failed')
            end
        else
            if not Core.RemoveSocietyMoney(access.job, amount) then return Err('no_money') end
            if not Core.AddMoney(source, amount, account, 'Company withdrawal') then
                Core.AddSocietyMoney(access.job, amount)
                return Err('failed')
            end
        end
        lastTransaction[source] = os.time()
        Log(access, 'money', kind, nil, nil, amount, note ~= '' and note or nil)
        return { ok = true, balance = Core.GetSocietyMoney(access.job), playerBalance = Core.GetMoney(source, account) }
    end
end

Action('deposit', 'deposit', moneyAction('deposit'))
Action('withdraw', 'withdraw', moneyAction('withdraw'))

AddEventHandler('playerDropped', function() lastTransaction[source] = nil end)

Action('logs', 'logs', function(source, access, category)
    local filter = nil
    if type(category) == 'string' and category ~= 'all' then filter = { category } end
    return { logs = logRows(access.job, filter, 300) }
end)

Action('dashboard', 'dashboard', function(source, access)
    local employees = GetEmployees(access.job)
    local online, duty, payroll = 0, 0, 0
    local byGrade = {}
    for _, e in ipairs(employees) do
        if e.online then online = online + 1 end
        if e.onDuty then duty = duty + 1 end
        payroll = payroll + math.max(e.salary or 0, e.gradeSalary or 0)
        byGrade[e.gradeLabel] = (byGrade[e.gradeLabel] or 0) + 1
    end
    local grades = {}
    for _, g in ipairs((JobData(access.job) or {}).grades or {}) do
        grades[#grades + 1] = { label = g.label, count = byGrade[g.label] or 0, grade = g.grade }
    end

    local days = moneyByDay(access.job, 7)
    local income, expenses = 0, 0
    for _, d in ipairs(days) do income = income + d.income; expenses = expenses + d.expenses end

    local result = {
        employees = #employees,
        online = online,
        onDuty = duty,
        payroll = payroll,
        grades = grades,
        days = days,
        income = income,
        expenses = expenses,
        vehicles = tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM `yecoyz_bossmenu_vehicles` WHERE `job` = ?', { access.job })) or 0,
        activity = logRows(access.job, nil, 8),
        onlineList = {},
    }
    if access.perms.economy then result.balance = Core.GetSocietyMoney(access.job) end
    for _, e in ipairs(employees) do
        if e.online then result.onlineList[#result.onlineList + 1] = { name = e.name, gradeLabel = e.gradeLabel, onDuty = e.onDuty } end
    end
    if access.perms.duty then
        result.duty = DutySummary(access.job, employees)
    end
    return result
end)
