-- Creator (/bossmenucreator): an admin window to set up every job (computers, shops, access), and a placement mode that puts a ghost of the monitor
-- (or the vehicle spawn) where you look.
local RES = BM.res
BM.creating = false

local function nui(action, data) SendNUIMessage({ action = action, data = data }) end

local function creatorCall(name, ...)
    return Core.Callback.Await(RES .. ':creator:' .. name, ...) or { error = 'timeout' }
end

local function openPanel()
    local data = creatorCall('data')
    if data.error then return BM.notify('no_permission', 'error') end
    BM.creating = true
    data.vehicleSpawn = Config.Vehicles.Mode == 'spawn' and Config.Features.Vehicles
    SetNuiFocus(true, true)
    nui('creator', data)
end

RegisterNetEvent(RES .. ':openCreator', function() CreateThread(openPanel) end)

local function closePanel()
    BM.creating = false
    SetNuiFocus(false, false)
    nui('creatorClose')
end

---------------------------------------------------------------------------------------------------------------------
-- Placement
---------------------------------------------------------------------------------------------------------------------
local function rotToDir(rot)
    local z, x = math.rad(rot.z), math.rad(rot.x)
    local c = math.abs(math.cos(x))
    return vector3(-math.sin(z) * c, math.cos(z) * c, math.sin(x))
end

local function raycast(ignore)
    local from = GetGameplayCamCoord()
    local to = from + rotToDir(GetGameplayCamRot(2)) * 12.0
    local ray = StartExpensiveSynchronousShapeTestLosProbe(from.x, from.y, from.z, to.x, to.y, to.z, 1 | 16, ignore, 4)
    local _, hit, coords = GetShapeTestResult(ray)
    return hit == 1 and coords or nil
end

-- kind: 'computer' or 'spawn'. Returns { x, y, z, w } or nil when cancelled.
local function place(kind, model, start)
    local hash = BM.loadModel(model)
    if not hash then return nil end
    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)
    local ghost
    if kind == 'spawn' then
        ghost = CreateVehicle(hash, pos.x, pos.y, pos.z - 10.0, 0.0, false, false)
    else
        ghost = CreateObjectNoOffset(hash, pos.x, pos.y, pos.z - 10.0, false, false, false)
    end
    SetEntityAlpha(ghost, 170, false)
    SetEntityCollision(ghost, false, false)
    FreezeEntityPosition(ghost, true)
    SetModelAsNoLongerNeeded(hash)

    -- The keyboard and mouse that come with the monitor, as ghosts too.
    local extraGhosts = {}
    if kind == 'computer' then
        for _, item in ipairs(BM.deskItems(model)) do
            local h = BM.loadModel(item.model)
            if h then
                local e = CreateObjectNoOffset(h, pos.x, pos.y, pos.z - 10.0, false, false, false)
                SetEntityAlpha(e, 170, false)
                SetEntityCollision(e, false, false)
                local o = item.offset or vector3(0.0, 0.0, 0.0)
                AttachEntityToEntity(e, ghost, 0, o.x, o.y, o.z, 0.0, 0.0, item.heading or 0.0, false, false, false, false, 2, true)
                SetModelAsNoLongerNeeded(h)
                extraGhosts[#extraGhosts + 1] = e
            end
        end
    end

    local heading = start and start.w or (GetEntityHeading(ped) + 180.0) % 360.0
    local height = 0.0
    local result = nil

    Core.ShowControls({
        { keys = { 'E' }, label = BM.L('creator_confirm') },
        { keys = { 'Scroll' }, label = BM.L('creator_rotate') },
        { keys = { 'Shift', 'Scroll' }, label = BM.L('creator_rotate_fine') },
        { keys = { 'PgUp', 'PgDn' }, label = BM.L('creator_height') },
        { keys = { 'Backspace' }, label = kind == 'spawn' and BM.L('creator_skip') or BM.L('creator_cancel') },
    }, kind == 'spawn' and BM.L('creator_place_spawn') or BM.L('creator_place_computer'))

    while true do
        Wait(0)
        DisableControlAction(0, 14, true) -- scroll
        DisableControlAction(0, 15, true)
        DisableControlAction(0, 16, true)
        DisableControlAction(0, 17, true)
        DisableControlAction(0, 24, true) -- attack
        DisableControlAction(0, 25, true)
        DisableControlAction(0, 38, true) -- E
        DisableControlAction(0, 177, true) -- backspace
        DisableControlAction(0, 200, true) -- esc

        local fine = IsDisabledControlPressed(0, 21) or IsControlPressed(0, 21)
        local step = fine and 1.0 or 7.5
        if IsDisabledControlJustPressed(0, 14) or IsDisabledControlJustPressed(0, 16) then heading = (heading - step) % 360.0 end
        if IsDisabledControlJustPressed(0, 15) or IsDisabledControlJustPressed(0, 17) then heading = (heading + step) % 360.0 end
        if IsControlPressed(0, 10) then height = height + 0.005 end -- page up
        if IsControlPressed(0, 11) then height = height - 0.005 end -- page down

        local hit = raycast(ghost)
        if hit then
            local z = hit.z + height
            SetEntityCoordsNoOffset(ghost, hit.x, hit.y, z, false, false, false)
            SetEntityHeading(ghost, heading)
            if kind == 'spawn' then SetVehicleOnGroundProperly(ghost) end
            if IsDisabledControlJustPressed(0, 38) then
                local c = GetEntityCoords(ghost)
                result = { x = c.x, y = c.y, z = c.z, w = heading }
                break
            end
        end
        if IsDisabledControlJustPressed(0, 177) or IsDisabledControlJustPressed(0, 200) then break end
    end

    Core.HideControls()
    for _, e in ipairs(extraGhosts) do DeleteEntity(e) end
    DeleteEntity(ghost)
    return result
end

---------------------------------------------------------------------------------------------------------------------
-- Panel callbacks
---------------------------------------------------------------------------------------------------------------------
RegisterNUICallback('creatorClose', function(_, cb)
    closePanel()
    cb({})
end)

RegisterNUICallback('creatorDelete', function(data, cb)
    CreateThread(function() cb(creatorCall('delete', data.id)) end)
end)

RegisterNUICallback('creatorTeleport', function(data, cb)
    local c = BM.computers[tonumber(data.id)]
    if c then
        local obj = BM.props[c.id]
        local back = vector3(c.coords.x, c.coords.y, c.coords.z)
        if obj then
            local sc = BM.screenOf(obj, c.model)
            back = sc.center + vector3(sc.normal.x, sc.normal.y, 0.0) * 1.2
        end
        SetEntityCoords(PlayerPedId(), back.x, back.y, back.z - 0.9, false, false, false, false)
    end
    cb({})
end)

-- data = { id?, job, label, model, coords?, spawn?, step = 'computer' | 'spawn' | 'both' | 'save' }
-- Hides the panel while placing, then saves and shows the panel again.
RegisterNUICallback('creatorPlace', function(data, cb)
    cb({})
    CreateThread(function()
        SetNuiFocus(false, false)
        nui('creatorHide')
        local coords, spawn = data.coords, data.spawn
        local step = data.step or 'both'
        if step == 'computer' or step == 'both' then
            local placed = place('computer', data.model, coords)
            if not placed then
                SetNuiFocus(true, true)
                nui('creatorShow')
                return
            end
            coords = placed
        end
        if (step == 'spawn' or step == 'both') and Config.Vehicles.Mode == 'spawn' and Config.Features.Vehicles then
            local placed = place('spawn', 'sultan', spawn)
            if placed then spawn = placed elseif step == 'spawn' then spawn = data.spawn end
        end
        local result = creatorCall('save', { id = data.id, job = data.job, label = data.label, model = data.model, coords = coords, spawn = spawn or false })
        if result.error then BM.notify('creator_failed', 'error') else BM.notify('creator_saved', 'success') end
        SetNuiFocus(true, true)
        nui('creatorShow', result.computers and { computers = result.computers } or nil)
    end)
end)

-- Jobs: the list on the left, one job's computers / ranks / pages, and saving them.
RegisterNUICallback('creatorJobs', function(_, cb)
    CreateThread(function() cb(creatorCall('jobs')) end)
end)

RegisterNUICallback('creatorJob', function(data, cb)
    CreateThread(function() cb(creatorCall('job', data.job)) end)
end)

RegisterNUICallback('creatorJobSave', function(data, cb)
    CreateThread(function() cb(creatorCall('jobSave', data.job, data.data)) end)
end)

RegisterNUICallback('creatorJobReset', function(data, cb)
    CreateThread(function() cb(creatorCall('jobReset', data.job, data.what)) end)
end)

-- Shops (vehicles / items per job). New vehicle models are checked here, where the game can tell if they exist.
RegisterNUICallback('creatorShop', function(data, cb)
    CreateThread(function() cb(creatorCall('shop', data.kind, data.job)) end)
end)

RegisterNUICallback('creatorShopSave', function(data, cb)
    CreateThread(function()
        if data.kind == 'vehicle' then
            for _, e in ipairs(data.list or {}) do
                local hash = type(e.model) == 'string' and joaat(e.model)
                if not hash or not IsModelInCdimage(hash) or not IsModelAVehicle(hash) then
                    return cb({ error = 'invalid_model', model = e.model })
                end
            end
        end
        cb(creatorCall('shopSave', data.kind, data.job, data.list or {}))
    end)
end)

RegisterNUICallback('creatorSave', function(data, cb)
    CreateThread(function() cb(creatorCall('save', data)) end)
end)
