// 随机逻辑（浏览器和 Node 通用，便于测试）

(function () {
const DATA = (typeof window !== "undefined" && window.DATA) || globalThis.DATA;

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// 从列表中随机取出 n 个不重复元素
function pickN(list, n) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

function sum(items) {
  return items.reduce((s, it) => s + it.price, 0);
}

function computePrice(l) {
  return (
    l.primary.price +
    sum(l.primaryAtts) +
    l.armor.price +
    l.helmet.price +
    l.backpack.price +
    l.rig.price
  );
}

// 按排除类别过滤主武器池
function getWeaponPool(excludedCats) {
  const ex = excludedCats || [];
  return ex.length ? DATA.weapons.filter((w) => !ex.includes(w.cat)) : DATA.weapons;
}

function maxPrice(list) {
  return list.reduce((m, x) => Math.max(m, x.price), 0);
}

function slotOf(item) {
  return (item && item.slot) || "通用";
}

// 按槽位分组的配件池（同槽位配件互斥，一个槽位最多装一个）
function attachmentGroups() {
  const groups = {};
  for (const a of DATA.attachments) {
    const key = slotOf(a);
    (groups[key] = groups[key] || []).push(a);
  }
  return groups;
}

// 同槽位互斥下配件能达到的理论最高总值（取价格最高的 3 个槽位）
function maxAttachmentValue() {
  return Object.values(attachmentGroups())
    .map((list) => maxPrice(list))
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((s, x) => s + x, 0);
}

// 当前枪械池 + 装备池理论上能达到的最高战备值
function maxAchievable(excludedCats) {
  const pool = getWeaponPool(excludedCats);
  return (
    maxPrice(pool) +
    maxAttachmentValue() +
    maxPrice(DATA.armor) +
    maxPrice(DATA.helmets) +
    maxPrice(DATA.backpacks) +
    maxPrice(DATA.rigs)
  );
}

/**
 * 根据战备门槛和价值档位，计算目标战备区间
 * tier: "low" | "mid" | "high" | "random"(默认)
 */
function getTierRange(target, tier, excludedCats) {
  const req = Math.max(0, target || 0);
  if (!tier || tier === "random") {
    return req > 0 ? { min: req, max: req * 1.7 } : { min: 0, max: Infinity };
  }
  if (req > 0) {
    if (tier === "low") return { min: req, max: req * 1.25 };
    if (tier === "mid") return { min: req * 1.2, max: req * 1.75 };
    if (tier === "high") {
      return { min: req * 1.7, max: Math.min(req * 2.5, maxAchievable(excludedCats)) };
    }
  } else {
    if (tier === "low") return { min: 0, max: 80000 };
    if (tier === "mid") return { min: 80000, max: 200000 };
    if (tier === "high") return { min: 200000, max: Infinity };
  }
  return { min: req, max: Infinity };
}

// 判断某个槽位是否被锁定（配件槽按位置判断）
function isSlotLocked(locks, key, index) {
  if (!locks) return false;
  if (key === "primaryAtts") {
    return Array.isArray(locks.primaryAtts) && locks.primaryAtts[index] === true;
  }
  return locks[key] === true;
}

// 生成一套配装；prev 为上一套配装（用于保留锁定项），locks 为锁定标记
function generateLoadout(excludedCats, prev, locks) {
  const keep = (key, pick) => (locks && prev && locks[key] ? prev[key] : pick());
  const primary = keep("primary", () => pickOne(getWeaponPool(excludedCats)));
  // 弹药：口径跟随主武器；只有主武器同时被锁定时，弹药才允许单独锁定
  const primaryLocked = !!(locks && locks.primary && prev && prev.primary);
  const ammo = (primaryLocked && locks && locks.ammo && prev && prev.ammo)
    ? prev.ammo
    : pickAmmoFor(primary);
  const armor = keep("armor", () => pickOne(DATA.armor));
  const helmet = keep("helmet", () => pickOne(DATA.helmets));
  const backpack = keep("backpack", () => pickOne(DATA.backpacks));
  const rig = keep("rig", () => pickOne(DATA.rigs));

  // 配件：按位置保留被锁定的配件；其余位置从“未占用槽位”中随机，同槽位最多一个
  const lockedAtts = (locks && prev && Array.isArray(locks.primaryAtts))
    ? prev.primaryAtts.filter((_, i) => locks.primaryAtts[i])
    : [];
  const groups = attachmentGroups();
  const slotKeys = Object.keys(groups);
  let primaryAtts;
  if (lockedAtts.length) {
    const usedSlots = new Set(lockedAtts.map(slotOf));
    const freeSlots = slotKeys.filter((s) => !usedSlots.has(s));
    const picks = pickN(freeSlots, 3 - lockedAtts.length).map((s) => pickOne(groups[s]));
    primaryAtts = prev.primaryAtts.map((it, i) => (locks.primaryAtts[i] ? it : picks.pop()));
  } else {
    primaryAtts = pickN(slotKeys, 3).map((s) => pickOne(groups[s]));
  }

  const loadout = { primary, primaryAtts, ammo, armor, helmet, backpack, rig };
  loadout.price = computePrice(loadout);
  return loadout;
}

// 为主武器随机一档弹药（口径固定跟随枪械）
function pickAmmoFor(weapon) {
  const tier = pickOne(DATA.ammoTiers);
  return { caliber: weapon.caliber, level: tier.level, name: tier.name, price: tier.price };
}

// 按价格加权随机取一个
function pickWeighted(items) {
  const total = items.reduce((s, x) => s + x.price, 0);
  let r = Math.random() * total;
  for (const x of items) {
    r -= x.price;
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}

// 把一个槽位里的某件装备换成另一件（保持数组去重）
function replaceItem(l, key, oldItem, newItem) {
  const next = { ...l };
  if (Array.isArray(l[key])) {
    next[key] = l[key].map((x) => (x.name === oldItem.name ? newItem : x));
  } else {
    next[key] = newItem;
  }
  next.price = computePrice(next);
  return next;
}

// 换掉最便宜的一件装备：从同类别里随机换一件更贵的（跳过锁定项）
function upgradeCheapest(l, weaponPool, locks) {
  const slots = [
    { key: "primary", items: [l.primary], pool: weaponPool },
    { key: "primaryAtts", items: l.primaryAtts, pool: DATA.attachments },
    { key: "armor", items: [l.armor], pool: DATA.armor },
    { key: "helmet", items: [l.helmet], pool: DATA.helmets },
    { key: "backpack", items: [l.backpack], pool: DATA.backpacks },
    { key: "rig", items: [l.rig], pool: DATA.rigs }
  ];

  let cheapest = null;
  for (const slot of slots) {
    for (let i = 0; i < slot.items.length; i++) {
      if (isSlotLocked(locks, slot.key, i)) continue;
      const item = slot.items[i];
      // 配件：可换到同槽位或其他未被占用的槽位，保证每槽最多一个
      const otherSlots = new Set(slot.items.map(slotOf));
      otherSlots.delete(slotOf(item));
      const higher = slot.pool.filter((x) => x.price > item.price
        && (slot.key !== "primaryAtts" || !otherSlots.has(slotOf(x)))
        && !slot.items.some((y) => y.name === x.name));
      if (higher.length && (!cheapest || item.price < cheapest.item.price)) {
        cheapest = { slot, item, higher };
      }
    }
  }
  if (!cheapest) return l;
  return replaceItem(l, cheapest.slot.key, cheapest.item, pickWeighted(cheapest.higher));
}

// 换掉最贵的一件装备：从同类别里随机换一件更便宜的（跳过锁定项）
function downgradePriciest(l, weaponPool, locks) {
  const slots = [
    { key: "primary", items: [l.primary], pool: weaponPool },
    { key: "primaryAtts", items: l.primaryAtts, pool: DATA.attachments },
    { key: "armor", items: [l.armor], pool: DATA.armor },
    { key: "helmet", items: [l.helmet], pool: DATA.helmets },
    { key: "backpack", items: [l.backpack], pool: DATA.backpacks },
    { key: "rig", items: [l.rig], pool: DATA.rigs }
  ];

  let priciest = null;
  for (const slot of slots) {
    for (let i = 0; i < slot.items.length; i++) {
      if (isSlotLocked(locks, slot.key, i)) continue;
      const item = slot.items[i];
      // 配件：可换到同槽位或其他未被占用的槽位，保证每槽最多一个
      const otherSlots = new Set(slot.items.map(slotOf));
      otherSlots.delete(slotOf(item));
      const lower = slot.pool.filter((x) => x.price < item.price
        && (slot.key !== "primaryAtts" || !otherSlots.has(slotOf(x)))
        && !slot.items.some((y) => y.name === x.name));
      if (lower.length && (!priciest || item.price > priciest.item.price)) {
        priciest = { slot, item, lower };
      }
    }
  }
  if (!priciest) return l;
  return replaceItem(l, priciest.slot.key, priciest.item, pickWeighted(priciest.lower));
}

/**
 * 生成一套落在目标战备区间内的配装
 * 先随机生成，不足就逐级升级装备，超出上限太多就降级；锁定项全程保持
 */
function generateLoadoutForTarget(target, excludedCats, tier, prev, locks, valueCap) {
  const range = getTierRange(target, tier, excludedCats);
  // 装备价值锁：作为硬性上限；若低于战备门槛则优先保门槛，尽力收敛
  if (valueCap > 0 && valueCap < range.max) range.max = valueCap;
  const pool = getWeaponPool(excludedCats);
  let l = generateLoadout(excludedCats, prev, locks);
  let guard = 0;
  while (l.price < range.min && guard < 120) {
    const next = upgradeCheapest(l, pool, locks);
    if (next.price === l.price) break; // 已经无法再升级
    l = next;
    guard++;
  }

  guard = 0;
  while (l.price > range.max && guard < 120) {
    const next = downgradePriciest(l, pool, locks);
    if (next.price === l.price || next.price < range.min) break;
    l = next;
    guard++;
  }

  return l;
}

/**
 * 生成一队人的随机配装
 * @param {object} opts 配置对象（与 state.js 中的配置字段一一对应）
 * @param {number} opts.count 人数 1~3
 * @param {boolean} opts.sameEquip 装备是否全员相同
 * @param {boolean} opts.sameOperator 干员是否全员相同
 * @param {boolean} opts.operatorEnabled 干员是否参与随机（false = 固定干员）
 * @param {number} opts.target 每人的战备门槛（哈夫币），0 表示无要求
 * @param {string[]} opts.excludedCats 需要排除的枪械类别，如 ["手枪", "霰弹枪"]
 * @param {string} opts.tier 价值档位："low" | "mid" | "high" | "random"(默认)
 * @param {Array<object>} opts.locks 每名队员的锁定标记数组（长度不超过人数）
 * @param {object} opts.prev 上一轮结果（含 players），用于保留锁定项
 */
function generateParty(opts) {
  const cfg = opts || {};
  const n = Math.max(1, Math.min(3, cfg.count || 1));
  const req = Math.max(0, cfg.target || 0);
  const teamLocks = Array.isArray(cfg.locks) ? cfg.locks : [];
  const sameEquip = !!cfg.sameEquip;
  const sameOperator = !!cfg.sameOperator;
  const operatorEnabled = cfg.operatorEnabled !== false;
  const prev = cfg.prev || null;
  const lockOf = (i) => (sameEquip ? teamLocks[0] : teamLocks[i]) || null;
  const prevOf = (i) => (prev && prev.players && prev.players[sameEquip ? 0 : i]) || null;

  // 锁定干员的读取：只有上一轮存在该队员时才生效
  const lockedOpOf = (i) => {
    const lo = lockOf(i);
    const pv = prevOf(i);
    return lo && lo.operator && pv ? pv.operator : null;
  };

  let operators;
  if (!operatorEnabled) {
    // 干员固定：沿用上一轮结果，新增队员才随机补位
    operators = Array.from({ length: n }, (_, i) => {
      const pv = prevOf(i);
      return pv && pv.operator ? pv.operator : pickOne(DATA.operators);
    });
  } else if (sameOperator) {
    const lockedOp = lockedOpOf(0);
    operators = Array(n).fill(lockedOp || pickOne(DATA.operators));
  } else {
    // 各自随机：允许重复干员，仅保留本人锁定的干员
    operators = Array.from({ length: n }, (_, i) => lockedOpOf(i) || pickOne(DATA.operators));
  }

  const makeLoadout = (i) => generateLoadoutForTarget(req, cfg.excludedCats || [], cfg.tier, prevOf(i), lockOf(i), cfg.valueCap);
  const loadouts = sameEquip
    ? [makeLoadout(0)]
    : Array.from({ length: n }, (_, i) => makeLoadout(i));

  const players = [];
  for (let i = 0; i < n; i++) {
    players.push({
      operator: operators[i],
      ...loadouts[sameEquip ? 0 : i]
    });
  }

  return {
    totalPrice: players.reduce((s, p) => s + p.price, 0),
    players
  };
}

const api = { generateParty, generateLoadout, generateLoadoutForTarget, pickOne, pickN, DATA };

// 浏览器：挂到全局供 app.js 使用
// Node (ESM/CJS)：支持两种导出方式，方便测试
if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
  if (typeof globalThis !== "undefined") globalThis.LoadoutCore = api;
} else if (typeof globalThis !== "undefined") {
  globalThis.LoadoutCore = api;
}
})();
