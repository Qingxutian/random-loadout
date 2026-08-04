// 简单的逻辑自测：node selftest.mjs
import "./data.js";
import "./core.js";

const { generateParty } = globalThis.LoadoutCore;

const cases = [
  [1, true, true],
  [1, false, false],
  [2, true, true],
  [2, false, true],
  [2, true, false],
  [2, false, false],
  [3, true, true],
  [3, false, false],
  [3, true, false],
  [3, false, true]
];

for (const [n, se, so] of cases) {
  const r = generateParty(n, se, so, 0);
  const ops = r.players.map((p) => p.operator.name).join(",");
  const uniqueOps = new Set(r.players.map((p) => p.operator.name)).size;
  const prices = r.players.map((p) => p.price).join("/");
  console.log(
    `n=${n} equip=${se ? "same" : "diff"} op=${so ? "same" : "diff"} | ` +
    `干员[${uniqueOps}个不同] ${ops} | 战备=${prices} 总值=${r.totalPrice}`
  );
}

// 战备门槛测试
const prison = generateParty(1, false, false, 780000);
console.log(
  `潮汐监狱（绝密 78 万）：战备=${prison.players[0].price} ` +
  `${prison.players[0].price >= 780000 ? "达标 ✓" : "不达标 ✗"}`
);

const classified = generateParty(2, false, false, 187500);
console.log(
  `机密门槛（18.75 万）：每人都达标 = ${classified.players.every((p) => p.price >= 187500)} ` +
  `| 战备=${classified.players.map((p) => p.price).join("/")}`
);

// 枪械排除测试
const excluded = generateParty(1, false, false, 0, ["手枪", "栓动狙击", "霰弹枪"]);
const cat = excluded.players[0].primary.cat;
console.log(
  "排除测试：主武器类别 =", cat,
  "| 未出现排除项 =", !["手枪", "栓动狙击", "霰弹枪"].includes(cat)
);

// 副武器移除测试
const noSecondary = generateParty(1, false, false);
console.log("副武器槽位已移除 =", noSecondary.players[0].secondary === undefined);

// 价值档位测试
const low = generateParty(1, false, false, 187500, [], "low");
const lowPrice = low.players[0].price;
console.log(
  `低价值（机密门槛 18.75 万）：战备=${lowPrice} ` +
  `达标=${lowPrice >= 187500} 未超 24 万=${lowPrice <= 240000}`
);

const mid = generateParty(1, false, false, 0, [], "mid");
const midPrice = mid.players[0].price;
console.log(`中价值（无门槛）：战备=${midPrice} 在 [8万, 20万] = ${midPrice >= 80000 && midPrice <= 200000}`);

const high = generateParty(1, false, false, 0, [], "high");
const highPrice = high.players[0].price;
console.log(`高价值（无门槛）：战备=${highPrice} ≥ 20 万 = ${highPrice >= 200000}`);
