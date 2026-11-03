-- Employees, ranks, salaries, bonuses and access.
local RES = GetCurrentResourceName()

local function gradeMap(job)
    local data = JobData(job)
    local map = {}
    for _, g in ipairs(data and data.grades or {}) do map[g.grade] = g end
    return map, data
end

local function individualSalaries(job)
    local map = {}
    for _, row in ipairs(MySQL.query.await('SELECT `identifier`, `salary` FROM `yecoyz_bossmenu_salaries` WHERE `job` = ?', { job }) or {}) do
        map[row.identifier] = row.salary
    end
    return map
end

local function onDuty(source)
    if DutyAvailable() then
        local ok, state = pcall(function() return exports[Config.Duty.Resource]:GetDutyState(source) end)
        if ok and state ~= nil then return state == true end
    end
    local job = Core.GetJob(source)
    return job and job.onDuty == true or false
end
IsOnDuty = onDuty

-- Every employee, online or not: { identifier, name, grade, gradeLabel, online, source, onDuty, phone, salary, ... }
function GetEmployees(job)
    local grades = gradeMap(job)
    local salaries = individualSalaries(job)
    local access = GetPersonalAccess(job)
    local list, byId = {}, {}

    for _, row in ipairs(Core.GetJobEmployees(job)) do
        local e = {
            identifier = row.identifier,
            name = ((row.firstname or '') .. ' ' .. (row.lastname or '')):gsub('^%s+', ''):gsub('%s+$', ''),
            grade = row.grade, phone = row.phone, lastSeen = row.lastSeen, online = false,
        }
        list[#list + 1] = e
        byId[e.identifier] = e
    end

    -- Online players are more current than the database.
    for _, src in ipairs(Core.GetPlayersByJob(job)) do
        local identifier = Core.GetIdentifier(src)
        local pjob = Core.GetJob(src)
        if identifier and pjob then
            local e = byId[identifier]
            if not e then
                e = { identifier = identifier }
                list[#list + 1] = e
                byId[identifier] = e
            end
            local character = Core.GetCharacter(src) or {}
            e.name = Core.GetFullName(src)
            e.grade = pjob.grade
            e.online = true
            e.source = src
            e.onDuty = onDuty(src)
            e.phone = character.phone or e.phone
        end
    end

    for _, e in ipairs(list) do
        local g = grades[e.grade]
        e.gradeLabel = g and g.label or tostring(e.grade)
        e.gradeSalary = g and g.salary or 0
        e.isBoss = g and g.isBoss or false
        e.salary = salaries[e.identifier]
        local perms = {}
        for name in pairs(access[e.identifier] or {}) do perms[#perms + 1] = name end
        e.perms = perms
        if e.name == '' then e.name = e.identifier end
    end

    table.sort(list, function(a, b)
        if a.grade ~= b.grade then return a.grade > b.grade end
        return a.name < b.name
    end)
    return list
end

local function findEmployee(job, identifier)
    for _, e in ipairs(GetEmployees(job)) do
        if e.identifier == identifier then return e end
    end
end
FindEmployee = findEmployee

Action('employees', 'employees', function(source, access)
    local list = GetEmployees(access.job)
    if access.perms.duty then
        local stats = DutyStatsFor(access.job, list)
        for _, e in ipairs(list) do e.duty = stats[e.identifier] end
    end
    for _, e in ipairs(list) do e.manageable = CanManage(access, e.identifier, e.grade) end
    return { employees = list, grades = (JobData(access.job) or {}).grades or {} }
end)

---------------------------------------------------------------------------------------------------------------------
-- Hiring
---------------------------------------------------------------------------------------------------------------------
local function hirePosition(source)
    local session = Sessions[source]
    if session and session.computer then
        local c = Computers.Get(session.computer)
        if c then return vector3(c.coords.x, c.coords.y, c.coords.z) end
    end
    return GetEntityCoords(GetPlayerPed(source))
end

local function nearbyCandidates(source, job)
    local origin = hirePosition(source)
    local list = {}
    for _, src in ipairs(Core.GetPlayers()) do
        if src ~= source then
            local pjob = Core.GetJob(src)
            local dist = #(GetEntityCoords(GetPlayerPed(src)) - origin)
            if dist <= Config.Hiring.Distance and (not pjob or pjob.name ~= job) then
                list[#list + 1] = { source = src, name = Core.GetFullName(src), job = pjob and pjob.label or nil, distance = math.floor(dist * 10) / 10 }
            end
        end
    end
    table.sort(list, function(a, b) return a.distance < b.distance end)
    return list
end

Action('nearby', 'hire', function(source, access)
    return { players = nearbyCandidates(source, access.job) }
end)

Action('hire', 'hire', function(source, access, target, grade)
    target = tonumber(target)
    grade = tonumber(grade) or 0
    if not target then return Err('invalid') end
    local ok = false
    for _, p in ipairs(nearbyCandidates(source, access.job)) do
        if p.source == target then ok = true break end
    end
    if not ok then return Err('not_nearby') end

    local g = GetGrade(access.job, grade)
    if not g then return Err('invalid_grade') end
    if not access.isBoss and Config.Access.Hierarchy and grade >= access.grade then return Err('hierarchy') end

    if not Core.SetJob(target, access.job, grade) then return Err('failed') end
    local name = Core.GetFullName(target)
    Log(access, 'staff', 'hire', Core.GetIdentifier(target), name, nil, g.label)
    Notify(target, 'notify_hired', 'success', access.jobLabel, g.label)
    return { ok = true, name = name }
end)

---------------------------------------------------------------------------------------------------------------------
-- Firing and ranks
---------------------------------------------------------------------------------------------------------------------
-- Returns success and the server id when the employee is online.
local function setJob(identifier, job, grade)
    local src = Core.GetSourceFromIdentifier(identifier)
    return Core.SetJobByIdentifier(identifier, job, grade), src
end

Action('fire', 'fire', function(source, access, identifier)
    local e = type(identifier) == 'string' and findEmployee(access.job, identifier)
    if not e then return Err('not_found') end
    if not CanManage(access, e.identifier, e.grade) then return Err('hierarchy') end

    local job, grade = Core.GetDefaultJob()
    local ok, src = setJob(e.identifier, job, grade)
    if not ok then return Err('failed') end
    -- They keep nothing from the company.
    MySQL.query.await('DELETE FROM `yecoyz_bossmenu_access` WHERE `job` = ? AND `identifier` = ?', { access.job, e.identifier })
    MySQL.query.await('DELETE FROM `yecoyz_bossmenu_salaries` WHERE `job` = ? AND `identifier` = ?', { access.job, e.identifier })
    GetPersonalAccess(access.job)[e.identifier] = nil
    Log(access, 'staff', 'fire', e.identifier, e.name, nil, e.gradeLabel)
    if src then Notify(src, 'notify_fired', 'error', access.jobLabel) end
    return { ok = true }
end)

Action('setGrade', 'promote', function(source, access, identifier, grade)
    grade = tonumber(grade)
    local e = type(identifier) == 'string' and findEmployee(access.job, identifier)
    if not e or not grade then return Err('not_found') end
    if not CanManage(access, e.identifier, e.grade) then return Err('hierarchy') end
    if not access.isBoss and Config.Access.Hierarchy and grade >= access.grade then return Err('hierarchy') end
    local g = GetGrade(access.job, grade)
    if not g then return Err('invalid_grade') end
    if e.grade == grade then return { ok = true } end

    local ok, src = setJob(e.identifier, access.job, grade)
    if not ok then return Err('failed') end
    Log(access, 'staff', grade > e.grade and 'promote' or 'demote', e.identifier, e.name, nil, ('%s -> %s'):format(e.gradeLabel, g.label))
    if src then Notify(src, grade > e.grade and 'notify_promoted' or 'notify_demoted', grade > e.grade and 'success' or 'warning', g.label) end
    return { ok = true }
end)

---------------------------------------------------------------------------------------------------------------------
-- Grades (ranks)
---------------------------------------------------------------------------------------------------------------------
local function cleanText(text, max)
    if type(text) ~= 'string' then return nil end
    text = text:gsub('[%c<>]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if text == '' or #text > (max or 32) then return nil end
    return text
end

Action('grades', { 'grades', 'salaries' }, function(source, access)
    local data = JobData(access.job)
    local counts = {}
    for _, e in ipairs(Core.GetJobEmployees(access.job)) do counts[e.grade] = (counts[e.grade] or 0) + 1 end
    for _, g in ipairs(data and data.grades or {}) do g.employees = counts[g.grade] or 0 end
    return { grades = data and data.grades or {} }
end)

-- data = { grade (nil = new, added on top), label, salary }
Action('saveGrade', { 'grades', 'salaries' }, function(source, access, data)
    if type(data) ~= 'table' then return Err('invalid') end
    local job = JobData(access.job)
    if not job then return Err('failed') end
    local grade = tonumber(data.grade)
    local current = grade and GetGrade(access.job, grade)
    local salary = math.floor(tonumber(data.salary) or (current and current.salary) or 0)
    if salary < 0 or salary > Config.Grades.MaxSalary then return Err('invalid_salary') end

    -- Salary only (salaries permission) or a full edit (grades permission).
    local label = cleanText(data.label) or (current and current.label)
    if not label then return Err('invalid_label') end
    if not access.perms.grades then
        if not current then return Err('no_permission') end
        label = current.label
    end
    if not access.perms.salaries and current and salary ~= current.salary then return Err('no_permission') end
    if not FeatureOn('GradeSalaries') and current and salary ~= current.salary then return Err('no_permission') end

    if not current then
        if #job.grades >= Config.Grades.MaxGrades then return Err('max_grades') end
        grade = 0
        for _, g in ipairs(job.grades) do if g.grade >= grade then grade = g.grade + 1 end end
        if not FeatureOn('GradeSalaries') then salary = 0 end
    elseif not access.isBoss and grade >= access.grade then
        return Err('hierarchy')
    end

    local name = current and current.name or (label:lower():gsub('[^%w]+', '_'):sub(1, 32))
    if not Core.SaveJobGrade(access.job, grade, { name = name, label = label, salary = salary }) then return Err('failed') end

    if not current then
        -- A new rank is added at the top, then moved down below the boss ranks so the boss stays highest.
        local placed = grade
        while true do
            local data = JobData(access.job)
            local below
            for i, g in ipairs(data and data.grades or {}) do
                if g.grade == placed then below = data.grades[i - 1] break end
            end
            if not below or not below.isBoss or not Core.SwapJobGrades(access.job, placed, below.grade) then break end
            JobSettings.SwapGrades(access.job, placed, below.grade)
            placed = below.grade
        end
        grade = placed
        Log(access, 'grade', 'grade_create', nil, label, salary)
    else
        if label ~= current.label then Log(access, 'grade', 'grade_rename', nil, label, nil, current.label) end
        if salary ~= current.salary then Log(access, 'grade', 'grade_salary', nil, label, salary, Config.Currency .. FormatNumber(current.salary)) end
    end
    return { ok = true, grade = grade }
end)

Action('deleteGrade', 'grades', function(source, access, grade)
    grade = tonumber(grade)
    local current, job = GetGrade(access.job, grade)
    if not current then return Err('not_found') end
    if current.isBoss then return Err('boss_grade') end
    if #job.grades <= 1 then return Err('last_grade') end
    if not access.isBoss and grade >= access.grade then return Err('hierarchy') end
    for _, e in ipairs(Core.GetJobEmployees(access.job)) do
        if e.grade == grade then return Err('grade_in_use') end
    end
    for _, src in ipairs(Core.GetPlayersByJob(access.job)) do
        local j = Core.GetJob(src)
        if j and j.grade == grade then return Err('grade_in_use') end
    end
    if not Core.DeleteJobGrade(access.job, grade) then return Err('failed') end
    JobSettings.RemoveGrade(access.job, grade)
    Log(access, 'grade', 'grade_delete', nil, current.label)
    return { ok = true }
end)

-- Moves a rank one place up (dir = 1) or down (dir = -1): it swaps places with the rank next to it, and everyone with
-- either rank keeps it. Boss ranks stay at the top.
Action('moveGrade', 'grades', function(source, access, grade, dir)
    grade, dir = tonumber(grade), tonumber(dir)
    if dir ~= 1 and dir ~= -1 then return Err('invalid') end
    local current, job = GetGrade(access.job, grade)
    if not current then return Err('not_found') end
    local other
    for i, g in ipairs(job.grades) do
        if g.grade == grade then other = job.grades[i + dir] break end
    end
    if not other then return Err('invalid') end
    -- Boss ranks don't move, and no rank goes above one. A rank that is above a boss rank may move down past it.
    if current.isBoss or (other.isBoss and dir == 1) then return Err('boss_grade_move') end
    if not access.isBoss and (grade >= access.grade or other.grade >= access.grade) then return Err('hierarchy') end
    if not Core.SwapJobGrades(access.job, grade, other.grade) then return Err('failed') end
    JobSettings.SwapGrades(access.job, grade, other.grade)
    Log(access, 'grade', 'grade_move', nil, current.label, nil, ('%d -> %d'):format(grade, other.grade))
    return { ok = true }
end)

---------------------------------------------------------------------------------------------------------------------
-- Individual salary
---------------------------------------------------------------------------------------------------------------------
Action('setSalary', 'salaries', function(source, access, identifier, salary)
    if not FeatureOn('IndividualSalary') then return Err('disabled') end
    local e = type(identifier) == 'string' and findEmployee(access.job, identifier)
    if not e then return Err('not_found') end
    if not CanManage(access, e.identifier, e.grade) and not (access.isBoss and e.identifier == access.identifier) then return Err('hierarchy') end

    if salary == nil or salary == false then
        MySQL.query.await('DELETE FROM `yecoyz_bossmenu_salaries` WHERE `job` = ? AND `identifier` = ?', { access.job, e.identifier })
        Log(access, 'staff', 'salary_reset', e.identifier, e.name)
        return { ok = true }
    end

    salary = math.floor(tonumber(salary) or -1)
    if salary < e.gradeSalary or salary > Config.IndividualSalary.Max then return Err('invalid_salary') end
    MySQL.query.await('INSERT INTO `yecoyz_bossmenu_salaries` (`job`, `identifier`, `salary`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `salary` = VALUES(`salary`)', {
        access.job, e.identifier, salary,
    })
    Log(access, 'staff', 'salary_set', e.identifier, e.name, salary)
    return { ok = true }
end)

-- Pays the part of a personal salary above the rank salary (the framework pays the rank salary itself).
CreateThread(function()
    DB.Await()
    while true do
        Wait(math.max(1, Config.IndividualSalary.Interval) * 60000)
        if FeatureOn('IndividualSalary') then
            local rows = MySQL.query.await('SELECT `job`, `identifier`, `salary` FROM `yecoyz_bossmenu_salaries`') or {}
            local gradesByJob = {}
            for _, row in ipairs(rows) do
                local src = Core.GetSourceFromIdentifier(row.identifier)
                local job = src and Core.GetJob(src)
                if job and job.name == row.job and (not Config.IndividualSalary.OnlyOnDuty or onDuty(src)) then
                    gradesByJob[row.job] = gradesByJob[row.job] or gradeMap(row.job)
                    local g = gradesByJob[row.job][job.grade]
                    local extra = row.salary - (g and g.salary or 0)
                    if extra > 0 then
                        local paid = not Config.IndividualSalary.FromSociety or Core.RemoveSocietyMoney(row.job, extra)
                        if paid then
                            Core.AddMoney(src, extra, Config.IndividualSalary.Account, 'Salary')
                            Notify(src, 'notify_salary', 'success', Config.Currency .. FormatNumber(extra))
                        else
                            Notify(src, 'notify_salary_nomoney', 'error')
                        end
                    end
                end
            end
        end
    end
end)

---------------------------------------------------------------------------------------------------------------------
-- Bonuses
---------------------------------------------------------------------------------------------------------------------
local lastBonus = {}

Action('bonus', 'bonuses', function(source, access, identifier, amount, note)
    if Busy(source) then return Err('busy') end
    amount = math.floor(tonumber(amount) or 0)
    if amount <= 0 or amount > Config.Bonuses.Max then return Err('invalid_amount') end
    local e = type(identifier) == 'string' and findEmployee(access.job, identifier)
    if not e then return Err('not_found') end
    if e.identifier == access.identifier then return Err('self') end
    if not e.online and not Config.Bonuses.OfflinePayout then return Err('offline') end

    local key = access.job .. ':' .. e.identifier
    if Config.Bonuses.Cooldown > 0 and lastBonus[key] and os.time() - lastBonus[key] < Config.Bonuses.Cooldown then return Err('cooldown') end

    if not Core.RemoveSocietyMoney(access.job, amount) then return Err('no_money') end
    note = cleanText(note, 80)
    local ok, now = Payouts.Give(e.identifier, access.job, amount, Config.Bonuses.Account, ('Bonus from %s'):format(access.jobLabel), true)
    if not ok then
        Core.AddSocietyMoney(access.job, amount)
        return Err('failed')
    end
    lastBonus[key] = os.time()
    Log(access, 'money', 'bonus', e.identifier, e.name, amount, note)
    if now and e.source then Notify(e.source, 'notify_bonus', 'success', Config.Currency .. FormatNumber(amount), access.jobLabel) end
    return { ok = true, queued = not now }
end)

---------------------------------------------------------------------------------------------------------------------
-- Access
---------------------------------------------------------------------------------------------------------------------
Action('setAccess', 'access', function(source, access, identifier, perms)
    local e = type(identifier) == 'string' and findEmployee(access.job, identifier)
    if not e or type(perms) ~= 'table' then return Err('not_found') end
    if not CanManage(access, e.identifier, e.grade) then return Err('hierarchy') end

    local set = {}
    for _, name in ipairs(perms) do
        if PermissionByName[name] then
            -- Nobody can hand out what they don't have themselves.
            if not access.perms[name] and PermAvailable(name, access.job) then return Err('no_permission') end
            set[name] = true
        end
    end
    -- A permission that needs another one gets it too (hire needs the staff list).
    for name in pairs(set) do
        local needs = PermissionNeeds[name]
        if needs then set[needs] = true end
    end
    SetPersonalAccess(access.job, e.identifier, set)
    local list = {}
    for name in pairs(set) do list[#list + 1] = name end
    table.sort(list)
    Log(access, 'access', 'access_set', e.identifier, e.name, nil, #list > 0 and table.concat(list, ', ') or '-')
    return { ok = true, perms = list }
end)
