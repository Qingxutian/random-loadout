// 简单的逻辑自测：node selftest.mjs
import "./data.js";
import "./core.js";
import "./state.js";

const { generateParty } = globalThis.LoadoutCore;
const { createState, normalizeState, serialize, parse } = globalThis.LoadoutState;

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
  const r = generateParty({ count: n, sameEquip: se, sameOperator: so });
  const ops = r.players.map((p) => p.operator.name).join(",");
  const uniqueOps = new Set(r.players.map((p) => p.operator.name)).size;
  const prices = r.players.map((p) => p.price).join("/");
  console.log(
    `n=${n} equip=${se ? "same" : "diff"} op=${so ? "same" : "diff"} | ` +
    `干员[${uniqueOps}个不同] ${ops} | 战备=${prices} 总值=${r.totalPrice}`
  );
}

// 战备门槛测试
const prison = generateParty({ count: 1, target: 780000 });
console.log(
  `潮汐监狱（绝密 78 万）：战备=${prison.players[0].price} ` +
  `${prison.players[0].price >= 780000 ? "达标 ✓" : "不达标 ✗"}`
);

const classified = generateParty({ count: 2, target: 187500 });
console.log(
  `机密门槛（18.75 万）：每人都达标 = ${classified.players.every((p) => p.price >= 187500)} ` +
  `| 战备=${classified.players.map((p) => p.price).join("/")}`
);

// 枪械排除测试
const excluded = generateParty({ count: 1, excludedCats: ["手枪", "栓动狙击", "霰弹枪"] });
const cat = excluded.players[0].primary.cat;
console.log(
  "排除测试：主武器类别 =", cat,
  "| 未出现排除项 =", !["手枪", "栓动狙击", "霰弹枪"].includes(cat)
);

// 副武器移除测试
const noSecondary = generateParty({ count: 1 });
console.log("副武器槽位已移除 =", noSecondary.players[0].secondary === undefined);

// 价值档位测试
const low = generateParty({ count: 1, target: 187500, tier: "low" });
const lowPrice = low.players[0].price;
console.log(
  `低价值（机密门槛 18.75 万）：战备=${lowPrice} ` +
  `达标=${lowPrice >= 187500} 未超 24 万=${lowPrice <= 240000}`
);

const mid = generateParty({ count: 1, tier: "mid" });
const midPrice = mid.players[0].price;
console.log(`中价值（无门槛）：战备=${midPrice} 在 [8万, 20万] = ${midPrice >= 80000 && midPrice <= 200000}`);

const high = generateParty({ count: 1, tier: "high" });
const highPrice = high.players[0].price;
console.log(`高价值（无门槛）：战备=${highPrice} ≥ 20 万 = ${highPrice >= 200000}`);

// ===== 单项锁定测试 =====
// 单人：锁定干员、主武器、配件位置 0，连续重随机 30 次都必须保持不变
const lock1 = [{
  operator: true,
  primary: true,
  primaryAtts: [true, false, false],
  armor: false,
  helmet: false,
  backpack: false,
  rig: false
}];
let kept = { op: 0, primary: 0, att0: 0, att1: 0 };
let prevR = generateParty({ count: 1 });
for (let k = 0; k < 30; k++) {
  const next = generateParty({ count: 1, locks: lock1, prev: prevR });
  if (next.players[0].operator.name === prevR.players[0].operator.name) kept.op++;
  if (next.players[0].primary.name === prevR.players[0].primary.name) kept.primary++;
  if (next.players[0].primaryAtts[0].name === prevR.players[0].primaryAtts[0].name) kept.att0++;
  if (next.players[0].primaryAtts[1].name === prevR.players[0].primaryAtts[1].name) kept.att1++;
  prevR = next;
}
console.log(
  `锁定保持（30 次）：干员=${kept.op} 主武器=${kept.primary} 配件1(锁)=${kept.att0} 配件2(未锁)=${kept.att1}`
);
if (kept.op !== 30 || kept.primary !== 30 || kept.att0 !== 30) {
  throw new Error("锁定项未保持");
}

// ===== 配件槽位互斥测试 =====
const SLOT_MAP = {};
for (const a of globalThis.DATA.attachments) {
  SLOT_MAP[a.name] = a.slot;
}
function hasSlotConflict(loadout) {
  const used = new Set();
  for (const a of loadout.primaryAtts) {
    const s = SLOT_MAP[a.name];
    if (used.has(s)) return true;
    used.add(s);
  }
  return false;
}

let noConflict = true;
for (let k = 0; k < 100; k++) {
  const r = generateParty({ count: 3 });
  if (r.players.some((p) => hasSlotConflict(p))) noConflict = false;
}
console.log(`配件槽位互斥（100 轮×3人 无同槽冲突）=${noConflict}`);
if (!noConflict) {
  throw new Error("配件同槽位冲突");
}

// 锁定一个配件后，其余位置也不能与锁定件同槽
let lockAttOk = true;
let prevAtt = generateParty({ count: 1 });
const lockAtt = [{
  operator: false,
  primary: false,
  primaryAtts: [true, false, false],
  ammo: false,
  armor: false,
  helmet: false,
  backpack: false,
  rig: false
}];
for (let k = 0; k < 30; k++) {
  const next = generateParty({ count: 1, locks: lockAtt, prev: prevAtt });
  if (next.players[0].primaryAtts[0].name !== prevAtt.players[0].primaryAtts[0].name) lockAttOk = false;
  if (hasSlotConflict(next.players[0])) lockAttOk = false;
  prevAtt = next;
}
console.log(`配件锁定+互斥（30 次）=${lockAttOk}`);
if (!lockAttOk) {
  throw new Error("配件锁定与槽位互斥冲突");
}

// 高门槛升级过程中也不产生同槽冲突
let highNoConflict = true;
for (let k = 0; k < 30; k++) {
  const r = generateParty({ count: 1, target: 780000 });
  if (hasSlotConflict(r.players[0])) highNoConflict = false;
}
console.log(`高门槛升级配件无冲突（30 轮）=${highNoConflict}`);
if (!highNoConflict) {
  throw new Error("升级过程产生同槽冲突");
}

// 三人·各自随机干员：锁定 1 号队员干员，其余人随机（允许重复）
const lockOps = [
  { operator: true, primary: false, primaryAtts: [false, false, false], armor: false, helmet: false, backpack: false, rig: false },
  { operator: false, primary: false, primaryAtts: [false, false, false], armor: false, helmet: false, backpack: false, rig: false },
  { operator: false, primary: false, primaryAtts: [false, false, false], armor: false, helmet: false, backpack: false, rig: false }
];
const rOpsA = generateParty({ count: 3 });
const rOpsB = generateParty({ count: 3, locks: lockOps, prev: rOpsA });
const lockedOp = rOpsB.players[0].operator.name;
const opNames = rOpsB.players.map((p) => p.operator.name);
console.log(
  `干员锁定：1号=${lockedOp} 全员=[${opNames.join(",")}]（各自随机允许重复）`
);
if (lockedOp !== rOpsA.players[0].operator.name) {
  throw new Error("干员锁定逻辑异常");
}

// 三人·各自随机：允许出现重复干员（200 轮内应能观察到重复）
let seenDup = false;
for (let k = 0; k < 200 && !seenDup; k++) {
  const r = generateParty({ count: 3, sameOperator: false });
  if (new Set(r.players.map((p) => p.operator.name)).size < 3) seenDup = true;
}
console.log(`三人各自随机允许重复（200 轮内出现重复）=${seenDup}`);
if (!seenDup) {
  throw new Error("各自随机未出现重复干员");
}

// 全员相同装备：锁首位队员主武器，全队共用且保持不变
const lockSame = [{
  operator: false,
  primary: true,
  primaryAtts: [false, false, false],
  armor: false,
  helmet: false,
  backpack: false,
  rig: false
}];
const rSameA = generateParty({ count: 3, sameEquip: true });
const rSameB = generateParty({ count: 3, sameEquip: true, locks: lockSame, prev: rSameA });
const samePrimaryOk = rSameB.players.every((p) => p.primary.name === rSameA.players[0].primary.name);
console.log(`全员相同·主武器锁定：全队主武器一致且保持=${samePrimaryOk}`);
if (!samePrimaryOk) {
  throw new Error("全员相同装备的锁定逻辑异常");
}

// 锁定廉价防具挑战高门槛：必须能正常结束且锁定项不被替换
const lockCheap = [{
  operator: false,
  primary: false,
  primaryAtts: [false, false, false],
  armor: true,
  helmet: false,
  backpack: false,
  rig: false
}];
const rCheapA = generateParty({ count: 1 });
const rCheapB = generateParty({ count: 1, target: 780000, locks: lockCheap, prev: rCheapA });
const cheapArmorKept = rCheapB.players[0].armor.name === rCheapA.players[0].armor.name;
console.log(
  `锁定防具挑战 78 万门槛：防具保持=${cheapArmorKept} 最终战备=${rCheapB.players[0].price}`
);
if (!cheapArmorKept) {
  throw new Error("高门槛下锁定防具被替换");
}

// ===== 弹药测试 =====
// 弹药口径必须匹配主武器，等级必须在 1~5 之间
let ammoMatch = true;
let ammoLevelOk = true;
for (let k = 0; k < 50; k++) {
  const r = generateParty({ count: 3 });
  for (const p of r.players) {
    if (p.ammo.caliber !== p.primary.caliber) ammoMatch = false;
    if (p.ammo.level < 1 || p.ammo.level > 5) ammoLevelOk = false;
  }
}
console.log(`弹药口径匹配（50 轮×3人）=${ammoMatch} | 等级在 1~5=${ammoLevelOk}`);
if (!ammoMatch || !ammoLevelOk) {
  throw new Error("弹药口径/等级异常");
}

// 主武器 + 弹药同时锁定：重随机后弹药等级保持不变
const lockAmmo = [{
  operator: false,
  primary: true,
  primaryAtts: [false, false, false],
  ammo: true,
  armor: false,
  helmet: false,
  backpack: false,
  rig: false
}];
let prevAmmo = generateParty({ count: 1 });
let ammoKept = 0;
for (let k = 0; k < 20; k++) {
  const next = generateParty({ count: 1, locks: lockAmmo, prev: prevAmmo });
  if (next.players[0].ammo.level === prevAmmo.players[0].ammo.level) ammoKept++;
  if (next.players[0].primary.name !== prevAmmo.players[0].primary.name) {
    throw new Error("弹药锁定测试中主武器被替换");
  }
  prevAmmo = next;
}
console.log(`弹药锁定（20 次）：等级保持=${ammoKept}/20`);
if (ammoKept !== 20) {
  throw new Error("弹药锁定未生效");
}

// 战备值只算 武器+配件+护甲+头盔+背包+弹挂，弹药不计入
let gearFormulaOk = true;
for (let k = 0; k < 30; k++) {
  const r = generateParty({ count: 2 });
  for (const p of r.players) {
    const expected = p.primary.price
      + p.primaryAtts.reduce((s, a) => s + a.price, 0)
      + p.armor.price + p.helmet.price + p.backpack.price + p.rig.price;
    if (p.price !== expected) gearFormulaOk = false;
  }
}
console.log(`战备值公式（30 轮×2人，不含弹药）=${gearFormulaOk}`);
if (!gearFormulaOk) {
  throw new Error("战备值计算包含了弹药");
}

// ===== 装备价值锁测试 =====
// 单人：30 轮战备值都不超过上限
let capOk = true;
for (let k = 0; k < 30; k++) {
  const r = generateParty({ count: 1, valueCap: 200000 });
  if (r.players[0].price > 200000) capOk = false;
}
console.log(`装备价值锁（单人 30 轮 ≤ 20 万）=${capOk}`);
if (!capOk) {
  throw new Error("装备价值锁未生效");
}

// 三人·各自装备：每名队员都不超过上限
let capTeamOk = true;
for (let k = 0; k < 10; k++) {
  const r = generateParty({ count: 3, sameEquip: false, valueCap: 250000 });
  if (r.players.some((p) => p.price > 250000)) capTeamOk = false;
}
console.log(`装备价值锁（三人各自装备 10 轮全员 ≤ 25 万）=${capTeamOk}`);
if (!capTeamOk) {
  throw new Error("三人装备价值锁未生效");
}

// 上限低于战备门槛：优先满足门槛
const rConf = generateParty({ count: 1, target: 187500, valueCap: 100000 });
console.log(`上限低于门槛：仍满足门槛=${rConf.players[0].price >= 187500} 战备=${rConf.players[0].price}`);
if (rConf.players[0].price < 187500) {
  throw new Error("战备门槛优先逻辑异常");
}

// 价值锁与锁定共存：锁定高价值主武器时允许超上限，但不替换锁定项
const lockExp = [{
  operator: false,
  primary: true,
  ammo: true,
  primaryAtts: [false, false, false],
  armor: false,
  helmet: false,
  backpack: false,
  rig: false
}];
const rExpA = generateParty({ count: 1 });
const rExpB = generateParty({ count: 1, valueCap: 50000, locks: lockExp, prev: rExpA });
const primaryKept = rExpB.players[0].primary.name === rExpA.players[0].primary.name;
console.log(`价值锁+锁定：主武器保持=${primaryKept} 战备=${rExpB.players[0].price}（允许超上限）`);
if (!primaryKept) {
  throw new Error("价值锁替换了锁定主武器");
}

// ===== 干员总开关测试 =====
const rFixedA = generateParty({ count: 3, sameOperator: false });
const fixedOps = rFixedA.players.map((p) => p.operator.name);
let fixedKept = 0;
let prevFixed = rFixedA;
for (let k = 0; k < 20; k++) {
  const next = generateParty({ count: 3, sameOperator: false, operatorEnabled: false, prev: prevFixed });
  const nextOps = next.players.map((p) => p.operator.name);
  if (nextOps.every((n, i) => n === fixedOps[i])) fixedKept++;
  prevFixed = next;
}
console.log(`干员固定（20 次）：保持=${fixedKept}/20`);
if (fixedKept !== 20) {
  throw new Error("干员固定开关未生效");
}

// ===== state 统一状态测试 =====
const s1 = createState();
s1.mode = "room";
s1.room = { id: "123456", role: "host", online: 2 };
s1.count = 3;
s1.operatorEnabled = false;
s1.sameEquip = true;
s1.sameOperator = true;
s1.map = "巴克什";
s1.difficulty = "机密";
s1.valueCapEnabled = true;
s1.valueCap = 250000;
s1.locks[1].primary = true;
s1.locks[2].primaryAtts = [false, true, false];
s1.result = { map: "巴克什", difficulty: "机密", requirement: 187500, totalPrice: 999, players: [] };
const s2 = parse(serialize(s1));
console.log(
  "state 序列化往返：count =", s2.count,
  "| mode =", s2.mode,
  "| room =", s2.room.id + "/" + s2.room.role + "/" + s2.room.online,
  "| operatorEnabled =", s2.operatorEnabled,
  "| valueCap =", s2.valueCap,
  "| locks[1].primary =", s2.locks[1].primary,
  "| locks[2].primaryAtts =", s2.locks[2].primaryAtts.join(","),
  "| result.map =", s2.result.map
);
if (s2.mode !== "room" || s2.room.id !== "123456" || s2.room.role !== "host" || s2.room.online !== 2
  || s2.count !== 3 || s2.operatorEnabled !== false || s2.valueCap !== 250000
  || !s2.locks[1].primary || !s2.locks[2].primaryAtts[1] || s2.result.map !== "巴克什") {
  throw new Error("state 序列化往返异常");
}

// 非法输入归一化：越界人数、未知档位自动回落默认值
const s3 = normalizeState({ count: 9, tier: "ultra", valueCap: -5, excluded: { "手枪": true } });
console.log(
  "state 归一化：count =", s3.count, "| tier =", s3.tier, "| valueCap =", s3.valueCap, "| excluded.手枪 =", s3.excluded["手枪"], "| locks 长度 =", s3.locks.length
);
if (s3.count !== 1 || s3.tier !== null || s3.valueCap !== null || !s3.excluded["手枪"] || s3.locks.length !== 3) {
  throw new Error("state 归一化异常");
}

// ===== 联机传输格式测试（GoEasy publish 限 2500 字符） =====
const { serializeWire, parseWire } = globalThis.LoadoutState;
const w1 = createState();
w1.mode = "room";
w1.room = { id: "123456", role: "host", online: 3 };
w1.count = 3;
w1.sameEquip = false;
w1.sameOperator = false;
w1.operatorEnabled = true;
w1.map = "潮汐监狱";
w1.difficulty = "绝密";
w1.valueCapEnabled = true;
w1.valueCap = 900000;
w1.excluded["手枪"] = true;
w1.locks[1].ammo = true;
w1.locks[1].primary = true;
w1.result = generateParty({ count: 3, sameEquip: false, sameOperator: false, operatorEnabled: true, target: 780000, excludedCats: ["手枪"], tier: "high", valueCap: 900000, locks: w1.locks, prev: null });
w1.result.map = "潮汐监狱";
w1.result.difficulty = "绝密";
w1.result.requirement = 780000;
w1.result.excludedCats = ["手枪"];
w1.result.valueCap = 900000;
const wire = serializeWire(w1);
const wireBack = parseWire(wire);
console.log(
  "联机传输格式：长度 =", wire.length, "（限 2500）",
  "| 房间号 =", wireBack.room.id,
  "| excluded =", Object.keys(wireBack.excluded).filter((k) => wireBack.excluded[k]).join(","),
  "| 人数 =", wireBack.count,
  "| 结果玩家 =", wireBack.result && wireBack.result.players.length,
  "| 锁定弹药 =", wireBack.locks[1].ammo
);
if (wire.length > 2500) {
  throw new Error("联机状态超过 GoEasy publish 长度限制");
}
if (wireBack.room.id !== "123456") {
  throw new Error("联机传输丢失房间号");
}
if (wireBack.count !== 3 || !wireBack.excluded["手枪"] || !wireBack.result || wireBack.result.players.length !== 3 || !wireBack.locks[1].ammo) {
  throw new Error("联机传输往返数据不一致");
}
// 非法/截断消息安全回落
const badWire = parseWire("not-json");
if (badWire.count !== 1 || badWire.result !== null) {
  throw new Error("联机传输异常消息未安全回落");
}
