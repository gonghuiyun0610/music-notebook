/** YUN 收集箱 V7：浏览 / 编辑双模式 + 收集入口 + 紧凑筛选 + 同步/收藏/删除 */
"use strict";
(() => {
  const API = localStorage.getItem("yunInboxApi") || "https://yun-music-api.jgjhhjybzh.workers.dev";
  const COLLECT_URL = API + "/collect";
  const TYPES = ["录音","图片","视频","文件","记录"];
  const state = {
    mode: localStorage.getItem("yunInboxMode") || "browse",
    items: [],
    typeFilter: "全部",
    selected: new Set(),
    regexSelected: [],
    query: ""
  };

  const esc = s => String(s ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const typeName = t => t === "音频" ? "录音" : t === "文字" ? "记录" : t;
  const iconPaths = {
    "录音": '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
    "图片": '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
    "视频": '<rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
    "文件": '<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    "记录": '<path d="m15 4 5 5M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15Z"/>'
  };
  const icon = t => '<svg class="yun-asset-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[typeName(t)]||iconPaths["文件"])+ '</svg>';
  const typeClass = t => ({"录音":"recording","图片":"image","视频":"video","文件":"file","记录":"note"}[typeName(t)]||"file");
  const mediaIcon = (t, expanded=false) => icon(t)+'<span class="yun-media-caret" aria-hidden="true">'+(expanded?'▾':'▶')+'</span>';
  const byId = id => state.items.find(x => String(x.id) === String(id));
  const token = () => localStorage.getItem("yunInboxSession") || "";

  async function apiFetch(path, init={}) {
    let t = token();
    const headers = new Headers(init.headers || {});
    if (t) headers.set("Authorization", "Bearer " + t);
    let r = await fetch(API + path, {...init, headers, cache:"no-store"});
    if (r.status === 401) {
      const secret = prompt("首次连接收集箱，请输入 YUN 安全密钥：");
      if (!secret) throw Error("尚未连接 YUN 收集箱");
      const lr = await fetch(API + "/api/yun-login", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({secret})
      });
      const ld = await lr.json();
      if (!lr.ok || !ld.token) throw Error(ld.error || "连接失败");
      localStorage.setItem("yunInboxSession", ld.token);
      headers.set("Authorization", "Bearer " + ld.token);
      r = await fetch(API + path, {...init, headers, cache:"no-store"});
    }
    return r;
  }

  function shell() {
    const tab = document.createElement("button");
    tab.className = "yun-inbox-tab";
    tab.textContent = "‹ 收集箱";
    tab.title = "打开收集箱";

    const box = document.createElement("section");
    box.className = "yun-inbox";
    box.innerHTML = `
      <div class="yun-inbox-head">
        <strong>收集箱</strong>
        <div class="yun-inbox-head-actions">
          <button class="yun-head-btn yun-refresh-btn" type="button" title="刷新收集箱（仅加入新文件）" aria-label="刷新">↻</button>
          <button class="yun-head-btn yun-collect-btn" type="button">收集</button>
          <button class="yun-head-btn yun-mode-btn" type="button"></button>
          <button class="yun-inbox-close" type="button" aria-label="收起">×</button>
        </div>
      </div>
      <div class="yun-inbox-search"><input placeholder="搜索最近收集的内容…"></div>
      <div class="yun-edit-tools">
        <div class="yun-filter-row">
          <button class="yun-filter-chip active" data-type-filter="全部">全部</button>
          <button class="yun-filter-chip" data-type-filter="收藏">收藏</button>
          <button class="yun-filter-chip" data-type-filter="录音">录音</button>
          <button class="yun-filter-chip" data-type-filter="图片">图片</button>
          <button class="yun-filter-chip" data-type-filter="视频">视频</button>
          <button class="yun-filter-chip" data-type-filter="文件">文件</button>
          <button class="yun-filter-chip" data-type-filter="记录">记录</button>
        </div>
        <div class="yun-batch-row">
          <span class="yun-selected-count">已选择 0 项</span>
          <button class="yun-icon-btn yun-batch-sync" title="批量同步" aria-label="批量同步">↻</button>
          <button class="yun-icon-btn yun-batch-delete" title="批量删除" aria-label="批量删除">×</button>
        </div>
      </div>
      <div class="yun-inbox-list"></div>
      <div class="yun-inbox-tip">可预览播放；拖到已有模块可直接填入，拖到白板空白处会新建模块</div>
    `;
    document.body.append(tab, box);

    tab.onclick = () => { box.classList.add("open"); tab.hidden = true; };
    box.querySelector(".yun-inbox-close").onclick = () => { box.classList.remove("open"); tab.hidden = false; };
    box.querySelector(".yun-collect-btn").onclick = () => { window.open(COLLECT_URL, "_blank", "noopener"); };
    box.querySelector(".yun-mode-btn").onclick = () => {
      state.mode = state.mode === "browse" ? "edit" : "browse";
      localStorage.setItem("yunInboxMode", state.mode);
      state.selected.clear();
      applyMode();
      render();
    };

    box.querySelector(".yun-inbox-search input").oninput = e => { state.query = e.target.value.trim().toLowerCase(); render(); };
    box.querySelectorAll("[data-type-filter]").forEach(b => b.onclick = () => {
      state.typeFilter = b.dataset.typeFilter;
      box.querySelectorAll("[data-type-filter]").forEach(x => x.classList.toggle("active", x === b));
      render();
    });

    box.querySelector(".yun-batch-sync").onclick = batchSync;
    box.querySelector(".yun-batch-delete").onclick = batchDelete;

    box.querySelector(".yun-refresh-btn").onclick = refresh;
    applyMode();
    load();
  }

  function applyMode() {
    const box = document.querySelector(".yun-inbox");
    if (!box) return;
    box.classList.toggle("browse-mode", state.mode === "browse");
    box.classList.toggle("edit-mode", state.mode === "edit");
    box.querySelector(".yun-mode-btn").textContent = state.mode === "browse" ? "编辑模式" : "浏览模式";
    box.querySelector(".yun-edit-tools").hidden = false;
    box.querySelector(".yun-batch-row").hidden = state.mode !== "edit";
  }

  async function load() {
    const list = document.querySelector(".yun-inbox-list");
    list.innerHTML = '<div class="yun-inbox-empty">正在读取最近收集…</div>';
    try {
      const r = await apiFetch("/api/recent-json");
      if (!r.ok) throw Error("HTTP " + r.status);
      const data = await r.json();
      state.items = Array.isArray(data.items) ? data.items : [];
      render();
    } catch (e) {
      list.innerHTML = `<div class="yun-inbox-empty"><b>收集箱连接失败</b><br>请刷新页面重试。<br><small>${esc(e.message)}</small></div>`;
    }
  }

  async function refresh() {
    const btn = document.querySelector(".yun-refresh-btn");
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.add("working");
    try {
      const r = await apiFetch("/api/recent-json");
      if (!r.ok) throw Error("HTTP " + r.status);
      const data = await r.json();
      const incoming = Array.isArray(data.items) ? data.items : [];
      const ids = new Set(state.items.map(x => String(x.id)));
      const newer = incoming.filter(x => !ids.has(String(x.id)));
      state.items = [...newer, ...state.items];
      render();
      btn.title = newer.length ? `新增 ${newer.length} 项` : "没有新文件";
    } catch(e) { alert("刷新失败：" + e.message); }
    finally { btn.disabled=false; btn.classList.remove("working"); }
  }

  function filteredItems() {
    return state.items.filter(x => {
      const editTypeOK = state.typeFilter === "全部" || (state.typeFilter === "收藏" && x.favorite) || typeName(x.type) === state.typeFilter;
      const regexOK = !state.regexSelected.length || String(x.regex || "").split(/[,，]/).some(label => state.regexSelected.includes(label.trim()));
      const q = state.query;
      const text = `${x.displayName || x.name || ""} ${x.name || ""} ${x.regex || ""} ${x.note || ""}`.toLowerCase();
      return editTypeOK && regexOK && (!q || text.includes(q));
    });
  }

  function drag(row, x) {
    row.draggable = true;
    row.ondragstart = e => {
      if (e.target.closest("button,input,audio,video")) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("application/x-yun-inbox", JSON.stringify(x));
      e.dataTransfer.setData("text/plain", x.displayName || x.name || "");
    };
  }

  function openPreview(x) {
    const old = document.querySelector(".yun-preview-backdrop"); if (old) old.remove();
    const back = document.createElement("div"); back.className = "yun-preview-backdrop";
    const modal = document.createElement("div"); modal.className = "yun-preview-modal";
    modal.innerHTML = `<div class="yun-preview-head"><strong>${esc(x.displayName || x.name || "素材预览")}</strong><button aria-label="关闭">×</button></div><div class="yun-preview-body"></div>`;
    back.append(modal); document.body.append(back);
    const body = modal.querySelector(".yun-preview-body"), src = x.media || x.preview || "";
    if (x.type === "图片") body.innerHTML = `<img src="${esc(src)}" alt="${esc(x.displayName || x.name || "")}">`;
    else if (x.type === "视频") body.innerHTML = `<video src="${esc(src)}" controls autoplay playsinline preload="metadata"></video>`;
    else if (["录音","音频"].includes(x.type)) body.innerHTML = `<audio src="${esc(src)}" controls autoplay preload="metadata"></audio>`;
    else if (["文字","记录"].includes(x.type)) {
      body.innerHTML = '<div class="yun-preview-loading">正在读取文字…</div>';
      fetch(src,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.text();}).then(t=>{body.innerHTML="";const pre=document.createElement("pre");pre.textContent=t;body.append(pre);}).catch(()=>body.innerHTML='<div class="yun-preview-loading">暂时无法读取这份文字。</div>');
    } else body.innerHTML = `<div class="yun-preview-file">${icon(x.type)}<b>${esc(x.displayName || x.name || "文件")}</b><span>${esc(x.size || "")}</span></div>`;
    const close = () => { back.querySelectorAll("audio,video").forEach(m=>m.pause()); back.remove(); };
    modal.querySelector("button").onclick = close;
    back.onclick = e => { if (e.target === back) close(); };
  }

  function displayNameEditor(row, x) {
    const title=row.querySelector(".yun-inbox-name");
    title.title=state.mode==="browse"?"双击修改显示名称":"点击修改显示名称";
    const edit=e=>{
      e.preventDefault();e.stopPropagation();
      if(row.querySelector(".yun-inline-name"))return;
      const oldName=x.displayName,oldDirty=x.dirty;
      const input=document.createElement("input");input.className="yun-inline-name";
      input.value=x.displayName||x.name||"";input.setAttribute("aria-label","修改显示名称");
      title.replaceWith(input);row.draggable=false;input.focus();input.select();
      input.onclick=e=>e.stopPropagation();input.ondblclick=e=>e.stopPropagation();
      let finished=false;
      const save=async()=>{
        if(finished)return;finished=true;
        const v=input.value.trim();
        if(v && v!==(x.displayName||x.name)){
          input.disabled=true;x.displayName=v;x.dirty=true;
          try{await saveMeta(x,{displayName:v});}
          catch(error){x.displayName=oldName;x.dirty=oldDirty;alert("显示名称保存失败："+error.message);}
        }
        render();
      };
      input.onblur=save;
      input.onkeydown=ev=>{
        if(ev.key==="Enter"){ev.preventDefault();input.blur();}
        if(ev.key==="Escape"){ev.preventDefault();finished=true;render();}
      };
    };
    title.onclick=e=>{e.stopPropagation();if(state.mode==="edit")edit(e);};
    title.ondblclick=e=>{e.stopPropagation();if(state.mode==="browse")edit(e);};
  }

  async function saveMeta(x, patch) {
    const r = await apiFetch("/api/item-meta", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id:x.id,path:x.path,...patch})
    });
    if (!r.ok) throw Error("保存失败");
    return r.json();
  }

  async function syncItem(x, btn) {
    const current = x.displayName || x.name || "";
    if (!current) return;
    btn?.classList.add("working");
    try {
      const r = await apiFetch("/api/item-rename", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:x.id,path:x.path,displayName:current,timestamp:x.timestamp})
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw Error(d.error || "同步失败");
      x.path = d.path || x.path;
      x.name = d.name || x.name;
      x.dirty = false;
      render();
    } catch(e) {
      alert("同步失败：" + e.message);
    } finally { btn?.classList.remove("working"); }
  }

  async function deleteItem(x) {
    if (!confirm(`删除“${x.displayName || x.name || "这个文件"}”？\n\n确认后会同时删除百度网盘中的原文件。`)) return;
    try {
      const r = await apiFetch("/api/item-delete", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:x.id,path:x.path})
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw Error(d.error || "删除失败");
      state.items = state.items.filter(i => String(i.id) !== String(x.id));
      state.selected.delete(String(x.id));
      render();
    } catch(e) { alert("删除失败：" + e.message); }
  }

  async function batchSync() {
    const xs = [...state.selected].map(byId).filter(Boolean);
    if (!xs.length) return;
    for (const x of xs) await syncItem(x);
    state.selected.clear();
    render();
  }

  async function batchDelete() {
    const xs = [...state.selected].map(byId).filter(Boolean);
    if (!xs.length) return;
    if (!confirm(`确定删除选中的 ${xs.length} 个文件？\n\n将同时删除百度网盘中的原文件。`)) return;
    for (const x of xs) {
      try {
        const r = await apiFetch("/api/item-delete", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({id:x.id,path:x.path,confirmed:true})
        });
        const d = await r.json();
        if (r.ok && d.ok) state.items = state.items.filter(i => String(i.id) !== String(x.id));
      } catch(_) {}
    }
    state.selected.clear(); render();
  }

  function render() {
    const box = document.querySelector(".yun-inbox");
    if (!box) return;
    box.querySelector(".yun-selected-count").textContent = `已选择 ${state.selected.size} 项`;

    const list = box.querySelector(".yun-inbox-list");
    list.replaceChildren();
    const filtered = filteredItems();
    if (!filtered.length) {
      list.innerHTML = '<div class="yun-inbox-empty">这里还没有符合条件的素材。</div>';
      return;
    }

    let day = "";
    filtered.forEach(x => {
      if (state.mode === "edit") {
        const d = x.day || "最近";
        if (d !== day) { day = d; const h = document.createElement("div"); h.className="yun-inbox-day"; h.textContent=d; list.append(h); }
      }
      const row = document.createElement("div");
      row.className = "yun-inbox-item yun-type-"+typeClass(x.type);
      row.dataset.id = x.id;
      const thumb = x.type === "图片" && x.preview ? `<img src="${esc(x.preview)}" alt="">`
        : icon(x.type);
      const checked = state.selected.has(String(x.id));
      const title = esc(x.displayName || x.name || "未命名素材");
      const rx = x.regex ? `<span class="yun-tag yun-tag-rx">${esc(x.regex)}</span>` : "";
      const typeTag = `<span class="yun-tag yun-tag-type">${esc(typeName(x.type))}</span>`;
      row.innerHTML = `
        ${state.mode === "edit" ? `<label class="yun-check"><input type="checkbox" ${checked?"checked":""}></label>` : ""}
        <div class="yun-inbox-thumb">${thumb}</div>
        <div class="yun-inbox-info">
          <div class="yun-title-line"><div class="yun-inbox-name">${title}</div>${state.mode==="edit"?typeTag+rx:""}</div>
          <div class="yun-inbox-meta">${esc(x.time||"")}${x.size?" · "+esc(x.size):""}</div>
        </div>
        <div class="yun-item-actions">
          ${state.mode==="edit" ? `<button class="yun-icon-btn yun-sync" title="${x.dirty?"未同步":"同步到网盘"}">↻</button>` : ""}
          <button type="button" class="yun-icon-btn yun-star ${x.favorite?"active":""}" title="${x.favorite?"取消收藏":"收藏"}" aria-label="${x.favorite?"取消收藏":"收藏"}" aria-pressed="${!!x.favorite}">${x.favorite?"★":"☆"}</button>
          <button class="yun-icon-btn yun-delete" title="删除">×</button>
        </div>
      `;
      drag(row,x);

      if (state.mode === "edit") {
        const cb = row.querySelector('input[type="checkbox"]');
        cb.onchange = () => { cb.checked ? state.selected.add(String(x.id)) : state.selected.delete(String(x.id)); render(); };
        row.querySelector(".yun-sync").onclick = e => { e.stopPropagation(); syncItem(x,e.currentTarget); };
      }
      displayNameEditor(row,x);
      row.querySelector(".yun-star").onclick = async e => {
        e.stopPropagation(); x.favorite = !x.favorite;
        await saveMeta(x,{favorite:x.favorite}).catch(()=>{});
        render();
      };
      row.querySelector(".yun-delete").onclick = e => { e.stopPropagation(); deleteItem(x); };

      if (["录音","音频","视频"].includes(x.type) && x.media) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "yun-media-toggle";
        btn.innerHTML = mediaIcon(x.type);
        btn.title = x.type === "视频" ? "点击展开视频" : "点击展开录音播放条";
        btn.setAttribute("aria-label",btn.title);
        row.querySelector(".yun-inbox-thumb").replaceChildren(btn);
        btn.onclick = e => {
          e.stopPropagation();
          const old = row.querySelector(".yun-inbox-audio,.yun-inbox-video");
          if (old) { old.pause(); old.remove(); btn.innerHTML=mediaIcon(x.type); return; }
          const media = document.createElement(x.type === "视频" ? "video" : "audio");
          media.className = x.type === "视频" ? "yun-inbox-video" : "yun-inbox-audio";
          media.controls = true;
          media.preload = "none";
          media.playsInline = true;
          media.draggable = false;
          media.src = x.media;
          if (x.type === "视频") media.ondblclick = () => openPreview(x);
          row.append(media);
          btn.innerHTML=mediaIcon(x.type,true);
          media.play().catch(() => {});
        };
      } else if (["图片","文字","记录"].includes(x.type)) {
        row.ondblclick = e => { if (!e.target.closest("button,input,audio,video")) openPreview(x); };
      }
      list.append(row);
    });
  }

  window.YunInbox = {api:API,reload:load};
  document.addEventListener("DOMContentLoaded", shell);
})();
