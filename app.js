(function () {
  const { generateParty, DATA } = window.LoadoutCore;

  const state = {
    count: 1,
    sameEquip: false,
    sameOperator: false,
    map: null,        // null = 随机
    difficulty: null, // null = 随机
    excluded: { "霰弹枪": false, "栓动狙击": false, "手枪": false },
    tier: null,       // null = 随机档位
    result: null
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const allDifficulties = ["普通", "机密", "绝密", "永夜"];
  const gearIcons = { armor: "🛡️", helmet: "🪖", backpack: "🎒", rig: "🎽" };

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

  const countBtns = $$("#player-count button");
  const equipBtns = $$("#equip-mode button");
  const operatorBtns = $$("#operator-mode button");

  bindSegmented(countBtns, (v) => { state.count = Number(v); roll(); });
  bindSegmented(equipBtns, (v) => { state.sameEquip = v === "same"; roll(); });
  bindSegmented(operatorBtns, (v) => { state.sameOperator = v === "same"; roll(); });

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

  const mapBtns = buildGroup("#map-select", [
    { value: "random", text: "随机" },
    ...Object.keys(DATA.maps).map((name) => ({ value: name, text: name }))
  ], (v) => {
    state.map = v === "random" ? null : v;
    refreshDifficultyButtons();
    roll();
  });

  const difficultyBtns = buildGroup("#difficulty-select", [
    { value: "random", text: "随机" },
    ...allDifficulties.map((d) => ({ value: d, text: d }))
  ], (v) => {
    state.difficulty = v === "random" ? null : v;
    roll();
  });

  function refreshDifficultyButtons() {
    const enabled = state.map ? DATA.maps[state.map].difficulties : allDifficulties;
    difficultyBtns.forEach((btn) => {
      const v = btn.dataset.value;
      btn.classList.toggle("disabled", v !== "random" && !enabled.includes(v));
    });
    if (state.difficulty && state.map && !DATA.maps[state.map].difficulties.includes(state.difficulty)) {
      state.difficulty = null;
      difficultyBtns.forEach((b) => b.classList.toggle("active", b.dataset.value === "random"));
    }
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

  function chipsHtml(items) {
    return items.map((it) => `<span class="chip">${it.name}<i>${fmt(it.price)}</i></span>`).join("");
  }

  function gearSlot(label, icon, item) {
    return `
      <div class="slot">
        <div class="slot-label"><span>${icon}</span>${label}</div>
        <div class="gear-row">
          <span class="gear-name">${item.name}</span>
          <span class="gear-price">${fmt(item.price)}</span>
        </div>
      </div>`;
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
        <span class="m-label">👥 队伍</span>
        <span class="m-value">${teamLabel}</span>
      </div>
      <div class="mission-item">
        <span class="m-label">🎒 装备</span>
        <span class="m-value">${state.sameEquip ? "全员相同" : "各自不同"}</span>
      </div>
      <div class="mission-item">
        <span class="m-label">🪖 干员</span>
        <span class="m-value">${state.sameOperator ? "全员相同" : "各自不同"}</span>
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
          </div>
          <div class="req-row">
            <span>${r.requirement > 0 ? "战备要求 ≥ " + fmt(r.requirement) : "无战备门槛"}</span>
            <span class="req-state ${ok ? "ok" : "no"}">${r.requirement > 0 ? (ok ? "达标 ✓" : "未达标 ✗") : "自由配装"}</span>
          </div>
          <div class="meter"><div class="meter-fill ${ok ? "" : "no"}" style="width:${pct}%"></div></div>
          <div class="slot">
            <div class="slot-label"><span>🎯</span>主武器</div>
            <div class="weapon-row">
              <span class="weapon-name">${p.primary.name}</span>
              <span class="cat-tag cat-${p.primary.cat}">${p.primary.cat}</span>
              <span class="weapon-price">${fmt(p.primary.price)}</span>
            </div>
            <div class="chips">${chipsHtml(p.primaryAtts)}</div>
          </div>
          ${gearSlot("防具", gearIcons.armor, p.armor)}
          ${gearSlot("头盔", gearIcons.helmet, p.helmet)}
          ${gearSlot("背包", gearIcons.backpack, p.backpack)}
          ${gearSlot("胸挂", gearIcons.rig, p.rig)}
          <div class="card-foot">
            <span class="req-status ${ok ? "ok" : "no"}">${r.requirement > 0 ? (ok ? "战备达标 ✓" : "战备未达标 ✗") : "自由配装"}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function roll() {
    const md = resolveMapDifficulty();
    const excludedCats = Object.keys(state.excluded).filter((k) => state.excluded[k]);
    state.result = generateParty(state.count, state.sameEquip, state.sameOperator, md.requirement, excludedCats, state.tier);
    state.result.map = md.map;
    state.result.difficulty = md.difficulty;
    state.result.requirement = md.requirement;
    state.result.excludedCats = excludedCats;
    render();
  }

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
    if (r.excludedCats.length) {
      lines.push(`枪械排除：${r.excludedCats.join("、")}`);
    }
    r.players.forEach((p, i) => {
      const ok = r.requirement <= 0 || p.price >= r.requirement;
      lines.push("");
      lines.push(`【${names[i]}】${p.operator.name}（${p.operator.role}兵）`);
      lines.push(`主武器：${p.primary.name}（${p.primary.cat}） ${p.primaryAtts.map(a => a.name).join("、")}`);
      lines.push(`防具：${p.armor.name} / 头盔：${p.helmet.name} / 背包：${p.backpack.name} / 胸挂：${p.rig.name}`);
      lines.push(`战备值：${fmt(p.price)}${r.requirement > 0 ? `（要求 ≥ ${fmt(r.requirement)}，${ok ? "达标" : "未达标"}）` : ""}`);
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

  $("#roll-btn").addEventListener("click", roll);
  $("#copy-btn").addEventListener("click", copyText);
  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") roll();
  });

  refreshDifficultyButtons();
  roll();
})();
