-- Vehicle and item shops per job, set up in game in the creator and saved in the database. sql/presets.sql has example
-- lists for police, ambulance and mechanic.
Shop = {}

local KINDS = { vehicle = true, item = true }
local MAX_ENTRIES = 100
local lists = { vehicle = {}, item = {} } -- [kind][job] = list

function Shop.Get(kind, job)
    return lists[kind][job] or {}
end

CreateThread(function()
    DB.Await()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `yecoyz_bossmenu_shop` (
            `job` varchar(64) NOT NULL,
            `kind` varchar(16) NOT NULL,
            `items` longtext NOT NULL,
            `updated_by` varchar(100) DEFAULT NULL,
            `updated_at` int(11) unsigned NOT NULL DEFAULT 0,
            PRIMARY KEY (`job`, `kind`)
        )
    ]])
    for _, row in ipairs(MySQL.query.await('SELECT `job`, `kind`, `items` FROM `yecoyz_bossmenu_shop`') or {}) do
        if KINDS[row.kind] then lists[row.kind][row.job] = DecodeJson(row.items) end
    end
end)

---------------------------------------------------------------------------------------------------------------------
-- Checking what the creator sends
---------------------------------------------------------------------------------------------------------------------
local function text(value, max)
    if type(value) ~= 'string' then return nil end
    value = value:gsub('[%c<>]', ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, max)
    return value ~= '' and value or nil
end

local function int(value, min, max)
    value = math.floor(tonumber(value) or -1)
    if value < min or value > max then return nil end
    return value
end

-- A picture link: https/http, or nui:// for images inside a resource.
local function imageUrl(value)
    if type(value) ~= 'string' or value == '' then return nil end
    if #value > 512 or value:find('[%s"\'<>]') then return nil end
    if not (value:find('^https?://') or value:find('^nui://')) then return nil end
    return value
end

local function clean(kind, e)
    if type(e) ~= 'table' then return nil end
    local out = {
        label = text(e.label, 48),
        price = int(e.price, 0, 100000000),
        grade = int(e.grade or 0, 0, 100),
        category = text(e.category, 32),
        image = imageUrl(e.image),
    }
    if not out.price or not out.grade then return nil end
    if e.image and e.image ~= '' and not out.image then return nil, 'invalid_image' end
    if kind == 'vehicle' then
        out.model = type(e.model) == 'string' and e.model:match('^[%w_]+$') and e.model:lower():sub(1, 32) or nil
        if not out.model then return nil, 'invalid_model' end
        out.garage = text(e.garage, 64)
        out.useGrade = e.useGrade and int(e.useGrade, 0, 100) or nil
    else
        out.name = type(e.name) == 'string' and e.name:match('^[%w_%-]+$') and e.name:sub(1, 64) or nil
        if not out.name then return nil, 'invalid_item' end
        out.max = e.max and int(e.max, 1, 1000) or nil
    end
    return out
end

---------------------------------------------------------------------------------------------------------------------
-- Creator callbacks
---------------------------------------------------------------------------------------------------------------------
local function jobOk(job)
    return type(job) == 'string' and Core.GetJobs()[job] ~= nil
end

local function payload(kind, job)
    return { ok = true, list = Shop.Get(kind, job) }
end

CreatorCallback('shop', function(source, kind, job)
    if not KINDS[kind] or not jobOk(job) then return { error = 'invalid' } end
    return payload(kind, job)
end)

-- The whole list of one job is saved at once.
CreatorCallback('shopSave', function(source, kind, job, list)
    if not KINDS[kind] or not jobOk(job) or type(list) ~= 'table' then return { error = 'invalid' } end
    if #list > MAX_ENTRIES then return { error = 'too_many' } end
    local out = {}
    for _, e in ipairs(list) do
        local entry, err = clean(kind, e)
        if not entry then return { error = err or 'invalid' } end
        out[#out + 1] = entry
    end
    MySQL.query.await('INSERT INTO `yecoyz_bossmenu_shop` (`job`, `kind`, `items`, `updated_by`, `updated_at`) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `items` = VALUES(`items`), `updated_by` = VALUES(`updated_by`), `updated_at` = VALUES(`updated_at`)', {
        job, kind, json.encode(out), Core.GetIdentifier(source), os.time(),
    })
    lists[kind][job] = out
    return payload(kind, job)
end)
