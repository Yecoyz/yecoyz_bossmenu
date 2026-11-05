-- Computers in the world: the monitor props, the screen (a DUI page drawn on the monitor) and the interaction.
BM = BM or {}
BM.res = GetCurrentResourceName()
BM.computers = {} -- [id] = computer from the server
BM.inUse = {} -- [id] = name of who is logged in
BM.props = {} -- [id] = entity

local RES = BM.res
local TXD, TXN = 'yecoyz_bm_screen', 'screen'
local GRID = 6
local DUI_W, DUI_H = 1280, 770

local models = {}
for _, m in ipairs(Config.Computer.Models) do models[m.model] = m end
function BM.modelData(model) return models[model] or Config.Computer.Models[1] end

function BM.loadModel(model)
    local hash = type(model) == 'number' and model or joaat(model)
    if not IsModelInCdimage(hash) then return nil end
    RequestModel(hash)
    local t = GetGameTimer() + 5000
    while not HasModelLoaded(hash) and GetGameTimer() < t do Wait(0) end
    return HasModelLoaded(hash) and hash or nil
end

function BM.loadDict(dict)
    RequestAnimDict(dict)
    local t = GetGameTimer() + 3000
    while not HasAnimDictLoaded(dict) and GetGameTimer() < t do Wait(0) end
    return HasAnimDictLoaded(dict)
end

-- Locale for Lua texts and the UI.
local locale = json.decode(LoadResourceFile(RES, ('locales/%s.json'):format(Config.Locale)) or LoadResourceFile(RES, 'locales/en.json') or '{}') or {}
BM.locale = locale
function BM.L(key, ...)
    local text = locale[key] or key
    if select('#', ...) > 0 then return text:format(...) end
    return text
end
function BM.notify(key, kind, ...)
    Core.Notify(BM.L(key, ...), kind or 'info', nil, BM.L('title'))
end

RegisterNUICallback('getLocale', function(_, cb) cb(locale) end)

---------------------------------------------------------------------------------------------------------------------
-- Screen corners of a placed computer, in world space.
---------------------------------------------------------------------------------------------------------------------
function BM.screenOf(entity, model)
    local s = BM.modelData(model).screen
    local tl = GetOffsetFromEntityInWorldCoords(entity, s.tl.x, s.tl.y, s.tl.z)
    local tr = GetOffsetFromEntityInWorldCoords(entity, s.tr.x, s.tr.y, s.tr.z)
    local bl = GetOffsetFromEntityInWorldCoords(entity, s.bl.x, s.bl.y, s.bl.z)
    local br = tr + (bl - tl)
    local center = (tl + br) / 2
    local right, down = tr - tl, bl - tl
    -- Facing out of the screen (towards the viewer).
    local normal = vector3(down.y * right.z - down.z * right.y, down.z * right.x - down.x * right.z, down.x * right.y - down.y * right.x)
    normal = normal / #normal
    return { tl = tl, tr = tr, bl = bl, br = br, center = center, normal = normal, width = #right, height = #down }
end

---------------------------------------------------------------------------------------------------------------------
-- Props
---------------------------------------------------------------------------------------------------------------------
local function spawnProp(c)
    local hash = BM.loadModel(c.model)
    if not hash then return nil end
    local obj = CreateObjectNoOffset(hash, c.coords.x, c.coords.y, c.coords.z, false, false, false)
    SetEntityHeading(obj, c.coords.w)
    FreezeEntityPosition(obj, true)
    SetEntityInvincible(obj, true)
    SetModelAsNoLongerNeeded(hash)
    return obj
end

---------------------------------------------------------------------------------------------------------------------
-- Keyboard and mouse in front of the monitor, and hiding the small map props in their way (Config.Computer.Desk).
---------------------------------------------------------------------------------------------------------------------
local extras = {} -- [id] = { entities }
local hidden = {} -- [id] = { [key] = { coords, model } }

-- { model, offset, heading } for each desk item of this monitor model (a model entry can set keyboard/mouse = false).
function BM.deskItems(model)
    local desk = Config.Computer.Desk
    if not desk then return {} end
    local data = BM.modelData(model)
    local list = {}
    for _, key in ipairs({ 'keyboard', 'mouse' }) do
        local item = data[key]
        if item == nil then item = desk[key:sub(1, 1):upper() .. key:sub(2)] end
        if item and item.model then list[#list + 1] = item end
    end
    return list
end

-- The surface under a desk item (the desk), or nil when there is none close to the monitor's base height, e.g. the
-- monitor stands at the edge of the desk and the keyboard would hang in the air.
local function surfaceAt(pos, ignore)
    local ray = StartExpensiveSynchronousShapeTestLosProbe(pos.x, pos.y, pos.z + 0.25, pos.x, pos.y, pos.z - 0.15, 1 | 16, ignore, 4)
    local _, hit, coords = GetShapeTestResult(ray)
    if hit ~= 1 or math.abs(coords.z - pos.z) > 0.1 then return nil end
    return coords.z
end

local function spawnExtras(id, obj, model)
    local list = {}
    local heading = GetEntityHeading(obj)
    for _, item in ipairs(BM.deskItems(model)) do
        local o = item.offset or vector3(0.0, 0.0, 0.0)
        local pos = GetOffsetFromEntityInWorldCoords(obj, o.x, o.y, o.z)
        local z = surfaceAt(pos, obj)
        local hash = z and BM.loadModel(item.model)
        if hash then
            local e = CreateObjectNoOffset(hash, pos.x, pos.y, z, false, false, false)
            SetEntityHeading(e, (heading + (item.heading or 0.0)) % 360.0)
            FreezeEntityPosition(e, true)
            SetEntityInvincible(e, true)
            SetModelAsNoLongerNeeded(hash)
            list[#list + 1] = e
        end
    end
    extras[id] = list
end

-- How far from the monitor a prop's origin can be while its middle is still inside Desk.Area: props further away are
-- skipped with one distance check instead of reading their model size.
local clearRadius
do
    local desk = Config.Computer.Desk
    if desk and desk.Area then
        local a, b = desk.Area.min, desk.Area.max
        local far = vector3(math.max(math.abs(a.x), math.abs(b.x)), math.max(math.abs(a.y), math.abs(b.y)), math.max(math.abs(a.z), math.abs(b.z)))
        clearRadius = #far + (desk.MaxSize or 0.9) * 2.0
    end
end

-- Map props (not ones spawned by scripts) whose middle is inside Desk.Area around the monitor and that are no bigger
-- than Desk.MaxSize get a model hide. Runs again while the player is near, as interior props stream in later.
-- pool: GetGamePool('CObject'), shared when several computers are checked in the same tick.
local function clearArea(id, obj, pool)
    local desk = Config.Computer.Desk
    if not desk or not desk.ClearArea then return end
    local area, maxSize = desk.Area, desk.MaxSize or 0.9
    local list = hidden[id] or {}
    hidden[id] = list
    -- Models listed by name or hash: hidden within HideRadius of the monitor, also the interior's built-in decoration
    -- that scripts can't find on their own.
    local center = GetEntityCoords(obj)
    for _, name in ipairs(desk.HideModels or {}) do
        local model = type(name) == 'number' and name or joaat(name)
        local key = ('list:%d'):format(model)
        if not list[key] then
            CreateModelHideExcludingScriptObjects(center.x, center.y, center.z, desk.HideRadius or 1.0, model, true)
            list[key] = { coords = center, model = model, radius = desk.HideRadius or 1.0 }
        end
    end
    for _, e in ipairs(pool or GetGamePool('CObject')) do
        if e ~= obj and #(GetEntityCoords(e) - center) <= clearRadius and not IsEntityAMissionEntity(e) then
            local model = GetEntityModel(e)
            local mn, mx = GetModelDimensions(model)
            local size = math.max(mx.x - mn.x, mx.y - mn.y, mx.z - mn.z)
            if size <= maxSize then
                local mid = GetOffsetFromEntityInWorldCoords(e, (mn.x + mx.x) / 2, (mn.y + mx.y) / 2, (mn.z + mx.z) / 2)
                local rel = GetOffsetFromEntityGivenWorldCoords(obj, mid.x, mid.y, mid.z)
                if rel.x >= area.min.x and rel.x <= area.max.x and rel.y >= area.min.y and rel.y <= area.max.y
                    and rel.z >= area.min.z and rel.z <= area.max.z then
                    local pos = GetEntityCoords(e)
                    local key = ('%d:%.2f:%.2f:%.2f'):format(model, pos.x, pos.y, pos.z)
                    if not list[key] then
                        CreateModelHideExcludingScriptObjects(pos.x, pos.y, pos.z, 0.05, model, true)
                        list[key] = { coords = pos, model = model }
                    end
                end
            end
        end
    end
end

local function removeExtras(id)
    for _, e in ipairs(extras[id] or {}) do
        if DoesEntityExist(e) then DeleteEntity(e) end
    end
    extras[id] = nil
    for _, h in pairs(hidden[id] or {}) do
        RemoveModelHide(h.coords.x, h.coords.y, h.coords.z, h.radius or 0.05, h.model, false)
    end
    hidden[id] = nil
end
BM.deskHidden = hidden

local screens = {} -- [id] = { polys, pos } of a spawned monitor (it is frozen, so worked out once)

local function removeProp(id)
    local obj = BM.props[id]
    if obj and DoesEntityExist(obj) then DeleteEntity(obj) end
    BM.props[id] = nil
    screens[id] = nil
    removeExtras(id)
    Core.RemoveInteraction('yecoyz_bm_' .. id)
end

local function addInteraction(c, obj)
    Core.AddInteraction({
        id = 'yecoyz_bm_' .. c.id,
        entity = obj,
        offset = vector3(0.0, -0.25, 0.35),
        distance = Config.Computer.InteractDistance,
        options = {
            {
                name = 'use', label = BM.L('use_computer'), icon = 'monitor',
                canInteract = function()
                    if BM.using or BM.creating then return false end
                    local job = Core.GetJob()
                    return job ~= nil and job.name == c.job
                end,
                onSelect = function() CreateThread(function() BM.use(c.id) end) end,
            },
        },
    })
end

local function applyComputers(list)
    local seen = {}
    for _, c in ipairs(list) do
        seen[c.id] = true
        local old = BM.computers[c.id]
        -- Moved or changed: spawn it again.
        if old and (old.model ~= c.model or old.coords.x ~= c.coords.x or old.coords.y ~= c.coords.y or old.coords.z ~= c.coords.z or old.coords.w ~= c.coords.w or old.job ~= c.job) then
            removeProp(c.id)
        end
        BM.computers[c.id] = c
    end
    for id in pairs(BM.computers) do
        if not seen[id] then removeProp(id); BM.computers[id] = nil end
    end
end

RegisterNetEvent(RES .. ':computers', applyComputers)

RegisterNetEvent(RES .. ':inUse', function(id, name)
    BM.inUse[id] = name
    if BM.screenId == id then BM.sendScreen() end
end)

CreateThread(function()
    local computers = Core.Callback.Await(RES .. ':computers')
    if computers then applyComputers(computers) end
    local list = Core.Callback.Await(RES .. ':inUseList') or {}
    for id, name in pairs(list) do BM.inUse[tonumber(id)] = name end
end)

-- Spawn and remove props by distance.
CreateThread(function()
    while true do
        local pos = GetEntityCoords(PlayerPedId())
        local pool
        for id, c in pairs(BM.computers) do
            local dist = #(pos - vector3(c.coords.x, c.coords.y, c.coords.z))
            local near = dist < Config.Computer.SpawnDistance
            if near and not (BM.props[id] and DoesEntityExist(BM.props[id])) then
                local obj = spawnProp(c)
                if obj then
                    BM.props[id] = obj
                    spawnExtras(id, obj, c.model)
                    clearArea(id, obj)
                    addInteraction(c, obj)
                end
            elseif not near and BM.props[id] then
                removeProp(id)
            elseif near and BM.props[id] and dist < 30.0 then
                pool = pool or GetGamePool('CObject')
                clearArea(id, BM.props[id], pool) -- props that streamed in since
            end
        end
        Wait(1000)
    end
end)

---------------------------------------------------------------------------------------------------------------------
-- The screen: one DUI, shown on the closest computer in view.
---------------------------------------------------------------------------------------------------------------------
local dui, duiReady = nil, false
BM.screenId = nil

local function duiSend(msg)
    if dui and duiReady then SendDuiMessage(dui, json.encode(msg)) end
end
BM.duiSend = duiSend

function BM.sendScreen()
    local c = BM.computers[BM.screenId]
    if not c then return end
    local job = Core.GetJob()
    duiSend({
        action = 'screen',
        data = {
            jobLabel = c.jobLabel or c.job,
            job = c.job,
            label = c.label,
            user = BM.inUse[c.id],
            clock = { h = GetClockHours(), m = GetClockMinutes() },
            canUse = job ~= nil and job.name == c.job,
            prompt = BM.L('screen_prompt'),
            locked = BM.L('screen_locked'),
            inUse = BM.L('screen_in_use'),
            title = BM.L('title'),
        },
    })
end

local function ensureDui()
    if dui then return end
    dui = CreateDui(('https://cfx-nui-%s/web/dist/index.html#screen'):format(RES), DUI_W, DUI_H)
    local txd = CreateRuntimeTxd(TXD)
    CreateRuntimeTextureFromDuiHandle(txd, TXN, GetDuiHandle(dui))
    duiReady = false
end

local function destroyDui()
    if not dui then return end
    DestroyDui(dui)
    dui, duiReady, BM.screenId = nil, false, nil
end

-- The DUI page says when it has loaded.
RegisterNUICallback('screenReady', function(_, cb)
    duiReady = true
    BM.sendScreen()
    cb({})
end)

-- Sprite polys map the texture affinely, so a grid of small cells keeps it straight. The monitor is frozen, so the
-- cells are worked out once: two triangles per cell, each { x, y, z (x3), u, v (x3) } in DrawSpritePoly order.
local function screenPolys(sc)
    local lift = sc.normal * 0.003
    local tl, right, down = sc.tl + lift, sc.tr - sc.tl, sc.bl - sc.tl
    local polys = {}
    for j = 0, GRID - 1 do
        local v0, v1 = j / GRID, (j + 1) / GRID
        for i = 0, GRID - 1 do
            local u0, u1 = i / GRID, (i + 1) / GRID
            local a = tl + right * u0 + down * v0
            local b = tl + right * u1 + down * v0
            local c = tl + right * u1 + down * v1
            local d = tl + right * u0 + down * v1
            polys[#polys + 1] = { d.x, d.y, d.z, c.x, c.y, c.z, b.x, b.y, b.z, u0, v1, u1, v1, u1, v0 }
            polys[#polys + 1] = { d.x, d.y, d.z, b.x, b.y, b.z, a.x, a.y, a.z, u0, v1, u1, v0, u0, v0 }
        end
    end
    return polys
end

local function screenFor(id)
    local s = screens[id]
    if s then return s end
    local obj, c = BM.props[id], BM.computers[id]
    if not obj or not c or not DoesEntityExist(obj) then return nil end
    s = { polys = screenPolys(BM.screenOf(obj, c.model)), pos = GetEntityCoords(obj) }
    screens[id] = s
    return s
end

local function drawScreen(polys)
    for k = 1, #polys do
        local p = polys[k]
        DrawSpritePoly(p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], 255, 255, 255, 255, TXD, TXN,
            p[10], p[11], 1.0, p[12], p[13], 1.0, p[14], p[15], 1.0)
    end
end

-- The closest monitor in view distance, looked up a few times a second (not every frame).
local nearest = nil
CreateThread(function()
    while true do
        local pos = GetEntityCoords(PlayerPedId())
        local best, bestDist = nil, Config.Computer.ViewDistance
        for id in pairs(BM.props) do
            local s = screenFor(id)
            if s then
                local d = #(pos - s.pos)
                if d < bestDist then best, bestDist = id, d end
            end
        end
        nearest = best
        Wait(best and 250 or 500)
    end
end)

CreateThread(function()
    local lastClock = 0
    while true do
        local best = nearest
        local obj = best and BM.props[best]
        local s = obj and screens[best]
        if s then
            ensureDui()
            if BM.screenId ~= best then
                BM.screenId = best
                BM.sendScreen()
            end
            if GetGameTimer() - lastClock > 10000 then
                lastClock = GetGameTimer()
                BM.sendScreen()
            end
            if duiReady and IsEntityOnScreen(obj) and not (BM.using and BM.mode == 'screen' and BM.usingId == best and BM.hideScreen) then
                drawScreen(s.polys)
            end
            Wait(0)
        else
            destroyDui()
            Wait(250)
        end
    end
end)

AddEventHandler('onResourceStop', function(name)
    if name ~= RES then return end
    destroyDui()
    for id in pairs(BM.props) do removeProp(id) end
end)
