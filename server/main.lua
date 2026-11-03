-- Access, sessions, logging and the shared helpers the other server files use.
local RES = GetCurrentResourceName()
Sessions = {} -- [source] = { job, computer }

-- The company functions (grades, employees, accounts, vehicles) came in yecoyz_core 1.3.0.
-- Checked in a thread: an export call can yield while the server starts, and a yield here would
-- let the other server files load before Action() and the helpers below exist.
CreateThread(function()
    if not pcall(function() return exports.yecoyz_core:GetSocietySystem() end) then
        print('^1[yecoyz_bossmenu] yecoyz_core 1.3.0 or newer is needed. Update yecoyz_core.^7')
    end
end)

local locale = DecodeJson(LoadResourceFile(RES, ('locales/%s.json'):format(Config.Locale)) or LoadResourceFile(RES, 'locales/en.json'))

function L(key, ...)
    local text = locale[key] or key
    if select('#', ...) > 0 then return text:format(...) end
    return text
end

function Notify(source, key, kind, ...)
    Core.Notify(source, L(key, ...), kind or 'info', nil, L('title'))
end

function DutyAvailable()
    return FeatureOn('Duty') and GetResourceState(Config.Duty.Resource) == 'started'
end

local function jobAllowed(name)
    if not name or name == 'unemployed' then return false end
    if #Config.Access.Jobs == 0 then return true end
    for _, job in ipairs(Config.Access.Jobs) do
        if job == name then return true end
    end
    return false
end
JobAllowed = jobAllowed

---------------------------------------------------------------------------------------------------------------------
-- Personal access (Access page), cached per job.
---------------------------------------------------------------------------------------------------------------------
local personal = {} -- [job] = { [identifier] = { perm = true } }

function GetPersonalAccess(job)
    if personal[job] then return personal[job] end
    local list = {}
    for _, row in ipairs(MySQL.query.await('SELECT `identifier`, `permissions` FROM `yecoyz_bossmenu_access` WHERE `job` = ?', { job }) or {}) do
        local set = {}
        for _, name in ipairs(DecodeJson(row.permissions)) do set[name] = true end
        list[row.identifier] = set
    end
    personal[job] = list
    return list
end

function SetPersonalAccess(job, identifier, perms)
    local list = {}
    for name in pairs(perms) do list[#list + 1] = name end
    table.sort(list)
    if #list == 0 then
        MySQL.query.await('DELETE FROM `yecoyz_bossmenu_access` WHERE `job` = ? AND `identifier` = ?', { job, identifier })
    else
        MySQL.query.await('INSERT INTO `yecoyz_bossmenu_access` (`job`, `identifier`, `permissions`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `permissions` = VALUES(`permissions`)', {
            job, identifier, json.encode(list),
        })
    end
    GetPersonalAccess(job)[identifier] = #list > 0 and perms or nil
end

-- A permission is usable when its feature is on (and duty runs for 'duty'). With a job, also when that job didn't
-- turn the page off in the creator (server/jobs.lua).
local function permAvailable(name, job)
    local p = PermissionByName[name]
    if not p or not FeatureOn(p.feature) then return false end
    if name == 'duty' and not DutyAvailable() then return false end
    if job and JobSettings and not JobSettings.PageOn(job, name) then return false end
    local needs = PermissionNeeds[name]
    if needs and not permAvailable(needs, job) then return false end
    return true
end
PermAvailable = permAvailable

-- What the grades get on their own: set in the creator for that rank, or Config.Access.GradeDefaults.
local function gradePerms(job, grade, set)
    local ranks = JobSettings and JobSettings.Ranks(job)
    if ranks then
        for _, name in ipairs(ranks[grade] or {}) do set[name] = true end
        return
    end
    for minGrade, list in pairs(Config.Access.GradeDefaults[job] or {}) do
        if grade >= minGrade then
            for _, name in ipairs(list) do set[name] = true end
        end
    end
end

-- Config.Access.BossGrades: grade names, or a number for "this grade and higher".
function IsBossGrade(grade, name)
    for _, value in ipairs(Config.Access.BossGrades) do
        if type(value) == 'number' then
            if grade >= value then return true end
        elseif value == name then
            return true
        end
    end
    return false
end

function IsBoss(job)
    if not job then return false end
    if job.isBoss then return true end
    return IsBossGrade(job.grade, job.gradeName)
end

-- The job and its grades from yecoyz_core, with this resource's boss grades marked too.
function JobData(job)
    local data = Core.GetJobData(job)
    if not data then return nil end
    for _, g in ipairs(data.grades) do
        g.isBoss = g.isBoss or IsBossGrade(g.grade, g.name)
    end
    return data
end

function GetGrade(job, grade)
    local data = JobData(job)
    if not data then return nil end
    for _, g in ipairs(data.grades) do
        if g.grade == grade then return g, data end
    end
    return nil, data
end

-- { job, jobLabel, grade, gradeLabel, isBoss, identifier, name, perms = { name = true } } or nil.
function GetAccess(source)
    local job = Core.GetJob(source)
    if not job or not jobAllowed(job.name) then return nil end
    local identifier = Core.GetIdentifier(source)
    if not identifier then return nil end

    local boss = IsBoss(job)
    local set = {}
    if boss then
        for _, p in ipairs(Permissions) do set[p.name] = true end
    else
        gradePerms(job.name, job.grade, set)
        for name in pairs(GetPersonalAccess(job.name)[identifier] or {}) do set[name] = true end
    end

    local perms, any = {}, false
    for name in pairs(set) do
        if permAvailable(name, job.name) then perms[name] = true; any = true end
    end
    if not any then return nil end

    return {
        job = job.name, jobLabel = job.label, grade = job.grade, gradeLabel = job.gradeLabel, isBoss = boss,
        identifier = identifier, name = Core.GetFullName(source), perms = perms, source = source,
    }
end

-- Bosses can manage everyone but themselves. Others only lower ranks (Config.Access.Hierarchy).
function CanManage(access, targetIdentifier, targetGrade)
    if targetIdentifier == access.identifier then return false end
    if access.isBoss then return true end
    if not Config.Access.Hierarchy then return true end
    return (tonumber(targetGrade) or 0) < access.grade
end

---------------------------------------------------------------------------------------------------------------------
-- Log
---------------------------------------------------------------------------------------------------------------------
-- category: 'staff' | 'money' | 'grade' | 'vehicle' | 'duty' | 'access'
function Log(access, category, action, target, targetName, amount, details)
    MySQL.insert('INSERT INTO `yecoyz_bossmenu_logs` (`job`, `category`, `action`, `actor`, `actor_name`, `target`, `target_name`, `amount`, `details`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', {
        access.job, category, action, access.identifier, access.name, target, targetName,
        amount and math.floor(amount) or nil, details and tostring(details):sub(1, 255) or nil, os.time(),
    })
end

---------------------------------------------------------------------------------------------------------------------
-- Menu callbacks: every action goes through Action(), which checks the session and the permission.
---------------------------------------------------------------------------------------------------------------------
local function err(code) return { error = code } end
Err = err

-- perm: a permission name, a list (any of them) or nil (only an open session needed).
function Action(name, perm, handler)
    Core.Callback.Register(RES .. ':' .. name, function(source, ...)
        local session = Sessions[source]
        if not session then return err('no_session') end
        local access = GetAccess(source)
        if not access or access.job ~= session.job then
            Sessions[source] = nil
            return err('no_access')
        end
        if type(perm) == 'string' and not access.perms[perm] then return err('no_permission') end
        if type(perm) == 'table' then
            local ok = false
            for _, p in ipairs(perm) do if access.perms[p] then ok = true break end end
            if not ok then return err('no_permission') end
        end
        local ok, result = pcall(handler, source, access, ...)
        if not ok then
            print(('^1[yecoyz_bossmenu] %s failed: %s^7'):format(name, result))
            return err('failed')
        end
        return result
    end)
end

-- Players another script opened the menu for with OpenBossMenu (allowed once, without a computer).
local openAnywhere = {}

-- Opening: at a computer (checked against its position), by command or through OpenBossMenu.
local function openFor(source, computerId)
    local access = GetAccess(source)
    if not access then return err('no_access') end

    if computerId then
        local computer = Computers.Get(computerId)
        if not computer then return err('no_computer') end
        if computer.job ~= access.job then return err('wrong_job') end
        local ped = GetPlayerPed(source)
        if #(GetEntityCoords(ped) - vector3(computer.coords.x, computer.coords.y, computer.coords.z)) > 6.0 then return err('too_far') end
    elseif not Config.Command and not openAnywhere[source] then
        return err('no_computer')
    end
    openAnywhere[source] = nil

    Sessions[source] = { job = access.job, computer = computerId }
    if computerId then TriggerClientEvent(RES .. ':inUse', -1, computerId, access.name) end
    local perms = {}
    for name in pairs(access.perms) do perms[#perms + 1] = name end
    local allPerms = {}
    for _, p in ipairs(Permissions) do if permAvailable(p.name, access.job) then allPerms[#allPerms + 1] = p.name end end

    return {
        me = { name = access.name, identifier = access.identifier, grade = access.grade, gradeLabel = access.gradeLabel, isBoss = access.isBoss },
        job = { name = access.job, label = access.jobLabel },
        perms = perms,
        allPerms = allPerms,
        currency = Config.Currency,
        duty = DutyAvailable(),
        settings = {
            maxBonus = Config.Bonuses.Max,
            maxSalary = Config.Grades.MaxSalary,
            maxIndividual = Config.IndividualSalary.Max,
            individual = FeatureOn('IndividualSalary'),
            maxTransaction = Config.Economy.MaxTransaction,
            maxGrades = Config.Grades.MaxGrades,
            hireById = Config.Hiring.ById,
            vehicleMode = Config.Vehicles.Mode,
            dutyEdit = Config.Duty.AllowEdit, dutyRemove = Config.Duty.AllowRemove, dutyAdd = Config.Duty.AllowAdd,
            dutyForceOff = Config.Duty.AllowForceOff, maxShiftHours = Config.Duty.MaxShiftHours,
            gradeSalaries = FeatureOn('GradeSalaries'),
        },
    }
end

Core.Callback.Register(RES .. ':open', function(source, computerId)
    return openFor(source, tonumber(computerId))
end)

local function endSession(source)
    openAnywhere[source] = nil
    local session = Sessions[source]
    Sessions[source] = nil
    if session and session.computer then TriggerClientEvent(RES .. ':inUse', -1, session.computer, nil) end
end

RegisterNetEvent(RES .. ':close', function()
    endSession(source)
end)

AddEventHandler('playerDropped', function()
    endSession(source)
end)

-- Who is logged in on which computer, for players that join later.
Core.Callback.Register(RES .. ':inUseList', function()
    local list = {}
    for src, session in pairs(Sessions) do
        if session.computer then list[tostring(session.computer)] = Core.GetFullName(src) end
    end
    return list
end)

-- Can this player use a computer of this job at all (shown on the computer).
Core.Callback.Register(RES .. ':canUse', function(source)
    local access = GetAccess(source)
    return access and access.job or false
end)

-- Other scripts: exports.yecoyz_bossmenu:OpenBossMenu(source) opens the menu where the player stands.
exports('OpenBossMenu', function(source)
    if not GetAccess(source) then return false end
    openAnywhere[source] = true
    TriggerClientEvent(RES .. ':openAnywhere', source)
    return true
end)

exports('GetAccess', GetAccess)

---------------------------------------------------------------------------------------------------------------------
-- Payouts: money for a player that is paid now, or on the next login when they are offline.
---------------------------------------------------------------------------------------------------------------------
Payouts = {}

function Payouts.Give(identifier, job, amount, account, reason, allowOffline)
    local src = Core.GetSourceFromIdentifier(identifier)
    if src then
        return Core.AddMoney(src, amount, account, reason) ~= false, true
    end
    if not allowOffline then return false end
    MySQL.insert.await('INSERT INTO `yecoyz_bossmenu_payouts` (`identifier`, `job`, `amount`, `account`, `reason`, `created_at`) VALUES (?, ?, ?, ?, ?, ?)', {
        identifier, job, amount, account, reason, os.time(),
    })
    return true, false
end

local function payPending(source)
    local identifier = Core.GetIdentifier(source)
    if not identifier then return end
    local rows = MySQL.query.await('SELECT `id`, `amount`, `account`, `reason` FROM `yecoyz_bossmenu_payouts` WHERE `identifier` = ?', { identifier }) or {}
    for _, row in ipairs(rows) do
        -- Delete first so a payout can never be paid twice.
        if (MySQL.update.await('DELETE FROM `yecoyz_bossmenu_payouts` WHERE `id` = ?', { row.id }) or 0) > 0 then
            Core.AddMoney(source, row.amount, row.account, row.reason)
            Notify(source, 'notify_payout', 'success', Config.Currency .. FormatNumber(row.amount), row.reason or '')
        end
    end
end

Core.OnPlayerLoaded(function(source)
    CreateThread(function()
        DB.Await()
        Wait(5000)
        payPending(source)
    end)
end)

function FormatNumber(n)
    local s = tostring(math.floor(tonumber(n) or 0))
    local sign, digits = s:match('^(-?)(%d+)$')
    if not digits then return s end
    return sign .. digits:reverse():gsub('(%d%d%d)', '%1,'):reverse():gsub('^,', '')
end

-- Rate limit for the money actions, so a spammed button can't run twice.
local busy = {}
function Busy(source, ms)
    local now = GetGameTimer()
    if busy[source] and busy[source] > now then return true end
    busy[source] = now + (ms or 750)
    return false
end
