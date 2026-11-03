-- Hooks for your own scripts. Change these to fit your server.
BM = BM or {}

-- A vehicle bought in the menu was spawned. Give the keys and fuel with your scripts here.
function BM.OnVehicleSpawned(vehicle, plate, model)
    SetVehicleFuelLevel(vehicle, 100.0)
    if GetResourceState('qb-vehiclekeys') == 'started' then
        TriggerEvent('vehiclekeys:client:SetOwner', plate)
    elseif GetResourceState('qbx_vehiclekeys') == 'started' then
        TriggerServerEvent('qb-vehiclekeys:server:AcquireVehicleKeys', plate)
    elseif GetResourceState('wasabi_carlock') == 'started' then
        exports.wasabi_carlock:GiveKey(plate)
    end
    if GetResourceState('LegacyFuel') == 'started' then
        exports.LegacyFuel:SetFuel(vehicle, 100.0)
    elseif GetResourceState('ox_fuel') == 'started' then
        Entity(vehicle).state.fuel = 100.0
    end
end

-- Called when the menu opens and closes (hide your HUD here, for example).
function BM.OnMenuOpen() end
function BM.OnMenuClose() end
