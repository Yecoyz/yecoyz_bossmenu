-- Development bridge client (Config.DevBridge): runs the Lua snippet in request "code" with Shot(name) and Report
-- (a table merged into the report) in scope; the snippet's return value lands in report.result.
if not Config.DevBridge then return end
RegisterNetEvent('yecoyz_bossmenu:dev', function(req)
    CreateThread(function()
        local report = { id = req.id, serverResult = req.serverResult }
        local env = setmetatable({
            Req = req, Report = report,
            Shot = function(name, png) TriggerServerEvent('yecoyz_bossmenu:devShot', req.id, name, png == true); Wait(png and 2500 or 600) end,
        }, { __index = _G, __newindex = _G })
        if req.code then
            local fn, err = load(req.code, 'dev', 't', env)
            if not fn then report.error = err else
                local ok, result = pcall(fn)
                if ok then report.result = result else report.error = tostring(result) end
            end
        end
        TriggerServerEvent('yecoyz_bossmenu:devReport', report)
    end)
end)

-- What the NUI shows (screenshots don't include NUI): BM.probe() -> { text, layout }.
local probe
RegisterNUICallback('probe', function(data, cb) probe = data; cb({}) end)
function BM.probe(selector)
    probe = nil
    SendNUIMessage({ action = 'probe', data = { selector = selector } })
    local t = GetGameTimer() + 1500
    while not probe and GetGameTimer() < t do Wait(0) end
    return probe
end

-- Clicks the first element matching a CSS selector (or containing text) in the NUI.
function BM.click(selector, text)
    SendNUIMessage({ action = 'click', data = { selector = selector, text = text } })
    Wait(300)
end
