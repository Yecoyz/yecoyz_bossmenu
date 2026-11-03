-- Per-job settings that admins change in the creator (saved in the database):
--   pages = { [permission] = false } turns parts of the menu off for one job (on top of Config.Features)
--   ranks = { [grade] = { permissions } } what each rank gets on its own; replaces Config.Access.GradeDefaults for
--           that job once it was edited in game
JobSettings = {}

local settings = {} -- [job] = { pages = {...}, ranks = {...} | nil }

local function get(job) return job and settings[job] end

-- false when the job turned the page off in game.
function JobSettings.PageOn(job, perm)
    local s = get(job)
    return not (s and s.pages and s.pages[perm] == false)
end

-- The rank permissions edited in game for this job, or nil to use Config.Access.GradeDefaults.
function JobSettings.Ranks(job)
    local s = get(job)
    return s and s.ranks
end

local function store(job)
    local s = settings[job]
    if not s then
        MySQL.query.await('DELETE FROM `yecoyz_bossmenu_jobs` WHERE `job` = ?', { job })
        return
    end
    -- JSON objects need string keys; grades are turned back into numbers when loading.
    local ranks
    if s.ranks then
        ranks = {}
        for grade, list in pairs(s.ranks) do ranks[tostring(grade)] = list end
    end
    MySQL.query.await('INSERT INTO `yecoyz_bossmenu_jobs` (`job`, `settings`, `updated_by`, `updated_at`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `settings` = VALUES(`settings`), `updated_by` = VALUES(`updated_by`), `updated_at` = VALUES(`updated_at`)', {
        job, json.encode({ pages = s.pages or {}, ranks = ranks }), s.by, os.time(),
    })
end

local function decode(raw)
    local data = DecodeJson(raw)
    local out = { pages = {}, ranks = nil }
    for perm, on in pairs(type(data.pages) == 'table' and data.pages or {}) do
        if PermissionByName[perm] and on == false then out.pages[perm] = false end
    end
    if type(data.ranks) == 'table' then
        out.ranks = {}
        for grade, list in pairs(data.ranks) do
            local g = tonumber(grade)
            if g and type(list) == 'table' then out.ranks[g] = list end
        end
    end
    return out
end

CreateThread(function()
    DB.Await()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `yecoyz_bossmenu_jobs` (
            `job` varchar(64) NOT NULL,
            `settings` longtext NOT NULL,
            `updated_by` varchar(100) DEFAULT NULL,
            `updated_at` int(11) unsigned NOT NULL DEFAULT 0,
            PRIMARY KEY (`job`)
        )
    ]])
    for _, row in ipairs(MySQL.query.await('SELECT `job`, `settings` FROM `yecoyz_bossmenu_jobs`') or {}) do
        settings[row.job] = decode(row.settings)
    end
end)

-- Ranks moved in the menu swap places, so their permissions go with them.
function JobSettings.SwapGrades(job, a, b)
    local ranks = JobSettings.Ranks(job)
    if not ranks then return end
    ranks[a], ranks[b] = ranks[b], ranks[a]
    store(job)
end

function JobSettings.RemoveGrade(job, grade)
    local ranks = JobSettings.Ranks(job)
    if not ranks or not ranks[grade] then return end
    ranks[grade] = nil
    store(job)
end

---------------------------------------------------------------------------------------------------------------------
-- Creator callbacks
---------------------------------------------------------------------------------------------------------------------
local function jobOk(job)
    return type(job) == 'string' and job ~= 'unemployed' and JobAllowed(job) and Core.GetJobs()[job] ~= nil
end

local function computersOf(job)
    local out = {}
    for _, c in ipairs(Computers.All()) do
        if c.job == job then out[#out + 1] = c end
    end
    return out
end

-- Every job, with a short summary for the list on the left.
CreatorCallback('jobs', function()
    local out = {}
    for name, job in pairs(Core.GetJobs() or {}) do
        if name ~= 'unemployed' and JobAllowed(name) then
            local s = settings[name]
            local off = 0
            for _ in pairs(s and s.pages or {}) do off = off + 1 end
            out[#out + 1] = {
                name = name, label = job.label or name,
                computers = #computersOf(name),
                vehicles = #Shop.Get('vehicle', name), items = #Shop.Get('item', name),
                pagesOff = off,
            }
        end
    end
    table.sort(out, function(a, b) return a.label:lower() < b.label:lower() end)
    return { ok = true, jobs = out }
end)

-- What a rank gets from the config (Config.Access.GradeDefaults: "this grade and higher").
local function configRank(job, grade)
    local set = {}
    for minGrade, list in pairs(Config.Access.GradeDefaults[job] or {}) do
        if grade >= minGrade then
            for _, name in ipairs(list) do set[name] = true end
        end
    end
    local list = {}
    for name in pairs(set) do list[#list + 1] = name end
    table.sort(list)
    return list
end

-- Everything about one job: its computers, pages and ranks. Shops are loaded by their own tab.
local function jobPayload(job)
    local data = JobData(job)
    local ranks = JobSettings.Ranks(job)
    local grades = {}
    for _, g in ipairs(data and data.grades or {}) do
        grades[#grades + 1] = {
            grade = g.grade, label = g.label, isBoss = g.isBoss,
            perms = g.isBoss and {} or (ranks and (ranks[g.grade] or {}) or configRank(job, g.grade)),
        }
    end
    table.sort(grades, function(a, b) return a.grade > b.grade end)
    local pages = {}
    for _, p in ipairs(Permissions) do
        if FeatureOn(p.feature) and (p.name ~= 'duty' or DutyAvailable()) then
            pages[#pages + 1] = { name = p.name, on = JobSettings.PageOn(job, p.name), needs = PermissionNeeds[p.name] }
        end
    end
    return {
        ok = true, job = job, label = Core.GetJobLabel(job),
        computers = computersOf(job), grades = grades, pages = pages,
        ranksCustom = ranks ~= nil, custom = settings[job] ~= nil,
    }
end

CreatorCallback('job', function(source, job)
    if not jobOk(job) then return { error = 'invalid_job' } end
    return jobPayload(job)
end)

-- data = { pages = { [perm] = bool }, ranks = { [grade] = { perms } } | nil }
CreatorCallback('jobSave', function(source, job, data)
    if not jobOk(job) or type(data) ~= 'table' then return { error = 'invalid' } end
    local s = settings[job] or { pages = {} }

    if type(data.pages) == 'table' then
        s.pages = {}
        for perm, on in pairs(data.pages) do
            if PermissionByName[perm] and on == false then s.pages[perm] = false end
        end
    end

    if type(data.ranks) == 'table' then
        local valid = {}
        for _, g in ipairs((JobData(job) or {}).grades or {}) do valid[g.grade] = not g.isBoss end
        local ranks = {}
        for grade, list in pairs(data.ranks) do
            grade = tonumber(grade)
            if grade and valid[grade] and type(list) == 'table' then
                local set = {}
                for _, name in ipairs(list) do
                    if PermissionByName[name] then set[name] = true end
                end
                -- A permission that needs another one gets it too (hire needs the staff list).
                for name in pairs(set) do
                    if PermissionNeeds[name] then set[PermissionNeeds[name]] = true end
                end
                local out = {}
                for name in pairs(set) do out[#out + 1] = name end
                table.sort(out)
                ranks[grade] = out
            end
        end
        s.ranks = ranks
    end

    s.by = Core.GetIdentifier(source)
    settings[job] = s
    store(job)
    return jobPayload(job)
end)

-- what: 'pages' | 'ranks'. Back to config.lua for that part.
CreatorCallback('jobReset', function(source, job, what)
    if not jobOk(job) then return { error = 'invalid' } end
    local s = settings[job]
    if s then
        if what == 'pages' then s.pages = {} elseif what == 'ranks' then s.ranks = nil end
        if not next(s.pages or {}) and not s.ranks then settings[job] = nil end
        store(job)
    end
    return jobPayload(job)
end)
