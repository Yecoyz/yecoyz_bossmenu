-- Permissions that can be given to single employees (Access page) or to grades (Config.Access.GradeDefaults).
-- feature = the Config.Features switch that has to be on for the permission to exist.
Permissions = {
    { name = 'dashboard', feature = 'Dashboard' },
    { name = 'employees', feature = 'Employees' },
    { name = 'hire', feature = 'Hire' },
    { name = 'fire', feature = 'Fire' },
    { name = 'promote', feature = 'Promote' },
    { name = 'grades', feature = 'Grades' },
    { name = 'salaries', feature = 'GradeSalaries' },
    { name = 'bonuses', feature = 'Bonuses' },
    { name = 'vehicles', feature = 'Vehicles' },
    { name = 'items', feature = 'Items' },
    { name = 'economy', feature = 'Economy' },
    { name = 'deposit', feature = 'Deposit' },
    { name = 'withdraw', feature = 'Withdraw' },
    { name = 'duty', feature = 'Duty' },
    { name = 'logs', feature = 'Logs' },
    { name = 'access', feature = 'Access' },
}

PermissionByName = {}
for _, p in ipairs(Permissions) do PermissionByName[p.name] = p end

-- Permissions that only make sense with another one (deposit needs the economy page).
PermissionNeeds = {
    hire = 'employees', fire = 'employees', promote = 'employees', bonuses = 'employees', access = 'employees',
    deposit = 'economy', withdraw = 'economy',
}

function FeatureOn(name)
    return Config.Features[name] == true
end
