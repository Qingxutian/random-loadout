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

// 当前枪械池 + 装备池理论上能达到的最高战备值
function maxAchievable(excludedCats) {
  const pool = getWeaponPool(excludedCats);
  return (
    maxPrice(pool) +
    3 * maxPrice(DATA.attachments) +
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

function generateLoadout(excludedCats) {
  const primary = pickOne(getWeaponPool(excludedCats));
  const primaryAtts = pickN(DATA.attachments, 3);
  const armor = pickOne(DATA.armor);
  const helmet = pickOne(DATA.helmets);
  const backpack = pickOne(DATA.backpacks);
  const rig = pickOne(DATA.rigs);

  const loadout = {
    primary,
    primaryAtts,
    armor,
    helmet,
    backpack,
    rig
  };
  loadout.price = computePrice(loadout);
  return loadout;
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

// 换掉最便宜的一件装备：从同类别里随机换一件更贵的
function upgradeCheapest(l, weaponPool) {
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
    for (const item of slot.items) {
      const higher = slot.pool.filter((x) => x.price > item.price && !slot.items.some((y) => y.name === x.name));
      if (higher.length && (!cheapest || item.price < cheapest.item.price)) {
        cheapest = { slot, item, higher };
      }
    }
  }
  if (!cheapest) return l;
  return replaceItem(l, cheapest.slot.key, cheapest.item, pickWeighted(cheapest.higher));
}

// 换掉最贵的一件装备：从同类别里随机换一件更便宜的
function downgradePriciest(l, weaponPool) {
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
    for (const item of slot.items) {
      const lower = slot.pool.filter((x) => x.price < item.price && !slot.items.some((y) => y.name === x.name));
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
 * 先随机生成，不足就逐级升级装备，超出上限太多就降级
 */
function generateLoadoutForTarget(target, excludedCats, tier) {
  const range = getTierRange(target, tier, excludedCats);
  const pool = getWeaponPool(excludedCats);
  let l = generateLoadout(excludedCats);
  let guard = 0;
  while (l.price < range.min && guard < 120) {
    const next = upgradeCheapest(l, pool);
    if (next.price === l.price) break; // 已经无法再升级
    l = next;
    guard++;
  }

  guard = 0;
  while (l.price > range.max && guard < 120) {
    const next = downgradePriciest(l, pool);
    if (next.price === l.price || next.price < range.min) break;
    l = next;
    guard++;
  }

  return l;
}

/**
 * 生成一队人的随机配装
 * @param {number} count 人数 1~3
 * @param {boolean} sameEquip 装备是否全员相同
 * @param {boolean} sameOperator 干员是否全员相同
 * @param {number} target 每人的战备门槛（哈夫币），0 表示无要求
 * @param {string[]} excludedCats 需要排除的枪械类别，如 ["手枪", "霰弹枪"]
 * @param {string} tier 价值档位："low" | "mid" | "high" | "random"(默认)
 */
function generateParty(count, sameEquip, sameOperator, target, excludedCats, tier) {
  const n = Math.max(1, Math.min(3, count || 1));
  const req = Math.max(0, target || 0);

  let operators;
  if (sameOperator) {
    operators = Array(n).fill(pickOne(DATA.operators));
  } else {
    // 干员互不相同；若人数超过干员总数则退化为允许重复
    operators = n <= DATA.operators.length
      ? pickN(DATA.operators, n)
      : Array.from({ length: n }, () => pickOne(DATA.operators));
  }

  const makeLoadout = () => generateLoadoutForTarget(req, excludedCats, tier);
  const loadouts = sameEquip
    ? [makeLoadout()]
    : Array.from({ length: n }, makeLoadout);

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
} else if (typeof globalThis !== "undefined") {
  globalThis.LoadoutCore = api;
}
})();
