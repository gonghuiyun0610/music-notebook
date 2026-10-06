/* MIDI 文件编解码与浏览器合成音色。 */
"use strict";

function midiDefaults() {
  return { name: "我的 MIDI 织体", bpm: 90, bars: 8, meter: "4/4", octave: 3, snap: 1, notes: [] };
}
function midiRepairLegacyBlock(b) {
  for (const [k, v] of Object.entries(midiDefaults())) if (b[k] === undefined) b[k] = v;
}
function midiValidate(b) {
  if (!Array.isArray(b.notes) || b.notes.length > 100000 || !["4/4", "3/4", "6/4", "6/8"].includes(b.meter || "4/4")) throw Error("MIDI 数据不正确。");
  if (!Number.isInteger(b.bars) || b.bars < 1 || b.bars > 4096 || !Number.isFinite(b.bpm) || b.bpm < 20 || b.bpm > 300) throw Error("MIDI 小节或 BPM 不正确。");
  for (const n of b.notes) if (!Number.isInteger(n.pitch) || n.pitch < 0 || n.pitch > 127 || !Number.isFinite(n.start) || n.start < 0 || !Number.isFinite(n.duration) || n.duration <= 0 || n.start + n.duration > b.bars * meterSteps(b) + .01 || !Number.isInteger(n.velocity) || n.velocity < 1 || n.velocity > 127) throw Error("MIDI 音符越界或参数不正确。");
}

// SMF 0/1：支持运行状态、速度、拍号和多轨。保留原始音符时序。
function midiParse(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer); let pos = 0;
  const read = () => { if (pos >= bytes.length) throw Error("MIDI 文件截断。"); return bytes[pos++]; };
  const tag = () => String.fromCharCode(read(), read(), read(), read());
  const u16 = () => (read() << 8) | read();
  const u32 = () => { const v = view.getUint32(pos); pos += 4; return v; };
  function vlq() { let n = 0; for (let i = 0; i < 4; i++) { const v = read(); n = n * 128 + (v & 127); if (!(v & 128)) return n; } throw Error("MIDI 时间编码不正确。"); }
  if (tag() !== "MThd") throw Error("请选择标准 .mid 文件。");
  const headerLen = u32(); if (headerLen < 6) throw Error("MIDI 文件头无效。");
  const format = u16(), count = u16(), ppq = u16();
  if (format > 1) throw Error("暂不支持独立序列格式 2。");
  if (ppq & 0x8000 || !ppq) throw Error("暂不支持 SMPTE 时间码 MIDI。");
  pos = 8 + headerLen;
  const tracks = []; const tempos = []; const meters = [];
  for (let index = 0; index < count; index++) {
    if (tag() !== "MTrk") throw Error("MIDI 轨道无效。");
    const length = u32(); const end = pos + length;
    if (end > bytes.length) throw Error("MIDI 轨道截断。");
    let tick = 0, running = 0, name = "轨道 " + (index + 1); const notes = []; const pending = new Map();
    while (pos < end) {
      tick += vlq(); let statusByte = read();
      if (statusByte < 128) { if (!running) throw Error("运行状态缺失。"); pos--; statusByte = running; }
      else if (statusByte < 240) running = statusByte;
      if (statusByte === 255) {
        const type = read(), size = vlq(); if (pos + size > end) throw Error("元事件越界。");
        const body = bytes.slice(pos, pos + size); pos += size;
        if (type === 3) name = new TextDecoder().decode(body) || name;
        if (type === 0x51 && size === 3) tempos.push({ tick, bpm: 60000000 / ((body[0] << 16) | (body[1] << 8) | body[2]) });
        if (type === 0x58 && size >= 2) meters.push({ tick, meter: body[0] + "/" + 2 ** body[1] });
      } else if (statusByte === 240 || statusByte === 247) { const size = vlq(); pos += size; }
      else if (statusByte >= 240) throw Error("不支持的 MIDI 系统事件。");
      else {
        const kind = statusByte >> 4, channel = statusByte & 15; const a = read(); const c = [12, 13].includes(kind) ? 0 : read();
        const key = channel + ":" + a;
        if (kind === 9 && c > 0) { if (!pending.has(key)) pending.set(key, []); pending.get(key).push({ start: tick, velocity: c, pitch: a }); }
        else if (kind === 8 || (kind === 9 && c === 0)) { const n = pending.get(key)?.shift(); if (n) notes.push({ id: uid(), pitch: n.pitch, start: n.start / ppq * 4, duration: Math.max(1 / 120, (tick - n.start) / ppq * 4), velocity: n.velocity }); }
      }
      if (pos > end) throw Error("MIDI 事件越界。");
    }
    for (const queue of pending.values()) for (const n of queue) notes.push({ id: uid(), pitch: n.pitch, start: n.start / ppq * 4, duration: Math.max(1, (tick - n.start) / ppq * 4), velocity: n.velocity });
    tracks.push({ name, notes, end: tick / ppq * 4 }); pos = end;
  }
  tempos.sort((a, b) => a.tick - b.tick); meters.sort((a, b) => a.tick - b.tick);
  return { tracks, bpm: tempos[0]?.bpm || 90, meter: meters[0]?.meter || "4/4", variable: new Set(tempos.map(x => x.bpm)).size > 1 || new Set(meters.map(x => x.meter)).size > 1 };
}
function midiThumbnail(b) {
  const canvas = el("canvas", { class: "midi-thumbnail", width: 250, height: 70, "aria-label": "音型缩略图：" + (b.name || "") });
  const c = canvas.getContext("2d"); c.fillStyle = "#eff3e9"; c.fillRect(0, 0, 250, 70);
  const pitches = b.notes.map(n => n.pitch), low = Math.min(48, ...pitches), high = Math.max(72, ...pitches), end = Math.max(16, ...b.notes.map(n => n.start + n.duration));
  c.fillStyle = "#438474";
  for (const n of b.notes) c.fillRect(n.start / end * 246 + 2, 4 + (high - n.pitch) / (high - low + 1) * 60, Math.max(2, n.duration / end * 246), 4);
  return canvas;
}
function midiPresets(b) {
  data.presets ||= [];
  if (!data.presets.length) {
    for (const [name, pitches] of [["C 大调上行分解", [60, 64, 67, 72]], ["交替分解", [60, 67, 64, 67]], ["柱式和弦", [60, 64, 67]]]) {
      const notes = []; if (name === "柱式和弦") pitches.forEach(pitch => notes.push({ pitch, start: 0, duration: 8, velocity: 90 }));
      else for (let s = 0; s < 16; s += 2) notes.push({ pitch: pitches[s / 2 % 4], start: s, duration: 2, velocity: 90 });
      data.presets.push({ id: uid(), name, bars: 1, bpm: 90, meter: "4/4", notes });
    }
    changed();
  }
  const d = el("dialog", { class: "preset-dialog" }, [el("h2", { text: "选择示例" }), el("p", { class: "muted", text: "插入到当前起点，生成独立副本，可继续修改。" })]);
  const grid = el("div", { class: "preset-grid" });
  for (const p of data.presets) {
    const card = el("div", { class: "preset-card" }, [midiThumbnail(p), el("h3", { text: p.name }), button("添加到当前模块", () => {
      const v = stateFor(b); const start = Math.floor(v.start); b.notes.push(...clone(p.notes).map(n => ({ ...n, id: uid(), start: n.start + start })));
      b.bars = Math.max(b.bars, Math.ceil(Math.max(...b.notes.map(n => n.start + n.duration)) / meterSteps(b))); v.loopB = b.bars * meterSteps(b); d.close(); redraw();
    }, "primary")]);
    grid.append(card);
  }
  d.append(grid, button("关闭", () => d.close())); d.onclose = () => d.remove(); document.body.append(d); d.showModal();
}
async function midiImport(b, f) {
  if (!f) return;
  try {
    if (f.size > 10 * 1024 * 1024) throw Error("MIDI 文件最大 10 MB。");
    const parsed = midiParse(await f.arrayBuffer());
    const candidates = parsed.tracks.filter(t => t.notes.length);
    if (!candidates.length) throw Error("文件中没有音符。");
    const d = el("dialog", {}, [el("h2", { text: "选择导入轨道" })]);
    if (parsed.variable) d.append(el("p", { text: "此文件含速度或拍号变化；当前版本用首个速度和拍号播放，保留音符拍位置。" }));
    function importTrack(t) {
      if (b.notes.length && !confirm("导入会替换当前模块的音符，继续？")) return;
      if (!["4/4", "3/4", "6/4", "6/8"].includes(parsed.meter)) return status("文件拍号暂不支持：" + parsed.meter);
      b.notes = clone(t.notes); b.bpm = clamp(Math.round(parsed.bpm), 20, 300); b.meter = parsed.meter;
      b.bars = Math.max(1, Math.ceil(Math.max(t.end, ...b.notes.map(n => n.start + n.duration)) / meterSteps(b)));
      b.octave = clamp(Math.floor(Math.min(...b.notes.map(n => n.pitch)) / 12) - 1, -1, 8);
      midiValidate(b); delete b.editorView; viewState.delete(b.id); d.close(); redraw();
    }
    candidates.forEach(t => d.append(button(t.name + " · " + t.notes.length + " 个音符", () => { try { importTrack(t); } catch (e) { status(e.message); } })));
    d.append(button("取消", () => d.close())); d.onclose = () => d.remove(); document.body.append(d); d.showModal();
  } catch (e) { status("导入失败：" + e.message); }
}

/** Canvas 编辑器：只绘制八小节窗口，长序列不生成海量 DOM。
 * 音符主体拖动移动；Alt/Option 复制；Ctrl/Command 纵向拖动力度。
 * 空白拖绘时值，边缘拉伸，Shift 点击多选，框选工具支持组编辑。
 */
function midiRender(card, b) {
  repairBlock(b); const v = stateFor(b); activeBlock ||= b;
  transportControls(card, b);
  const extras = el("div", { class: "midi-options" });
  const file = el("input", { type: "file", accept: ".mid,.midi,audio/midi", hidden: "", onchange: e => midiImport(b, e.target.files[0]) });
  if (editing) extras.append(button("导入 .mid", () => file.click()), file);
  extras.append(button("导出 .mid", () => midiDownload(b)));
  extras.append(choice("网格", b.snap || 1, [[4, "1/4"], [2, "1/8"], [1, "1/16"], [.5, "1/32"]], n => { b.snap = Number(n); changed(); paint(); }));
  extras.append(numberControl("显示八度", b.octave, -1, 8, n => { b.octave = n; changed(); paint(); }));
  if (editing) extras.append(button("保存为示例", () => {
    const name = prompt("示例名称", blockTitle(b)); if (!name?.trim()) return;
    data.presets.push({ id: uid(), name: name.trim(), bpm: b.bpm, meter: b.meter, bars: b.bars, notes: clone(b.notes) }); changed(); status("已保存示例：" + name);
  }), button("选择示例", () => midiPresets(b)), choice("编辑工具", v.tool || "draw", [["draw", "画音符"], ["select", "框选"]], s => v.tool = s), button("删除选中", () => { const selected = selectedNotes.get(b.id) || new Set(); b.notes = b.notes.filter(n => !selected.has(n.id)); selected.clear(); changed(); paint(); }));
  card.append(extras);
  const wrap = el("div", { class: "midi-canvas-wrap" });
  const canvas = el("canvas", { class: "midi-canvas", "aria-label": "MIDI 钢琴卷帘：八小节窗口", tabindex: "0" }); canvas.dataset.midiCanvas = b.id;
  const hint = el("div", { class: "hint", text: "空白拖绘音符 · 拖主体移动 · 拖右边缘改长度 · Alt/Option＋拖动复制 · Ctrl/Command＋上下拖动力度 · Shift 点击多选 · Shift 拖标尺设循环 · 空格播放 / 暂停" });
  wrap.append(canvas); card.append(wrap, hint);
  let w = 900; const h = 560, keyW = 52, top = 65, rowH = 19, rows = 25;
  let drag = null, ghost = [], selectionRect = null;
  const selected = selectedNotes.get(b.id) || new Set(); selectedNotes.set(b.id, selected);
  const low = () => clamp((b.octave + 1) * 12, 0, 103);
  const visibleSteps = () => meterSteps(b) * 8;
  const cellW = () => (w - keyW) / visibleSteps();
  const first = () => v.left * meterSteps(b);
  function coords(e) {
    const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left) * w / rect.width; const y = (e.clientY - rect.top) * h / rect.height;
    return { x, y, step: first() + (x - keyW) / cellW(), pitch: clamp(low() + rows - 1 - Math.floor((y - top) / rowH), 0, 127) };
  }
  function noteRect(n) { return { x: keyW + (n.start - first()) * cellW(), y: top + (low() + rows - 1 - n.pitch) * rowH + 2, width: n.duration * cellW(), height: rowH - 4 }; }
  function hit(c) { return [...b.notes].reverse().find(n => { const r = noteRect(n); return c.x >= r.x && c.x <= r.x + r.width && c.y >= r.y && c.y <= r.y + r.height; }); }
  function snap(s) { return Math.round(s / b.snap) * b.snap; }
  function paint() {
    const c = canvas.getContext("2d"); c.clearRect(0, 0, w, h); c.fillStyle = "#fafbf7"; c.fillRect(0, 0, w, h);
    const steps = meterSteps(b); const cell = cellW();
    for (let r = 0; r < rows; r++) {
      const pitch = low() + rows - 1 - r; const y = top + r * rowH;
      c.fillStyle = [1, 3, 6, 8, 10].includes(pitch % 12) ? "#edf0e9" : "#fafbf7"; c.fillRect(keyW, y, w - keyW, rowH);
      c.fillStyle = "#ffffff"; c.fillRect(0, y, keyW - 1, rowH); c.fillStyle = "#53695f"; c.font = "11px sans-serif"; c.fillText(midiPitch(pitch), 5, y + 13);
      c.strokeStyle = "#e4e9df"; c.beginPath(); c.moveTo(0, y + rowH); c.lineTo(w, y + rowH); c.stroke();
    }
    c.fillStyle = "#edf3e8"; c.fillRect(keyW, 0, w - keyW, top);
    if (v.loop) {
      const loopLeft = clamp(keyW + (v.loopA - first()) * cell, keyW, w);
      const loopRight = clamp(keyW + (v.loopB - first()) * cell, keyW, w);
      c.fillStyle = "#d4e4cd"; c.fillRect(loopLeft, 0, Math.max(0, loopRight - loopLeft), 22);
    }
    const unit = b.meter === "6/8" ? 2 : 4;
    for (let i = 0; i <= visibleSteps(); i += b.snap) {
      const s = first() + i; const x = keyW + i * cell;
      c.strokeStyle = s % steps < .001 ? "#769588" : s % unit < .001 ? "#b5c6b8" : "#e1e7dc";
      c.lineWidth = s % steps < .001 ? 1.5 : .5; c.beginPath(); c.moveTo(x, top); c.lineTo(x, top + rows * rowH); c.stroke();
      if (Math.abs(s % steps) < .001) {
        c.fillStyle = "#356b58"; c.font = "bold 12px sans-serif"; c.fillText("" + (Math.floor(s / steps) + 1), x + 3, 17);
        const secs = s * 60 / b.bpm / 4; c.font = "10px sans-serif"; c.fillStyle = "#7b8b80"; c.fillText(Math.floor(secs / 60) + ":" + String(Math.floor(secs % 60)).padStart(2, "0"), x + 3, 34);
      }
      if (i % 1 === 0 && cell >= 5) {
        const label = s % unit < .001 ? Math.floor(s % steps / unit) + 1 : unit === 4 ? ["", "e", "&", "a"][Math.floor(s % 4)] : "&";
        const groupAccent = b.meter === "6/8" && Math.abs(s % steps % 6) < .001;
        if (groupAccent) { c.fillStyle = "#c8dec2"; c.fillRect(x, 39, Math.max(10, unit * cell), 23); }
        c.fillStyle = s % unit < .001 || label === "&" ? "#376d58" : "#99a89b"; c.font = s % unit < .001 ? "bold 10px sans-serif" : "9px sans-serif"; c.fillText(String(label), x + 1, 55);
      }
    }
    c.save(); c.beginPath(); c.rect(keyW, top, w - keyW, rows * rowH); c.clip();
    for (const n of [...b.notes, ...ghost]) {
      if (b.notes.includes(n) && drag?.original?.includes(n.id) && ["move", "resize", "velocity"].includes(drag.mode)) continue;
      const r = noteRect(n); c.fillStyle = "rgba(45,119,93," + (.35 + n.velocity / 127 * .65) + ")"; c.fillRect(r.x, r.y, Math.max(2, r.width - 1), r.height);
      if (selected.has(n.id)) { c.strokeStyle = "#bd8e4c"; c.lineWidth = 2; c.strokeRect(r.x, r.y, Math.max(2, r.width - 1), r.height); }
    }
    if (selectionRect) { c.fillStyle = "#b3cfc440"; c.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height); c.strokeStyle = "#649f88"; c.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height); }
    c.restore();
    const cursorX = keyW + (v.cursor - first()) * cell;
    if (cursorX >= keyW && cursorX <= w) { c.strokeStyle = "#7caf97"; c.lineWidth = 2; c.beginPath(); c.moveTo(cursorX, top); c.lineTo(cursorX, top + rows * rowH); c.stroke(); }
    c.fillStyle = "#587361"; c.font = "12px sans-serif"; c.fillText("音符 " + b.notes.length + " · 可见八小节 · 起点 " + (Math.floor(v.start / steps) + 1), 10, h - 4);
    if (drag?.mode === "velocity" && ghost.length) { c.fillStyle = "#285d49"; c.fillText("力度 " + ghost[0].velocity, clamp(drag.last.x, 0, w - 90), clamp(drag.last.y - 10, 20, h - 10)); }
  }
  canvas.paint = paint;
  const observer = new ResizeObserver(() => {
    w = Math.max(720, Math.round(wrap.clientWidth)); const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + "px"; canvas.style.height = h + "px"; canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0); paint();
  }); observer.observe(wrap);
  const cleanup = new MutationObserver(() => { if (!canvas.isConnected) { observer.disconnect(); cleanup.disconnect(); } }); cleanup.observe($("blocks"), { childList: true, subtree: true });
  canvas.onpointerdown = e => {
    activeBlock = b; canvas.focus(); const c = coords(e); e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    if (c.y < top && c.x >= keyW) {
      stop();
      if (e.shiftKey) {
        drag = { mode: "loop", c }; v.loop = true;
        v.loopA = clamp(snap(c.step), 0, b.bars * meterSteps(b) - b.snap);
        v.loopB = v.loopA + b.snap; paint(); return;
      }
      v.start = clamp(v.origin === "bar" ? Math.floor(c.step / meterSteps(b)) * meterSteps(b) : Math.max(0, snap(c.step)), 0, b.bars * meterSteps(b) - b.snap);
      v.cursor = v.start; changed(); paint(); return;
    }
    if (v.hand) { stop(); drag = { mode: "pan", c, left: v.left }; canvas.style.cursor = "grabbing"; return; }
    if (!editing || c.x < keyW || c.y > top + rows * rowH) return;
    const n = hit(c);
    if (n) {
      if (e.shiftKey) { selected.has(n.id) ? selected.delete(n.id) : selected.add(n.id); paint(); return; }
      if (!selected.has(n.id)) { selected.clear(); selected.add(n.id); }
      const picked = b.notes.filter(x => selected.has(x.id)); const r = noteRect(n);
      const mode = e.ctrlKey || e.metaKey ? "velocity" : e.altKey ? "copy" : c.x > r.x + r.width - Math.min(5, r.width / 3) ? "resize" : "move";
      drag = { mode, c, original: picked.map(x => x.id), notes: clone(picked), last: c }; ghost = clone(picked);
      if (mode === "copy") ghost.forEach(n => n.id = uid());
    } else if (v.tool === "select") { drag = { mode: "select", c }; }
    else {
      selected.clear(); const start = Math.max(0, Math.floor(c.step / b.snap) * b.snap);
      ghost = [{ id: uid(), pitch: c.pitch, start, duration: b.snap, velocity: 90 }]; drag = { mode: "draw", c, start };
    }
    paint();
  };
  canvas.onpointermove = e => {
    const c = coords(e);
    if (!drag) { canvas.style.cursor = v.hand ? "grab" : hit(c) ? e.altKey ? "copy" : (e.ctrlKey || e.metaKey) ? "ns-resize" : "move" : "crosshair"; return; }
    drag.last = c;
    if (drag.mode === "loop") {
      const max = b.bars * meterSteps(b);
      v.loopA = clamp(Math.min(snap(drag.c.step), snap(c.step)), 0, max - b.snap);
      v.loopB = clamp(Math.max(snap(drag.c.step), snap(c.step)) + b.snap, v.loopA + b.snap, max);
      paint(); return;
    }
    if (drag.mode === "pan") { v.left = clamp(drag.left - (c.x - drag.c.x) / (w - keyW) * 8, 0, Math.max(0, b.bars - 8)); paint(); return; }
    if (drag.mode === "select") {
      selectionRect = { x: Math.min(c.x, drag.c.x), y: Math.min(c.y, drag.c.y), width: Math.abs(c.x - drag.c.x), height: Math.abs(c.y - drag.c.y) }; paint(); return;
    }
    if (drag.mode === "draw") {
      const end = Math.max(0, Math.floor(c.step / b.snap) * b.snap); ghost[0].start = Math.min(drag.start, end); ghost[0].duration = Math.abs(end - drag.start) + b.snap;
    } else {
      let delta = snap(c.step - drag.c.step); delta = Math.max(delta, -Math.min(...drag.notes.map(n => n.start)));
      const pitchDelta = clamp(c.pitch - drag.c.pitch, -Math.min(...drag.notes.map(n => n.pitch)), 127 - Math.max(...drag.notes.map(n => n.pitch)));
      ghost.forEach((n, i) => {
        const old = drag.notes[i];
        if (drag.mode === "velocity") n.velocity = clamp(old.velocity + Math.round((drag.c.y - c.y) / 2), 1, 127);
        else if (drag.mode === "resize") n.duration = Math.max(b.snap, old.duration + delta);
        else { n.start = old.start + delta; n.pitch = old.pitch + pitchDelta; }
      });
    }
    paint();
  };
  canvas.onpointerup = () => {
    if (!drag) return;
    if (drag.mode === "select" && selectionRect) {
      selected.clear(); b.notes.forEach(n => { const r = noteRect(n); if (r.x < selectionRect.x + selectionRect.width && r.x + r.width > selectionRect.x && r.y < selectionRect.y + selectionRect.height && r.y + r.height > selectionRect.y) selected.add(n.id); });
    } else if (drag.mode === "pan") {
      panStart(b, v); changed();
    } else if (drag.mode === "loop") {
      v.start = v.loopA; v.cursor = v.loopA; changed();
    } else {
      if (["move", "resize", "velocity"].includes(drag.mode)) b.notes = b.notes.filter(n => !drag.original.includes(n.id));
      b.notes.push(...ghost); selected.clear(); ghost.forEach(n => selected.add(n.id));
      b.bars = Math.max(b.bars, Math.ceil(Math.max(1, ...b.notes.map(n => n.start + n.duration)) / meterSteps(b))); v.loopB = Math.max(v.loopB, b.bars * meterSteps(b)); changed();
    }
    ghost = []; drag = null; selectionRect = null; canvas.style.cursor = v.hand ? "grab" : "crosshair"; paint();
  };
  canvas.onpointercancel = () => { drag = null; ghost = []; selectionRect = null; paint(); };
  canvas.ondblclick = e => { if (!editing) return; const n = hit(coords(e)); if (n) { b.notes = b.notes.filter(x => x !== n); changed(); paint(); } };
  canvas.onkeydown = e => { if (["Delete", "Backspace"].includes(e.key) && editing) { e.preventDefault(); b.notes = b.notes.filter(n => !selected.has(n.id)); selected.clear(); changed(); paint(); } };
}
function midiPitch(p) {
  return (
    ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][p % 12] +
    (Math.floor(p / 12) - 1)
  );
}

function midiSound(n, time, duration, bus) {
  const gain = ctx.createGain();
  gain.connect(bus);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime((n.velocity / 127) * 0.12, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.001, (n.velocity / 127) * 0.035),
    time + Math.max(0.015, duration * 0.75),
  );
  gain.gain.linearRampToValueAtTime(0, time + duration + 0.035);
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.value = 440 * 2 ** ((n.pitch - 69) / 12);
  o.connect(gain);
  o.start(time);
  o.stop(time + duration + 0.045);
}

function midiBytes(b) {
  midiValidate(b);
  const ticks = 120,
    tempo = Math.round(60000000 / b.bpm),
    end = Math.ceil(b.bars * meterSteps(b) * ticks);
  const events = [
    {
      t: 0,
      order: 0,
      bytes: [
        0xff,
        0x51,
        3,
        (tempo >> 16) & 255,
        (tempo >> 8) & 255,
        tempo & 255,
      ],
    },
    { t: 0, order: 0, bytes: [0xff, 0x58, 4, Number(b.meter.split("/")[0]), Math.log2(Number(b.meter.split("/")[1])), 24, 8] },
    { t: 0, order: 0, bytes: [0xc0, 0] },
  ];
  for (const n of b.notes) {
    events.push(
      { t: Math.round(n.start * ticks), order: 2, bytes: [0x90, n.pitch, n.velocity] },
      {
        t: Math.round((n.start + n.duration) * ticks),
        order: 1,
        bytes: [0x80, n.pitch, 0],
      },
    );
  }
  events.sort((a, c) => a.t - c.t || a.order - c.order);
  function vlq(n) {
    const out = [n & 127];
    while ((n >>= 7)) out.unshift((n & 127) | 128);
    return out;
  }
  const track = [];
  let previous = 0;
  for (const e of events) {
    track.push(...vlq(e.t - previous), ...e.bytes);
    previous = e.t;
  }
  track.push(...vlq(end - previous), 0xff, 0x2f, 0);
  const size = track.length;
  return new Uint8Array([
    77,
    84,
    104,
    100,
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    1,
    224,
    77,
    84,
    114,
    107,
    (size >>> 24) & 255,
    (size >>> 16) & 255,
    (size >>> 8) & 255,
    size & 255,
    ...track,
  ]);
}
// 导出 .mid 文件，可在 DAW 中选择自己的乐器音色。
function midiDownload(b) {
  const url = URL.createObjectURL(
    new Blob([midiBytes(b)], { type: "audio/midi" }),
  );
  const a = el("a", {
    href: url,
    download: (b.name.replace(/[\\/:*?"<>|]/g, "_") || "pattern") + ".mid",
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status("已导出 MIDI · 可以导入 Cubase 或 Logic。");
}
