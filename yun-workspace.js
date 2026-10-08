/** V26: one active bookmark, column nodes and an independent inbox lane. */
"use strict";
(() => {
  let workspace,rail,graph,slot,active=null,nodes=[],pan=null,scrollFrame=0,lastSelection=null;
  const pointKey=id=>"point:"+id;
  const ordered=list=>[...list].sort((a,b)=>(a.object.sidebarOrder??1e6)-(b.object.sidebarOrder??1e6));
  function shell(){
    if(workspace)return;
    const blocks=$("blocks");workspace=el("div",{class:"yun-workspace",id:"yun-workspace"});
    rail=el("div",{class:"yun-workspace-rail"});graph=el("section",{class:"yun-column-nodes","aria-label":"当前栏目知识块"});
    slot=el("div",{class:"yun-workspace-inbox-slot",id:"yun-workspace-inbox-slot"});
    rail.append(graph,slot);blocks.parentNode.insertBefore(workspace,blocks);workspace.append(rail,blocks);
  }
  const boardElement=id=>document.getElementById("block-"+id);
  function setActive(id,scroll=false){
    const n=nodes.find(n=>n.id===id);if(!n)return;
    active=id;boardSelectedKnowledge=id;
    for(const old of workspace.querySelectorAll(".board-local-tools"))old.remove();
    for(const item of nodes){const board=boardElement(item.id);if(!board)continue;
      board.classList.toggle("yun-active-board",item.id===active);
      board.dataset.columnParent=item.parent;
    }
    const board=boardElement(id),title=board?.querySelector(".knowledge-board-title");
    if(title){const tools=boardLocalTools(n.object,n.list);tools.style.top="";
      // In browsing mode the add control enters editing before adding content.
      if(!editing){const summary=tools.querySelector("summary");summary.onclick=e=>{e.preventDefault();e.stopPropagation();beginEdit(n);};}
      title.append(tools);
      tools.querySelector(".board-inbox-button")?.setAttribute("aria-expanded",String(!!document.querySelector(".yun-inbox.open")));
    }
    for(const node of graph.querySelectorAll(".yun-column-node")){
      const selected=node.dataset.blockId===active;node.classList.toggle("active",selected);node.setAttribute("aria-current",selected?"true":"false");
      const state=node.querySelector(".yun-node-state");state.textContent=selected?(editing?"编辑中":"当前"):"";
    }
    if(scroll)board?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function beginEdit(n){
    current=n.p.id;Archive.selection={kind:"point",id:n.id};Archive.view="knowledge";editing=true;active=n.id;render();
    boardElement(n.id)?.scrollIntoView({block:"start"});
  }
  function reorder(from,to,after=false){
    const source=nodes.find(n=>n.id===from),target=nodes.find(n=>n.id===to);
    if(!source||!target||source===target||source.parent!==target.parent)return false;
    const next=nodes.filter(n=>n.id!==from);next.splice(next.findIndex(n=>n.id===to)+(after?1:0),0,source);
    next.forEach((n,i)=>n.object.sidebarOrder=i);
    // Persist the same order in the physical lists without moving unrelated items.
    for(const list of new Set(next.map(n=>n.list))){
      const items=next.filter(n=>n.list===list).map(n=>n.object),ids=new Set(items.map(b=>b.id));let index=0;
      for(let i=0;i<list.length;i++)if(ids.has(list[i].id))list[i]=items[index++];
    }
    changed();render();return true;
  }
  function renderNodes(){
    graph.replaceChildren(el("h3",{text:"当前栏目知识块"}));
    const list=el("div",{class:"yun-column-node-list"});
    nodes.forEach(n=>{
      const row=el("div",{class:"yun-column-node",tabindex:"0",role:"button","aria-label":"跳转到"+n.title});row.dataset.blockId=n.id;
      const grip=button("⠿",()=>{},"yun-node-grip");grip.title="拖动调整上下顺序；Alt＋上下箭头也可排序";grip.setAttribute("aria-label",grip.title);
      const label=el("span",{class:"yun-node-label",text:n.title}),state=el("small",{class:"yun-node-state"});row.append(grip,label,state);
      row.onclick=e=>{if(e.target.closest?.(".yun-node-grip"))return;setActive(n.id,true);};
      row.onkeydown=e=>{if(e.altKey&&["ArrowUp","ArrowDown"].includes(e.key)){
        e.preventDefault();const i=nodes.findIndex(x=>x.id===n.id),j=i+(e.key==="ArrowUp"?-1:1);if(nodes[j])reorder(n.id,nodes[j].id,j>i);
      }else if(e.key==="Enter"){e.preventDefault();setActive(n.id,true);}};
      grip.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();
        pan={id:n.id,pointer:e.pointerId,x:e.clientX,y:e.clientY,target:null,after:false};grip.setPointerCapture?.(e.pointerId);row.classList.add("dragging");};
      grip.onpointermove=e=>{if(!pan)return;e.preventDefault();
        graph.querySelectorAll(".yun-column-node").forEach(r=>{r.classList.remove("drop-before","drop-after");const rect=r.getBoundingClientRect();
          if(r.dataset.blockId!==pan.id&&e.clientY>=rect.top&&e.clientY<=rect.bottom){pan.target=r.dataset.blockId;pan.after=e.clientY>rect.top+rect.height/2;r.classList.add(pan.after?"drop-after":"drop-before");}
        });
      };
      const finish=e=>{if(!pan)return;const drag=pan;pan=null;grip.releasePointerCapture?.(e.pointerId);row.classList.remove("dragging");graph.querySelectorAll(".yun-column-node").forEach(r=>r.classList.remove("drop-before","drop-after"));
        if(drag.target&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)reorder(drag.id,drag.target,drag.after);
      };
      grip.onpointerup=finish;grip.onpointercancel=()=>{pan=null;row.classList.remove("dragging");};
      list.append(row);
    });graph.append(list,el("p",{class:"yun-node-hint",text:"拖动节点调整上下顺序"}));
  }
  const previous=render;
  render=function(){
    previous();shell();pan=null;
    const root=$("blocks"),boards=[...root.children].filter(n=>n.classList.contains("knowledge-board"));
    const enabled=["directory","knowledge"].includes(Archive.view)&&boards.length>0;
    workspace.classList.toggle("with-nodes",enabled);rail.hidden=!enabled;
    if(!enabled){nodes=[];active=null;graph.replaceChildren();window.YunInbox?.resetDock?.();return;}
    const model=window.YunSidebar.model(),selected=Archive.selection?`${Archive.selection.kind}:${Archive.selection.id}`:null;
    const selection=model.find(n=>n.key===selected),first=model.find(n=>n.id===boards[0].id.slice(6));
    if(selected!==lastSelection&&selection?.kind==="point")active=selection.id;lastSelection=selected;
    const parent=selection?.kind==="point"?selection.parent:selection?.key||first?.parent||"knowledge:root";
    nodes=ordered(model.filter(n=>n.kind==="point"&&n.parent===parent));
    // Legacy page holders can contain boards from different logical columns.
    for(const board of boards)if(!nodes.some(n=>"block-"+n.id===board.id))board.remove();
    nodes=nodes.filter(n=>boardElement(n.id));
    if(!nodes.length){workspace.classList.remove("with-nodes");rail.hidden=true;return;}
    const add=root.querySelector(".yun-add-knowledge");
    nodes.forEach(n=>{const b=boardElement(n.id);root.insertBefore(b,add||null);
      b.querySelector(".board-practice-actions")?.remove();
      b.addEventListener("pointerdown",e=>{if(e.button===0&&active!==n.id&&!e.target.closest?.(".board-local-tools"))setActive(n.id);},true);
    });
    renderNodes();setActive(nodes.some(n=>n.id===active)?active:(nodes.some(n=>n.id===selection?.id)?selection.id:nodes[0].id));
    window.YunInbox?.resetDock?.();
  };
  function follow(){scrollFrame=0;if(!nodes.length)return;
    const visible=nodes.map(n=>({n,r:boardElement(n.id)?.getBoundingClientRect()})).filter(x=>x.r&&x.r.bottom>140&&x.r.top<window.innerHeight);
    if(visible.length){const next=visible.find(x=>x.r.top<=150)||visible[0];if(next.n.id!==active)setActive(next.n.id);}
  }
  document.addEventListener("scroll",()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(follow);},true);
  window.YunWorkspace={reorder,setActive,get active(){return active;},get nodes(){return nodes;},get inboxSlot(){return rail&&!rail.hidden?slot:null;}};
})();
