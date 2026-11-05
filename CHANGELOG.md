# Changelog

## 1.0.3

- Deposits and withdrawals have a cooldown per player (`Config.Economy.Cooldown`, 3 seconds by default, 0 turns it off).
- Players that join get the computer list through a callback instead of a request event.

## 1.0.2

- Qbox: you now get the keys of a vehicle bought in the menu. The keys are given on the server through yecoyz_core (qbx_vehiclekeys, wasabi_carlock, Renewed-Vehiclekeys, qb-vehiclekeys), and ox_fuel gets a full tank for everyone.
- Needs yecoyz_core 1.4.0.

## 1.0.1

- Better performance near a computer: the monitor screen is worked out once instead of every frame and is not drawn when it is off screen, and the check for small props on the desk skips everything that is not close to the monitor.
- The duty page loads shift history once instead of twice, and the activity log and item history read through the log index, so they stay fast as the log grows.

## 1.0.0

First release.

- Boss menu on an in-world computer: the camera moves in and the menu is used on the monitor, or over the whole screen.
- Staff: hire players near the computer, fire, promote, personal salaries and bonuses.
- Ranks: create, rename, reorder and delete ranks and change their salaries, for online and offline employees. New ranks go below the boss rank.
- Access for single employees and per rank, with rank rules.
- Work items bought with company money, straight into the buyer's inventory, with a list per job.
- Work vehicles bought with company money, into the job garage of zyke_garages, jg-advancedgarages, qb-garages, qbx_garages or esx_garage, or spawned at the computer.
- Company account: dashboard, deposits, withdrawals and history.
- yecoyz_duty statistics and shift management.
- In-game creator: pick a job and set up its computers and vehicle spawns, its vehicle and item shop (with your own pictures), the pages it can use and what each rank gets. Example shops for police, ambulance and mechanic are in `sql/presets.sql`. Monitors come with a keyboard and mouse, and small props in the way are hidden.
- Every feature can be turned off in the config.
- Needs yecoyz_core 1.3.0 or newer.
