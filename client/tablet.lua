-- The boss menu as an app on yecoyz_tablet (Config.Tablet). The app is the menu page in tablet mode
-- (web/dist/index.html#tablet=<tablet resource>), shown in the tablet's frame. It is only registered for players with
-- menu access, and the server opens a session only while the tablet is out.
local RES = BM.res
local TABLET = Config.Tablet
if not TABLET or not TABLET.Enabled then return end

local registered = false
BM.tabletSession = false

local function tabletStarted()
    return GetResourceState(TABLET.Resource) == 'started'
end

local function registerApp()
    local ok, err = exports[TABLET.Resource]:RegisterApp({
        id = TABLET.AppId,
        label = TABLET.Label,
        ui = 'web/dist/index.html#tablet=' .. TABLET.Resource,
        icon = TABLET.Icon,
        color = TABLET.Color,
        description = BM.L('tablet_description'),
        author = 'Yecoyz',
        installedByDefault = TABLET.InstalledByDefault ~= false,
    })
    if not ok then print(('^1[yecoyz_bossmenu] tablet app: %s^7'):format(err)) end
    registered = ok == true
end

local function unregisterApp()
    registered = false
    pcall(function() exports[TABLET.Resource]:UnregisterApp(TABLET.AppId) end)
end

-- The app is there only while the player can open the menu (job, rank and access, decided on the server).
local function refresh()
    if not tabletStarted() then
        registered = false
        return
    end
    local job = Core.Callback.Await(RES .. ':canUse')
    if job and not registered then
        registerApp()
    elseif not job and registered then
        unregisterApp()
    end
end

local function endSession()
    if not BM.tabletSession then return end
    BM.tabletSession = false
    TriggerServerEvent(RES .. ':close', 'tablet')
end

CreateThread(function()
    Wait(1000)
    refresh()
end)
Core.OnPlayerLoaded(function() CreateThread(refresh) end)
Core.OnJobUpdated(function() CreateThread(refresh) end)
RegisterNetEvent(RES .. ':accessChanged', function() CreateThread(refresh) end)

-- The tablet forgets its apps when it restarts.
AddEventHandler('onClientResourceStart', function(name)
    if name == TABLET.Resource then
        registered = false
        CreateThread(refresh)
    end
end)
AddEventHandler('onClientResourceStop', function(name)
    if name == TABLET.Resource then
        registered = false
        BM.tabletSession = false
    end
end)

-- The app page opens a session when it is shown and gets the same boot data as a computer.
RegisterNUICallback('tabletOpen', function(_, cb)
    if BM.using then return cb({ error = 'busy' }) end
    CreateThread(function()
        local boot = Core.Callback.Await(RES .. ':openTablet')
        if not boot or boot.error then
            BM.tabletSession = false
            return cb({ error = boot and boot.error or 'timeout' })
        end
        BM.tabletSession = true
        cb({ boot = boot })
    end)
end)

RegisterNUICallback('tabletClose', function(_, cb)
    cb({})
    endSession()
end)

-- Hidden or the tablet put away: the session ends (the page opens a new one when it is shown again).
AddEventHandler(TABLET.Resource .. ':client:appClosed', function(id)
    if id == TABLET.AppId then endSession() end
end)
