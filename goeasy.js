// ============================================================
// GoEasy 联机通讯封装（插拔式，第四步）
// 所有 GoEasy 相关代码都收口在这里，不污染单人模式逻辑：
//  - 房主创建房间：使用 CommonKey（可发布）
//  - 访客加入房间：仅使用 SubscribeKey（只订阅，无写权限）
//  - 断线/重连由 GoEasy SDK 自动处理，通过 onStatus 回调通知页面
//  - SDK 未加载时所有方法安全降级（返回 false / 状态 unavailable），不影响单人模式
// ============================================================

(function () {
  "use strict";

  const HOST = "hangzhou.goeasy.io";
  // 房主专用 CommonKey（可发布消息）
  const COMMON_KEY = "BC-8205070a1db64512908a6bd5c7b57838";
  // 访客专用 SubscribeKey（只读订阅，无发布权限）
  const SUBSCRIBE_KEY = "BS-21aabf71b386448e88f1b7125e8e4003";

  const net = {
    goEasy: null,
    role: null,
    roomId: null,
    channel: null,
    connected: false,
    handlers: null
  };

  // UMD 包在浏览器挂 globalThis.GoEasy = { default: GoEasyClass }，这里兼容两种形态
  function SDK() {
    const g = (typeof globalThis !== "undefined" && globalThis.GoEasy) || null;
    if (!g) return null;
    return g.default || g;
  }

  function channelOf(roomId) {
    return "rl_" + roomId;
  }

  // 每个标签页一个稳定 userId：刷新页面后重连仍是同一身份，在线人数不会重复计算
  function genUserId() {
    try {
      if (typeof sessionStorage !== "undefined") {
        const key = "rl_user_id";
        let id = sessionStorage.getItem(key);
        if (!id) {
          id = "u_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
          sessionStorage.setItem(key, id);
        }
        return id;
      }
    } catch (e) { /* ignore */ }
    return "u_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function emitStatus(kind, detail) {
    const h = net.handlers;
    if (h && typeof h.onStatus === "function") {
      try { h.onStatus(kind, detail); } catch (e) { /* ignore */ }
    }
  }

  function emitReady() {
    const h = net.handlers;
    if (h && typeof h.onReady === "function") {
      try { h.onReady(); } catch (e) { /* ignore */ }
    }
  }

  function subscribeAll() {
    const goEasy = net.goEasy;
    if (!goEasy || !net.channel) return;
    const h = net.handlers || {};

    goEasy.pubsub.subscribe({
      channel: net.channel,
      onMessage: (msg) => {
        if (typeof h.onState === "function") {
          try { h.onState(msg && msg.content, msg); } catch (e) { /* ignore */ }
        }
      },
      onSuccess: () => { /* 订阅成功 */ },
      onFailed: (err) => emitStatus("subscribe_failed", err)
    });

    goEasy.pubsub.subscribePresence({
      channel: net.channel,
      membersLimit: 30,
      onPresence: (ev) => {
        if (typeof h.onPresence === "function") {
          try { h.onPresence(ev); } catch (e) { /* ignore */ }
        }
      },
      onSuccess: () => { /* 在线状态订阅成功 */ },
      onFailed: (err) => emitStatus("presence_failed", err)
    });
  }

  /**
   * 建立联机连接
   * @param {object} opts
   * @param {string} opts.roomId 6 位数字房间号
   * @param {"host"|"member"} opts.role 房主 / 队员
   * @param {string} [opts.userId] 用户 id，缺省自动生成
   * @param {object} opts.handlers { onState, onPresence, onStatus, onReady }
   */
  function connect(opts) {
    opts = opts || {};
    net.handlers = opts.handlers || null;
    net.role = opts.role === "member" ? "member" : "host";
    net.roomId = String(opts.roomId || "");
    net.channel = channelOf(net.roomId);
    net.connected = false;

    if (!/^\d{6}$/.test(net.roomId)) {
      emitStatus("failed", { code: 400, content: "房间号无效" });
      return false;
    }

    const GoEasyClass = SDK();
    if (!GoEasyClass) {
      emitStatus("unavailable", { code: 0, content: "GoEasy SDK 未加载，请检查 vendor 文件是否部署" });
      return false;
    }

    try {
      net.goEasy = GoEasyClass.getInstance({
        host: HOST,
        appkey: net.role === "host" ? COMMON_KEY : SUBSCRIBE_KEY,
        modules: ["pubsub"]
      });
    } catch (err) {
      emitStatus("failed", { code: 0, content: (err && err.message) || String(err) });
      return false;
    }

    const goEasy = net.goEasy;
    const userId = opts.userId || genUserId();
    emitStatus("connecting", { attempts: 0 });

    try {
      goEasy.connect({
        id: userId,
        data: { role: net.role, room: net.roomId },
        onProgress: (attempts) => {
          // 首次连接失败自动重连，或连接成功后网络中断自动重连
          emitStatus(net.connected ? "reconnecting" : "connecting", { attempts });
        },
        onSuccess: () => {
          net.connected = true;
          subscribeAll();
          emitStatus("connected", {});
          emitReady();
        },
        onFailed: (err) => {
          emitStatus("failed", err);
        }
      });
    } catch (err) {
      emitStatus("failed", { code: 0, content: (err && err.message) || String(err) });
      return false;
    }
    return true;
  }

  /**
   * 广播完整状态（仅房主可发布；队员调用直接返回 false）
   * @param {object|string} payload state 对象或序列化后的 JSON 字符串
   */
  function publishState(payload) {
    if (net.role !== "host" || !net.connected || !net.goEasy || !net.channel) return false;
    const message = typeof payload === "string" ? payload : JSON.stringify(payload);
    try {
      net.goEasy.pubsub.publish({
        channel: net.channel,
        message,
        onSuccess: () => { /* 发布成功 */ },
        onFailed: (err) => emitStatus("publish_failed", err)
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 查询当前频道在线成员（SDK 2.7+ hereNow；不可用时回调 null）
   * @param {function} onSuccess ({ members, amount }) => void
   * @param {function} [onFailed] (err) => void
   */
  function queryMembers(onSuccess, onFailed) {
    const goEasy = net.goEasy;
    if (!goEasy || !net.channel || !goEasy.pubsub || typeof goEasy.pubsub.hereNow !== "function") {
      if (onSuccess) onSuccess(null);
      return false;
    }
    try {
      goEasy.pubsub.hereNow({
        channel: net.channel,
        limit: 30,
        onSuccess: (res) => {
          const content = res && res.content;
          if (onSuccess) {
            onSuccess({
              members: (content && Array.isArray(content.members)) ? content.members : [],
              amount: (content && Number.isInteger(content.amount) && content.amount >= 0) ? content.amount : 0
            });
          }
        },
        onFailed: (err) => { if (onFailed) onFailed(err); }
      });
      return true;
    } catch (e) {
      if (onFailed) onFailed(e);
      return false;
    }
  }

  /** 主动断开：退订频道 + 断开连接，回到可再次创建/加入的状态 */
  function disconnect() {
    const goEasy = net.goEasy;
    const channel = net.channel;
    net.handlers = null;
    net.connected = false;
    net.role = null;
    net.roomId = null;
    net.channel = null;
    if (!goEasy) return;
    try {
      if (channel) {
        goEasy.pubsub.unsubscribe({ channel, onSuccess: () => {}, onFailed: () => {} });
        goEasy.pubsub.unsubscribePresence({ channel, onSuccess: () => {}, onFailed: () => {} });
      }
      goEasy.disconnect({ onSuccess: () => {}, onFailed: () => {} });
    } catch (e) { /* ignore */ }
    net.goEasy = null;
  }

  function getStatus() {
    try {
      if (net.goEasy && typeof net.goEasy.getConnectionStatus === "function") {
        return net.goEasy.getConnectionStatus();
      }
    } catch (e) { /* ignore */ }
    return "disconnected";
  }

  const api = {
    connect,
    disconnect,
    publishState,
    queryMembers,
    getStatus,
    getRole: () => net.role,
    getRoomId: () => net.roomId,
    isAvailable: () => !!SDK()
  };

  // 浏览器：挂到全局供 app.js 使用
  // Node (ESM/CJS)：支持两种导出方式，方便测试
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    if (typeof globalThis !== "undefined") globalThis.GoEasyNet = api;
  } else if (typeof globalThis !== "undefined") {
    globalThis.GoEasyNet = api;
  }
})();
