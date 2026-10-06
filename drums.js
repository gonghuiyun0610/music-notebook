/**
 * 鼓编辑器：四小节窗口、框选循环、名称静音、鼓点水平拖动。
 * Canvas 绘制静态鼓点；独立 DOM 竖线显示连续播放位置。
 * 本文件在 modules.js 后加载，保留知识目录、练习、媒体和 MIDI 功能。
 */
"use strict";

// 部件与打法分别成轨。以下为浏览器合成音色，不依赖在线采样。
Object.assign(DRUMS, {
  kick: "底鼓 · 标准",
  kickSoft: "底鼓 · 轻击",
  kickDeep: "底鼓 · 深低频",
  kickTight: "底鼓 · 短促重击",
  snare: "军鼓 · 标准",
  snareGhost: "军鼓 · 幽灵音",
  snareRimshot: "军鼓 · Rimshot",
  snareBrush: "军鼓 · 刷奏",
  rim: "军鼓 · 边击",
  cross: "军鼓 · Cross-stick",
  hihat: "踩镲 · 闭合",
  openhat: "踩镲 · 开镲",
  pedal: "踩镲 · 脚踩",
  tomHigh: "通鼓 · 高音",
  tomMid: "通鼓 · 中音",
  tomLow: "通鼓 · 落地",
  crash: "吊镲 · 标准",
  crashChoke: "吊镲 · 闷镲",
  ride: "叮叮镲 · 镲面",
  bell: "叮叮镲 · 镲帽",
  rideEdge: "叮叮镲 · 边缘",
});

function drumEnsureTracks(b) {
  const size = b.bars * meterSteps(b);
  b.visible = [...new Set(b.visible || Object.keys(b.tracks))].filter(
    (k) => DRUMS[k],
  );
  b.muted = [...new Set(b.muted || [])].filter((k) => DRUMS[k]);
  for (const key of b.visible) b.tracks[key] ||= Array(size).fill(0);
  for (const track of Object.values(b.tracks))
    while (track.length < size) track.push(0);
}

// 选中的部件才显示、发声；取消选择保留数据，重新勾选可恢复。
// 编辑模式的部件管理只保留「显示」，静音直接在轨道名称上切换。
drumParts = function (b) {
  if (!editing) return;
  stop();
  drumEnsureTracks(b);
  const dialog = el("dialog", { class: "drum-parts-dialog" }, [
    el("h2", { text: "管理鼓部件" }),
    el("p", {
      class: "muted",
      text: "选择显示的部件；取消显示保留原鼓点。静音请直接点击轨道名称。",
    }),
  ]);
  for (const [key, name] of Object.entries(DRUMS)) {
    const show = el("input", {
      type: "checkbox",
      "aria-label": "显示 " + name,
    });
    show.checked = b.visible.includes(key);
    show.onchange = () => {
      if (show.checked) {
        b.tracks[key] ||= Array(b.bars * meterSteps(b)).fill(0);
        b.visible = [...new Set([...b.visible, key])];
      } else b.visible = b.visible.filter((k) => k !== key);
      changed();
    };
    dialog.append(
      el("label", { class: "part-row" }, [
        show,
        el("span", { text: "显示 " + name }),
      ]),
    );
  }
  dialog.append(button("完成", () => dialog.close(), "primary"));
  dialog.onclose = () => {
    dialog.remove();
    render();
  };
  document.body.append(dialog);
  dialog.showModal();
};

// 每种打法使用不同的包络、音高或噪声音色，确保选择变化能听见。
drumSound = function (kind, when, bus) {
  const gain = ctx.createGain();
  gain.connect(bus);
  const kicks = {
    kick: [135, 45, 0.3, 0.48],
    kickSoft: [105, 42, 0.22, 0.25],
    kickDeep: [95, 30, 0.48, 0.5],
    kickTight: [170, 55, 0.14, 0.52],
    tomHigh: [290, 125, 0.24, 0.32],
    tomMid: [220, 85, 0.32, 0.34],
    tomLow: [145, 55, 0.42, 0.36],
  };
  function tone(frequency, length, type = "sine", level = 1) {
    const oscillator = ctx.createOscillator();
    const amp = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.connect(amp);
    amp.gain.value = level;
    amp.connect(gain);
    oscillator.start(when);
    oscillator.stop(when + length);
    return oscillator;
  }
  if (kicks[kind]) {
    const [high, low, length, level] = kicks[kind];
    const o = tone(high, length + 0.02);
    o.frequency.setValueAtTime(high, when);
    o.frequency.exponentialRampToValueAtTime(
      low,
      when + Math.min(0.16, length),
    );
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + length);
    return;
  }
  if (["rim", "cross", "ride", "bell", "rideEdge"].includes(kind)) {
    const settings = {
      rim: [1100, 0.085, 0.13],
      cross: [760, 0.055, 0.09],
      ride: [2200, 0.44, 0.045],
      bell: [1500, 0.7, 0.085],
      rideEdge: [2600, 0.58, 0.06],
    };
    const [freq, length, level] = settings[kind];
    [1, 1.48, 2.1, 3.4].forEach((ratio, i) =>
      tone(freq * ratio, length + 0.02, "triangle", 1 / (i + 1)),
    );
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + length);
    return;
  }
  const settings = {
    snare: [0.19, 1300, 0.28],
    snareGhost: [0.085, 1700, 0.075],
    snareRimshot: [0.23, 1100, 0.33],
    snareBrush: [0.3, 2400, 0.14],
    hihat: [0.055, 7500, 0.11],
    openhat: [0.42, 6000, 0.12],
    pedal: [0.085, 8200, 0.07],
    crash: [0.95, 4500, 0.13],
    crashChoke: [0.12, 4500, 0.12],
  };
  const [length, cutoff, level] = settings[kind] || settings.hihat;
  const buffer = ctx.createBuffer(
    1,
    Math.ceil(ctx.sampleRate * length),
    ctx.sampleRate,
  );
  const noise = buffer.getChannelData(0);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = cutoff;
  source.connect(filter);
  filter.connect(gain);
  gain.gain.setValueAtTime(kind === "snareBrush" ? 0.001 : level, when);
  if (kind === "snareBrush")
    gain.gain.linearRampToValueAtTime(level, when + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, when + length);
  if (kind === "snareRimshot") tone(1100, 0.055, "triangle", 0.2);
  if (kind === "snare") tone(180, 0.1, "triangle", 0.07);
  source.start(when);
  source.stop(when + length);
};

// 统一播放器每帧只更新一根竖线，鼓点本身不再逐格发亮。
function drawDrumPlayhead(b, position) {
  const canvas = [...document.querySelectorAll("[data-drum-canvas]")].find(
    (c) => c.dataset.drumCanvas === b.id,
  );
  if (canvas?.updatePlayhead) canvas.updatePlayhead(position);
}

// 转移鼓点：保持轨道不变，并吸附到十六分网格；目标已有鼓点则拒绝覆盖。
function drumMoveHit(b, key, from, to) {
  const total = b.bars * meterSteps(b);
  if (!Number.isInteger(to) || to < 0 || to >= total || to === from)
    return false;
  if (!b.tracks[key]?.[from] || b.tracks[key][to]) return false;
  b.tracks[key][from] = 0;
  b.tracks[key][to] = 1;
  return true;
}

// 无选择时循环全部；选择用整小节边界，和播放器共用 loopA / loopB。
function drumApplySelection(b, v) {
  const selection = v.drumSelection;
  if (
    selection &&
    Number.isInteger(selection.startBar) &&
    Number.isInteger(selection.endBar) &&
    selection.startBar >= 0 &&
    selection.startBar < b.bars &&
    selection.endBar > selection.startBar
  ) {
    selection.endBar = Math.min(selection.endBar, b.bars);
    v.loopA = selection.startBar * meterSteps(b);
    v.loopB = selection.endBar * meterSteps(b);
  } else {
    v.drumSelection = null;
    v.loopA = 0;
    v.loopB = b.bars * meterSteps(b);
  }
  v.loop = true;
}

rhythm = function (card, b) {
  repairBlock(b);
  drumEnsureTracks(b);
  const v = stateFor(b),
    steps = meterSteps(b),
    count = steps * 4;
  drumApplySelection(b, v);
  v.left = clamp(v.left, 0, Math.max(0, b.bars + (editing ? 4 : 0) - 4));
  card.onpointerdown = () => (activeBlock = b);
  // 阅读模式只显示三个控件。编辑模式仅追加部件管理按钮。
  const controls = el("div", { class: "controls drum-simple-controls" });
  const play = button("▶ 播放", () => togglePlayback(b), "primary");
  play.dataset.play = b.id;
  controls.append(
    play,
    numberControl("BPM", b.bpm, 20, 300, (n) => {
      stop();
      b.bpm = n;
      changed();
    }),
    choice(
      "拍号",
      b.meter,
      ["4/4", "3/4", "6/4", "6/8"].map((m) => [m, m]),
      (meter) => {
        stop();
        b.meter = meter;
        b.bars = Math.max(
          b.bars,
          Math.ceil(
            Math.max(
              1,
              ...Object.values(b.tracks).map((t) => t.lastIndexOf(1) + 1),
            ) / meterSteps(b),
          ),
        );
        drumEnsureTracks(b);
        drumApplySelection(b, v);
        v.cursor = v.loopA;
        redraw();
      },
    ),
  );
  if (editing) controls.append(button("管理鼓部件", () => drumParts(b)));
  card.append(controls);

  const viewport = el("div", { class: "drum-four-viewport" });
  const stage = el("div", { class: "drum-four-stage" });
  const canvas = el("canvas", {
    class: "drum-roll-canvas",
    tabindex: "0",
    "aria-label": "四小节鼓网格，上方小节块可框选循环",
  });
  canvas.dataset.drumCanvas = b.id;
  const labels = el("div", { class: "drum-name-buttons" });
  const line = el("div", { class: "drum-playhead", "aria-hidden": "true" });
  stage.append(canvas, labels, line);
  viewport.append(stage);
  card.append(viewport);
  // 真正的浏览器水平滚动条，独立于画布，纵向部件名称不会被滚走。
  const scroller = el("div", {
    class: "drum-time-scroll",
    tabindex: "0",
    role: "scrollbar",
    "aria-label": "鼓时间轴水平滚动条",
    "aria-orientation": "horizontal",
  });
  const spacer = el("div", { class: "drum-time-spacer" });
  scroller.append(spacer);
  card.append(scroller);
  const hint = el("p", { class: "hint" });
  card.append(hint);
  const labelW = 154,
    top = 62,
    rowH = 36,
    bottom = 10;
  let width = 1000,
    height = top + Math.max(1, b.visible.length) * rowH + bottom,
    drag = null;
  const first = () => v.left * steps;
  const cellW = () => (width - labelW) / count;
  const maxLeft = () => Math.max(0, b.bars + (editing ? 4 : 0) - 4);
  function syncScrollbar() {
    const plot = width - labelW;
    scroller.style.marginLeft = labelW + "px";
    scroller.style.width = plot + "px";
    spacer.style.width = plot * (1 + maxLeft() / 4) + "px";
    scroller.setAttribute("aria-valuemin", "0");
    scroller.setAttribute("aria-valuemax", String(maxLeft()));
    scroller.setAttribute("aria-valuenow", String(v.left));
    const desired = (v.left / 4) * plot;
    if (Math.abs(scroller.scrollLeft - desired) > 0.5)
      scroller.scrollLeft = desired;
  }
  function coords(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * width) / (rect.width || width),
      y = ((e.clientY - rect.top) * height) / (rect.height || height);
    return {
      x,
      y,
      row: Math.floor((y - top) / rowH),
      step: Math.floor(first() + (x - labelW) / cellW()),
    };
  }
  function selectionNow() {
    return drag?.kind === "range"
      ? {
          startBar: Math.min(drag.a, drag.b),
          endBar: Math.max(drag.a, drag.b) + 1,
        }
      : v.drumSelection;
  }
  function paint() {
    const c = canvas.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, width, height);
    c.fillStyle = "#fafbf8";
    c.fillRect(0, 0, width, height);
    c.fillStyle = "#f4f7f1";
    c.fillRect(0, 0, labelW, height);
    c.save();
    c.beginPath();
    c.rect(labelW, 0, width - labelW, height);
    c.clip();
    const chosen = selectionNow();
    const begin = Math.floor(v.left);
    for (let bar = begin; bar <= Math.ceil(v.left + 4); bar++) {
      const x = labelW + (bar * steps - first()) * cellW(),
        barWidth = steps * cellW();
      const selected = chosen && bar >= chosen.startBar && bar < chosen.endBar;
      c.fillStyle = selected
        ? "#bed4c5"
        : bar >= b.bars
          ? "#f0f1ec"
          : "#e6eee7";
      c.fillRect(x + 1, 2, barWidth - 2, 28);
      c.fillStyle = bar >= b.bars ? "#a6ada5" : "#425c4e";
      c.font = "12px system-ui, sans-serif";
      c.fillText(String(bar + 1), x + 8, 21);
    }
    for (let r = 0; r < Math.max(1, b.visible.length); r++) {
      const y = top + r * rowH;
      c.fillStyle = r % 2 ? "#f0f4ed" : "#fafbf8";
      c.fillRect(labelW, y, width - labelW, rowH);
      c.strokeStyle = "#dfe6dc";
      c.beginPath();
      c.moveTo(labelW, y + rowH);
      c.lineTo(width, y + rowH);
      c.stroke();
    }
    const unit = b.meter === "6/8" ? 2 : 4;
    for (let s = Math.floor(first()); s <= Math.ceil(first() + count); s++) {
      const x = labelW + (s - first()) * cellW();
      c.strokeStyle =
        s % steps === 0 ? "#8ba494" : s % unit === 0 ? "#c6d2c5" : "#e1e8dc";
      c.lineWidth = s % steps === 0 ? 1.2 : 0.5;
      c.beginPath();
      c.moveTo(x, 32);
      c.lineTo(x, height - bottom);
      c.stroke();
      if (s % unit === 0) {
        c.fillStyle = "#7c8f7d";
        c.font = "10px system-ui, sans-serif";
        c.fillText(String(Math.floor((s % steps) / unit) + 1), x + 3, 48);
      }
    }
    b.visible.forEach((key, row) => {
      for (
        let s = Math.max(0, Math.floor(first()));
        s < Math.min(b.tracks[key].length, Math.ceil(first() + count));
        s++
      ) {
        if (
          !b.tracks[key][s] ||
          (drag?.kind === "note" &&
            drag.moved &&
            drag.key === key &&
            drag.from === s)
        )
          continue;
        c.fillStyle = b.muted.includes(key) ? "#b0b9ae" : "#547e6c";
        c.fillRect(
          labelW + (s - first()) * cellW() + 2,
          top + row * rowH + 9,
          Math.max(2, cellW() - 4),
          18,
        );
      }
    });
    if (drag?.kind === "note" && drag.moved) {
      c.fillStyle = b.tracks[drag.key][drag.to] ? "#bd7970" : "#c8a25d";
      c.fillRect(
        labelW + (drag.to - first()) * cellW() + 2,
        top + drag.row * rowH + 8,
        Math.max(2, cellW() - 4),
        20,
      );
    }
    c.restore();
    hint.textContent = v.drumSelection
      ? "循环：第 " +
        (v.drumSelection.startBar + 1) +
        "–" +
        v.drumSelection.endBar +
        " 小节。再次框选同一范围或按 Esc 取消。"
      : "循环：全部 " +
        b.bars +
        " 小节。框选上方小节块可设置循环；点击部件文字切换静音。";
    if (editing)
      hint.textContent +=
        " 点空白添加、点鼓点删除、拖动鼓点移动；滚动到末尾空白小节可继续写。";
    if (!b.visible.length)
      hint.textContent = "没有显示的鼓部件，请在编辑模式管理鼓部件。";
    canvas.updatePlayhead(v.cursor, false);
  }
  function showPosition(position, follow = true) {
    if (
      follow &&
      transport?.id === b.id &&
      (position < first() || position >= first() + count)
    ) {
      v.left = clamp(Math.floor(position / steps / 4) * 4, 0, maxLeft());
      syncScrollbar();
      paint();
    }
    const x = labelW + (position - first()) * cellW();
    line.hidden = x < labelW || x > width || !Number.isFinite(x);
    line.style.left = x + "px";
    line.style.top = "31px";
    line.style.height = height - 31 - bottom + "px";
  }
  canvas.updatePlayhead = showPosition;
  canvas.paint = paint;
  b.visible.forEach((key, row) => {
    const name = button(
      DRUMS[key],
      () => {
        b.muted = b.muted.includes(key)
          ? b.muted.filter((k) => k !== key)
          : [...b.muted, key];
        name.classList.toggle("muted-track", b.muted.includes(key));
        name.setAttribute("aria-pressed", String(b.muted.includes(key)));
        changed();
        paint();
      },
      "drum-name",
    );
    name.style.top = top + row * rowH + "px";
    name.style.height = rowH + "px";
    name.classList.toggle("muted-track", b.muted.includes(key));
    name.setAttribute("aria-label", DRUMS[key] + " 静音切换");
    name.setAttribute("aria-pressed", String(b.muted.includes(key)));
    labels.append(name);
  });
  scroller.onscroll = () => {
    v.left = clamp((scroller.scrollLeft / (width - labelW)) * 4, 0, maxLeft());
    scroller.setAttribute("aria-valuenow", String(v.left));
    paint();
  };
  scroller.onkeydown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    v.left =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? maxLeft()
          : clamp(v.left + (e.key === "ArrowRight" ? 1 : -1), 0, maxLeft());
    syncScrollbar();
    paint();
  };
  canvas.onpointerdown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const p = coords(e);
    activeBlock = b;
    if (p.x < labelW) return;
    if (p.y <= 31) {
      stop();
      e.preventDefault();
      const bar = clamp(Math.floor(p.step / steps), 0, b.bars - 1);
      drag = { kind: "range", a: bar, b: bar };
    } else if (p.y < top) return;
    else {
      if (!editing || p.row < 0 || p.row >= b.visible.length || p.step < 0)
        return;
      stop();
      e.preventDefault();
      const key = b.visible[p.row];
      drag = {
        kind: "note",
        key,
        row: p.row,
        from: p.step,
        to: p.step,
        x: p.x,
        moved: false,
        existing: !!b.tracks[key][p.step],
      };
    }
    canvas.setPointerCapture?.(e.pointerId);
    paint();
  };
  canvas.onpointermove = (e) => {
    if (!drag) return;
    const p = coords(e);
    if (drag.kind === "range") {
      drag.b = clamp(Math.floor(p.step / steps), 0, b.bars - 1);
      paint();
    } else if (drag.existing && Math.abs(p.x - drag.x) > 3) {
      drag.moved = true;
      drag.to = clamp(p.step, 0, b.bars * steps - 1);
      paint();
    }
  };
  canvas.onpointerup = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.kind === "range") {
      const range = {
        startBar: Math.min(d.a, d.b),
        endBar: Math.max(d.a, d.b) + 1,
      };
      const same =
        v.drumSelection &&
        v.drumSelection.startBar === range.startBar &&
        v.drumSelection.endBar === range.endBar;
      v.drumSelection = same ? null : range;
      drumApplySelection(b, v);
      v.cursor = v.loopA;
      v.start = v.loopA;
    } else if (d.moved) {
      drumMoveHit(b, d.key, d.from, d.to);
    } else {
      if (d.from >= b.bars * steps) {
        b.bars = Math.floor(d.from / steps) + 1;
        drumEnsureTracks(b);
        drumApplySelection(b, v);
        syncScrollbar();
      }
      b.tracks[d.key][d.from] = b.tracks[d.key][d.from] ? 0 : 1;
    }
    changed();
    paint();
  };
  canvas.onpointercancel = () => {
    drag = null;
    paint();
  };
  canvas.onkeydown = (e) => {
    if (e.key === "Escape") {
      stop();
      drag = null;
      v.drumSelection = null;
      drumApplySelection(b, v);
      v.cursor = 0;
      v.start = 0;
      changed();
      paint();
    }
  };
  function resize() {
    width = Math.max(320, viewport.clientWidth || card.clientWidth || 1000);
    stage.style.width = width + "px";
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
    syncScrollbar();
    paint();
  }
  resize();
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    const cleanup = new MutationObserver(() => {
      if (!canvas.isConnected) {
        observer.disconnect();
        cleanup.disconnect();
      }
    });
    cleanup.observe($("blocks"), { childList: true, subtree: true });
  }
};
