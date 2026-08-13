// ============================================================
// 全局状态管理（第二步）
// 所有配置 + 随机结果收敛到统一的 state 对象：
//  - 纯 JSON 结构，不含函数 / DOM 引用，可直接序列化
//  - 为联机同步做准备：房主整包广播 state，访客 applyState 即可还原界面
// ============================================================

(function () {
  const EXCLUDED_KEYS = ["霰弹枪", "栓动狙击", "手枪"];

  function emptyLocks() {
    return {
      operator: false,
      primary: false,
      primaryAtts: [false, false, false],
      ammo: false,
      armor: false,
      helmet: false,
      backpack: false,
      rig: false
    };
  }

  // 把任意来源的 locks 归一到 3 人 × 完整槽位结构
  function normalizeLocks(locks) {
    const src = Array.isArray(locks) ? locks : [];
    return Array.from({ length: 3 }, (_, i) => {
      const base = src[i] || {};
      const atts = Array.isArray(base.primaryAtts) ? base.primaryAtts : [];
      const out = emptyLocks();
      out.operator = !!base.operator;
      out.primary = !!base.primary;
      out.primaryAtts = [!!atts[0], !!atts[1], !!atts[2]];
      out.ammo = !!base.ammo;
      out.armor = !!base.armor;
      out.helmet = !!base.helmet;
      out.backpack = !!base.backpack;
      out.rig = !!base.rig;
      return out;
    });
  }

  function cloneResult(result) {
    if (!result || typeof result !== "object") return null;
    try {
      return JSON.parse(JSON.stringify(result));
    } catch (e) {
      return null;
    }
  }

  // 联机房间信息：房间号 6 位数字、身份、在线人数、成员号位名单 roster（[{id, slot}]）
  function normalizeRoom(room) {
    const r = room && typeof room === "object" ? room : {};
    const id = typeof r.id === "string" && /^\d{6}$/.test(r.id) ? r.id : null;
    const roster = Array.isArray(r.roster)
      ? r.roster
          .filter((e) => e && typeof e.id === "string" && e.id && Number.isInteger(e.slot) && e.slot >= 1 && e.slot <= 3)
          .map((e) => ({ id: e.id, slot: e.slot }))
      : [];
    return {
      id,
      role: r.role === "member" ? "member" : r.role === "host" ? "host" : null,
      online: Number.isInteger(r.online) && r.online >= 1 ? r.online : 1,
      roster
    };
  }

  // 归一化任意来源的 state（本地初始化 / 联机接收都走这里）
  function normalizeState(raw) {
    const s = raw && typeof raw === "object" ? raw : {};
    const excluded = {};
    EXCLUDED_KEYS.forEach((k) => { excluded[k] = !!(s.excluded && s.excluded[k]); });
    return {
      version: 2,
      mode: s.mode === "room" ? "room" : "solo",
      room: normalizeRoom(s.room),
      count: [1, 2, 3].includes(s.count) ? s.count : 1,
      operatorEnabled: s.operatorEnabled !== false,
      sameOperator: !!s.sameOperator,
      sameEquip: !!s.sameEquip,
      map: typeof s.map === "string" && s.map ? s.map : null,
      difficulty: typeof s.difficulty === "string" && s.difficulty ? s.difficulty : null,
      excluded,
      tier: ["low", "mid", "high"].includes(s.tier) ? s.tier : null,
      valueCapEnabled: !!s.valueCapEnabled,
      valueCap: typeof s.valueCap === "number" && isFinite(s.valueCap) && s.valueCap > 0 ? Math.floor(s.valueCap) : null,
      locks: normalizeLocks(s.locks),
      result: cloneResult(s.result)
    };
  }

  function createState() {
    return normalizeState({});
  }

  function cloneState(state) {
    return normalizeState(state);
  }

  function serialize(state) {
    return JSON.stringify(normalizeState(state));
  }

  function parse(json) {
    try {
      return normalizeState(JSON.parse(json));
    } catch (e) {
      return createState();
    }
  }

  // ---------- 联机传输格式 ----------
  // GoEasy publish 的 message 限制 2500 字符，这里去掉本地冗余字段（room / 完整 excluded 映射），
  // 传输最小必要数据；接收端 parseWire 会重新归一化成完整 state。
  function serializeWire(state) {
    const s = normalizeState(state);
    return JSON.stringify({
      version: 2,
      mode: "room",
      roomId: s.room && s.room.id,
      online: (s.room && s.room.online) || 1,
      count: s.count,
      operatorEnabled: s.operatorEnabled,
      sameOperator: s.sameOperator,
      sameEquip: s.sameEquip,
      map: s.map,
      difficulty: s.difficulty,
      excluded: Object.keys(s.excluded).filter((k) => s.excluded[k]),
      tier: s.tier,
      valueCapEnabled: s.valueCapEnabled,
      valueCap: s.valueCap,
      locks: s.locks,
      roster: (s.room && s.room.roster) || [],
      result: s.result
    });
  }

  function parseWire(json) {
    try {
      const raw = JSON.parse(json);
      if (typeof raw.roomId === "string" && /^\d{6}$/.test(raw.roomId)) {
        raw.room = { id: raw.roomId, online: raw.online };
      }
      if (Array.isArray(raw.excluded)) {
        const ex = {};
        raw.excluded.forEach((k) => { ex[k] = true; });
        raw.excluded = ex;
      }
      if (Array.isArray(raw.roster) && raw.room) {
        raw.room.roster = raw.roster;
      }
      return normalizeState(raw);
    } catch (e) {
      return createState();
    }
  }

  const api = { emptyLocks, normalizeLocks, normalizeState, createState, cloneState, serialize, parse, serializeWire, parseWire };

  // 浏览器：挂到全局供 app.js 使用
  // Node (ESM/CJS)：支持两种导出方式，方便测试
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    if (typeof globalThis !== "undefined") globalThis.LoadoutState = api;
  } else if (typeof globalThis !== "undefined") {
    globalThis.LoadoutState = api;
  }
})();
