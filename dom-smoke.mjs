// 用最小 DOM 桩在 Node 里跑一遍 app.js，验证页面脚本能正常渲染
import "./data.js";
import "./core.js";

const listeners = [];
function stub(extra = {}) {
  return {
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    innerHTML: "",
    textContent: "",
    dataset: {},
    style: {},
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener(type, fn) {
      listeners.push({ type, fn, el: this });
    },
    select() {},
    ...extra
  };
}

const elements = {
  "#meta": stub(),
  "#players": stub(),
  "#roll-btn": stub(),
  "#copy-btn": stub(),
  "#map-select": stub(),
  "#difficulty-select": stub(),
  "#value-select": stub()
};

function segGroup(vals) {
  return vals.map((v) => {
    const b = stub();
    b.dataset = { value: v };
    return b;
  });
}

const countButtons = segGroup(["1", "2", "3"]);
const equipButtons = segGroup(["same", "diff"]);
const operatorButtons = segGroup(["same", "diff"]);
const excludeButtons = segGroup(["霰弹枪", "栓动狙击", "手枪"]);
const tierButtons = segGroup(["random", "low", "mid", "high"]);

globalThis.window = {
  LoadoutCore: globalThis.LoadoutCore,
  addEventListener() {}
};
globalThis.document = {
  querySelector(sel) {
    return elements[sel] || null;
  },
  querySelectorAll(sel) {
    if (sel === "#player-count button") return countButtons;
    if (sel === "#equip-mode button") return equipButtons;
    if (sel === "#operator-mode button") return operatorButtons;
    if (sel === "#exclude-select button") return excludeButtons;
    if (sel === "#value-select button") return tierButtons;
    return [];
  },
  createElement() {
    return stub();
  }
};

await import("./app.js");

function countCard(html) {
  return (html.match(/player-card/g) || []).length;
}

function click(btn) {
  const rec = listeners.find((l) => l.el === btn && l.type === "click");
  if (!rec) throw new Error("click listener not found");
  rec.fn.call(btn);
}

// 初始加载：单人 + 随机地图/难度
let html = elements["#players"].innerHTML;
let meta = elements["#meta"].innerHTML;
console.log("初始单人：卡片数 =", countCard(html), "| 含地图/难度 =", meta.includes("地图") && meta.includes("难度"), "| 含战备要求 =", meta.includes("战备要求"));
console.log("副武器已移除 =", !html.includes("副武器"));

// 三人 + 装备相同 + 干员不同
click(countButtons[2]);
click(equipButtons[0]);
click(operatorButtons[1]);
html = elements["#players"].innerHTML;
meta = elements["#meta"].innerHTML;
console.log("三人·装备相同·干员不同：卡片数 =", countCard(html), "| 含同套标记 =", html.includes("同套装备"), "| 含战备总值 =", meta.includes("队伍战备总值"));

// 双人 + 装备不同 + 干员相同
click(countButtons[1]);
click(equipButtons[1]);
click(operatorButtons[0]);
html = elements["#players"].innerHTML;
console.log("双人·装备不同·干员相同：卡片数 =", countCard(html), "| 无同套标记 =", !html.includes("同套装备"));

// 潮汐监狱 + 绝密：门槛 78 万，必须全员达标
const mapBtns = elements["#map-select"].children;
const diffBtns = elements["#difficulty-select"].children;
const prisonBtn = mapBtns.find((b) => b.dataset.value === "潮汐监狱");
const secretBtn = diffBtns.find((b) => b.dataset.value === "绝密");
click(prisonBtn);
click(secretBtn);
html = elements["#players"].innerHTML;
meta = elements["#meta"].innerHTML;
console.log(
  "潮汐监狱·绝密：含门槛 780,000 =", meta.includes("780,000"),
  "| 全员达标标记 =", html.includes("达标 ✓"),
  "| 卡片数 =", countCard(html)
);

// 排除手枪
const pistolBtn = excludeButtons.find((b) => b.dataset.value === "手枪");
click(pistolBtn);
meta = elements["#meta"].innerHTML;
html = elements["#players"].innerHTML;
console.log("排除手枪：meta 含排除标记 =", meta.includes("排除 手枪"), "| 卡片无副武器 =", !html.includes("副武器"));

// 低价值档位
const tierBtns = elements["#value-select"].children;
const lowBtn = tierBtns.find((b) => b.dataset.value === "low");
click(lowBtn);
meta = elements["#meta"].innerHTML;
console.log("低价值档位：meta 含低价值 =", meta.includes("低价值"));

if (countCard(html) !== 2) {
  throw new Error("渲染结果与预期不符");
}
if (!meta.includes("780,000") || !html.includes("达标 ✓")) {
  throw new Error("战备门槛渲染或达标状态异常");
}
if (!meta.includes("排除 手枪")) {
  throw new Error("枪械排除状态未渲染");
}
if (!meta.includes("低价值")) {
  throw new Error("价值档位未渲染");
}
console.log("DOM 冒烟测试通过");
