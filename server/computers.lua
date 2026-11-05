-- Boss menu computers: placed with the creator (saved in the database) or set in Config.Computers.
local RES = GetCurrentResourceName()
Computers = {}

local list = {} -- [id] = { id, job, label, model, coords = {x,y,z,w}, spawn = {x,y,z,w} | nil, static }

local function vec(v)
    if type(v) ~= 'table' and type(v) ~= 'vector4' and type(v) ~= 'vector3' then return nil end
    local x, y, z = tonumber(v.x), tonumber(v.y), tonumber(v.z)
    if not x or not y or not z then return nil end
    return { x = x + 0.0, y = y + 0.0, z = z + 0.0, w = (tonumber(v.w) or 0.0) + 0.0 }
end

local function modelAllowed(model)
    for _, m in ipairs(Config.Computer.Models) do
        if m.model == model then return true end
    end
    return false
end

function Computers.Get(id) return list[tonumber(id) or 0] end

function Computers.All()
    local out = {}
    for _, c in pairs(list) do out[#out + 1] = c end
    table.sort(out, function(a, b) return a.id < b.id end)
    return out
end

local function listForClients()
    for _, c in pairs(list) do c.jobLabel = Core.GetJobLabel(c.job) end
    return Computers.All()
end

-- Pushes changes to everyone; players that join ask once through the computers callback.
local function sync()
    TriggerClientEvent(RES .. ':computers', -1, listForClients())
end

local function load()
    DB.Await()
    list = {}
    for i, c in ipairs(Config.Computers) do
        local coords = vec(c.coords)
        if coords and c.job then
            local id = -i
            list[id] = { id = id, job = c.job, label = c.label, model = c.model or Config.Computer.Models[1].model, coords = coords, spawn = vec(c.spawn), static = true }
        end
    end
    for _, row in ipairs(MySQL.query.await('SELECT * FROM `yecoyz_bossmenu_computers`') or {}) do
        local coords = vec(DecodeJson(row.coords))
        if coords then
            list[row.id] = { id = row.id, job = row.job, label = row.label, model = row.model, coords = coords, spawn = vec(DecodeJson(row.spawn, nil)) }
        end
    end
    sync()
end

CreateThread(load)

Core.Callback.Register(RES .. ':computers', function()
    return listForClients()
end)

---------------------------------------------------------------------------------------------------------------------
-- Creator
---------------------------------------------------------------------------------------------------------------------
local function isAdmin(source)
    return Core.HasPermission(source, Config.Creator.Permission) or IsPlayerAceAllowed(source, 'command')
end

CreatorHandlers = {} -- [name] = handler, for server-side tests

local function creatorCallback(name, handler)
    CreatorHandlers[name] = handler
    Core.Callback.Register(RES .. ':creator:' .. name, function(source, ...)
        if not isAdmin(source) then return { error = 'no_permission' } end
        local ok, result = pcall(handler, source, ...)
        if not ok then
            print(('^1[yecoyz_bossmenu] creator %s failed: %s^7'):format(name, result))
            return { error = 'failed' }
        end
        return result
    end)
end

CreatorCallback = creatorCallback

RegisterCommand(Config.Creator.Command, function(source)
    if source == 0 then return print('[yecoyz_bossmenu] use this command in game') end
    if not isAdmin(source) then return Notify(source, 'no_permission', 'error') end
    TriggerClientEvent(RES .. ':openCreator', source)
end, false)

creatorCallback('data', function(source)
    local jobs = {}
    for name, job in pairs(Core.GetJobs() or {}) do
        if name ~= 'unemployed' and JobAllowed(name) then jobs[#jobs + 1] = { name = name, label = job.label or name } end
    end
    table.sort(jobs, function(a, b) return a.label < b.label end)
    local models = {}
    for _, m in ipairs(Config.Computer.Models) do models[#models + 1] = { model = m.model, label = m.label or m.model } end
    return {
        computers = Computers.All(), jobs = jobs, models = models,
        shops = { vehicle = FeatureOn('Vehicles'), item = FeatureOn('Items') }, currency = Config.Currency,
    }
end)

-- data = { id (nil = new), job, label, model, coords, spawn | false }
creatorCallback('save', function(source, data)
    if type(data) ~= 'table' or type(data.job) ~= 'string' then return { error = 'invalid' } end
    if not Core.GetJobs()[data.job] then return { error = 'invalid_job' } end
    if not modelAllowed(data.model) then return { error = 'invalid_model' } end
    local coords = vec(data.coords)
    if not coords then return { error = 'invalid' } end
    local spawn = data.spawn and vec(data.spawn) or nil
    local label = type(data.label) == 'string' and data.label:gsub('[%c<>]', ''):sub(1, 64) or nil
    if label == '' then label = nil end

    local id = tonumber(data.id)
    if id then
        local current = list[id]
        if not current or current.static then return { error = 'not_found' } end
        MySQL.update.await('UPDATE `yecoyz_bossmenu_computers` SET `job` = ?, `label` = ?, `model` = ?, `coords` = ?, `spawn` = ? WHERE `id` = ?', {
            data.job, label, data.model, json.encode(coords), spawn and json.encode(spawn) or nil, id,
        })
    else
        id = MySQL.insert.await('INSERT INTO `yecoyz_bossmenu_computers` (`job`, `label`, `model`, `coords`, `spawn`, `created_by`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?)', {
            data.job, label, data.model, json.encode(coords), spawn and json.encode(spawn) or nil, Core.GetIdentifier(source), os.time(),
        })
        if not id then return { error = 'failed' } end
    end
    list[id] = { id = id, job = data.job, label = label, model = data.model, coords = coords, spawn = spawn }
    sync()
    return { ok = true, id = id, computers = Computers.All() }
end)

creatorCallback('delete', function(source, id)
    id = tonumber(id)
    local current = id and list[id]
    if not current or current.static then return { error = 'not_found' } end
    MySQL.query.await('DELETE FROM `yecoyz_bossmenu_computers` WHERE `id` = ?', { id })
    list[id] = nil
    sync()
    return { ok = true, computers = Computers.All() }
end)
