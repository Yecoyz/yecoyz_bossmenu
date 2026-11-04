-- Hooks for your own scripts. Change these to fit your server.
BM = BM or {}

-- A vehicle bought in the menu was spawned. The keys are given on the server by yecoyz_core (Config.VehicleKeys:
-- qbx_vehiclekeys, wasabi_carlock, Renewed-Vehiclekeys, qb-vehiclekeys). Add other key or fuel scripts here.
function BM.OnVehicleSpawned(vehicle, plate, model)
    SetVehicleFuelLevel(vehicle, 100.0)
    if GetResourceState('LegacyFuel') == 'started' then
        exports.LegacyFuel:SetFuel(vehicle, 100.0)
    end
end

-- Called when the menu opens and closes (hide your HUD here, for example).
function BM.OnMenuOpen() end
function BM.OnMenuClose() end
