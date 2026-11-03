# yecoyz_bossmenu

A boss menu on a computer in the world. Bosses walk up to a monitor, the camera moves in on the screen and the menu
opens right on it. Everyone else nearby sees the company's screen on the monitor, and who is logged in.

## Features

Every feature can be turned off in `config.lua` (`Config.Features`). A feature that is off disappears from the menu
and the server refuses it.

- **Dashboard**: company balance, staff, online and on duty, payroll, income and expenses for the last 7 days, staff
  per rank, who is online, most hours worked this week and the latest activity.
- **Employees**: everyone in the job, online or offline. Hire players standing near the computer (or by server ID),
  fire, change ranks, give bonuses (offline employees get them at their next login) and set a personal salary.
- **Ranks**: create, rename, reorder and delete ranks and change their salary. Moving a rank up or down swaps it
  with the one next to it, and everyone keeps their rank. New ranks go right below the boss rank, which always stays
  on top.
- **Access**: give single employees parts of the menu, for example only hiring, only buying vehicles or the whole
  economy. Bosses always have everything. Grades can also get access by default (`Config.Access.GradeDefaults`).
- **Economy**: the company account balance, income and expenses per day, every transaction, deposit and withdraw.
- **Vehicles**: buy work vehicles from the company account. They are parked at the computer's vehicle spawn, or put
  in a garage (`Config.Vehicles.Mode`): the job's work garage by default, or the buyer's own garage
  (`Config.Vehicles.Owner`). jg-advancedgarages, zyke_garages, qbx_garages, qb-garages and esx_garage are found
  automatically by yecoyz_core; `Config.Vehicles.Garage` picks the garage, per job if you want.
- **Items**: buy work items (radios, bandages, armour, weapons...) from the company account, straight into the
  buyer's inventory. Each job has its own list with prices and the lowest rank that may buy (`Config.Items`). Item
  pictures come from ox_inventory, qb-inventory or ps-inventory.
- **Duty**: with [yecoyz_duty](https://yecoyz.com/scripts/yecoyz-duty) running, hours per employee (today, week, 30
  days, all time), hours worked per day, and shift management: change how long a shift lasted, remove a shift, add a
  forgotten shift or end someone's shift. Changes show as edited in yecoyz_duty too.
- **Activity log** of everything done in the menu.
- **Creator**: admins set up every job in game with `/bossmenucreator`: place its computers, turn pages on or off, pick
  what each rank gets, and set up its vehicle and item shop
  there too: add, edit and remove entries with prices, ranks and their own pictures, without touching the config. Each monitor gets a keyboard and mouse, and
  small map props in the way (cups, papers, an old monitor) are hidden while it is there (`Config.Computer.Desk`).

## Install

1. Needs [yecoyz_core](https://github.com/Yecoyz/yecoyz_core) 1.3.0 or newer and oxmysql. ESX, QBCore and Qbox
   work through yecoyz_core, and so do the company accounts (esx_addonaccount, Renewed-Banking, qb-banking,
   qb-management or yecoyz_core's own table, see `Config.Society` in yecoyz_core).
2. Put `yecoyz_bossmenu` in your resources and start it after yecoyz_core:

```cfg
ensure oxmysql
ensure yecoyz_core
ensure yecoyz_duty      # optional
ensure yecoyz_bossmenu
```

The database tables are created on the first start.

## Placing computers

Type `/bossmenucreator` (needs `Config.Creator.Permission`, `group.admin` by default). A window opens with every job on
the left; pick one to set up its computers, vehicle and item shops, the pages it can use and what each rank gets.
On the Computers tab, **New computer** asks for a name and the monitor, then you place it where you look:

| Key | |
|---|---|
| E | Place |
| Scroll / Shift + Scroll | Rotate / rotate slowly |
| Page Up / Page Down | Raise / lower |
| Backspace | Cancel (or no vehicle spawn) |

With `Config.Vehicles.Mode = 'spawn'` the next step places the vehicle spawn for that computer. Computers can be moved,
given a new spawn, teleported to and deleted from the list. Computers can also be set in `Config.Computers`.

### Other monitors

`Config.Computer.Models` lists the monitors the creator can place, with the corners of the screen in model space. To
add one, spawn the prop and adjust `tl`, `tr` and `bl` until the menu fits on its screen.

## Who can use it

- Bosses (`Config.Access.BossGrades`, and the job's boss flag on QBCore / Qbox) get everything.
- Others get what is given to them on the employee's **Access** button, plus `Config.Access.GradeDefaults`.
- Nobody can manage someone with the same or a higher rank (`Config.Access.Hierarchy`), and nobody can give access
  they don't have.
- Every action is checked again on the server.

## Personal salaries

The framework keeps paying the rank salary. The boss menu pays the difference up to the personal salary every
`Config.IndividualSalary.Interval` minutes, from the company account. Set the interval to the framework's paycheck
interval. A personal salary can't be lower than the rank salary.

## For other scripts

```lua
-- server
exports.yecoyz_bossmenu:OpenBossMenu(source)   -- opens the menu where the player is (same access rules)
exports.yecoyz_bossmenu:GetAccess(source)      -- { job, grade, isBoss, perms = { hire = true, ... } } or nil
```

`client/open.lua` has hooks for vehicle keys and fuel (`BM.OnVehicleSpawned`) and for hiding your HUD while the menu
is open.

## Config

See `config.lua`. The main parts: `Features`, `Access`, `Economy`, `Bonuses`, `IndividualSalary`, `Grades`,
`Hiring`, `Vehicles`, `Items`, `Duty`, `Computer`, `Creator` and `Command` (open the menu with a
command instead of a computer).

## Example shops

The vehicle and item shops are set up in game and start empty. `sql/presets.sql` has example lists for police,
ambulance and mechanic: run it once in your database to get them. It never overwrites a list a job already has.
