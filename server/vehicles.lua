-- Work vehicles bought from the company account.
local RES = GetCurrentResourceName()
local spawning = {} -- [source] = { plate, model, expires } of a bought vehicle the client is spawning

local function shopFor(job, grade, isBoss)
    local list = {}
    for i, v in ipairs(Shop.Get('vehicle', job)) do
        list[#list + 1] = {
            index = i, model = v.model, label = v.label or v.model, price = v.price, grade = v.grade or 0,
            category = v.category or 'Vehicles', image = v.image, locked = not isBoss and grade < (v.grade or 0),
        }
    end
    return list
end

Action('vehicles', 'vehicles', function(source, access)
    local session = Sessions[source]
    local computer = session and session.computer and Computers.Get(session.computer)
    return {
        shop = shopFor(access.job, access.grade, access.isBoss),
        fleet = MySQL.query.await('SELECT `id`, `model`, `label`, `plate`, `price`, `bought_by_name`, `created_at` FROM `yecoyz_bossmenu_vehicles` WHERE `job` = ? ORDER BY `id` DESC LIMIT 100', { access.job }) or {},
        balance = access.perms.economy and Core.GetSocietyMoney(access.job) or nil,
        mode = Config.Vehicles.Mode,
        owner = Config.Vehicles.Owner == 'player' and 'player' or 'job',
        canSpawn = Config.Vehicles.Mode ~= 'spawn' or (computer and computer.spawn ~= nil) or false,
    }
end)

Action('buyVehicle', 'vehicles', function(source, access, index, model)
    if Busy(source, 2000) then return Err('busy') end
    local item = Shop.Get('vehicle', access.job)[tonumber(index) or 0]
    -- The list can change in the creator while the menu is open: the model has to match what the buyer saw.
    if not item or (model and item.model ~= model) then return Err('not_found') end
    if not access.isBoss and access.grade < (item.grade or 0) then return Err('hierarchy') end

    local spawn
    if Config.Vehicles.Mode == 'spawn' then
        local session = Sessions[source]
        local computer = session and session.computer and Computers.Get(session.computer)
        spawn = computer and computer.spawn
        if not spawn then return Err('no_spawn') end
    end

    if not Core.RemoveSocietyMoney(access.job, item.price) then return Err('no_money') end
    local plate = Core.GeneratePlate(Config.Vehicles.PlatePrefix)

    local garage
    if Config.Vehicles.Mode == 'garage' then
        local wanted = Config.Vehicles.Garage
        if type(wanted) == 'table' then wanted = wanted[access.job] end
        local ok
        if Config.Vehicles.Owner == 'player' then
            ok, _, garage = Core.GiveVehicle(source, item.model, plate, access.job, item.garage or wanted)
        else
            ok, _, garage = Core.GiveJobVehicle(source, access.job, item.model, plate, item.garage or wanted, item.useGrade)
        end
        if not ok then
            Core.AddSocietyMoney(access.job, item.price)
            return Err('failed')
        end
    end

    MySQL.insert.await('INSERT INTO `yecoyz_bossmenu_vehicles` (`job`, `model`, `label`, `plate`, `price`, `bought_by`, `bought_by_name`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', {
        access.job, item.model, item.label, plate, item.price, access.identifier, access.name, os.time(),
    })
    Log(access, 'vehicle', 'vehicle', nil, item.label, item.price, plate)

    if spawn then
        spawning[source] = { plate = plate, model = item.model, expires = os.time() + 30 }
        TriggerClientEvent(RES .. ':spawnVehicle', source, { model = item.model, plate = plate, coords = spawn })
    end
    return { ok = true, plate = plate, spawned = spawn ~= nil, garage = garage }
end)

local function trim(text) return (tostring(text or ''):gsub('^%s+', ''):gsub('%s+$', '')) end

-- The client spawned the vehicle it bought: give the keys from here, where the key scripts trust the call.
RegisterNetEvent(RES .. ':vehicleSpawned', function(netId)
    local source = source
    local pending = spawning[source]
    spawning[source] = nil
    if not pending or os.time() > pending.expires or type(netId) ~= 'number' then return end

    -- The entity and its plate reach the server a moment after the client made them.
    local vehicle, t = 0, GetGameTimer() + 5000
    while GetGameTimer() < t do
        vehicle = NetworkGetEntityFromNetworkId(netId)
        if vehicle ~= 0 and DoesEntityExist(vehicle) and trim(GetVehicleNumberPlateText(vehicle)) == trim(pending.plate) then break end
        vehicle = 0
        Wait(100)
    end
    if vehicle == 0 or GetEntityModel(vehicle) ~= joaat(pending.model) then return end

    Core.GiveVehicleKeys(source, netId, pending.plate)
    if GetResourceState('ox_fuel') == 'started' then Entity(vehicle).state:set('fuel', 100.0, true) end
end)

AddEventHandler('playerDropped', function() spawning[source] = nil end)
