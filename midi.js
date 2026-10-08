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
  for (const n of b.notes) if (!Number.isInteger(n.pitch) || n.pitch < 0 || n.pitch > 127 || !Number.isFinite(n.start) || n.start < 0 || !Number.isFinite(n.duration) || n.duration <= 0 || n.start + n.duration > b.bars * meterSteps(b) + .01 || (n.muted !== undefined && typeof n.muted !== "boolean") || !Number.isInteger(n.velocity) || n.velocity < 1 || n.velocity > 127) throw Error("MIDI 音符越界或参数不正确。");
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

/** 四小节钢琴卷帘：音区自适应、纵向滚动、逐音符静音及编辑。 */
function midiRender(card, b) {
  repairBlock(b);
  b.snap = [4,2,1,.5].includes(b.snap) ? b.snap : 1;
  // 将上一版按音高静音的数据迁移为每个音符的静音状态。
  if (b.mutedPitches) {
    b.notes.forEach(n => { if(b.mutedPitches.includes(n.pitch)) n.muted=true; });
    delete b.mutedPitches;
  }
  const v=stateFor(b), editable=editing;
  v.hand=false; v.loop=true;
  const steps=()=>meterSteps(b), total=()=>b.bars*steps();
  const maxLeft=()=>Math.max(0,b.bars+(editable?4:0)-4);
  function applyLoop(){
    if(v.noteSelection){
      v.loopA=clamp(v.noteSelection.a,0,total()-1);
      v.loopB=clamp(v.noteSelection.b,v.loopA+1,total());
    }else{v.loopA=0;v.loopB=total();}
  }
  applyLoop();v.left=clamp(v.left,0,maxLeft());
  const bounds=b.notes.length ? [Math.min(...b.notes.map(n=>n.pitch)),Math.max(...b.notes.map(n=>n.pitch))] : [48,72];
  const signature=bounds.join(":");
  if(v.pitchSignature!==signature || !Number.isFinite(v.highPitch)){
    v.highPitch=clamp(bounds[1]+(b.notes.length?2:0),36,96);
    v.pitchSignature=signature;
  }
  const selected=selectedNotes.get(b.id)||new Set();selectedNotes.set(b.id,selected);
  v.highPitch=clamp(v.highPitch,36,96);
  let drag=null, ghost=[], selectionRect=null, w=900;
  const keyW=56,top=65,rows=25;let rowH=19,h=top+rows*rowH+12;
  const low=()=>v.highPitch-rows+1;
  const first=()=>v.left*steps();
  const cellW=()=>(w-keyW)/(steps()*4);
  const snap=s=>Math.round(s/b.snap)*b.snap;
  const floorSnap=s=>Math.floor(s/b.snap)*b.snap;
  const controls=el("div",{class:"controls drum-simple-controls"});
  const play=button("▶ 播放",()=>togglePlayback(b),"primary");play.dataset.play=b.id;
  controls.append(play,numberControl("BPM",b.bpm,20,300,n=>{stop();b.bpm=n;changed();}),choice("拍号",b.meter,["4/4","3/4","6/4","6/8"].map(m=>[m,m]),m=>{
    stop();b.meter=m;b.bars=Math.max(b.bars,Math.ceil(Math.max(1,...b.notes.map(n=>n.start+n.duration))/steps()));
    v.noteSelection=null;applyLoop();v.cursor=0;redraw();
  }),choice("网格量化",b.snap,[[4,"1/4"],[2,"1/8"],[1,"1/16"],[.5,"1/32"]],n=>{b.snap=Number(n);changed();paint();}));
  card.append(controls);
  if(editable){
    const extras=el("div",{class:"midi-options edit-only"});
    const file=el("input",{type:"file",accept:".mid,.midi,audio/midi",hidden:"",onchange:e=>{if(e.target.files[0])midiImport(b,e.target.files[0]);}});
    extras.append(button("导入 MIDI",()=>file.click()),file,button("导出 MIDI",()=>midiDownload(b)),choice("编辑工具",v.tool||"draw",[["draw","画音符"],["select","框选"]],tool=>{v.tool=tool;v.hand=false;}),button("删除选中",()=>{
      stop();b.notes=b.notes.filter(n=>!selected.has(n.id));selected.clear();changed();selectionControls();paint();
    }));card.append(extras);
  }
  const inspector=el("div",{class:"note-inspector edit-only","aria-live":"polite"});

  function selectionControls(){
    inspector.replaceChildren();
    const picked=b.notes.filter(n=>selected.has(n.id));
    if(!picked.length){inspector.hidden=true;return;}
    inspector.hidden=false;
    inspector.append(el("span",{text:picked.length===1?"已选 "+midiPitch(picked[0].pitch):"已选 "+picked.length+" 个音符"}));
    const duration=el("input",{type:"number",min:b.snap/4,max:16384,step:b.snap/4,value:picked[0].duration/4,"aria-label":"音符时值（拍）"});
    duration.onchange=()=>{
      const value=Number(duration.value);
      if(!Number.isFinite(value)||value<=0){duration.value=picked[0].duration/4;return;}
      stop();picked.forEach(n=>n.duration=clamp(Math.round(value*4/b.snap)*b.snap,b.snap,4096*steps()-n.start));
      b.bars=Math.max(b.bars,Math.ceil(Math.max(...b.notes.map(n=>n.start+n.duration))/steps()));applyLoop();changed();syncScroll();selectionControls();paint();
    };
    inspector.append(el("label",{text:"时值（拍） "},[duration]),numberControl("力度",picked[0].velocity,1,127,n=>{stop();picked.forEach(note=>note.velocity=n);changed();paint();}),button(picked.every(n=>n.muted)?"取消静音":"静音选中",()=>{
      stop();const muted=!picked.every(n=>n.muted);picked.forEach(n=>n.muted=muted);changed();selectionControls();paint();
    }));
  }
  const wrap=el("div",{class:"midi-roll-viewport"});
  const stage=el("div",{class:"midi-roll-stage"});
  const canvas=el("canvas",{class:"midi-canvas",tabindex:"0","aria-label":"四小节音符网格；上方小节块框选循环，下方标尺按量化选择播放位置"});canvas.dataset.midiCanvas=b.id;
  const line=el("div",{class:"drum-playhead midi-playhead","aria-hidden":"true"});
  const seekHandle=button("▼",()=>{},"playhead-seek-handle");
  seekHandle.setAttribute("aria-label","拖动音符播放位置");
  stage.append(canvas,line,seekHandle);
  const pitchScroll=el("div",{class:"midi-pitch-scroll",tabindex:"0","aria-label":"音符音区纵向滚动条"});
  pitchScroll.append(el("div",{style:"height:"+(85*rowH)+"px;width:1px"}));
  wrap.append(stage,pitchScroll);card.append(wrap);
  const scroller=el("div",{class:"drum-time-scroll",tabindex:"0","aria-label":"音符时间轴水平滚动条"});
  const spacer=el("div",{class:"drum-time-spacer"});scroller.append(spacer);card.append(scroller);if(editable)card.append(inspector);
  const hint=el("p",{class:"hint module-top-hint"});controls.append(hint);
  function syncScroll(){
    const plot=w-keyW;scroller.style.marginLeft=keyW+"px";scroller.style.width=plot+"px";
    spacer.style.width=plot*(1+maxLeft()/4)+"px";
    const left=v.left/4*plot;if(Math.abs(scroller.scrollLeft-left)>.5)scroller.scrollLeft=left;
    const pitchOffset=(96-v.highPitch)*rowH;if(Math.abs(pitchScroll.scrollTop-pitchOffset)>.5)pitchScroll.scrollTop=pitchOffset;
  }
  pitchScroll.onscroll=()=>{v.highPitch=clamp(96-Math.round(pitchScroll.scrollTop/rowH),36,96);paint();};
  pitchScroll.onkeydown=e=>{
    if(!["ArrowDown","ArrowUp","Home","End"].includes(e.key))return;e.preventDefault();
    v.highPitch=e.key==="Home"?96:e.key==="End"?36:clamp(v.highPitch+(e.key==="ArrowDown"?-1:1),36,96);syncScroll();paint();
  };
  wrap.onwheel=e=>{if(e.shiftKey)return;e.preventDefault();v.highPitch=clamp(v.highPitch-Math.sign(e.deltaY)*3,36,96);syncScroll();paint();};
  scroller.onscroll=()=>{v.left=clamp(scroller.scrollLeft/(w-keyW)*4,0,maxLeft());paint();};
  scroller.onkeydown=e=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();
    v.left=e.key==="Home"?0:e.key==="End"?maxLeft():clamp(v.left+(e.key==="ArrowRight"?1:-1),0,maxLeft());syncScroll();paint();
  };
  function coords(e){const rect=canvas.getBoundingClientRect();const x=(e.clientX-rect.left)*w/(rect.width||w),y=(e.clientY-rect.top)*h/(rect.height||h);return{x,y,step:first()+(x-keyW)/cellW(),pitch:clamp(v.highPitch-Math.floor((y-top)/rowH),12,96)};}
  function noteRect(n){return{x:keyW+(n.start-first())*cellW(),y:top+(v.highPitch-n.pitch)*rowH+2,width:n.duration*cellW(),height:rowH-4};}
  function hit(c){return [...b.notes].reverse().find(n=>{const r=noteRect(n);return c.x>=r.x&&c.x<=r.x+r.width&&c.y>=r.y&&c.y<=r.y+r.height;});}
  function showPosition(position,follow=true){
    if(follow&&transport?.id===b.id&&(position<first()||position>=first()+steps()*4)){
      v.left=clamp(Math.floor(position/steps()/4)*4,0,maxLeft());syncScroll();paint();
    }
    const x=keyW+(position-first())*cellW();line.hidden=x<keyW||x>w;line.style.left=x+"px";line.style.top="29px";line.style.height=(h-41)+"px";seekHandle.hidden=line.hidden;seekHandle.style.left=(x-8)+"px";
  }
  canvas.updatePlayhead=showPosition;
  function paint(){
    const c=canvas.getContext("2d");if(!c)return;
    c.clearRect(0,0,w,h);c.fillStyle="#fafbf7";c.fillRect(0,0,w,h);
    const stepCount=steps(),cell=cellW();
    for(let r=0;r<rows;r++){
      const pitch=v.highPitch-r,y=top+r*rowH;
      c.fillStyle=[1,3,6,8,10].includes(pitch%12)?"#edf0e9":"#fafbf7";c.fillRect(keyW,y,w-keyW,rowH);
      c.fillStyle="#fff";c.fillRect(0,y,keyW-1,rowH);c.fillStyle="#53695f";c.font="11px sans-serif";c.fillText(midiPitch(pitch),5,y+13);
      c.strokeStyle="#e4e9df";c.beginPath();c.moveTo(0,y+rowH);c.lineTo(w,y+rowH);c.stroke();
    }
    c.fillStyle="#edf3e8";c.fillRect(keyW,0,w-keyW,top);
    c.save();c.beginPath();c.rect(keyW,0,w-keyW,h);c.clip();
    for(let bar=Math.floor(v.left);bar<Math.ceil(v.left+4);bar++){
      const x=keyW+(bar*stepCount-first())*cell,width=stepCount*cell;
      const chosen=(v.noteSelection||drag?.mode==="loop")&&bar*stepCount>=v.loopA&&bar*stepCount<v.loopB;
      c.fillStyle=chosen?"#bed4c5":bar>=b.bars?"#f0f1ec":"#e6eee7";c.fillRect(x+1,2,width-2,26);
      c.fillStyle="#425c4e";c.font="12px sans-serif";c.fillText(String(bar+1),x+8,20);
    }
    const unit=b.meter==="6/8"?2:4;
    for(let s=Math.ceil(first()/b.snap)*b.snap;s<=first()+stepCount*4;s+=b.snap){
      const x=keyW+(s-first())*cell;c.strokeStyle=s%stepCount===0?"#8ba494":s%unit===0?"#c6d2c5":"#e1e8dc";c.lineWidth=s%stepCount===0?1.2:.5;
      c.beginPath();c.moveTo(x,32);c.lineTo(x,h-12);c.stroke();
      if(s%unit===0){c.fillStyle="#7c8f7d";c.font="10px sans-serif";c.fillText(String(Math.floor((s%stepCount)/unit)+1),x+3,49);}
    }
    c.restore();c.save();c.beginPath();c.rect(keyW,top,w-keyW,rows*rowH);c.clip();
    for(const n of [...b.notes,...ghost]){
      if(b.notes.includes(n)&&drag?.original?.includes(n.id)&&["move","resize","velocity"].includes(drag.mode))continue;
      const r=noteRect(n);c.fillStyle=n.muted?"#b4bcb2":selected.has(n.id)?"#bd8e4c":"#648f83";
      c.fillRect(r.x,r.y,Math.max(2,r.width-1),r.height);
      if(selected.has(n.id)){c.strokeStyle="#987342";c.lineWidth=1;c.strokeRect(r.x,r.y,Math.max(2,r.width-1),r.height);}
    }
    if(selectionRect){c.fillStyle="#b3cfc440";c.fillRect(selectionRect.x,selectionRect.y,selectionRect.width,selectionRect.height);c.strokeStyle="#649f88";c.strokeRect(selectionRect.x,selectionRect.y,selectionRect.width,selectionRect.height);}
    c.restore();showPosition(v.cursor,false);
    hint.textContent=(v.noteSelection?"循环：选中小节":"循环：全部 "+b.bars+" 小节")+" · 顶部框选循环 · 标尺点击或拖动定位播放 · 音区上下滚动"+(editable?" · 空白拖绘音符 · 点击选中后编辑时值、力度和静音 · 拖动右边缘调整时值":" · 点击音符切换静音");
  }
  canvas.paint=paint;
  function seek(c){stop();v.start=clamp(snap(c.step),0,total()-b.snap);v.cursor=v.start;changed();paint();}
  canvas.onpointerdown=e=>{
    if(e.button!==undefined&&e.button!==0)return;
    activeBlock=b;canvas.focus();const c=coords(e);if(c.x<keyW||c.y>h-12)return;
    e.preventDefault();canvas.setPointerCapture?.(e.pointerId);
    if(c.y<28){
      stop();const bar=clamp(Math.floor(c.step/steps()),0,b.bars-1);drag={mode:"loop",bar,previous:v.noteSelection?{...v.noteSelection}:null};v.loopA=bar*steps();v.loopB=(bar+1)*steps();paint();return;
    }
    if(c.y<top){drag={mode:"seek"};seek(c);return;}
    const n=hit(c);
    if(!editable){if(n){stop();n.muted=!n.muted;changed();paint();}return;}
    stop();
    if(n){
      if(e.shiftKey){selected.has(n.id)?selected.delete(n.id):selected.add(n.id);selectionControls();paint();return;}
      if(!selected.has(n.id)){selected.clear();selected.add(n.id);}
      const picked=b.notes.filter(note=>selected.has(note.id)),r=noteRect(n);
      const mode=e.ctrlKey||e.metaKey?"velocity":e.altKey?"copy":c.x>r.x+r.width-Math.min(6,r.width/3)?"resize":"move";
      drag={mode,c,original:picked.map(note=>note.id),notes:clone(picked),last:c};ghost=clone(picked);if(mode==="copy")ghost.forEach(note=>note.id=uid());
    }else if(v.tool==="select"){drag={mode:"select",c};}
    else{selected.clear();const start=clamp(floorSnap(c.step),0,4096*steps()-b.snap);ghost=[{id:uid(),pitch:c.pitch,start,duration:b.snap,velocity:90,muted:false}];drag={mode:"draw",c,start};}
    selectionControls();paint();
  };
  canvas.onpointermove=e=>{
    if(!drag)return;const c=coords(e);drag.last=c;
    if(drag.mode==="seek"){seek(c);return;}
    if(drag.mode==="loop"){const bar=clamp(Math.floor(c.step/steps()),0,b.bars-1);v.loopA=Math.min(drag.bar,bar)*steps();v.loopB=(Math.max(drag.bar,bar)+1)*steps();paint();return;}
    if(drag.mode==="select"){selectionRect={x:Math.min(c.x,drag.c.x),y:Math.min(c.y,drag.c.y),width:Math.abs(c.x-drag.c.x),height:Math.abs(c.y-drag.c.y)};paint();return;}
    if(drag.mode==="draw"){const end=clamp(floorSnap(c.step),0,4096*steps()-b.snap);ghost[0].start=Math.min(drag.start,end);ghost[0].duration=Math.abs(end-drag.start)+b.snap;}
    else{
      let delta=snap(c.step-drag.c.step);delta=clamp(delta,-Math.min(...drag.notes.map(n=>n.start)),4096*steps()-Math.max(...drag.notes.map(n=>n.start+n.duration)));
      const pitchDelta=clamp(c.pitch-drag.c.pitch,-Math.min(...drag.notes.map(n=>n.pitch)),127-Math.max(...drag.notes.map(n=>n.pitch)));
      ghost.forEach((n,i)=>{const old=drag.notes[i];if(drag.mode==="velocity")n.velocity=clamp(old.velocity+Math.round((drag.c.y-c.y)/2),1,127);else if(drag.mode==="resize")n.duration=clamp(old.duration+snap(c.step-drag.c.step),b.snap,4096*steps()-n.start);else{n.start=old.start+delta;n.pitch=old.pitch+pitchDelta;}});
    }paint();
  };
  canvas.onpointerup=()=>{
    if(!drag)return;
    if(drag.mode==="select"){
      selected.clear();if(selectionRect)b.notes.forEach(n=>{const r=noteRect(n);if(r.x<selectionRect.x+selectionRect.width&&r.x+r.width>selectionRect.x&&r.y<selectionRect.y+selectionRect.height&&r.y+r.height>selectionRect.y)selected.add(n.id);});
    }else if(drag.mode==="loop"){
      const same=drag.previous&&drag.previous.a===v.loopA&&drag.previous.b===v.loopB;v.noteSelection=same?null:{a:v.loopA,b:v.loopB};applyLoop();v.start=v.loopA;v.cursor=v.start;changed();
    }else if(drag.mode!=="seek"){
      if(["move","resize","velocity"].includes(drag.mode))b.notes=b.notes.filter(n=>!drag.original.includes(n.id));
      b.notes.push(...ghost);selected.clear();ghost.forEach(n=>selected.add(n.id));b.bars=Math.max(b.bars,Math.ceil(Math.max(1,...b.notes.map(n=>n.start+n.duration))/steps()));applyLoop();changed();
    }
    drag=null;ghost=[];selectionRect=null;syncScroll();selectionControls();paint();
  };
  canvas.onpointercancel=()=>{if(drag?.mode==="loop"){v.noteSelection=drag.previous;applyLoop();}drag=null;ghost=[];selectionRect=null;selectionControls();paint();};
  canvas.onkeydown=e=>{
    if(e.key==="Escape"){stop();v.noteSelection=null;applyLoop();v.start=0;v.cursor=0;selected.clear();selectionControls();paint();}
    if(editable&&["Delete","Backspace"].includes(e.key)){e.preventDefault();stop();b.notes=b.notes.filter(n=>!selected.has(n.id));selected.clear();changed();selectionControls();paint();}
  };
  seekHandle.onpointerdown=e=>canvas.onpointerdown(e);
  seekHandle.onpointermove=e=>canvas.onpointermove(e);
  seekHandle.onpointerup=e=>canvas.onpointerup(e);
  seekHandle.onkeydown=e=>{if(!["ArrowLeft","ArrowRight"].includes(e.key))return;e.preventDefault();stop();v.start=clamp(v.cursor+(e.key==="ArrowRight"?b.snap:-b.snap),0,total()-b.snap);v.cursor=v.start;changed();paint();};
  function resize(){w=Math.max(260,Math.round(wrap.clientWidth-20)||900);
    if(card.clientHeight&&["fit","max"].includes(b.sizeMode)){const tools=[...card.children].filter(n=>n!==wrap&&n!==scroller).reduce((sum,n)=>sum+(n.hidden?0:n.offsetHeight||0),0);rowH=Math.max(10,(card.clientHeight-tools-48-top-12)/rows);h=top+rows*rowH+12;pitchScroll.firstElementChild.style.height=(85*rowH)+"px";}
    pitchScroll.style.height=(rows*rowH)+"px";
    const ratio=window.devicePixelRatio||1;stage.style.width=w+"px";canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);canvas.style.width=w+"px";canvas.style.height=h+"px";canvas.getContext("2d")?.setTransform(ratio,0,0,ratio,0,0);syncScroll();paint();}
  selectionControls();resize();
  if(typeof ResizeObserver!=="undefined"){
    const observer=new ResizeObserver(resize);observer.observe(wrap);observer.observe(card);
    const cleanup=new MutationObserver(()=>{if(!canvas.isConnected){observer.disconnect();cleanup.disconnect();}});cleanup.observe($("blocks"),{childList:true,subtree:true});
  }
}

function midiPitch(p) {
  return (
    ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][p % 12] +
    (Math.floor(p / 12) - 1)
  );
}

function midiSound(n, time, duration, bus) {
  if (n.muted) return;
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
