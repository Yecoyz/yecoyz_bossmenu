-- Work items (radios, bandages, ...) bought from the company account into the buyer's inventory.

-- Item pictures shown in the shop: the inventory's own image folder, or none (an icon instead).
local function imagePath()
    local path = Config.Items.Images
    if path ~= 'auto' then return path or nil end
    if GetResourceState('ox_inventory') == 'started' then return 'nui://ox_inventory/web/images/%s.png' end
    if GetResourceState('qb-inventory') == 'started' then return 'nui://qb-inventory/html/images/%s.png' end
    if GetResourceState('ps-inventory') == 'started' then return 'nui://ps-inventory/html/images/%s.png' end
    return nil
end

local function maxFor(item)
    return math.max(1, math.min(tonumber(item.max) or Config.Items.MaxAmount, Config.Items.MaxAmount))
end

local function shopFor(job, grade, isBoss)
    local list = {}
    for i, v in ipairs(Shop.Get('item', job)) do
        list[#list + 1] = {
            index = i, name = v.name, label = v.label or v.name, price = v.price, grade = v.grade or 0,
            category = v.category or 'Items', max = maxFor(v), image = v.image, locked = not isBoss and grade < (v.grade or 0),
        }
    end
    return list
end

Action('items', 'items', function(source, access)
    return {
        shop = shopFor(access.job, access.grade, access.isBoss),
        recent = MySQL.query.await("SELECT `id`, `actor_name`, `target_name`, `amount`, `details`, `created_at` FROM `yecoyz_bossmenu_logs` WHERE `job` = ? AND `category` = 'item' ORDER BY `created_at` DESC, `id` DESC LIMIT 50", { access.job }) or {},
        balance = access.perms.economy and Core.GetSocietyMoney(access.job) or nil,
        images = imagePath(),
    }
end)

Action('buyItem', 'items', function(source, access, index, amount, name)
    if Busy(source, 1000) then return Err('busy') end
    local item = Shop.Get('item', access.job)[tonumber(index) or 0]
    if not item or (name and item.name ~= name) then return Err('not_found') end
    amount = math.floor(tonumber(amount) or 0)
    if amount < 1 or amount > maxFor(item) then return Err('invalid_amount') end
    if not access.isBoss and access.grade < (item.grade or 0) then return Err('hierarchy') end
    if not Core.CanCarryItem(source, item.name, amount) then return Err('cant_carry') end

    local total = math.floor(item.price * amount)
    if total > 0 and not Core.RemoveSocietyMoney(access.job, total) then return Err('no_money') end
    if not Core.AddItem(source, item.name, amount) then
        if total > 0 then Core.AddSocietyMoney(access.job, total) end
        return Err('cant_carry')
    end

    Log(access, 'item', 'item', nil, ('%dx %s'):format(amount, item.label or item.name), total)
    return { ok = true, total = total }
end)
