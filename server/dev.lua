-- Development bridge (Config.DevBridge): writing dev/request.json with a new "id" sends the request to the first
-- connected player (or "player"), whose client runs it (client/dev.lua) and answers with dev/report.json.
-- Screenshots go to the screenshot-basic folder as yecoyz_bm_<shot>.jpg. Never enable this on a public server.
if not Config.DevBridge then return end
local res = GetCurrentResourceName()
local pending = {}
local function readRequest()
    local raw = LoadResourceFile(res, 'dev/request.json')
    if not raw then return end
    local ok, req = pcall(json.decode, raw)
    if ok and type(req) == 'table' and req.id then return req end
end
local last = readRequest()
local lastId = last and last.id -- a request left over from before the restart is not replayed
print('[bossmenu dev] bridge enabled: write dev/request.json to run a test pass')
CreateThread(function()
    while true do
        Wait(500)
        local req = readRequest()
        if req and req.id ~= lastId then
            lastId = req.id
            local target = tonumber(req.player) or tonumber(GetPlayers()[1])
            if not target and req.server and not req.code then
                -- Server-only request: runs without a player.
                local fn, err = load(req.server, 'dev-server', 't', setmetatable({}, { __index = _G }))
                local ok, result = false, err
                if fn then ok, result = pcall(fn) end
                SaveResourceFile(res, 'dev/report.json', json.encode({ id = req.id, serverResult = ok and result or ('error: ' .. tostring(result)) }), -1)
            elseif not target then
                SaveResourceFile(res, 'dev/report.json', json.encode({ id = req.id, error = 'no players online' }), -1)
            else
                pending[req.id] = target
                print(('[bossmenu dev] request %s -> player %d'):format(tostring(req.id), target))
                if req.server then
                    -- Server-side snippet first (its result is passed to the client as req.serverResult).
                    local fn, err = load(req.server, 'dev-server', 't', setmetatable({ source = target }, { __index = _G }))
                    local ok, result = false, err
                    if fn then ok, result = pcall(fn) end
                    req.serverResult = ok and result or ('error: ' .. tostring(result))
                end
                TriggerClientEvent('yecoyz_bossmenu:dev', target, req)
            end
        end
    end
end)
RegisterNetEvent('yecoyz_bossmenu:devReport', function(report)
    local id = source
    if type(report) ~= 'table' or pending[report.id] ~= id then return end
    SaveResourceFile(res, 'dev/report.json', json.encode(report), -1)
    print(('[bossmenu dev] report %s saved'):format(tostring(report.id)))
end)
RegisterNetEvent('yecoyz_bossmenu:devShot', function(requestId, name, png)
    local id = source
    if pending[requestId] ~= id or type(name) ~= 'string' or not name:match('^[%w_]+$') then return end
    if GetResourceState('screenshot-basic') ~= 'started' then return print('[bossmenu dev] screenshot-basic is not started') end
    local file = GetResourcePath('screenshot-basic') .. '/yecoyz_bm_' .. name .. (png and '.png' or '.jpg')
    exports['screenshot-basic']:requestClientScreenshot(id, { fileName = file, quality = png and 1.0 or 0.85, encoding = png and 'png' or 'jpg' }, function(err)
        print(('[bossmenu dev] screenshot %s %s'):format(name, err and ('failed: ' .. tostring(err)) or 'saved'))
    end)
end)
