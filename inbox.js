/** YUN 收集箱 V3：预览 / 播放 / 拖拽。真实数据接口：Worker GET /api/recent-json */
"use strict";
(() => {
  const API = localStorage.getItem("yunInboxApi") || "https://yun-music-api.jgjhhjybzh.workers.dev";
  const TYPES=["最近收集","图片","录音","视频","文件","文字"];
  let items=[], filter="最近收集";
  const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const icon=t=>({图片:"🖼",录音:"🎙",音频:"🎙",视频:"🎬",文字:"✎",文件:"📄"}[t]||"📄");
  function shell(){
    const tab=document.createElement("button"); tab.className="yun-inbox-tab"; tab.textContent="‹ 收集箱"; tab.title="打开收集箱";
    const box=document.createElement("section"); box.className="yun-inbox"; box.innerHTML=`<div class="yun-inbox-head"><span>♩</span><strong>收集箱</strong><button class="yun-inbox-close" aria-label="收起">×</button></div><div class="yun-inbox-search"><input placeholder="搜索最近收集的内容…"></div><div class="yun-inbox-tabs"></div><div class="yun-inbox-list"></div><div class="yun-inbox-tip">可预览播放；拖到已有模块可直接填入，拖到白板空白处会新建模块</div>`;
    document.body.append(tab,box);
    tab.onclick=()=>{box.classList.add("open");tab.hidden=true;};
    box.querySelector(".yun-inbox-close").onclick=()=>{box.classList.remove("open");tab.hidden=false;};
    const tabs=box.querySelector(".yun-inbox-tabs"); TYPES.forEach(t=>{const b=document.createElement("button");b.textContent=t;b.dataset.type=t;b.onclick=()=>{filter=t;render();};tabs.append(b);});
    box.querySelector("input").oninput=render;
    load();
  }
  async function load(){
    const list=document.querySelector(".yun-inbox-list"); list.innerHTML='<div class="yun-inbox-empty">正在读取最近收集…</div>';
    try{
      let token=localStorage.getItem("yunInboxSession")||"";
      let r=await fetch(API+"/api/recent-json",{headers:token?{Authorization:"Bearer "+token}:{},cache:"no-store"});
      if(r.status===401){
        const secret=prompt("首次连接收集箱，请输入 YUN 安全密钥：");
        if(!secret) throw Error("尚未连接 YUN 收集箱");
        const lr=await fetch(API+"/api/yun-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret})});
        const ld=await lr.json();
        if(!lr.ok||!ld.token) throw Error(ld.error||"连接失败");
        token=ld.token; localStorage.setItem("yunInboxSession",token);
        r=await fetch(API+"/api/recent-json",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      }
      if(!r.ok) throw Error("HTTP "+r.status);
      const data=await r.json(); items=Array.isArray(data.items)?data.items:[]; render();
    }catch(e){
      list.innerHTML=`<div class="yun-inbox-empty"><b>收集箱连接失败</b><br>请刷新页面重试。<br><small>${esc(e.message)}</small></div>`;
    }
  }
  function drag(row,x){
    row.draggable=true;
    row.ondragstart=e=>{e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("application/x-yun-inbox",JSON.stringify(x));e.dataTransfer.setData("text/plain",x.name||"");};
  }
  function openPreview(x){
    const old=document.querySelector(".yun-preview-backdrop"); if(old) old.remove();
    const back=document.createElement("div");back.className="yun-preview-backdrop";
    const modal=document.createElement("div");modal.className="yun-preview-modal";
    modal.innerHTML=`<div class="yun-preview-head"><strong>${esc(x.name||"素材预览")}</strong><button aria-label="关闭">×</button></div><div class="yun-preview-body"></div>`;
    back.append(modal);document.body.append(back);
    const body=modal.querySelector(".yun-preview-body"), src=x.media||x.preview||"";
    if(x.type==="图片") body.innerHTML=`<img src="${esc(src)}" alt="${esc(x.name||"")}">`;
    else if(x.type==="视频") body.innerHTML=`<video src="${esc(src)}" controls autoplay playsinline preload="metadata"></video>`;
    else if(["录音","音频"].includes(x.type)) body.innerHTML=`<audio src="${esc(src)}" controls autoplay preload="metadata"></audio>`;
    else if(x.type==="文字"){
      body.innerHTML='<div class="yun-preview-loading">正在读取文字…</div>';
      fetch(src,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.text();}).then(t=>{body.innerHTML="";const pre=document.createElement("pre");pre.textContent=t;body.append(pre);}).catch(()=>{body.innerHTML='<div class="yun-preview-loading">暂时无法读取这份文字。</div>';});
    } else body.innerHTML=`<div class="yun-preview-file">${icon(x.type)}<b>${esc(x.name||"文件")}</b><span>${esc(x.size||"")}</span></div>`;
    const close=()=>{back.querySelectorAll("audio,video").forEach(m=>m.pause());back.remove();};
    modal.querySelector("button").onclick=close; back.onclick=e=>{if(e.target===back)close();};
  }
  function render(){
    const box=document.querySelector(".yun-inbox"), q=box.querySelector("input").value.trim().toLowerCase();
    box.querySelectorAll(".yun-inbox-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.type===filter));
    const filtered=items.filter(x=>(filter==="最近收集"||x.type===filter||(filter==="录音"&&x.type==="音频"))&&(!q||String(x.name||"").toLowerCase().includes(q)));
    const list=box.querySelector(".yun-inbox-list"); list.replaceChildren();
    if(!filtered.length){list.innerHTML='<div class="yun-inbox-empty">这里还没有符合条件的素材。</div>';return;}
    let day="";
    filtered.forEach(x=>{
      const d=x.day||"最近"; if(d!==day){day=d;const h=document.createElement("div");h.className="yun-inbox-day";h.textContent=d;list.append(h);}
      const row=document.createElement("div");row.className="yun-inbox-item";
      const thumb=x.type==="图片"&&x.preview?`<img src="${esc(x.preview)}" alt="">`:icon(x.type);
      const playable=["录音","音频","视频","图片","文字"].includes(x.type);
      row.innerHTML=`<div class="yun-inbox-thumb">${thumb}</div><div class="yun-inbox-info"><div class="yun-inbox-name">${esc(x.name||"未命名素材")}</div><div class="yun-inbox-meta">${esc(x.time||"")} ${x.size?" · "+esc(x.size):""}</div></div>${playable?'<button class="yun-inbox-preview" type="button">预览</button>':""}${x.organized?'<span class="yun-inbox-badge">✓ 已整理</span>':""}`;
      drag(row,x);
      const pb=row.querySelector(".yun-inbox-preview"); if(pb){pb.draggable=false;pb.onclick=e=>{e.preventDefault();e.stopPropagation();openPreview(x);};}
      if(["录音","音频"].includes(x.type) && x.media){const a=document.createElement("audio");a.className="yun-inbox-audio";a.src=x.media;a.controls=true;a.preload="metadata";a.draggable=false;row.append(a);}
      if(x.type==="视频" && x.media){const v=document.createElement("video");v.className="yun-inbox-video";v.src=x.media;v.controls=true;v.playsInline=true;v.preload="metadata";v.draggable=false;row.append(v);}
      list.append(row);
    });
  }
  window.YunInbox={api:API,reload:load};
  document.addEventListener("DOMContentLoaded",shell);
})();
