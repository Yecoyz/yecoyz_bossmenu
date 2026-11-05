fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Yecoyz'
description 'Boss menu on an in-world computer: staff, ranks, salaries, bonuses, access, vehicles, economy and duty stats'
version '1.0.3'

shared_scripts {
    '@yecoyz_core/import.lua',
    'config.lua',
    'shared/*.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/database.lua',
    'server/main.lua',
    'server/staff.lua',
    'server/economy.lua',
    'server/vehicles.lua',
    'server/items.lua',
    'server/duty.lua',
    'server/computers.lua',
    'server/shop.lua',
    'server/jobs.lua',
    'server/dev.lua',
}

client_scripts {
    'client/open.lua',
    'client/main.lua',
    'client/computer.lua',
    'client/creator.lua',
    'client/dev.lua',
}

ui_page 'web/dist/index.html'

files {
    'web/dist/index.html',
    'web/dist/assets/*',
    'locales/*.json',
}

dependencies {
    'yecoyz_core',
    'oxmysql',
}
