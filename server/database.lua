-- Tables are created on start, nothing has to be imported.
DB = { Ready = false }

CreateThread(function()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `yecoyz_bossmenu_computers` (
            `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
            `job` varchar(64) NOT NULL,
            `label` varchar(64) DEFAULT NULL,
            `model` varchar(64) NOT NULL,
            `coords` longtext NOT NULL,
            `spawn` longtext DEFAULT NULL,
            `created_by` varchar(100) DEFAULT NULL,
            `created_at` int(11) unsigned NOT NULL DEFAULT 0,
            PRIMARY KEY (`id`)
        )
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `yecoyz_bossmenu_access` (
            `job` varchar(64) NOT NULL,
            `identifier` varchar(100) NOT NULL,
            `permissions` longtext NOT NULL,
            PRIMARY KEY (`job`, `identifier`)
        )
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `yecoyz_bossmenu_salaries` (
            `job` varchar(64) NOT NULL,
            `identifier` varchar(100) NOT NULL,
            `salary` int(11) unsigned NOT NULL,
            PRIMARY KEY (`job`, `identifier`)
        )
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `yecoyz_bossmenu_logs` (
            `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
            `job` varchar(64) NOT NULL,
            `category` varchar(16) NOT NULL,
            `action` varchar(32) NOT NULL,
            `actor` varchar(100) DEFAULT NULL,
            `actor_name` varchar(100) DEFAULT NULL,
            `target` varchar(100) DEFAULT NULL,
            `target_name` varchar(100) DEFAULT NULL,
            `amount` int(11) DEFAULT NULL,
            `details` varchar(255) DEFAULT NULL,
            `created_at` int(11) unsigned NOT NULL,
            PRIMARY KEY (`id`),
            KEY `job_time` (`job`, `created_at`)
        )
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `yecoyz_bossmenu_payouts` (
            `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
            `identifier` varchar(100) NOT NULL,
            `job` varchar(64) NOT NULL,
            `amount` int(11) unsigned NOT NULL,
            `account` varchar(32) NOT NULL,
            `reason` varchar(100) DEFAULT NULL,
            `created_at` int(11) unsigned NOT NULL,
            PRIMARY KEY (`id`),
            KEY `identifier` (`identifier`)
        )
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `yecoyz_bossmenu_vehicles` (
            `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
            `job` varchar(64) NOT NULL,
            `model` varchar(64) NOT NULL,
            `label` varchar(64) DEFAULT NULL,
            `plate` varchar(16) NOT NULL,
            `price` int(11) unsigned NOT NULL,
            `bought_by` varchar(100) DEFAULT NULL,
            `bought_by_name` varchar(100) DEFAULT NULL,
            `created_at` int(11) unsigned NOT NULL,
            PRIMARY KEY (`id`),
            KEY `job` (`job`)
        )
    ]])
    DB.Ready = true
    TriggerEvent('yecoyz_bossmenu:dbReady')
end)

function DB.Await()
    while not DB.Ready do Wait(50) end
end

function DecodeJson(value, fallback)
    if type(value) ~= 'string' or value == '' then return fallback or {} end
    local ok, result = pcall(json.decode, value)
    if not ok or type(result) ~= 'table' then return fallback or {} end
    return result
end
