-- Using a computer: the camera moves in on the monitor and the menu (NUI) is fitted onto its screen, so it is used
-- with the normal mouse and keyboard while it looks like it is on the monitor. Config.Computer.Mode = 'fullscreen'
-- opens it over the whole screen instead.
local RES = BM.res
local cam = nil
local busy = false
BM.using = false
BM.usingId = nil
BM.mode = nil

local function nui(action, data) SendNUIMessage({ action = action, data = data }) end
BM.nui = nui

local errors = {
    no_access = 'error_no_access', wrong_job = 'error_no_access', too_far = 'error_too_far', no_computer = 'error_no_access',
}

local function cameraOn(sc)
    -- Far enough back that the screen fills about 80% of the view height.
    local fov = 40.0
    local dist = (sc.height / 2) / math.tan(math.rad(fov / 2)) / 0.8
    local aspect = GetAspectRatio(false)
    local distW = (sc.width / 2) / math.tan(math.rad(fov / 2)) / aspect / 0.86
    dist = math.max(dist, distW)
    local p = sc.center + sc.normal * dist
    cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', p.x, p.y, p.z, 0.0, 0.0, 0.0, fov, false, 0)
    PointCamAtCoord(cam, sc.center.x, sc.center.y, sc.center.z)
    SetCamActive(cam, true)
    RenderScriptCams(true, true, 700, true, true)
    local mine = cam
    CreateThread(function()
        while cam == mine do
            SetEntityLocallyInvisible(PlayerPedId())
            DisableAllControlActions(0)
            Wait(0)
        end
    end)
end

local function cameraOff()
    if not cam then return end
    RenderScriptCams(false, true, 500, true, true)
    DestroyCam(cam, false)
    cam = nil
end

-- Screen corners on the game screen (0..1), worked out from where the camera ends up rather than read from the
-- game, which gives wrong values while the camera is still moving in (or -1 for a corner that is off screen then).
local function cross(a, b) return vector3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x) end
local function dot(a, b) return a.x * b.x + a.y * b.y + a.z * b.z end

local function screenQuad(sc)
    local pos, fov = GetCamCoord(cam), GetCamFov(cam)
    local f = sc.center - pos
    f = f / #f
    local r = cross(f, vector3(0.0, 0.0, 1.0))
    r = r / #r
    local u = cross(r, f)
    local tanV = math.tan(math.rad(fov) / 2) -- GTA camera FOV is vertical
    local tanH = tanV * GetAspectRatio(false)
    local out = {}
    for i, p in ipairs({ sc.tl, sc.tr, sc.br, sc.bl }) do
        local d = p - pos
        local z = dot(d, f)
        out[i] = { 0.5 + dot(d, r) / (z * tanH) / 2, 0.5 - dot(d, u) / (z * tanV) / 2 }
    end
    return out
end
BM.screenQuad = function(sc) return cam and screenQuad(sc) end

local function playAnim()
    local a = Config.Computer.Animation
    if a and a.dict and BM.loadDict(a.dict) then
        TaskPlayAnim(PlayerPedId(), a.dict, a.clip, 4.0, 4.0, -1, 1, 0.0, false, false, false)
    end
end

local function open(boot, mode, quad)
    BM.using = true
    BM.mode = mode
    SetNuiFocus(true, true)
    nui('open', { boot = boot, mode = mode, quad = quad })
    BM.OnMenuOpen()
end

-- Screen mode: the monitor (DUI) shows the menu first and the camera moves in on it. The real menu (NUI) is loaded
-- hidden meanwhile and fades in exactly over the monitor's screen once the camera stops, so it looks like the same
-- screen that becomes usable.

function BM.use(id)
    if busy or BM.using then return end
    local c = BM.computers[id]
    local obj = BM.props[id]
    if not c or not obj then return end
    busy = true
    local boot = Core.Callback.Await(RES .. ':open', id)
    if not boot or boot.error then
        BM.notify(errors[boot and boot.error] or 'error_no_access', 'error')
        busy = false
        return
    end
    BM.usingId = id
    local mode = Config.Computer.Mode == 'fullscreen' and 'fullscreen' or 'screen'
    local ped = PlayerPedId()
    local sc = BM.screenOf(obj, c.model)
    if mode == 'screen' then
        BM.opening = true
        BM.duiSend({ action = 'menu', data = { boot = boot } })
        nui('open', { boot = boot, mode = mode, hidden = true })
    end

    -- Stand in front of the monitor, facing it.
    local stand = sc.center + vector3(sc.normal.x, sc.normal.y, 0.0) * 0.75
    local heading = GetHeadingFromVector_2d(-sc.normal.x, -sc.normal.y)
    TaskGoStraightToCoord(ped, stand.x, stand.y, stand.z, 1.0, 3000, heading, 0.1)
    local t = GetGameTimer() + 3000
    while GetGameTimer() < t and #(GetEntityCoords(ped).xy - stand.xy) > 0.3 do Wait(50) end
    SetEntityHeading(ped, heading)
    playAnim()

    DisplayRadar(false)
    if mode == 'screen' then
        cameraOn(sc)
        -- IsCamInterpolating doesn't cover the RenderScriptCams ease, so wait until the camera the game actually
        -- renders has reached ours (position and FOV), then a couple of frames so the last step is drawn.
        local target, fov = GetCamCoord(cam), GetCamFov(cam)
        local t2 = GetGameTimer() + 3000
        Wait(50)
        while GetGameTimer() < t2 do
            if #(GetFinalRenderedCamCoord() - target) < 0.005 and math.abs(GetFinalRenderedCamFov() - fov) < 0.05 then break end
            Wait(0)
        end
        Wait(2 * 16)
        BM.using, BM.mode, BM.opening = true, mode, false
        nui('reveal', { quad = screenQuad(sc) })
        SetNuiFocus(true, true)
        BM.OnMenuOpen()
    else
        open(boot, mode, nil)
    end
    busy = false
end

-- Opened by command or another script: always full screen.
function BM.openAnywhere()
    if busy or BM.using then return end
    busy = true
    local boot = Core.Callback.Await(RES .. ':open', nil)
    if not boot or boot.error then
        BM.notify(errors[boot and boot.error] or 'error_no_access', 'error')
        busy = false
        return
    end
    BM.usingId = nil
    open(boot, 'fullscreen', nil)
    busy = false
end

RegisterNetEvent(RES .. ':openAnywhere', function() CreateThread(BM.openAnywhere) end)

if Config.Command then
    RegisterCommand(Config.Command, function() CreateThread(BM.openAnywhere) end, false)
end

function BM.close()
    if not BM.using then return end
    BM.using = false
    SetNuiFocus(false, false)
    local screen = BM.mode == 'screen'
    nui('close', { instant = screen })
    TriggerServerEvent(RES .. ':close')
    if screen then Wait(50) end -- let the menu disappear before the camera moves
    -- The monitor keeps showing the menu while the camera moves back, then locks.
    if BM.mode == 'screen' then
        SetTimeout(700, function()
            if not BM.using and not BM.opening then BM.duiSend({ action = 'menuClose' }) end
        end)
    end
    cameraOff()
    DisplayRadar(true)
    local a = Config.Computer.Animation
    if a and a.dict then StopAnimTask(PlayerPedId(), a.dict, a.clip, 2.0) end
    BM.usingId, BM.mode = nil, nil
    BM.OnMenuClose()
end

RegisterNUICallback('close', function(_, cb)
    cb({})
    CreateThread(BM.close)
end)

-- Every menu action goes to the server callback of the same name, which checks access again.
local actions = {
    employees = true, nearby = true, hire = true, fire = true, setGrade = true, grades = true, saveGrade = true,
    deleteGrade = true, moveGrade = true, setSalary = true, bonus = true, setAccess = true, economy = true, deposit = true,
    withdraw = true, logs = true, dashboard = true, vehicles = true, buyVehicle = true, items = true, buyItem = true, duty = true,
    dutyShifts = true, dutyEdit = true, dutyRemove = true, dutyAdd = true, dutyForceOff = true,
}

local function spawnBlocked()
    local c = BM.usingId and BM.computers[BM.usingId]
    if not c or not c.spawn then return false end
    return IsAnyVehicleNearPoint(c.spawn.x, c.spawn.y, c.spawn.z, 3.0)
end

-- The page the menu is on, so the monitor shows the same.
RegisterNUICallback('page', function(data, cb)
    if BM.using and type(data.page) == 'string' then BM.duiSend({ action = 'page', data = { page = data.page } }) end
    cb({})
end)

-- From the menu and from the monitor's copy of it (DUI), which loads while the camera moves in.
RegisterNUICallback('call', function(data, cb)
    local name = data and data.name
    if not (BM.using or BM.opening) or not actions[name] then return cb({ error = 'invalid' }) end
    if name == 'buyVehicle' and Config.Vehicles.Mode == 'spawn' and spawnBlocked() then return cb({ error = 'spawn_blocked' }) end
    local args = type(data.args) == 'table' and data.args or {}
    CreateThread(function()
        local result = Core.Callback.Await(RES .. ':' .. name, table.unpack(args, 1, 6))
        cb(result or { error = 'timeout' })
    end)
end)

-- A bought vehicle at the computer's vehicle spawn.
RegisterNetEvent(RES .. ':spawnVehicle', function(data)
    local hash = BM.loadModel(data.model)
    if not hash then return end
    local c = data.coords
    local veh = CreateVehicle(hash, c.x, c.y, c.z, c.w, true, false)
    local t = GetGameTimer() + 3000
    while not DoesEntityExist(veh) and GetGameTimer() < t do Wait(0) end
    SetVehicleNumberPlateText(veh, data.plate)
    SetVehicleOnGroundProperly(veh)
    SetEntityAsMissionEntity(veh, true, true)
    SetModelAsNoLongerNeeded(hash)
    t = GetGameTimer() + 3000
    while not NetworkGetEntityIsNetworked(veh) and GetGameTimer() < t do Wait(0) end
    TriggerServerEvent(RES .. ':vehicleSpawned', VehToNet(veh)) -- the server gives the keys (yecoyz_core)
    BM.OnVehicleSpawned(veh, data.plate, data.model)
    BM.notify('notify_vehicle_spawned', 'success', data.plate)
end)

AddEventHandler('onResourceStop', function(name)
    if name ~= RES then return end
    if BM.using then
        SetNuiFocus(false, false)
        cameraOff()
        DisplayRadar(true)
        ClearPedTasks(PlayerPedId())
    end
end)
