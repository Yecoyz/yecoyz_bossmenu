Config = {}

Config.Locale = 'en' -- a file in locales/ (en.json)
Config.Currency = '$'

---------------------------------------------------------------------------------------------------------------------
-- Features. Turn off what you don't want: the page or button disappears from the menu and the server refuses it.
---------------------------------------------------------------------------------------------------------------------
Config.Features = {
    Dashboard = true,        -- overview page with the company's numbers
    Employees = true,        -- staff list (needed for everything below that works on a person)
    Hire = true,             -- hire players standing near the computer
    Fire = true,             -- fire employees, online or offline
    Promote = true,          -- change an employee's rank
    Grades = true,           -- create, rename, reorder and delete ranks
    GradeSalaries = true,    -- change the salary of a rank
    IndividualSalary = true, -- give one employee their own salary (see Config.IndividualSalary)
    Bonuses = true,          -- pay an employee a one-time bonus from the company account
    Access = true,           -- give single employees access to parts of the menu (see Config.Access)
    Vehicles = true,         -- buy work vehicles (see Config.Vehicles)
    Items = true,            -- buy work items into your inventory (see Config.Items)
    Economy = true,          -- company account: balance, history, deposit and withdraw
    Deposit = true,
    Withdraw = true,
    Logs = true,             -- activity log of everything done in the menu
    Duty = true,             -- yecoyz_duty statistics and shift management (only when yecoyz_duty runs)
}

---------------------------------------------------------------------------------------------------------------------
-- Who can use the menu.
---------------------------------------------------------------------------------------------------------------------
Config.Access = {
    -- Grades that get everything. QBCore / Qbox also use the job's own isboss flag.
    -- ESX: grade names. A number here means "this grade and higher".
    BossGrades = { 'boss' },

    -- What other grades get without being given access one by one: [job] = { [minimum grade] = { permissions } }.
    -- Admins can also set this per rank in game (/bossmenucreator, Access tab); that replaces this list for the job.
    -- Permission names are listed in shared/permissions.lua.
    GradeDefaults = {
        -- police = {
        --     [3] = { 'dashboard', 'employees', 'hire', 'duty' },
        -- },
    },

    -- Only these jobs can have a boss menu. Empty = every job.
    Jobs = {},

    -- Someone can never manage an employee with the same or a higher rank than their own (bosses can).
    Hierarchy = true,
}

---------------------------------------------------------------------------------------------------------------------
-- Company money.
---------------------------------------------------------------------------------------------------------------------
-- The company account is the one yecoyz_core uses (its Config.Society: esx_addonaccount, Renewed-Banking, qb-banking, ...).
Config.Economy = {
    PlayerAccount = 'bank', -- the player's account money is deposited from and withdrawn to ('bank' or 'cash')
    MaxTransaction = 1000000, -- largest single deposit or withdrawal
    HistoryDays = 30, -- transactions shown on the economy page
}

Config.Bonuses = {
    Max = 50000, -- largest bonus at once
    Account = 'bank', -- where the employee gets it
    OfflinePayout = true, -- an offline employee gets the bonus the next time they log in
    Cooldown = 0, -- seconds before the same employee can get another bonus (0 = none)
}

-- A personal salary for one employee. The framework still pays the rank salary on its own paycheck; this resource
-- pays the difference up to the personal salary every Interval minutes, from the company account. A personal salary
-- can't be lower than the rank salary (the framework pays that part); give a lower rank instead.
Config.IndividualSalary = {
    Interval = 7, -- minutes, set it to the same as the framework's paycheck (ESX Config.PaycheckInterval)
    Max = 10000,
    FromSociety = true, -- false = the money is created instead of taken from the company account
    OnlyOnDuty = true, -- only pay while on duty (framework duty, or yecoyz_duty when Config.Duty is on)
    Account = 'bank',
}

Config.Grades = {
    MaxGrades = 20, -- most ranks a job can have
    MaxSalary = 25000,
}

Config.Hiring = {
    Distance = 8.0, -- metres from the computer a player has to stand to be hired
    ById = true, -- also allow hiring by server id (the player still has to be near)
}

---------------------------------------------------------------------------------------------------------------------
-- Work vehicles bought through the menu.
---------------------------------------------------------------------------------------------------------------------
Config.Vehicles = {
    -- 'spawn': paid from the company account and spawned at the computer's vehicle spawn (set in the creator).
    -- 'garage': paid from the company account and put in a garage (see Owner).
    Mode = 'spawn',
    -- Garage mode: 'job' puts it in the job's work garage, 'player' in the buyer's own garage. Works with
    -- jg-advancedgarages, zyke_garages, qbx_garages, qb-garages and esx_garage, found by yecoyz_core
    -- (see its Config.Garage). With 'job': zyke_garages and jg-advancedgarages make the job the owner, so everyone
    -- in the job can take it; qbx_garages shares it when the job garage has shared = true; qb-garages and
    -- esx_garage keep the buyer as owner, parked in / marked for the job garage.
    Owner = 'job',
    -- The garage it goes to. nil = yecoyz_core's Config.Garage (JobGarages for 'job', Default for 'player'), else the
    -- garage script's default. One name for every job, or per job: { police = 'mrpd', ambulance = 'pillbox' }.
    -- A shop entry can have its own garage = '...'.
    Garage = nil,
    PlatePrefix = '', -- e.g. 'LSPD' gives plates like LSPD1234. Empty = random plate.
    -- The vehicles each job can buy are set in game: /bossmenucreator, pick the job, Vehicles tab.
    -- Example lists for police, ambulance and mechanic: run sql/presets.sql once.
}

---------------------------------------------------------------------------------------------------------------------
-- Work items bought through the menu: paid from the company account and put in the buyer's inventory.
---------------------------------------------------------------------------------------------------------------------
Config.Items = {
    MaxAmount = 50, -- most of one item bought at once (a shop entry can have a lower max)
    -- Item pictures: 'auto' uses ox_inventory, qb-inventory or ps-inventory's image folder, nil shows an icon, or a
    -- path of your own with %s for the item name, e.g. 'nui://my_inventory/images/%s.png'.
    Images = 'auto',
    -- The items each job can buy are set in game: /bossmenucreator, pick the job, Items tab.
    -- Example lists for police, ambulance and mechanic: run sql/presets.sql once.
}

---------------------------------------------------------------------------------------------------------------------
-- yecoyz_duty integration. Used when Config.Features.Duty is on and yecoyz_duty is started.
---------------------------------------------------------------------------------------------------------------------
Config.Duty = {
    Resource = 'yecoyz_duty',
    AllowEdit = true, -- change how long a shift lasted
    AllowRemove = true, -- remove a shift
    AllowAdd = true, -- add a shift by hand (forgot to clock in)
    AllowForceOff = true, -- end the shift of someone on duty now
    MaxShiftHours = 24,
}

---------------------------------------------------------------------------------------------------------------------
-- Computers.
---------------------------------------------------------------------------------------------------------------------
Config.Computer = {
    ViewDistance = 12.0, -- how close you have to be to see the screen
    SpawnDistance = 60.0, -- props are spawned within this distance
    InteractDistance = 1.6,
    -- 'screen': you look at the monitor and use the menu on it. 'fullscreen': the menu opens over the whole screen.
    Mode = 'screen',
    Animation = { dict = 'anim@heists@prison_heiststation@cop_reactions', clip = 'cop_b_idle' },
    -- A keyboard and mouse in front of every monitor, and the small map props in the way (cups, papers, an old
    -- keyboard) hidden while the computer is spawned. Offsets are metres from the monitor's base: x right, y forward
    -- (negative = towards the user), z up. Set Keyboard or Mouse to false to leave it out, or give a model entry below
    -- its own keyboard = { ... } or mouse = false. They are set on the desk; with no desk under them (the monitor is at
    -- the edge) they are left out, so place the monitor far enough back.
    Desk = {
        Keyboard = { model = 'prop_keyboard_01a', offset = vec3(0.0, -0.33, 0.0), heading = 0.0 },
        Mouse = { model = 'prop_mouse_01a', offset = vec3(0.38, -0.33, 0.0), heading = 0.0 },
        ClearArea = true,
        -- The box around the monitor that is cleared (same axes as the offsets), and the biggest prop that may be
        -- hidden, so desks, walls and shelves always stay.
        Area = { min = vec3(-0.6, -0.6, -0.03), max = vec3(0.6, 0.45, 0.9) },
        MaxSize = 0.9,
        -- Some interiors have decoration built in (no collision) that scripts can't find. Hide those by model name or
        -- hash here: every prop of these models within HideRadius metres of a monitor is hidden.
        HideModels = {},
        HideRadius = 1.0,
    },
    -- Monitor models the creator can place. screen = the corners of the display in model space (top-left,
    -- top-right, bottom-left). Add your own: spawn the prop and adjust the corners until the menu fits.
    Models = {
        { model = 'prop_monitor_w_large', label = 'Wide monitor', screen = { tl = vec3(-0.3776, -0.073, 0.6256), tr = vec3(0.3803, -0.073, 0.6256), bl = vec3(-0.3776, -0.073, 0.1700) } },
    },
}

-- Setting up jobs in game: /bossmenucreator (needs the permission below). Pick a job to place its computers, edit its
-- shops, turn pages off for it and choose what each rank gets.
Config.Creator = {
    Command = 'bossmenucreator',
    Permission = 'group.admin', -- ace, or the ESX group / QBCore permission ('admin')
}

-- Computers set in this file instead of the creator. They can't be edited in game.
Config.Computers = {
    -- { job = 'police', label = 'Chief office', model = 'prop_monitor_w_large', coords = vec4(447.4, -973.5, 30.6, 180.0),
    --   spawn = vec4(446.0, -1025.0, 28.6, 0.0) },
}

-- Open the menu with a command instead of a computer (nil = off). Same access rules.
Config.Command = nil -- e.g. 'bossmenu'

-- Development bridge for testing (dev/request.json). Never turn on on a live server.
Config.DevBridge = false
