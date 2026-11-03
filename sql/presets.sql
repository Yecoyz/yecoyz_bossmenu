-- yecoyz_bossmenu: example vehicle and item shops for police, ambulance and mechanic.
--
-- Optional. Run it once in your database (HeidiSQL, phpMyAdmin, ...) if you want a starting point, then change the
-- lists in game with /bossmenucreator. Running it again never overwrites a list that already exists for a job; delete
-- that job's row in `yecoyz_bossmenu_shop` first if you want the preset back.

CREATE TABLE IF NOT EXISTS `yecoyz_bossmenu_shop` (
    `job` varchar(64) NOT NULL,
    `kind` varchar(16) NOT NULL,
    `items` longtext NOT NULL,
    `updated_by` varchar(100) DEFAULT NULL,
    `updated_at` int(11) unsigned NOT NULL DEFAULT 0,
    PRIMARY KEY (`job`, `kind`)
);

-- Vehicles. grade = lowest rank that can buy it. Optional: garage, useGrade (lowest rank that may drive it), image.
INSERT IGNORE INTO `yecoyz_bossmenu_shop` (`job`, `kind`, `items`, `updated_by`, `updated_at`) VALUES
('police', 'vehicle', '[{"model":"police","label":"Police Cruiser","price":25000,"grade":0,"category":"Patrol"},{"model":"police2","label":"Police Buffalo","price":35000,"grade":1,"category":"Patrol"},{"model":"police3","label":"Police Interceptor","price":45000,"grade":2,"category":"Patrol"},{"model":"policeb","label":"Police Bike","price":15000,"grade":1,"category":"Bikes"},{"model":"fbi","label":"Unmarked Buffalo","price":60000,"grade":3,"category":"Unmarked"},{"model":"riot","label":"Riot Van","price":90000,"grade":3,"category":"Special"}]', 'preset', UNIX_TIMESTAMP()),
('ambulance', 'vehicle', '[{"model":"ambulance","label":"Ambulance","price":30000,"grade":0,"category":"Emergency"}]', 'preset', UNIX_TIMESTAMP()),
('mechanic', 'vehicle', '[{"model":"towtruck","label":"Tow Truck","price":20000,"grade":0,"category":"Towing"},{"model":"flatbed","label":"Flatbed","price":35000,"grade":1,"category":"Towing"}]', 'preset', UNIX_TIMESTAMP());

-- Items. name = the item name in your inventory. Optional: max (most bought at once), image.
INSERT IGNORE INTO `yecoyz_bossmenu_shop` (`job`, `kind`, `items`, `updated_by`, `updated_at`) VALUES
('police', 'item', '[{"name":"radio","label":"Radio","price":250,"grade":0,"category":"Equipment"},{"name":"bandage","label":"Bandage","price":50,"grade":0,"category":"Medical"},{"name":"armour","label":"Body Armour","price":1500,"grade":1,"category":"Equipment"},{"name":"WEAPON_STUNGUN","label":"Taser","price":2500,"grade":1,"category":"Weapons","max":1},{"name":"WEAPON_PISTOL","label":"Pistol","price":5000,"grade":2,"category":"Weapons","max":1}]', 'preset', UNIX_TIMESTAMP()),
('ambulance', 'item', '[{"name":"bandage","label":"Bandage","price":50,"grade":0,"category":"Medical"},{"name":"medikit","label":"Medikit","price":500,"grade":0,"category":"Medical"}]', 'preset', UNIX_TIMESTAMP()),
('mechanic', 'item', '[{"name":"fixkit","label":"Repair Kit","price":750,"grade":0,"category":"Tools"}]', 'preset', UNIX_TIMESTAMP());
