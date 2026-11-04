-- yecoyz_duty integration: statistics from its shift history and shift corrections, written in the same format
-- yecoyz_duty uses (an edited shift keeps its original duration in `edited`, so it shows as edited there too).
local DAY = 86400

local function shiftStart(shift)
    if tonumber(shift.startTime) then return tonumber(shift.startTime) end
    if type(shift.startTimeFormatted) ~= 'string' then return nil end
    local y, mo, d, h, mi, s = shift.startTimeFormatted:match('^(%d+)-(%d+)-(%d+) (%d+):(%d+):(%d+)$')
    if not y then return nil end
    return os.time({ year = tonumber(y), month = tonumber(mo), day = tonumber(d), hour = tonumber(h), min = tonumber(mi), sec = tonumber(s) })
end

local function rowsFor(identifiers)
    if #identifiers == 0 then return {} end
    local marks = {}
    for i = 1, #identifiers do marks[i] = '?' end
    local rows = MySQL.query.await(('SELECT `identifier`, `history` FROM `yecoyz_duty` WHERE `identifier` IN (%s)'):format(table.concat(marks, ',')), identifiers) or {}
    local map = {}
    for _, row in ipairs(rows) do map[row.identifier] = DecodeJson(row.history) end
    return map
end

-- Shifts of this job (old shifts from before multijob have no job and count for every job).
local function jobShifts(history, job)
    local list = {}
    for index, shift in ipairs(history or {}) do
        if shift.job == nil or shift.job == job then
            local start = shiftStart(shift)
            if start then
                list[#list + 1] = {
                    index = index, key = start, startTime = start, duration = math.max(0, math.floor(tonumber(shift.duration) or 0)),
                    edited = shift.edited, manual = shift.manual,
                }
            end
        end
    end
    table.sort(list, function(a, b) return a.startTime > b.startTime end)
    return list
end

local function startOfToday()
    local t = os.date('*t')
    return os.time({ year = t.year, month = t.month, day = t.day, hour = 0 })
end

local function idsOf(employees)
    local ids = {}
    for _, e in ipairs(employees) do ids[#ids + 1] = e.identifier end
    return ids
end

-- [identifier] = { today, week, month, total, shifts, average, lastShift, onDuty }
-- histories: from rowsFor, when the caller already loaded them.
function DutyStatsFor(job, employees, histories)
    if not DutyAvailable() then return {} end
    histories = histories or rowsFor(idsOf(employees))
    local now, today = os.time(), startOfToday()
    local stats = {}
    for _, e in ipairs(employees) do
        local s = { today = 0, week = 0, month = 0, total = 0, shifts = 0, lastShift = nil, onDuty = e.onDuty == true }
        for _, shift in ipairs(jobShifts(histories[e.identifier], job)) do
            s.total = s.total + shift.duration
            s.shifts = s.shifts + 1
            if shift.startTime >= today then s.today = s.today + shift.duration end
            if shift.startTime >= now - 7 * DAY then s.week = s.week + shift.duration end
            if shift.startTime >= now - 30 * DAY then s.month = s.month + shift.duration end
            if not s.lastShift or shift.startTime > s.lastShift then s.lastShift = shift.startTime end
        end
        s.average = s.shifts > 0 and math.floor(s.total / s.shifts) or 0
        stats[e.identifier] = s
    end
    return stats
end

-- Hours worked per day (last `days` days) for the whole job.
local function hoursByDay(job, histories, days)
    local list, index = {}, {}
    local today = startOfToday()
    for i = days - 1, 0, -1 do
        local t = today - i * DAY
        list[#list + 1] = { day = os.date('%Y-%m-%d', t), time = t, seconds = 0 }
        index[os.date('%Y-%m-%d', t)] = list[#list]
    end
    for _, history in pairs(histories) do
        for _, shift in ipairs(jobShifts(history, job)) do
            local d = index[os.date('%Y-%m-%d', shift.startTime)]
            if d then d.seconds = d.seconds + shift.duration end
        end
    end
    return list
end

function DutySummary(job, employees)
    local stats = DutyStatsFor(job, employees)
    local week, top = 0, {}
    for _, e in ipairs(employees) do
        local s = stats[e.identifier]
        if s then
            week = week + s.week
            if s.week > 0 then top[#top + 1] = { name = e.name, seconds = s.week, gradeLabel = e.gradeLabel } end
        end
    end
    table.sort(top, function(a, b) return a.seconds > b.seconds end)
    while #top > 5 do table.remove(top) end
    return { week = week, top = top }
end

Action('duty', 'duty', function(source, access)
    local employees = GetEmployees(access.job)
    local histories = rowsFor(idsOf(employees))
    local stats = DutyStatsFor(access.job, employees, histories)
    local list = {}
    for _, e in ipairs(employees) do
        list[#list + 1] = {
            identifier = e.identifier, name = e.name, gradeLabel = e.gradeLabel, grade = e.grade, online = e.online,
            onDuty = e.onDuty, stats = stats[e.identifier], manageable = CanManage(access, e.identifier, e.grade),
        }
    end
    return { employees = list, days = hoursByDay(access.job, histories, 14) }
end)

local function employeeFor(access, identifier, needManage)
    if type(identifier) ~= 'string' then return nil, 'invalid' end
    local e = FindEmployee(access.job, identifier)
    if not e then return nil, 'not_found' end
    if needManage and not CanManage(access, e.identifier, e.grade) then return nil, 'hierarchy' end
    return e
end

Action('dutyShifts', 'duty', function(source, access, identifier)
    local e, code = employeeFor(access, identifier, false)
    if not e then return Err(code) end
    local history = rowsFor({ e.identifier })[e.identifier]
    return { shifts = jobShifts(history, access.job), manageable = CanManage(access, e.identifier, e.grade) }
end)

local function loadHistory(identifier)
    local row = MySQL.single.await('SELECT `history` FROM `yecoyz_duty` WHERE `identifier` = ? LIMIT 1', { identifier })
    return row and DecodeJson(row.history) or nil, row ~= nil
end

local function saveHistory(identifier, history, exists)
    if exists then
        return (MySQL.update.await('UPDATE `yecoyz_duty` SET `history` = ? WHERE `identifier` = ?', { json.encode(history), identifier }) or 0) > 0
    end
    return MySQL.insert.await('INSERT INTO `yecoyz_duty` (`identifier`, `history`, `jobs`) VALUES (?, ?, ?)', { identifier, json.encode(history), '{}' }) ~= nil
end

-- The shift at `index`, if it still is the one the boss saw (same start time) and belongs to this job.
local function pickShift(history, index, key, job)
    local shift = history and history[tonumber(index) or 0]
    if not shift or (shift.job ~= nil and shift.job ~= job) then return nil end
    local start = shiftStart(shift)
    if not start or start ~= tonumber(key) then return nil end
    return shift, start
end

local function maxDuration() return Config.Duty.MaxShiftHours * 3600 end

Action('dutyEdit', 'duty', function(source, access, identifier, index, key, duration)
    if not Config.Duty.AllowEdit then return Err('disabled') end
    local e, code = employeeFor(access, identifier, true)
    if not e then return Err(code) end
    duration = math.floor(tonumber(duration) or 0)
    if duration < 60 or duration > maxDuration() then return Err('invalid_duration') end
    local history, exists = loadHistory(e.identifier)
    local shift, start = pickShift(history, index, key, access.job)
    if not shift then return Err('shift_changed') end

    local old = math.floor(tonumber(shift.duration) or 0)
    shift.duration = duration
    shift.startTime = start
    shift.endTime = start + duration
    shift.endTimeFormatted = os.date('%Y-%m-%d %H:%M:%S', shift.endTime)
    shift.edited = { by = access.name, at = os.time(), originalDuration = (shift.edited and shift.edited.originalDuration) or old }
    if not saveHistory(e.identifier, history, exists) then return Err('failed') end
    Log(access, 'duty', 'duty_edit', e.identifier, e.name, nil, ('%d -> %d min'):format(old // 60, duration // 60))
    return { ok = true }
end)

Action('dutyRemove', 'duty', function(source, access, identifier, index, key)
    if not Config.Duty.AllowRemove then return Err('disabled') end
    local e, code = employeeFor(access, identifier, true)
    if not e then return Err(code) end
    local history, exists = loadHistory(e.identifier)
    local shift = pickShift(history, index, key, access.job)
    if not shift then return Err('shift_changed') end
    table.remove(history, tonumber(index))
    if not saveHistory(e.identifier, history, exists) then return Err('failed') end
    Log(access, 'duty', 'duty_remove', e.identifier, e.name, nil, ('%d min'):format((tonumber(shift.duration) or 0) // 60))
    return { ok = true }
end)

-- A shift added by hand: start (epoch seconds) and duration in seconds, not in the future.
Action('dutyAdd', 'duty', function(source, access, identifier, start, duration)
    if not Config.Duty.AllowAdd then return Err('disabled') end
    local e, code = employeeFor(access, identifier, true)
    if not e then return Err(code) end
    start = math.floor(tonumber(start) or 0)
    duration = math.floor(tonumber(duration) or 0)
    if duration < 60 or duration > maxDuration() then return Err('invalid_duration') end
    if start <= 0 or start + duration > os.time() or start < os.time() - 90 * DAY then return Err('invalid_time') end

    local history, exists = loadHistory(e.identifier)
    history = history or {}
    local data = JobData(access.job)
    history[#history + 1] = {
        job = access.job, jobLabel = data and data.label or access.jobLabel,
        startTime = start, endTime = start + duration, duration = duration,
        startTimeFormatted = os.date('%Y-%m-%d %H:%M:%S', start), endTimeFormatted = os.date('%Y-%m-%d %H:%M:%S', start + duration),
        edited = { by = access.name, at = os.time(), originalDuration = 0 }, manual = true,
    }
    if not saveHistory(e.identifier, history, exists) then return Err('failed') end
    Log(access, 'duty', 'duty_add', e.identifier, e.name, nil, ('%d min'):format(duration // 60))
    return { ok = true }
end)

Action('dutyForceOff', 'duty', function(source, access, identifier)
    if not Config.Duty.AllowForceOff then return Err('disabled') end
    local e, code = employeeFor(access, identifier, true)
    if not e then return Err(code) end
    if not e.online or not e.source then return Err('offline') end
    local ok = pcall(function() exports[Config.Duty.Resource]:SetDuty(e.source, false) end)
    if not ok then return Err('failed') end
    Log(access, 'duty', 'duty_forceoff', e.identifier, e.name)
    Notify(e.source, 'notify_forced_off', 'warning', access.name)
    return { ok = true }
end)
