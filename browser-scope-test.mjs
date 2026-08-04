// 模拟浏览器经典脚本：三个文件合并进同一个全局作用域执行
// 旧版 data.js/core.js 各自顶层声明 const DATA，在这里会直接报 SyntaxError
import fs from "node:fs";
import vm from "node:vm";

const src = ["data.js", "core.js", "app.js"]
  .map((f) => fs.readFileSync(new URL("./" + f, import.meta.url), "utf8"))
  .join("\n");

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

const countButtons = ["1", "2", "3"].map((v) => {
  const b = stub();
  b.dataset = { value: v };
  return b;
});
const boolButtons = ["same", "diff"].map((v) => {
  const b = stub();
  b.dataset = { value: v };
  return b;
});
const excludeButtons = ["霰弹枪", "栓动狙击", "手枪"].map((v) => {
  const b = stub();
  b.dataset = { value: v };
  return b;
});
const tierButtons = ["random", "low", "mid", "high"].map((v) => {
  const b = stub();
  b.dataset = { value: v };
  return b;
});

const sandbox = {
  console,
  addEventListener() {},
  document: {
    querySelector(sel) {
      return elements[sel] || null;
    },
    querySelectorAll(sel) {
      if (sel === "#player-count button") return countButtons;
      if (sel === "#equip-mode button") return boolButtons;
      if (sel === "#operator-mode button") return boolButtons;
      if (sel === "#exclude-select button") return excludeButtons;
      if (sel === "#value-select button") return tierButtons;
      return [];
    },
    createElement() {
      return stub();
    }
  }
};
sandbox.window = sandbox;

vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox);
} catch (err) {
  console.error("浏览器作用域模拟失败:", err.message);
  process.exit(1);
}

const cards = (sandbox.document.querySelector("#players").innerHTML.match(/player-card/g) || []).length;
const metaOk = sandbox.document.querySelector("#meta").innerHTML.includes("队伍战备总值");
const reqOk = sandbox.document.querySelector("#meta").innerHTML.includes("战备要求");
const noSecondaryOk = !sandbox.document.querySelector("#players").innerHTML.includes("副武器");
const tierOk = sandbox.document.querySelector("#meta").innerHTML.includes("价值档位");
console.log("浏览器作用域模拟：卡片数 =", cards, "| 含战备总值 =", metaOk, "| 含战备要求 =", reqOk, "| 无副武器 =", noSecondaryOk, "| 含价值档位 =", tierOk);
if (cards !== 1 || !metaOk || !reqOk || !noSecondaryOk || !tierOk) {
  console.error("渲染结果与预期不符");
  process.exit(1);
}
console.log("浏览器作用域模拟通过（脚本无冲突，页面正常渲染）");
