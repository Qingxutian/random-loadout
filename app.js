(function () {
  const { generateParty, DATA } = window.LoadoutCore;
  const LoadoutState = (typeof window !== "undefined" && window.LoadoutState) || globalThis.LoadoutState;
  const GoEasyNet = (typeof window !== "undefined" && window.GoEasyNet) || globalThis.GoEasyNet;

  // 统一状态对象：所有配置 + 随机结果都收敛在这里，纯 JSON、可序列化
  const state = LoadoutState.createState();

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const allDifficulties = ["普通", "机密", "绝密", "永夜"];
  const gearIcons = { armor: "🛡️", helmet: "🪖", backpack: "🎒", rig: "🎽" };

  function ensureLocks() {
    state.locks = LoadoutState.normalizeLocks(state.locks);
  }

  let toastTimer = null;
  function showToast(msg) {
    const host = document.body || document.documentElement;
    if (!host) return;
    let toast = $("#toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      host.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  // ---------- 联机同步 ----------
  // 房主每次修改配置 / 随机 / 锁定后广播全量 state；队员收到后直接应用，不再本地随机
  function broadcast() {
    if (state.mode !== "room" || !state.room || state.room.role !== "host") return;
    GoEasyNet.publishState(LoadoutState.serializeWire(state));
  }

  // 收到房主广播：归一化后整体替换本地 state（保留自己的身份和房间号；
  // GoEasy 会把消息回推给所有订阅者，房主收到自己的回包也不能被降级为队员）
  function handleRemoteState(content) {
    if (state.mode !== "room" || !state.room || !state.room.id) return;
    const incoming = typeof content === "string"
      ? LoadoutState.parseWire(content)
      : LoadoutState.normalizeState(content);
    if (!incoming.room || incoming.room.id !== state.room.id) return;
    const roomId = state.room.id;
    const online = state.room.online;
    const role = state.room.role === "host" ? "host" : "member";
    Object.keys(incoming).forEach((k) => { state[k] = incoming[k]; });
    state.mode = "room";
    state.room = { id: roomId, role, online };
    syncAllControls();
    render();
  }

  // 在线人数 / 上线事件：人数优先取 SDK 维护的成员列表长度（presence 事件自带 members，
  // 2.x 的 amount 字段不稳定，可能缺失或只是单次变化量），再回退到 amount；
  // 房主收到新成员 join 时补发一次当前状态，确保新人拿到最新结果
  function handlePresence(ev) {
    if (state.mode !== "room" || !state.room) return;
    let online = state.room.online;
    if (Array.isArray(ev && ev.members) && ev.members.length >= 1) {
      online = ev.members.length;
    } else {
      const amount = Number(ev && ev.amount);
      if (Number.isInteger(amount) && amount >= 1) online = amount;
    }
    state.room.online = online;
    renderRoomUI();
    if (state.room.role === "host" && ev && (ev.action === "join" || ev.action === "back")) {
      broadcast();
    }
  }

  const netStatusLabels = {
    connecting: "连接中…",
    connected: "已连接",
    reconnecting: "重连中…",
    failed: "连接失败",
    unavailable: "通讯不可用",
    subscribe_failed: "订阅失败",
    presence_failed: "在线状态失败",
    publish_failed: "同步失败"
  };
  const netStatusClass = {
    connecting: "warn",
    connected: "ok",
    reconnecting: "warn",
    failed: "no",
    unavailable: "no",
    subscribe_failed: "no",
    presence_failed: "no",
    publish_failed: "no"
  };

  function handleNetStatus(kind) {
    const el = $("#room-net-status");
    const text = $("#room-net-text");
    if (!el || !text) return;
    el.classList.remove("ok", "warn", "no");
    const cls = netStatusClass[kind] || "";
    if (cls) el.classList.add(cls);
    text.textContent = netStatusLabels[kind] || "未知状态";
    if (kind === "connected") {
      showToast("联机已连接");
    } else if (kind === "reconnecting") {
      showToast("网络断开，正在重连…");
    } else if (kind === "failed") {
      showToast("联机连接失败");
    } else if (kind === "unavailable") {
      showToast("联机通讯模块不可用");
    }
  }

  function buildGroup(containerSel, options, onChange) {
    const container = $(containerSel);
    const buttons = [];
    options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.value = opt.value;
      btn.textContent = opt.text;
      if (i === 0) btn.classList.add("active");
      btn.addEventListener("click", () => {
        if (btn.classList.contains("disabled")) return;
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        onChange(opt.value);
      });
      container.appendChild(btn);
      buttons.push(btn);
    });
    return buttons;
  }

  function bindSegmented(buttons, onChange) {
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains("disabled")) return;
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        onChange(btn.dataset.value);
      });
    });
  }

  function bindToggle(buttons, onChange) {
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const on = !btn.classList.contains("active");
        btn.classList.toggle("active", on);
        onChange(btn.dataset.value, on);
      });
    });
  }

  // ---------- 顶部模式切换 ----------
  const modeBtns = $$("#mode-switch button");

  function renderRoomUI() {
    const bar = $("#room-bar");
    const controlsPanel = $(".controls");
    const inRoom = state.mode === "room" && state.room && state.room.id;
    bar.classList.toggle("hidden", !inRoom);
    if (inRoom) {
      $("#room-id").textContent = state.room.id;
      $("#room-online").textContent = String(state.room.online);
      $("#room-role").textContent = state.room.role === "host" ? "房主" : "队员";
      controlsPanel.classList.toggle("room-member", state.room.role === "member");
    } else {
      controlsPanel.classList.remove("room-member");
      const netStatus = $("#room-net-status");
      if (netStatus) {
        netStatus.classList.remove("ok", "warn", "no");
        const text = $("#room-net-text");
        if (text) text.textContent = "未连接";
      }
    }
    modeBtns.forEach((b) => b.classList.toggle("active", !inRoom && b.dataset.mode === "solo"));
  }

  function isMemberView() {
    return state.mode === "room" && state.room && state.room.role === "member";
  }

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === "solo") {
        if (state.mode === "room") GoEasyNet.disconnect();
        state.mode = "solo";
        state.room = null;
        renderRoomUI();
        render();
      } else {
        openRoomModal(mode); // "create" | "join"
      }
    });
  });

  // ---------- 创建/加入房间弹窗 ----------
  const modal = $("#modal");
  const modalTitle = $("#modal-title");
  const createBody = $("#create-room-body");
  const joinBody = $("#join-room-body");
  const createCode = $("#create-room-code");
  const joinInput = $("#join-room-input");
  const joinError = $("#join-room-error");

  function openRoomModal(kind) {
    if (state.mode === "room") {
      showToast("请先退出当前房间，再创建或加入新房间");
      return;
    }
    if (kind === "create") {
      modalTitle.textContent = "创建房间";
      createBody.classList.remove("hidden");
      joinBody.classList.add("hidden");
      createCode.textContent = String(Math.floor(100000 + Math.random() * 900000));
    } else {
      modalTitle.textContent = "加入房间";
      createBody.classList.add("hidden");
      joinBody.classList.remove("hidden");
      joinError.textContent = "";
      joinInput.value = "";
    }
    modal.classList.remove("hidden");
    if (kind === "join" && joinInput.focus) joinInput.focus();
  }

  function closeRoomModal() {
    modal.classList.add("hidden");
  }

  $("#modal-close").addEventListener("click", closeRoomModal);
  $("#modal-backdrop").addEventListener("click", closeRoomModal);

  const netHandlers = {
    onState: handleRemoteState,
    onPresence: handlePresence,
    onStatus: handleNetStatus,
    onReady: () => {
      if (state.mode === "room" && state.room && state.room.role === "host") {
        broadcast(); // 房主连接成功后立即广播当前状态
      }
      // 连接成功后主动查一次在线成员，避免人数停留在初始的 1
      GoEasyNet.queryMembers((r) => {
        if (state.mode !== "room" || !state.room || !r) return;
        const n = (Array.isArray(r.members) && r.members.length >= 1)
          ? r.members.length
          : Number(r.amount);
        if (Number.isInteger(n) && n >= 1 && state.room.online !== n) {
          state.room.online = n;
          renderRoomUI();
        }
      });
    }
  };

  $("#create-room-confirm").addEventListener("click", () => {
    const id = createCode.textContent.trim();
    if (!/^\d{6}$/.test(id)) return;
    state.mode = "room";
    state.room = { id, role: "host", online: 1 };
    closeRoomModal();
    renderRoomUI();
    render();
    GoEasyNet.connect({ roomId: id, role: "host", handlers: netHandlers });
    showToast("房间已创建，等待队友加入…");
  });

  $("#join-room-confirm").addEventListener("click", () => {
    const id = joinInput.value.trim();
    if (!/^\d{6}$/.test(id)) {
      joinError.textContent = "请输入 6 位数字房间号";
      return;
    }
    state.mode = "room";
    state.room = { id, role: "member", online: 1 };
    closeRoomModal();
    renderRoomUI();
    GoEasyNet.connect({ roomId: id, role: "member", handlers: netHandlers });
    showToast("正在加入房间…");
  });

  $("#room-copy").addEventListener("click", () => {
    if (!state.room || !state.room.id) return;
    copyTextOf(state.room.id, "房间号已复制");
  });

  $("#room-exit").addEventListener("click", () => {
    GoEasyNet.disconnect();
    state.mode = "solo";
    state.room = null;
    renderRoomUI();
    render();
  });

  const countBtns = $$("#player-count button");
  const equipBtns = $$("#equip-mode button");
  const operatorBtns = $$("#operator-mode button");
  const operatorEnabledBtns = $$("#operator-enabled button");

  bindSegmented(countBtns, (v) => { state.count = Number(v); roll(); });
  bindSegmented(equipBtns, (v) => { state.sameEquip = v === "same"; roll(); });
  bindSegmented(operatorEnabledBtns, (v) => {
    state.operatorEnabled = v === "on";
    operatorBtns.forEach((b) => b.classList.toggle("disabled", !state.operatorEnabled));
    roll();
  });
  bindSegmented(operatorBtns, (v) => { state.sameOperator = v === "same"; roll(); });
  operatorEnabledBtns.forEach((b) => b.classList.toggle("active", (b.dataset.value === "on") === state.operatorEnabled));
  operatorBtns.forEach((b) => b.classList.toggle("disabled", !state.operatorEnabled));

  bindToggle($$("#exclude-select button"), (value, on) => {
    state.excluded[value] = on;
    roll();
  });

  const tierLabels = { low: "低价值", mid: "中价值", high: "高价值" };
  const tierBtns = buildGroup("#value-select", [
    { value: "random", text: "随机" },
    { value: "low", text: "低价值" },
    { value: "mid", text: "中价值" },
    { value: "high", text: "高价值" }
  ], (v) => {
    state.tier = v === "random" ? null : v;
    roll();
  });

  // ---------- 装备价值锁 ----------
  const valueCapToggle = $("#value-cap-toggle");
  const valueCapInput = $("#value-cap-input");

  function syncValueCapUI() {
    valueCapToggle.classList.toggle("active", state.valueCapEnabled);
    valueCapInput.disabled = !state.valueCapEnabled;
    if (state.valueCap) valueCapInput.value = state.valueCap;
  }

  valueCapToggle.addEventListener("click", () => {
    state.valueCapEnabled = !state.valueCapEnabled;
    if (!state.valueCapEnabled) state.valueCap = null;
    syncValueCapUI();
    if (state.valueCapEnabled && !state.valueCap && valueCapInput.focus) valueCapInput.focus();
    roll();
  });

  valueCapInput.addEventListener("change", () => {
    const v = Math.floor(Number(valueCapInput.value));
    state.valueCap = Number.isFinite(v) && v > 0 ? v : null;
    if (!state.valueCap) valueCapInput.value = "";
    syncValueCapUI();
    roll();
  });

  const mapBtns = buildGroup("#map-select", [
    { value: "random", text: "随机" },
    ...Object.keys(DATA.maps).map((name) => ({ value: name, text: name }))
  ], (v) => {
    state.map = v === "random" ? null : v;
    if (state.map && state.difficulty && !DATA.maps[state.map].difficulties.includes(state.difficulty)) {
      state.difficulty = null;
    }
    buildDifficultyButtons();
    roll();
  });

  const difficultyContainer = $("#difficulty-select");
  const difficultyBtns = [];

  // 难度/行动模式下拉：只展示当前地图真实存在的模式（含“随机”），移除灰色禁用项
  function buildDifficultyButtons() {
    const available = state.map ? DATA.maps[state.map].difficulties : allDifficulties;
    difficultyContainer.innerHTML = "";
    difficultyBtns.length = 0;
    const opts = [{ value: "random", text: "随机" }, ...available.map((d) => ({ value: d, text: d }))];
    opts.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.value = opt.value;
      btn.textContent = opt.text;
      btn.classList.toggle("active", opt.value === "random" ? !state.difficulty : state.difficulty === opt.value);
      btn.addEventListener("click", () => {
        state.difficulty = opt.value === "random" ? null : opt.value;
        difficultyBtns.forEach((b) => b.classList.toggle("active", b === btn));
        roll();
      });
      difficultyContainer.appendChild(btn);
      difficultyBtns.push(btn);
    });
  }

  // 联机收到广播后：把页面所有控件的高亮状态同步成 state 里的值
  function syncAllControls() {
    countBtns.forEach((b) => b.classList.toggle("active", Number(b.dataset.value) === state.count));
    equipBtns.forEach((b) => b.classList.toggle("active", (b.dataset.value === "same") === state.sameEquip));
    operatorEnabledBtns.forEach((b) => b.classList.toggle("active", (b.dataset.value === "on") === state.operatorEnabled));
    operatorBtns.forEach((b) => b.classList.toggle("disabled", !state.operatorEnabled));
    operatorBtns.forEach((b) => b.classList.toggle("active", (b.dataset.value === "same") === state.sameOperator));
    $$("#exclude-select button").forEach((b) => b.classList.toggle("active", !!state.excluded[b.dataset.value]));
    tierBtns.forEach((b) => b.classList.toggle("active", b.dataset.value === "random" ? !state.tier : b.dataset.value === state.tier));
    mapBtns.forEach((b) => b.classList.toggle("active", b.dataset.value === "random" ? !state.map : b.dataset.value === state.map));
    buildDifficultyButtons();
    syncValueCapUI();
  }

  function resolveMapDifficulty() {
    const mapNames = Object.keys(DATA.maps);
    const mapName = state.map || mapNames[Math.floor(Math.random() * mapNames.length)];
    const info = DATA.maps[mapName];
    const diff = (state.difficulty && info.difficulties.includes(state.difficulty))
      ? state.difficulty
      : info.difficulties[Math.floor(Math.random() * info.difficulties.length)];
    return { map: mapName, difficulty: diff, requirement: info.requirement[diff] || 0 };
  }

  function fmt(n) {
    return n.toLocaleString("zh-CN");
  }

  // ---------- 单项锁定 ----------
  function lockHtml(playerIdx, key, attIdx) {
    ensureLocks();
    const lk = state.locks[playerIdx];
    const locked = attIdx != null ? !!lk.primaryAtts[attIdx] : !!lk[key];
    const disabled = state.sameEquip && playerIdx > 0;
    const title = disabled
      ? "全员相同装备时，以首位队员的锁定为准"
      : locked ? "点击解锁，下次随机时此项目重新随机"
      : key === "ammo" ? "点击锁定弹药（将同时锁定主武器）"
      : "点击锁定，下次随机时此项目保持不变";
    return `<button type="button" class="lock-btn ${locked ? "on" : ""}" data-lock-player="${playerIdx}" data-lock-key="${key}"${attIdx != null ? ` data-lock-att="${attIdx}"` : ""}${disabled ? " disabled" : ""} title="${title}">${locked ? "🔒" : "🔓"}</button>`;
  }

  function chipsHtml(items, playerIdx) {
    return items.map((it, attIdx) => {
      ensureLocks();
      const locked = !!state.locks[playerIdx].primaryAtts[attIdx];
      return `
        <span class="chip ${locked ? "locked" : ""}">
          ${it.name}<i>${fmt(it.price)}</i>
          ${lockHtml(playerIdx, "primaryAtts", attIdx)}
        </span>`;
    }).join("");
  }

  function gearSlot(label, icon, item, key, playerIdx) {
    return `
      <div class="slot">
        <div class="slot-label"><span>${icon}</span>${label}</div>
        <div class="gear-row">
          <span class="gear-name">${item.name}</span>
          <span class="gear-price">${fmt(item.price)}</span>
          ${lockHtml(playerIdx, key)}
        </div>
      </div>`;
  }

  function ammoSlot(ammo, playerIdx) {
    return `
      <div class="slot">
        <div class="slot-label"><span>🧨</span>弹药<span class="not-counted">不计战备</span></div>
        <div class="gear-row">
          <span class="gear-name">${ammo.caliber} · ${ammo.name}</span>
          <span class="gear-price">${fmt(ammo.price)}</span>
          ${lockHtml(playerIdx, "ammo")}
        </div>
      </div>`;
  }

  function lockedCount() {
    ensureLocks();
    let c = 0;
    for (let i = 0; i < state.count; i++) {
      const lk = state.locks[i];
      c += (lk.operator ? 1 : 0) + (lk.primary ? 1 : 0) + lk.primaryAtts.filter(Boolean).length
        + (lk.ammo ? 1 : 0) + (lk.armor ? 1 : 0) + (lk.helmet ? 1 : 0) + (lk.backpack ? 1 : 0) + (lk.rig ? 1 : 0);
    }
    return c;
  }

  function render() {
    const r = state.result;
    if (!r) return;

    const teamLabel = state.count === 1 ? "单人" : state.count === 2 ? "双人" : "三人";
    const meta = $("#meta");
    meta.classList.remove("hidden");
    meta.innerHTML = `
      <div class="mission-item">
        <span class="m-label">🗺️ 地图</span>
        <span class="m-value">${r.map}</span>
      </div>
      <div class="mission-item">
        <span class="m-label">☠️ 难度</span>
        <span class="m-value">${r.difficulty}</span>
      </div>
      <div class="mission-item">
        <span class="m-label">🎯 战备要求</span>
        <span class="m-value">${r.requirement > 0 ? "≥ " + fmt(r.requirement) : "无门槛"}</span>
      </div>
      <div class="mission-item">
        <span class="m-label">🔫 枪械</span>
        <span class="m-value">${r.excludedCats.length ? "排除 " + r.excludedCats.join("、") : "全部可选"}</span>
      </div>
      <div class="mission-item">
        <span class="m-label">💎 价值档位</span>
        <span class="m-value">${state.tier ? tierLabels[state.tier] : "随机"}</span>
      </div>
      <div class="mission-item">
        <span class="m-label">🔒 装备价值锁</span>
        <span class="m-value">${r.valueCap ? "≤ " + fmt(r.valueCap) : "未启用"}</span>
      </div>
      <div class="mission-item">
        <span class="m-label">👥 队伍</span>
        <span class="m-value">${teamLabel}</span>
      </div>
      <div class="mission-item">
        <span class="m-label">🎒 装备</span>
        <span class="m-value">${state.sameEquip ? "全员相同" : "各自不同"}</span>
      </div>
      <div class="mission-item">
        <span class="m-label">🪖 干员</span>
        <span class="m-value">${state.operatorEnabled ? (state.sameOperator ? "全员相同" : "各自随机") : "固定不随机"}</span>
      </div>
      <div class="mission-item">
        <span class="m-label">🔒 单项锁定</span>
        <span class="m-value">${lockedCount() > 0 ? `已锁定 ${lockedCount()} 项` : "未锁定"}</span>
      </div>
      <div class="total">
        <span class="m-label">队伍战备总值</span>
        <span class="m-value total-num">${fmt(r.totalPrice)}</span>
      </div>
    `;

    const names = state.count === 1 ? ["你"] : state.count === 2 ? ["玩家 1", "玩家 2"] : ["玩家 1", "玩家 2", "玩家 3"];

    $("#players").innerHTML = r.players.map((p, i) => {
      const same = state.sameEquip && i > 0;
      const ok = r.requirement <= 0 || p.price >= r.requirement;
      const over = r.valueCap > 0 && p.price > r.valueCap;
      const pct = r.requirement > 0 ? Math.min(100, Math.round((p.price / r.requirement) * 100)) : 100;
      return `
        <div class="player-card">
          <div class="card-head">
            <span class="player-name">${names[i]}${same ? `<span class="same-badge">同套装备</span>` : ""}</span>
            <span class="card-price">
              <span class="price-label">战备值</span>
              <span class="price-num">${fmt(p.price)}</span>
            </span>
          </div>
          <div class="operator-row">
            <div class="operator-avatar role-avatar-${p.operator.role}">${p.operator.name.slice(0, 1)}</div>
            <div class="operator-info">
              <div class="operator-name">${p.operator.name}</div>
              <div class="operator-real">${p.operator.real}</div>
            </div>
            <span class="role-badge role-${p.operator.role}">${p.operator.role}兵</span>
            ${lockHtml(i, "operator")}
          </div>
          <div class="req-row">
            <span>${r.requirement > 0 ? "战备要求 ≥ " + fmt(r.requirement) : "无战备门槛"}${r.valueCap ? ` · 上限 ≤ ${fmt(r.valueCap)}` : ""}</span>
            <span class="req-state ${over ? "no" : ok ? "ok" : "no"}">${over ? "超出上限 ✗" : r.requirement > 0 ? (ok ? "达标 ✓" : "未达标 ✗") : "自由配装"}</span>
          </div>
          <div class="meter"><div class="meter-fill ${ok ? "" : "no"}" style="width:${pct}%"></div></div>
          <div class="slot">
            <div class="slot-label"><span>🎯</span>主武器</div>
            <div class="weapon-row">
              <span class="weapon-name">${p.primary.name}</span>
              <span class="cat-tag cat-${p.primary.cat}">${p.primary.cat}</span>
              <span class="weapon-price">${fmt(p.primary.price)}</span>
              ${lockHtml(i, "primary")}
            </div>
            <div class="chips">${chipsHtml(p.primaryAtts, i)}</div>
          </div>
          ${ammoSlot(p.ammo, i)}
          ${gearSlot("防具", gearIcons.armor, p.armor, "armor", i)}
          ${gearSlot("头盔", gearIcons.helmet, p.helmet, "helmet", i)}
          ${gearSlot("背包", gearIcons.backpack, p.backpack, "backpack", i)}
          ${gearSlot("胸挂", gearIcons.rig, p.rig, "rig", i)}
          <div class="card-foot">
            <span class="req-status ${over ? "no" : ok ? "ok" : "no"}">${over ? "超出价值上限 ✗" : r.requirement > 0 ? (ok ? "战备达标 ✓" : "战备未达标 ✗") : "自由配装"}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function roll() {
    if (isMemberView()) return; // 队员只能查看，不能随机
    ensureLocks();
    const md = resolveMapDifficulty();
    const excludedCats = Object.keys(state.excluded).filter((k) => state.excluded[k]);
    const prev = state.result;
    const valueCap = state.valueCapEnabled ? state.valueCap : null;
    state.result = generateParty({
      count: state.count,
      sameEquip: state.sameEquip,
      sameOperator: state.sameOperator,
      operatorEnabled: state.operatorEnabled,
      target: md.requirement,
      excludedCats,
      tier: state.tier,
      valueCap,
      locks: state.locks,
      prev
    });
    state.result.map = md.map;
    state.result.difficulty = md.difficulty;
    state.result.requirement = md.requirement;
    state.result.excludedCats = excludedCats;
    state.result.valueCap = valueCap;
    render();
    broadcast();
  }

  // 锁定按钮：事件委托（卡片每次重新渲染）
  $("#players").addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest(".lock-btn") : null;
    if (!btn || btn.disabled) return;
    if (isMemberView()) return;
    const pi = Number(btn.dataset.lockPlayer);
    const key = btn.dataset.lockKey;
    if (!key || Number.isNaN(pi)) return;
    ensureLocks();
    if (key === "primaryAtts") {
      const ai = Number(btn.dataset.lockAtt);
      if (Number.isNaN(ai)) return;
      state.locks[pi].primaryAtts[ai] = !state.locks[pi].primaryAtts[ai];
    } else {
      state.locks[pi][key] = !state.locks[pi][key];
      // 弹药锁定跟随主武器：锁弹药时自动带上主武器
      if (key === "ammo" && state.locks[pi].ammo && !state.locks[pi].primary) {
        state.locks[pi].primary = true;
      }
    }
    render();
    broadcast();
  });

  function copyText() {
    if (!state.result) return;
    const r = state.result;
    const names = state.count === 1 ? ["你"] : state.count === 2 ? ["玩家 1", "玩家 2"] : ["玩家 1", "玩家 2", "玩家 3"];
    const lines = [];
    lines.push(`三角洲行动随机配装（${state.count === 1 ? "单人" : state.count === 2 ? "双人" : "三人"}队）`);
    lines.push(`地图：${r.map} · 难度：${r.difficulty} · 战备要求：${r.requirement > 0 ? "≥ " + fmt(r.requirement) : "无门槛"}`);
    if (state.tier) {
      lines.push(`价值档位：${tierLabels[state.tier]}`);
    }
    if (r.valueCap) {
      lines.push(`装备价值锁：每人 ≤ ${fmt(r.valueCap)} 哈夫币`);
    }
    if (r.excludedCats.length) {
      lines.push(`枪械排除：${r.excludedCats.join("、")}`);
    }
    r.players.forEach((p, i) => {
      const ok = r.requirement <= 0 || p.price >= r.requirement;
      const over = r.valueCap > 0 && p.price > r.valueCap;
      lines.push("");
      lines.push(`【${names[i]}】${p.operator.name}（${p.operator.role}兵）`);
      lines.push(`主武器：${p.primary.name}（${p.primary.cat}） ${p.primaryAtts.map(a => a.name).join("、")}`);
      lines.push(`弹药：${p.ammo.caliber} ${p.ammo.name}（不计战备）`);
      lines.push(`防具：${p.armor.name} / 头盔：${p.helmet.name} / 背包：${p.backpack.name} / 胸挂：${p.rig.name}`);
      lines.push(`战备值：${fmt(p.price)}${r.requirement > 0 ? `（要求 ≥ ${fmt(r.requirement)}，${ok ? "达标" : "未达标"}）` : ""}${over ? "（超出价值上限）" : ""}`);
    });
    lines.push("");
    lines.push(`队伍战备总值：${fmt(r.totalPrice)} 哈夫币`);

    const text = lines.join("\n");
    const done = () => {
      const btn = $("#copy-btn");
      const old = btn.textContent;
      btn.textContent = "✅ 已复制";
      setTimeout(() => { btn.textContent = old; }, 1500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style = { position: "fixed", opacity: "0" };
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    done();
  }

  function copyTextOf(text, tip) {
    const done = () => showToast(tip || "已复制");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  $("#roll-btn").addEventListener("click", roll);
  $("#copy-btn").addEventListener("click", copyText);
  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") roll();
    if (e.key === "Escape") closeRoomModal();
  });
  window.addEventListener("beforeunload", () => GoEasyNet.disconnect());

  renderRoomUI();
  syncAllControls();
  roll();
})();
