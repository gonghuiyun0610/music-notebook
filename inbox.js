/** YUN 收集箱前端。真实数据接口：Worker GET /api/recent-json */
"use strict";
(() => {
  const API = localStorage.getItem("yunInboxApi") || "https://yun-music-api.jgjhhjybzh.workers.dev";
  const TYPES=["最近收集","图片","录音","视频","文件","文字"];
  let items=[], filter="最近收集";
  const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const icon=t=>({图片:"🖼",录音:"🎙",音频:"🎙",视频:"🎬",文字:"✎",文件:"📄"}[t]||"📄");
  function shell(){
    const tab=document.createElement("button"); tab.className="yun-inbox-tab"; tab.textContent="‹ 收集箱"; tab.title="打开收集箱";
    const box=document.createElement("section"); box.className="yun-inbox"; box.innerHTML=`<div class="yun-inbox-head"><span>♩</span><strong>收集箱</strong><button class="yun-inbox-close" aria-label="收起">×</button></div><div class="yun-inbox-search"><input placeholder="搜索最近收集的内容…"></div><div class="yun-inbox-tabs"></div><div class="yun-inbox-list"></div><div class="yun-inbox-tip">可直接拖到知识块白板中，自动生成对应内容块</div>`;
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
      const r=await fetch(API+"/api/recent-json",{credentials:"include",cache:"no-store"});
      if(!r.ok) throw Error("HTTP "+r.status);
      const data=await r.json(); items=Array.isArray(data.items)?data.items:[]; render();
    }catch(e){
      list.innerHTML=`<div class="yun-inbox-empty"><b>收集箱界面已经就位</b><br>等待 Worker 开放 <code>/api/recent-json</code> 后，这里会直接显示百度网盘最近收集。<br><small>${esc(e.message)}</small></div>`;
    }
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
      const row=document.createElement("div");row.className="yun-inbox-item";row.draggable=true;
      const thumb=x.type==="图片"&&x.preview?`<img src="${esc(x.preview)}" alt="">`:icon(x.type);
      row.innerHTML=`<div class="yun-inbox-thumb">${thumb}</div><div><div class="yun-inbox-name">${esc(x.name||"未命名素材")}</div><div class="yun-inbox-meta">${esc(x.time||"")} ${x.size?" · "+esc(x.size):""}</div></div>${x.organized?'<span class="yun-inbox-badge">✓ 已整理</span>':""}`;
      row.ondragstart=e=>{e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("application/x-yun-inbox",JSON.stringify(x));e.dataTransfer.setData("text/plain",x.name||"");};
      list.append(row);
    });
  }
  window.YunInbox={api:API,reload:load};
  document.addEventListener("DOMContentLoaded",shell);
})();
