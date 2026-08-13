// 用最小 DOM 桩在 Node 里跑一遍 app.js，验证页面脚本能正常渲染
import "./data.js";
import "./core.js";
import "./state.js";
import "./goeasy.js";

// ---------- 假 GoEasy：记录调用、可手动触发订阅回调 ----------
const netCalls = {
  instances: [],
  publishes: [],
  messageHandlers: [],
  presenceHandlers: [],
  disconnects: 0
};

class FakeGoEasy {
  static getInstance(opts) {
    const inst = new FakeGoEasy();
    inst.opts = opts;
    netCalls.instances.push(opts);
    return inst;
  }
  constructor() {
    this.connected = false;
    this.pubsub = {
      publish: (o) => { netCalls.publishes.push(o); o.onSuccess && o.onSuccess(); },
      subscribe: (o) => { netCalls.messageHandlers.push({ channel: o.channel, onMessage: o.onMessage }); o.onSuccess && o.onSuccess(); },
      unsubscribe: (o) => { o.onSuccess && o.onSuccess(); },
      subscribePresence: (o) => { netCalls.presenceHandlers.push({ channel: o.channel, onPresence: o.onPresence }); o.onSuccess && o.onSuccess(); },
      unsubscribePresence: (o) => { o.onSuccess && o.onSuccess(); }
    };
  }
  connect(o) {
    this.connected = true;
    o.onProgress && o.onProgress(1);
    o.onSuccess && o.onSuccess();
  }
  disconnect(o) {
    this.connected = false;
    netCalls.disconnects++;
    o && o.onSuccess && o.onSuccess();
  }
  getConnectionStatus() {
    return this.connected ? "connected" : "disconnected";
  }
}
globalThis.GoEasy = { default: FakeGoEasy };

const listeners = [];
function stub(extra = {}) {
  const classes = new Set();
  const el = {
    _html: "",
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = v;
      this.children.length = 0;
    },
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      toggle(c, force) {
        const on = force === undefined ? !classes.has(c) : !!force;
        if (on) classes.add(c); else classes.delete(c);
        return on;
      },
      contains(c) { return classes.has(c); }
    },
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
    focus() {},
    ...extra
  };
  return el;
}

const elements = {
  "#meta": stub(),
  "#players": stub(),
  "#roll-btn": stub(),
  "#copy-btn": stub(),
  "#map-select": stub(),
  "#difficulty-select": stub(),
  "#value-select": stub(),
  "#value-cap-toggle": stub(),
  "#value-cap-input": stub({ value: "", disabled: true }),
  ".controls": stub(),
  "#room-bar": stub(),
  "#room-id": stub(),
  "#room-online": stub(),
  "#room-role": stub(),
  "#room-net-status": stub(),
  "#room-net-text": stub(),
  "#room-copy": stub(),
  "#room-exit": stub(),
  "#modal": stub(),
  "#modal-title": stub(),
  "#modal-backdrop": stub(),
  "#modal-close": stub(),
  "#create-room-body": stub(),
  "#join-room-body": stub(),
  "#create-room-code": stub(),
  "#create-room-confirm": stub(),
  "#join-room-input": stub({ value: "" }),
  "#join-room-error": stub(),
  "#join-room-confirm": stub()
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
const operatorEnabledButtons = segGroup(["on", "off"]);
const excludeButtons = segGroup(["霰弹枪", "栓动狙击", "手枪"]);
const tierButtons = segGroup(["random", "low", "mid", "high"]);
const modeButtons = ["solo", "create", "join"].map((v) => {
  const b = stub();
  b.dataset = { mode: v };
  return b;
});

globalThis.window = {
  LoadoutCore: globalThis.LoadoutCore,
  LoadoutState: globalThis.LoadoutState,
  addEventListener() {}
};
globalThis.document = {
  body: null,
  documentElement: null,
  querySelector(sel) {
    return elements[sel] || null;
  },
  querySelectorAll(sel) {
    if (sel === "#player-count button") return countButtons;
    if (sel === "#equip-mode button") return equipButtons;
    if (sel === "#operator-mode button") return operatorButtons;
    if (sel === "#operator-enabled button") return operatorEnabledButtons;
    if (sel === "#exclude-select button") return excludeButtons;
    if (sel === "#value-select button") return tierButtons;
    if (sel === "#mode-switch button") return modeButtons;
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

function fire(el, type) {
  const rec = listeners.find((l) => l.el === el && l.type === type);
  if (!rec) throw new Error("listener not found: " + type);
  rec.fn.call(el);
}

// 顶部导航
console.log("顶部导航：模式按钮数 =", modeButtons.length, "| 单人默认激活 =", modeButtons[0].classList.contains("active"));
if (modeButtons.length !== 3) throw new Error("顶部模式切换按钮缺失");

// 初始加载：单人 + 随机地图/难度
let html = elements["#players"].innerHTML;
let meta = elements["#meta"].innerHTML;
console.log("初始单人：卡片数 =", countCard(html), "| 含地图/难度 =", meta.includes("地图") && meta.includes("难度"), "| 含战备要求 =", meta.includes("战备要求"));
console.log("副武器已移除 =", !html.includes("副武器"));

// 单项锁定：按钮渲染 + 点击锁定 + 锁定计数
console.log("单项锁定：卡片含锁定按钮 =", html.includes("lock-btn"));
if (!html.includes("lock-btn")) throw new Error("锁定按钮未渲染");
const playersEl = elements["#players"];
const lockRec = listeners.find((l) => l.el === playersEl && l.type === "click");
if (!lockRec) throw new Error("锁定按钮事件委托未注册");
const fakeLock = stub();
fakeLock.disabled = false;
fakeLock.dataset = { lockPlayer: "0", lockKey: "primary" };
fakeLock.closest = () => fakeLock;
lockRec.fn({ target: fakeLock });
html = elements["#players"].innerHTML;
meta = elements["#meta"].innerHTML;
console.log("单项锁定：点击后出现已锁定按钮 =", html.includes("lock-btn on"), "| 计数显示已锁定 =", meta.includes("已锁定 1 项"));
if (!html.includes("lock-btn on") || !meta.includes("已锁定 1 项")) {
  throw new Error("锁定状态渲染异常");
}

// 弹药锁定联动：先解锁主武器，再锁弹药，主武器应被自动带上
lockRec.fn({ target: fakeLock });
const fakeAmmoLock = stub();
fakeAmmoLock.disabled = false;
fakeAmmoLock.dataset = { lockPlayer: "0", lockKey: "ammo" };
fakeAmmoLock.closest = () => fakeAmmoLock;
lockRec.fn({ target: fakeAmmoLock });
meta = elements["#meta"].innerHTML;
console.log("弹药锁定联动：已锁定 2 项 =", meta.includes("已锁定 2 项"));
if (!meta.includes("已锁定 2 项")) {
  throw new Error("弹药锁定未联动主武器");
}

// 干员总开关：关闭后干员固定不随机，干员模式按钮置灰
console.log("干员总开关：默认开启随机 =", operatorEnabledButtons[0].classList.contains("active"), "| 干员模式可用 =", !operatorButtons[0].classList.contains("disabled"));
if (!operatorEnabledButtons[0].classList.contains("active") || operatorButtons[0].classList.contains("disabled")) {
  throw new Error("干员总开关初始状态异常");
}
click(operatorEnabledButtons[1]);
meta = elements["#meta"].innerHTML;
console.log("干员固定：meta 含固定不随机 =", meta.includes("固定不随机"), "| 干员模式置灰 =", operatorButtons[0].classList.contains("disabled"));
if (!meta.includes("固定不随机") || !operatorButtons[0].classList.contains("disabled")) {
  throw new Error("干员固定开关未生效");
}
click(operatorEnabledButtons[0]);
meta = elements["#meta"].innerHTML;
console.log("干员恢复随机：meta 含各自随机 =", meta.includes("各自随机"), "| 干员模式恢复 =", !operatorButtons[0].classList.contains("disabled"));

// 弹药槽渲染：口径 + 等级
html = elements["#players"].innerHTML;
console.log("弹药槽渲染：含弹药 =", html.includes("弹药"), "| 含等级弹 =", /[一二三四五]级弹药/.test(html), "| 标注不计战备 =", html.includes("不计战备"));
if (!html.includes("弹药") || !/[一二三四五]级弹药/.test(html) || !html.includes("不计战备")) {
  throw new Error("弹药槽未渲染");
}

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

// 潮汐监狱 + 绝密：门槛 78 万，必须全员达标；难度下拉只保留 随机/绝密
const mapBtns = elements["#map-select"].children;
const prisonBtn = mapBtns.find((b) => b.dataset.value === "潮汐监狱");
click(prisonBtn);
let diffBtns = elements["#difficulty-select"].children;
let diffValues = diffBtns.map((b) => b.dataset.value);
console.log("潮汐监狱·难度过滤：", diffValues.join(","), "| 仅绝密 =", diffValues.length === 2 && diffValues.includes("绝密") && !diffValues.includes("普通"));
if (diffValues.includes("普通") || diffValues.includes("永夜")) {
  throw new Error("潮汐监狱出现了不存在的行动模式");
}
const secretBtn = diffBtns.find((b) => b.dataset.value === "绝密");
click(secretBtn);
html = elements["#players"].innerHTML;
meta = elements["#meta"].innerHTML;
console.log(
  "潮汐监狱·绝密：含门槛 780,000 =", meta.includes("780,000"),
  "| 全员达标标记 =", html.includes("达标 ✓"),
  "| 卡片数 =", countCard(html)
);
if (!meta.includes("780,000") || !html.includes("达标 ✓")) {
  throw new Error("战备门槛渲染或达标状态异常");
}

// 巴克什战区：难度下拉只保留 随机/机密/绝密
const barkerBtn = mapBtns.find((b) => b.dataset.value === "巴克什");
click(barkerBtn);
diffValues = elements["#difficulty-select"].children.map((b) => b.dataset.value);
console.log("巴克什·难度过滤：", diffValues.join(","), "| 仅机密/绝密 =", diffValues.join(",") === "random,机密,绝密");
if (diffValues.includes("普通") || diffValues.includes("永夜")) {
  throw new Error("巴克什出现了不存在的行动模式");
}

// 航天基地：难度下拉只保留 随机/机密/绝密
const spaceBtn = mapBtns.find((b) => b.dataset.value === "航天基地");
click(spaceBtn);
diffValues = elements["#difficulty-select"].children.map((b) => b.dataset.value);
console.log("航天基地·难度过滤：", diffValues.join(","), "| 仅机密/绝密 =", diffValues.join(",") === "random,机密,绝密");
if (diffValues.includes("普通") || diffValues.includes("永夜")) {
  throw new Error("航天基地出现了不存在的行动模式");
}

// 排除手枪
const pistolBtn = excludeButtons.find((b) => b.dataset.value === "手枪");
click(pistolBtn);
meta = elements["#meta"].innerHTML;
html = elements["#players"].innerHTML;
console.log("排除手枪：meta 含排除标记 =", meta.includes("排除 手枪"), "| 卡片无副武器 =", !html.includes("副武器"));
if (!meta.includes("排除 手枪")) {
  throw new Error("枪械排除状态未渲染");
}

// 低价值档位
const tierBtns = elements["#value-select"].children;
const lowBtn = tierBtns.find((b) => b.dataset.value === "low");
click(lowBtn);
meta = elements["#meta"].innerHTML;
console.log("低价值档位：meta 含低价值 =", meta.includes("低价值"));
if (!meta.includes("低价值")) {
  throw new Error("价值档位未渲染");
}

// 装备价值锁：启用 + 输入上限后，简报与卡片显示上限
const valueCapToggle = elements["#value-cap-toggle"];
const valueCapInput = elements["#value-cap-input"];
click(valueCapToggle);
valueCapInput.value = "200000";
fire(valueCapInput, "change");
meta = elements["#meta"].innerHTML;
html = elements["#players"].innerHTML;
console.log(
  "装备价值锁：简报含 ≤ 200,000 =", meta.includes("≤ 200,000"),
  "| 卡片含上限 =", html.includes("上限 ≤ 200,000"),
  "| 输入框可用 =", !valueCapInput.disabled
);
if (!meta.includes("≤ 200,000") || !html.includes("上限 ≤ 200,000") || valueCapInput.disabled) {
  throw new Error("装备价值锁未生效");
}

// ===== 联机房间 UI =====
const modalEl = elements["#modal"];
const createConfirm = elements["#create-room-confirm"];
const joinConfirm = elements["#join-room-confirm"];
const joinInput = elements["#join-room-input"];
const joinError = elements["#join-room-error"];
const roomBar = elements["#room-bar"];
const roomIdEl = elements["#room-id"];
const roomRoleEl = elements["#room-role"];
const roomExit = elements["#room-exit"];
const controlsEl = elements[".controls"];
const roomNetText = elements["#room-net-text"];

// 创建房间：弹窗 → 确认 → 状态栏显示房主
click(modeButtons[1]);
console.log("创建房间：弹窗打开 =", !modalEl.classList.contains("hidden"), "| 生成 6 位房间号 =", /^\d{6}$/.test(elements["#create-room-code"].textContent));
if (modalEl.classList.contains("hidden") || !/^\d{6}$/.test(elements["#create-room-code"].textContent)) {
  throw new Error("创建房间弹窗异常");
}
click(createConfirm);
const hostRoomId = roomIdEl.textContent;
console.log(
  "创建房间：状态栏显示 =", !roomBar.classList.contains("hidden"),
  "| 房间号 =", roomIdEl.textContent,
  "| 身份 =", roomRoleEl.textContent,
  "| 房主可操作 =", !controlsEl.classList.contains("room-member"),
  "| 连接状态 =", roomNetText.textContent
);
if (roomBar.classList.contains("hidden") || !/^\d{6}$/.test(hostRoomId) || roomRoleEl.textContent !== "房主" || controlsEl.classList.contains("room-member")) {
  throw new Error("创建房间后状态异常");
}

// 房主联机：CommonKey 连接 + 连接成功即广播状态
const hostInst = netCalls.instances[0];
console.log(
  "房主联机：CommonKey =", hostInst && hostInst.appkey === "BC-8205070a1db64512908a6bd5c7b57838",
  "| 已广播状态 =", netCalls.publishes.length >= 1
);
if (!hostInst || hostInst.appkey !== "BC-8205070a1db64512908a6bd5c7b57838" || netCalls.publishes.length < 1) {
  throw new Error("房主未用 CommonKey 连接或未广播初始状态");
}
const hostState = JSON.parse(netCalls.publishes[0].message);
if (!hostState.result || hostState.roomId !== hostRoomId) {
  throw new Error("房主广播的状态缺少结果或房间号");
}

// 模拟队员加入：房主应收到 presence join 并补发一次状态（新人拿最新结果）
const hostPresence = netCalls.presenceHandlers.find((h) => h.channel === "rl_" + hostRoomId);
hostPresence.onPresence({ action: "join", amount: 2, member: { id: "u_member", data: {} } });
console.log("成员加入：在线人数更新 =", elements["#room-online"].textContent === "2", "| 房主补发状态 =", netCalls.publishes.length >= 2);
if (elements["#room-online"].textContent !== "2" || netCalls.publishes.length < 2) {
  throw new Error("presence join 未更新在线人数或未触发补发");
}

// 回归：GoEasy 会把发布的消息回推给所有订阅者（包括房主本人）。
// 房主收到自己的广播回包后，身份必须保持「房主」，控件不能进入队员只读。
const hostMsgHandler = netCalls.messageHandlers.find((h) => h.channel === "rl_" + hostRoomId);
if (!hostMsgHandler) {
  throw new Error("房主未订阅频道");
}
hostMsgHandler.onMessage({ content: netCalls.publishes[netCalls.publishes.length - 1].message });
console.log(
  "房主收到自己广播：身份保持 =", roomRoleEl.textContent === "房主",
  "| 控件可操作 =", !controlsEl.classList.contains("room-member")
);
if (roomRoleEl.textContent !== "房主" || controlsEl.classList.contains("room-member")) {
  throw new Error("房主收到自己广播后被降级为队员");
}

// 房间内再点创建/加入：提示需先退出
click(modeButtons[2]);
console.log("房间内点加入：弹窗保持关闭 =", modalEl.classList.contains("hidden"));
if (!modalEl.classList.contains("hidden")) {
  throw new Error("房间内应禁止再次创建/加入");
}

// 退出房间
click(roomExit);
console.log("退出房间：状态栏隐藏 =", roomBar.classList.contains("hidden"), "| 已断开联机 =", netCalls.disconnects >= 1);
if (!roomBar.classList.contains("hidden") || netCalls.disconnects < 1) {
  throw new Error("退出房间失败");
}

// 加入房间：非法输入报错，合法输入进入队员只读
click(modeButtons[2]);
joinInput.value = "123";
click(joinConfirm);
console.log("加入房间：非法输入提示 =", joinError.textContent.includes("6 位"));
if (!joinError.textContent.includes("6 位")) {
  throw new Error("房间号校验未生效");
}
joinInput.value = "654321";
click(joinConfirm);
console.log(
  "加入房间：房间号 =", roomIdEl.textContent,
  "| 身份 =", roomRoleEl.textContent,
  "| 队员只读 =", controlsEl.classList.contains("room-member")
);
if (roomIdEl.textContent !== "654321" || roomRoleEl.textContent !== "队员" || !controlsEl.classList.contains("room-member")) {
  throw new Error("加入房间后状态异常");
}

// 队员联机：SubscribeKey 连接 + 订阅房主频道
const memberInst = netCalls.instances[1];
const memberSub = netCalls.messageHandlers.find((h) => h.channel === "rl_654321");
console.log(
  "队员联机：SubscribeKey =", memberInst && memberInst.appkey === "BS-21aabf71b386448e88f1b7125e8e4003",
  "| 已订阅频道 =", !!memberSub
);
if (!memberInst || memberInst.appkey !== "BS-21aabf71b386448e88f1b7125e8e4003" || !memberSub) {
  throw new Error("队员未用 SubscribeKey 连接或未订阅频道");
}

// 模拟收到房主广播：队员页面应整体应用对方状态（不重新随机）
memberSub.onMessage({ content: JSON.stringify(hostState) });
html = elements["#players"].innerHTML;
meta = elements["#meta"].innerHTML;
console.log(
  "队员收包：卡片数 =", countCard(html),
  "| 显示房主地图 =", meta.includes(hostState.result.map),
  "| 身份保持队员 =", roomRoleEl.textContent === "队员"
);
if (countCard(html) !== hostState.result.players.length || !meta.includes(hostState.result.map) || roomRoleEl.textContent !== "队员") {
  throw new Error("队员未正确应用房主广播的状态");
}

// 队员点随机不生效（结果不重新生成）
html = elements["#players"].innerHTML;
click(elements["#roll-btn"]);
const htmlAfterMemberRoll = elements["#players"].innerHTML;
console.log("队员点随机：结果不变 =", html === htmlAfterMemberRoll);
if (html !== htmlAfterMemberRoll) {
  throw new Error("队员不应能重新随机");
}
click(roomExit);
console.log("队员退出：已断开联机 =", netCalls.disconnects >= 2);

if (countCard(html) !== hostState.result.players.length) {
  throw new Error("渲染结果与预期不符");
}
console.log("DOM 冒烟测试通过");
