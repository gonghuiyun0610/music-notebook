/* YUN 外观与导航；原知识、练习、同步模块继续复用。 */
"use strict";
const Yun={expanded:null,menu:null,drag:null,mapDispose:null,instrumentScope:"today",practiceSection:"un"};
const yunPaths={home:'<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>',book:'<path d="M12 5v16M12 5C8 2 3 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-1-1-6-2-10 1z"/>',practice:'<circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="m10 8-4 8m8-8 4 8"/>',piano:'<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 3v18m5-18v18m5-18v18M5 3v9m5-9v9m5-9v9m5-9v9"/>',works:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18m-12 5h6"/>',plus:'<path d="M12 5v14M5 12h14"/>',dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',minus:'<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',folder:'<path d="M2 7V5h8l2 3h10v13H2z"/>',file:'<path d="M5 2h9l5 5v15H5zM14 2v6h5M9 13h6m-6 4h6"/>',arrow:'<path d="m9 5 7 7-7 7"/>',grip:'<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3" stroke-linecap="round"/>'};
function yunIcon(name){const n=el("span",{class:"yun-icon","aria-hidden":"true"});n.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">'+(yunPaths[name]||yunPaths.file)+'</svg>';return n;}
function yunButton(label,icon,fn,cls=""){const b=button("",fn,cls);if(icon)b.append(yunIcon(icon));if(label)b.append(el("span",{text:label}));b.type="button";return b;}
function yunShell(){if($("yun-toolbar"))return;const aside=document.querySelector("aside");aside.querySelector("p.muted")?.remove();const heading=el("div",{class:"yun-brand"},[el("h2",{text:"YUN的音乐档案"}),el("p",{text:"听过，练过，留下过"})]);const toolbar=el("div",{class:"yun-toolbar",id:"yun-toolbar"});brand.replaceChildren(yunIcon("home"));brand.className="brand yun-home";brand.title="回到主页";toolbar.append(brand,el("div",{id:"yun-tools",class:"yun-tools"}));const input=$("search");input.placeholder="搜索";const search=el("div",{class:"yun-search"},[yunIcon("search"),input]);aside.prepend(heading,toolbar,search);document.addEventListener("click",e=>{if(Yun.menu&&!Yun.menu.contains(e.target)&&!e.target.closest?.(".yun-menu-trigger"))yunCloseMenu();});document.addEventListener("keydown",e=>{if(e.key==="Escape")yunCloseMenu();});}
function yunCloseMenu(){Yun.menu?.remove();Yun.menu=null;document.querySelectorAll(".yun-menu-trigger").forEach(n=>n.setAttribute("aria-expanded","false"));}
function yunContext(){if(Yun.expanded)return Yun.expanded;if(["directory","knowledge"].includes(Archive.view))return "knowledge";if(Archive.view==="home")return Yun.expanded||"knowledge";return Archive.view;}
function yunPopup(anchor,title,items){yunCloseMenu();const menu=el("div",{class:"yun-popover",role:"menu"},[el("small",{text:title})]);items.forEach(([name,desc,fn])=>{const row=button("",()=>{yunCloseMenu();fn();},"yun-menu-item");row.setAttribute("role","menuitem");row.append(el("strong",{text:name}));if(desc)row.append(el("small",{text:desc}));menu.append(row);});$("yun-toolbar").append(menu);Yun.menu=menu;anchor.setAttribute("aria-expanded","true");menu.querySelector("button")?.focus();}
function yunAddMenu(anchor){const view=yunContext();const names={knowledge:"知识百科",practice:"练习库",instrument:"乐器练习",works:"作品档案"};let items;
 if(view==="knowledge"){items=[["新建课程","按章节和课组织内容",()=>{Archive.selection=null;archiveAddDialog();}],["新建词条","直接记录一个知识点",yunNewEntry]];if(Archive.selection&&Archive.selection.kind!=="standalone")items.unshift(["在当前目录下新增","继续添加章节、课次或知识点",archiveAddDialog]);}
 if(view==="practice")items=[["新建练习单","保存自己的练习组合",()=>archiveListDialog()],["生成复习计划","选择范围后生成今日列表",()=>archivePlanDialog()],["新建分类","整理已加入的知识点",()=>{const d=archiveDialog("新建分类"),n=archiveInput();d.append(archiveField("分类名称",n));archiveCloseRow(d,()=>{const t=n.value.trim();if(!t)return;if(!data.practiceCategories.includes(t))data.practiceCategories.push(t);d.close();archivePersist();});}]];
 if(view==="instrument")items=[["新增练习条目","记录想练的内容",()=>{const i=archiveCurrentInstrument();if(i)archiveInstrumentItemDialog(i);}],["安排练习","选日期与目标时长",()=>{const i=archiveCurrentInstrument();if(i)archiveInstrumentSchedule(i);}],["新增乐器","增加自己的乐器档案",yunNewInstrument]];
 if(view==="works")items=[["新建作品","保留各个阶段的版本",()=>archiveWorkDialog()]];
 yunPopup(anchor,"新增到"+names[view],items);}
function yunManageMenu(anchor){const view=yunContext();yunPopup(anchor,"管理"+({knowledge:"知识百科",practice:"练习库",instrument:"乐器练习",works:"作品档案"}[view]),[["管理目录","重命名、调整顺序、删除",()=>{Yun.expanded=view;Archive.directoryEdit=true;nav();}],["收起全部","",()=>{Yun.expanded=null;for(const key of viewState.keys())if(key.startsWith("archive-tree:"))viewState.set(key,false);nav();}]]);}
function yunNewEntry(){const d=archiveDialog("新建词条"),name=archiveInput("","例如：和弦转位、效果器连接");d.append(archiveField("词条名称",name));archiveCloseRow(d,()=>{const title=name.value.trim();if(!title)return;const b=createBlock("group");b.title=title;const p={id:uid(),title,kind:"knowledge",standalone:true,category:"独立词条",blocks:[b]};data.pages.push(p);current=p.id;Archive.selection={kind:"standalone",id:p.id};Archive.view="knowledge";Yun.expanded="knowledge";editing=true;d.close();archivePersist();},"创建");}
function yunNewInstrument(){const d=archiveDialog("新增乐器"),n=archiveInput();d.append(archiveField("名称",n));archiveCloseRow(d,()=>{if(!n.value.trim())return;const i={id:uid(),name:n.value.trim(),items:[],sessions:[],plans:[]};data.instruments.push(i);Archive.instrument=i.id;d.close();archiveNavigate("instrument");changed();},"创建");}
function yunReorder(list,from,to){const a=list.findIndex(x=>x.id===from),b=list.findIndex(x=>x.id===to);if(a<0||b<0||a===b)return false;if(list===data.pages&&(list[a].chapterId!==list[b].chapterId||!!list[a].standalone!==!!list[b].standalone))return false;const [item]=list.splice(a,1);list.splice(b,0,item);return true;}
function yunTree(label,kind,id,list,rename,open,children){const box=el("div",{class:"yun-tree-node"}),row=el("div",{class:"yun-tree-row"});const key="archive-tree:"+id;let expanded=viewState.get(key)??false;
 if(Archive.directoryEdit){const del=yunButton("","minus",()=>{if(kind==="instrument"){archiveConfirm("删除乐器？","该乐器的练习条目、计划和日志将移除，可撤销。",()=>{const snapshot=clone(data.instruments);data.instruments=data.instruments.filter(i=>i.id!==id);archivePersist();archiveUndo(()=>data.instruments=snapshot,"已删除乐器");});}else if(kind==="work"){archiveConfirm("删除作品？","阶段记录一同移除，可撤销。",()=>{const snapshot=clone(data.works);data.works=data.works.filter(w=>w.id!==id);archivePersist();archiveUndo(()=>data.works=snapshot,"已删除作品");});}else if(kind==="playlist"){const old=clone(data.practiceLists);data.practiceLists=data.practiceLists.filter(l=>l.id!==id);archivePersist();archiveUndo(()=>data.practiceLists=old,"已删除练习单");}else archiveDelete(kind==="standalone"?"lesson":kind,id);},"yun-minus");del.setAttribute("aria-label","删除"+label);row.append(del);}
 if(children){const toggle=yunButton("","arrow",()=>{viewState.set(key,!expanded);nav();},"yun-chevron"+(expanded?" open":""));toggle.setAttribute("aria-label","展开或收起"+label);toggle.setAttribute("aria-expanded",String(expanded));row.append(toggle);}
 row.append(yunIcon(children?"folder":"file"));
 if(Archive.directoryEdit){const input=archiveInput(label);input.setAttribute("aria-label","修改"+label);input.onchange=()=>{const v=input.value.trim();if(v){rename(v);changed();nav();}else input.value=label;};row.append(input);const handle=yunButton("","grip",()=>{},"yun-grip");handle.title="拖动排序；也可用 Alt＋上下箭头";handle.draggable=true;handle.ondragstart=e=>{Yun.drag={list,id};e.dataTransfer.setData("text/plain",id);};handle.onkeydown=e=>{if(e.altKey&&["ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();const i=list.findIndex(x=>x.id===id),j=i+(e.key==="ArrowUp"?-1:1);if(j>=0&&j<list.length){yunReorder(list,id,list[j].id);changed();nav();}}};row.ondragover=e=>{if(Yun.drag?.list===list)e.preventDefault();};row.ondrop=e=>{e.preventDefault();if(Yun.drag?.list===list&&yunReorder(list,Yun.drag.id,id)){changed();nav();}Yun.drag=null;};row.append(handle);}
 else{const b=button(label,()=>{Archive.selection={kind,id};open();},"yun-tree-link");if(Archive.selection?.id===id)b.classList.add("selected");row.append(b);}
 box.append(row);if(children&&expanded)box.append(el("div",{class:"yun-tree-children"},children()));return box;}
function yunKnowledgeTree(){
 const nodes=[];
 const points=p=>p.blocks.filter(b=>b.type==="group").map(b=>yunTree(blockTitle(b),"point",b.id,p.blocks,v=>b.title=v,()=>locate(p,b)));
 const lessons=ch=>data.pages.filter(p=>p.chapterId===ch.id).map(p=>yunTree("第 "+(data.pages.filter(x=>x.chapterId===ch.id).indexOf(p)+1)+" 课 · "+p.title,"lesson",p.id,data.pages,v=>p.title=v.replace(/^第\s*\d+\s*课\s*·\s*/,""),()=>{current=p.id;archiveNavigate("knowledge");},()=>points(p)));
 const chapters=c=>c.chapters.map(ch=>yunTree(archiveChapterTitle(c,ch),"chapter",ch.id,c.chapters,v=>ch.title=v.replace(/^第[\d一二三四五六七八九十]+章\s*·\s*/,""),()=>archiveDirectoryOverview("chapter",ch.id),()=>lessons(ch)));
 for(const c of data.courses)nodes.push(yunTree(c.title,"course",c.id,data.courses,v=>c.title=v,()=>archiveDirectoryOverview("course",c.id),()=>chapters(c)));
 for(const p of data.pages.filter(p=>p.standalone))nodes.push(yunTree(p.title,"standalone",p.id,data.pages,v=>{p.title=v;if(p.blocks[0])p.blocks[0].title=v;},()=>{current=p.id;archiveNavigate("knowledge");}));
 if(!nodes.length)nodes.push(el("p",{class:"yun-empty",text:"点击＋，开始记录"}));return nodes;
}
function yunSub(label,fn,selected=false){const b=yunButton(label,"file",fn,"yun-sub-link"+(selected?" selected":""));return b;}
nav=function(){yunShell();yunCloseMenu();const tools=$("yun-tools");tools.replaceChildren();const plus=yunButton("","plus",()=>yunAddMenu(plus),"yun-tool yun-menu-trigger");plus.title="新增";plus.setAttribute("aria-label","新增");plus.setAttribute("aria-haspopup","menu");tools.append(plus);if(Archive.directoryEdit)tools.append(button("完成",()=>{Archive.directoryEdit=false;nav();},"yun-done"));else{const dots=yunButton("","dots",()=>yunManageMenu(dots),"yun-tool yun-menu-trigger");dots.title="管理";dots.setAttribute("aria-label","管理");dots.setAttribute("aria-haspopup","menu");tools.append(dots);}
 const root=$("nav");root.replaceChildren();const q=$("search").value.trim();if(q){const results=searchEntries(searchKind,q);root.append(el("p",{class:"search-count",text:results.length+" 个结果"}));results.forEach(({p,b})=>root.append(button(blockTitle(b)+" · "+p.title,()=>locate(p,b),"search-result")));return;}
 for(const [v,t,icon]of [["knowledge","知识百科","book"],["practice","练习库","practice"],["instrument","乐器练习","piano"],["works","作品档案","works"]]){const box=el("section",{class:"yun-module"}),row=el("div",{class:"yun-module-row"+(yunContext()===v&&Archive.view!=="home"?" selected":"")});const go=yunButton(t,icon,()=>{Yun.expanded=v;Archive.directoryEdit=false;if(v==="knowledge"){Archive.selection=null;archiveNavigate("directory");}else archiveNavigate(v);},"yun-module-name");const chevron=yunButton("","arrow",()=>{Yun.expanded=Yun.expanded===v?null:v;Archive.directoryEdit=false;nav();},"yun-chevron"+(Yun.expanded===v?" open":""));chevron.setAttribute("aria-label","展开或收起"+t);chevron.setAttribute("aria-expanded",String(Yun.expanded===v));row.append(go,chevron);box.append(row);if(Yun.expanded===v){const sub=el("div",{class:"yun-submenu"});if(v==="knowledge")sub.append(...yunKnowledgeTree());if(v==="practice"){for(const [tab,label,cat]of [["plan","今日计划"],["organize","未分类",null],["organize","已分类","_all"],["graph","知识图谱"],["lists","我的练习单"],["records","练习记录"]])sub.append(yunSub(label,()=>{Archive.practiceTab=tab;Yun.practiceSection=cat==="_all"?"classified":"un";Archive.category=cat==="_all"?data.practiceCategories[0]||null:null;archiveNavigate("practice");},Archive.view===v&&Archive.practiceTab===tab&&(tab!=="organize"||(cat==="_all"?Yun.practiceSection==="classified":Yun.practiceSection==="un"))));if(Archive.directoryEdit)data.practiceLists.forEach(l=>sub.append(yunTree(l.name,"playlist",l.id,data.practiceLists,v=>l.name=v,()=>archiveListDetail(l))));}
 if(v==="instrument"){for(const [tab,label,scope]of [["plan","今日安排","today"],["plan","本周计划","week"],["records","练习记录"],["pending","待掌握"]])sub.append(yunSub(label,()=>{Yun.instrumentScope=scope||"today";Archive.instrumentTab=tab;archiveNavigate(v);},Archive.view===v&&Archive.instrumentTab===tab));data.instruments.forEach(i=>sub.append(yunTree(i.name,"instrument",i.id,data.instruments,val=>i.name=val,()=>{Archive.instrument=i.id;archiveNavigate(v);})));}
 if(v==="works"){for(const type of ["全部","演唱","编曲","作曲","乐器","其他"])sub.append(yunSub(type==="全部"?"全部作品":type+"作品",()=>{Archive.workType=type;Archive.work=null;archiveNavigate(v);},Archive.view===v&&Archive.workType===type));if(Archive.directoryEdit)data.works.forEach(w=>sub.append(yunTree(w.title,"work",w.id,data.works,v=>w.title=v,()=>{Archive.work=w.id;archiveNavigate("works");})));}box.append(sub);}root.append(box);}
};
const yunNavigate=archiveNavigate;archiveNavigate=function(view){if(view!=="home")Yun.expanded=["directory","knowledge"].includes(view)?"knowledge":view;yunNavigate(view);};
const yunRender=render;render=function(){Yun.mapDispose?.();Yun.mapDispose=null;yunCloseMenu();yunRender();document.body.classList.toggle("yun-home-page",Archive.view==="home");document.title="YUN的音乐档案 · 听过，练过，留下过";if(Archive.view==="home"){$("title").textContent="YUN的音乐地图";$("crumb").textContent="主页";}if(Archive.view==="directory"){$("title").textContent="知识百科";$("crumb").textContent="主页 / 知识百科";const solo=data.pages.filter(p=>p.standalone);if(solo.length){const panel=el("section",{class:"archive-panel"},[el("h2",{text:"独立词条"})]);solo.forEach(p=>panel.append(button(p.title,()=>{current=p.id;archiveNavigate("knowledge");},"archive-list-button")));$("blocks").append(panel);}}};
archiveRenderHome=function(){const root=$("blocks");root.append(el("p",{class:"yun-map-subtitle",text:"让知识、练习与作品彼此连接"}));const viewport=el("section",{class:"yun-map-viewport","aria-label":"YUN的音乐地图"}),world=el("div",{class:"yun-map-world"});world.append(el("img",{class:"yun-map-background",src:"design-assets/music-islands.webp",alt:"",draggable:"false"}));const groups=[{x:27,y:28,title:"知识百科",icon:"book",go:()=>{Archive.selection=null;archiveNavigate("directory");},nodes:data.courses.map(c=>[c.title,()=>archiveDirectoryOverview("course",c.id)]).concat(data.pages.filter(p=>p.standalone).map(p=>[p.title,()=>{current=p.id;archiveNavigate("knowledge");}]))},{x:77,y:27,title:"乐器练习",icon:"piano",go:()=>archiveNavigate("instrument"),nodes:data.instruments.map(i=>[i.name,()=>{Archive.instrument=i.id;archiveNavigate("instrument");}])},{x:28,y:72,title:"练习库",icon:"practice",go:()=>archiveNavigate("practice"),nodes:[["今日计划",()=>{Archive.practiceTab="plan";archiveNavigate("practice");}],["我的练习单",()=>{Archive.practiceTab="lists";archiveNavigate("practice");}],["知识图谱",()=>{Archive.practiceTab="graph";archiveNavigate("practice");}]]},{x:77,y:72,title:"作品档案",icon:"works",go:()=>archiveNavigate("works"),nodes:data.works.map(w=>[w.title,()=>{Archive.work=w.id;Archive.workType="全部";archiveNavigate("works");}])}];
 groups.forEach(g=>{const hub=yunButton(g.title,g.icon,g.go,"yun-map-hub");hub.style.left=g.x+"%";hub.style.top=g.y+"%";world.append(hub);g.nodes.slice(0,8).forEach(([title,go],i)=>{const a=(i*2.399)-1.4,r=14+(i%2)*2,n=button("",go,"yun-map-node");n.append(el("span",{class:"yun-node-dot"}),el("span",{text:title}));n.style.left=(g.x+Math.cos(a)*r)+"%";n.style.top=(g.y+Math.sin(a)*r*.75)+"%";n.title="进入「"+title+"」";world.append(n);});if(g.nodes.length>8){const more=button("查看全部 · "+g.nodes.length,g.go,"yun-map-more");more.style.left=g.x+"%";more.style.top=g.y+12+"%";world.append(more);}});
 viewport.append(world);const controls=el("div",{class:"yun-map-controls"});let zoom=1,dx=0,dy=0,drag=null,moved=false;const apply=()=>world.style.transform=`translate(calc(var(--yun-map-offset, 0px) + ${dx}px),${dy}px) scale(${zoom})`;const reset=()=>{zoom=1;dx=0;dy=0;apply();};const adjust=d=>{zoom=Math.max(.8,Math.min(2.4,zoom+d));apply();};controls.append(button("定位",reset),button("−",()=>adjust(-.2)),button("＋",()=>adjust(.2)));viewport.append(controls,button("＋ 添加节点",()=>{Archive.selection=null;Yun.expanded="knowledge";nav();yunAddMenu($("yun-tools").querySelector("button"));},"yun-map-add"));viewport.onpointerdown=e=>{if(e.target.closest?.("button"))return;drag={x:e.clientX,y:e.clientY,dx,dy};moved=false;viewport.setPointerCapture?.(e.pointerId);};viewport.onpointermove=e=>{if(!drag)return;const mx=e.clientX-drag.x,my=e.clientY-drag.y;moved=Math.abs(mx)+Math.abs(my)>4;const maxX=viewport.clientWidth*.5,maxY=viewport.clientHeight*.5;dx=Math.max(-maxX,Math.min(maxX,drag.dx+mx));dy=Math.max(-maxY,Math.min(maxY,drag.dy+my));apply();};viewport.onpointerup=viewport.onpointercancel=()=>drag=null;viewport.addEventListener("wheel",e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();adjust(e.deltaY<0?.1:-.1);}},{passive:false});world.addEventListener("click",e=>{if(moved){e.preventDefault();moved=false;}},true);root.append(viewport);Yun.mapDispose=()=>{drag=null;};
};

const yunLocate=locate;locate=function(p,b){Yun.expanded="knowledge";for(const id of [p.courseId,p.chapterId,p.id])if(id)viewState.set("archive-tree:"+id,true);Archive.selection={kind:"point",id:b.id};yunLocate(p,b);};
const yunInstruments=archiveRenderInstruments;archiveRenderInstruments=function(){yunInstruments();if(Archive.instrumentTab==="plan"){const panels=$("blocks").querySelectorAll("section.archive-panel");panels.forEach(panel=>{const heading=panel.querySelector("h2")?.textContent||"";if(Yun.instrumentScope==="today"&&heading==="本周计划")panel.remove();if(Yun.instrumentScope==="week"&&heading.startsWith("今日计划"))panel.remove();});}};
const yunPractice=archiveRenderPractice;archiveRenderPractice=function(){yunPractice();if(Archive.practiceTab==="organize"){const cols=$("blocks").querySelector(".archive-organize");const sections=cols?.children;if(sections?.length===2){sections[Yun.practiceSection==="classified"?0:1].hidden=true;cols.classList.add("yun-single-organize");}}if(Archive.practiceTab==="records"){const panel=el("section",{class:"archive-panel"},[el("h2",{text:"练习记录"})]);data.practiceSessions.slice().reverse().forEach(s=>{const node=archiveFind(s.nodeId);panel.append(el("div",{class:"archive-row"},[el("span",{text:(node?blockTitle(node.b):"已删除知识点")+" · "+archiveTime(s.endedAt)}),el("small",{text:archiveMinutes(s.seconds)+" · "+ARCHIVE_FEEDBACK[s.feedback]})]));});if(!data.practiceSessions.length)panel.append(el("p",{class:"muted",text:"练完保存后，记录会出现在这里。"}));$("blocks").append(panel);}};

/* V21: arbitrary child columns, context knowledge blocks, navigation and undo. */
(() => {
  const ROOT = "knowledge:root";
  const selectionKey = s => s ? `${s.kind}:${s.id}` : ROOT;
  const folders = () => data.sidebarFolders ||= [];
  const parentKey = () => selectionKey(Archive.selection);
  const nodeExists = key => key === ROOT || folders().some(f => `folder:${f.id}` === key)
    || data.courses.some(c => `course:${c.id}` === key || c.chapters.some(ch => `chapter:${ch.id}` === key))
    || data.pages.some(p => [`lesson:${p.id}`,`standalone:${p.id}`].includes(key))
    || archiveNodes().some(x => `point:${x.b.id}` === key);
  function expandAncestors(key, seen=new Set()) {
    if(seen.has(key))return; seen.add(key);
    const id=key.slice(key.indexOf(":")+1);viewState.set("archive-tree:"+id,true);
    const f=folders().find(f=>`folder:${f.id}`===key);
    if(f)expandAncestors(f.parent,seen);
    const x=archiveNodes().find(x=>`point:${x.b.id}`===key);
    if(x?.b.sidebarParent)expandAncestors(x.b.sidebarParent,seen);
    const p=data.pages.find(p=>[`lesson:${p.id}`,`standalone:${p.id}`].includes(key));
    if(p){if(p.chapterId)expandAncestors(`chapter:${p.chapterId}`,seen);if(p.courseId)expandAncestors(`course:${p.courseId}`,seen);}
    const c=data.courses.find(c=>c.chapters.some(ch=>`chapter:${ch.id}`===key));
    if(c)expandAncestors(`course:${c.id}`,seen);
  }
  function createColumn(title, parent=parentKey()) {
    if(!nodeExists(parent)){archiveNotice("请先选择有效栏目。");return null;}
    const f={id:uid(),title,parent};folders().push(f);expandAncestors(parent);
    Archive.selection={kind:"folder",id:f.id};Archive.view="directory";Yun.expanded="knowledge";
    changed();render();return f;
  }
  function createKnowledge(title, parent=parentKey()) {
    if(!nodeExists(parent)){archiveNotice("请先选择有效栏目。");return null;}
    let p;
    if(parent.startsWith("lesson:")||parent.startsWith("standalone:"))p=data.pages.find(p=>p.id===parent.slice(parent.indexOf(":")+1));
    if(parent.startsWith("point:"))p=archiveFind(parent.slice(6))?.p;
    if(!p){
      p=data.pages.find(p=>p.sidebarContainer&&p.sidebarParent===parent);
      if(!p){p={id:uid(),title:"栏目知识",category:"知识百科",kind:"knowledge",standalone:true,sidebarContainer:true,sidebarParent:parent,blocks:[]};data.pages.push(p);}
    }
    const b=createBlock("group");b.title=title;b.sidebarParent=parent;p.blocks.push(b);
    current=p.id;Archive.selection={kind:"point",id:b.id};Archive.view="knowledge";Yun.expanded="knowledge";editing=true;
    expandAncestors(parent);changed();render();
    document.querySelector(`[data-block="${b.id}"]`)?.scrollIntoView({block:"start",behavior:"smooth"});
    return b;
  }
  function addDialog(kind) {
    const parent=parentKey(), d=archiveDialog(kind==="column"?"新增栏目":"新增知识块"),name=archiveInput("","输入名称");
    d.append(archiveField("名称",name));
    archiveCloseRow(d,()=>{const title=name.value.trim();if(!title){name.focus();return;}
      d.close();kind==="column"?createColumn(title,parent):createKnowledge(title,parent);
    },"创建");name.focus();
  }
  const oldAdd=yunAddMenu;
  yunAddMenu=function(anchor){if(yunContext()!=="knowledge")return oldAdd(anchor);
    yunPopup(anchor,"新增到当前高亮栏目",[["新增栏目","成为当前栏目的子目录",()=>addDialog("column")],["新增知识块","添加到当前栏目下",()=>addDialog("knowledge")]]);
  };
  // Keep old entry points consistent, without a type or destination selector.
  archiveAddDialog=()=>addDialog("column");yunNewEntry=()=>addDialog("knowledge");
  const oldReorder=yunReorder;
  yunReorder=function(list,from,to){const a=list.find(x=>x.id===from),b=list.find(x=>x.id===to);
    if(list===data.sidebarFolders&&a?.parent!==b?.parent)return false;
    if(a?.sidebarParent!==b?.sidebarParent)return false;
    return oldReorder(list,from,to);
  };

  const oldDelete=archiveDelete;
  archiveDelete=function(kind,id){
    if(kind!=="folder")return oldDelete(kind,id);
    const f=folders().find(f=>f.id===id);if(!f)return;
    archiveConfirm("删除「"+f.title+"」？","子栏目和其中的知识块将一并删除，可用撤销恢复。",()=>{
      const keys=new Set([`folder:${id}`]);let grew=true;
      while(grew){grew=false;for(const child of folders())if(keys.has(child.parent)&&!keys.has(`folder:${child.id}`)){keys.add(`folder:${child.id}`);grew=true;}
        for(const {b}of archiveNodes())if(keys.has(b.sidebarParent)&&!keys.has(`point:${b.id}`)){keys.add(`point:${b.id}`);grew=true;}}
      data.sidebarFolders=folders().filter(f=>!keys.has(`folder:${f.id}`));
      const prune=list=>list.filter(b=>!keys.has(`point:${b.id}`)).map(b=>{if(b.children)b.children=prune(b.children);return b;});
      data.pages.forEach(p=>p.blocks=prune(p.blocks));data.pages=data.pages.filter(p=>!p.sidebarContainer||p.blocks.length);
      Archive.selection=null;Archive.view="directory";changed();render();
    });
  };
  yunKnowledgeTree=function(){
    const ancestors=new Set();
    function children(key){
      if(ancestors.has(key))return [];ancestors.add(key);
      const out=[];
      const make=(title,kind,id,list,rename,open,childKey)=>yunTree(title,kind,id,list,rename,open,()=>children(childKey));
      if(key===ROOT){
        for(const c of data.courses)out.push(make(c.title,"course",c.id,data.courses,v=>c.title=v,()=>archiveDirectoryOverview("course",c.id),`course:${c.id}`));
        for(const p of data.pages.filter(p=>p.standalone&&!p.sidebarContainer))out.push(make(p.title,"standalone",p.id,data.pages,v=>p.title=v,()=>{current=p.id;archiveNavigate("knowledge");},`standalone:${p.id}`));
      }
      const c=data.courses.find(c=>`course:${c.id}`===key);
      if(c)for(const ch of c.chapters)out.push(make(archiveChapterTitle(c,ch),"chapter",ch.id,c.chapters,v=>ch.title=v,()=>archiveDirectoryOverview("chapter",ch.id),`chapter:${ch.id}`));
      if(key.startsWith("chapter:"))for(const p of data.pages.filter(p=>p.chapterId===key.slice(8)&&!p.sidebarContainer))out.push(make(p.title,"lesson",p.id,data.pages,v=>p.title=v,()=>{current=p.id;archiveNavigate("knowledge");},`lesson:${p.id}`));
      for(const f of folders().filter(f=>f.parent===key))out.push(make(f.title,"folder",f.id,folders(),v=>f.title=v,()=>archiveDirectoryOverview("folder",f.id),`folder:${f.id}`));
      for(const {p,b}of archiveNodes()){
        const natural=p.standalone?`standalone:${p.id}`:`lesson:${p.id}`;
        const belongs=b.sidebarParent||((p.blocks.includes(b))?natural:null);
        if(belongs===key)out.push(make(blockTitle(b),"point",b.id,p.blocks,v=>b.title=v,()=>locate(p,b),`point:${b.id}`));
      }
      ancestors.delete(key);return out;
    }
    const nodes=children(ROOT);return nodes.length?nodes:[el("p",{class:"yun-empty",text:"点击＋新增栏目或知识块"})];
  };
  const oldDirectory=archiveRenderDirectory;
  archiveRenderDirectory=function(){
    if(Archive.selection?.kind!=="folder")return oldDirectory();
    const f=folders().find(f=>f.id===Archive.selection.id);if(!f){Archive.selection=null;return oldDirectory();}
    $("title").textContent=f.title;$("crumb").textContent="知识百科 / "+f.title;
    const panel=el("section",{class:"archive-panel"},[el("h2",{text:f.title})]);
    for(const child of folders().filter(x=>x.parent===`folder:${f.id}`))panel.append(button(child.title,()=>archiveDirectoryOverview("folder",child.id),"archive-list-button"));
    for(const {p,b}of archiveNodes().filter(x=>x.b.sidebarParent===`folder:${f.id}`))panel.append(button(blockTitle(b),()=>locate(p,b),"archive-list-button"));
    panel.append(button("＋ 新增栏目",()=>addDialog("column")),button("＋ 新增知识块",()=>addDialog("knowledge")));$("blocks").append(panel);
  };

  // Observe every committed data change; do not place assets or credentials in history.
  const edits={undo:[],redo:[],baseline:null,replaying:false,lastInput:null,lastTime:0};
  const snapshot=()=>JSON.stringify(data);
  const oldChanged=changed;
  function removeOrphanedChildren(){
    // Old course/point delete handlers also remove their new attached descendants.
    let removed=true;
    while(removed){removed=false;
      const valid=folders().filter(f=>nodeExists(f.parent));
      if(valid.length!==folders().length){data.sidebarFolders=valid;removed=true;}
      const prune=list=>list.filter(b=>{const keep=!b.sidebarParent||nodeExists(b.sidebarParent);if(!keep)removed=true;return keep;}).map(b=>{if(b.children)b.children=prune(b.children);return b;});
      data.pages.forEach(p=>p.blocks=prune(p.blocks));
    }
    data.pages=data.pages.filter(p=>!p.sidebarContainer||p.blocks.length);
  }
  changed=function(){
    if(data&&!edits.replaying){removeOrphanedChildren();const next=snapshot();
      if(edits.baseline!==null&&edits.baseline!==next){
        const active=document.activeElement,typing=active?.isContentEditable;
        const coalesce=typing&&active===edits.lastInput&&Date.now()-edits.lastTime<500;
        if(!coalesce)edits.undo.push({data:edits.baseline,current});
        if(edits.undo.length>60)edits.undo.shift();
        while(edits.undo.length>1&&edits.undo.reduce((n,s)=>n+s.data.length,0)>12*1024*1024)edits.undo.shift();
        edits.redo=[];edits.lastInput=typing?active:null;edits.lastTime=Date.now();
      }edits.baseline=next;
    }oldChanged();
  };
  function restoreEdit(from,to){
    if(!from.length)return;
    const next=from.pop();to.push({data:snapshot(),current});edits.replaying=true;
    try{stop();data=validate(JSON.parse(next.data));current=data.pages.some(p=>p.id===next.current)?next.current:data.pages[0]?.id||null;
      activeBlock=null;boardActiveContent=null;Archive.undo=[];$("archive-undo")?.remove();$("delete-undo")?.remove();
      changed();render();edits.baseline=snapshot();edits.lastInput=null;
    }finally{edits.replaying=false;}
  }
  const routes={stack:[],last:null,replaying:false};
  const route=()=>({view:Archive.view,current,selection:clone(Archive.selection),practiceTab:Archive.practiceTab,category:Archive.category,instrument:Archive.instrument,instrumentTab:Archive.instrumentTab,work:Archive.work,workType:Archive.workType,expanded:Yun.expanded,practiceSection:Yun.practiceSection,instrumentScope:Yun.instrumentScope});
  function back(){
    if(!routes.stack.length){status("已经是最早的界面。");return;}
    const prior=routes.stack.pop();routes.replaying=true;
    try{stop();const {expanded,practiceSection,instrumentScope,current:pageId,...view}=prior;Object.assign(Archive,view);Object.assign(Yun,{expanded,practiceSection,instrumentScope});current=pageId;editing=false;render();}
    finally{routes.replaying=false;}
  }
  const oldRender=render;
  render=function(){
    if(!data)return;
    const now=route();if(!routes.replaying&&routes.last&&JSON.stringify(now)!==JSON.stringify(routes.last)){routes.stack.push(routes.last);if(routes.stack.length>100)routes.stack.shift();}
    oldRender();routes.last=route();
    if(Archive.view==="directory")for(const panel of $("blocks").querySelectorAll(".archive-panel")){
      if(panel.querySelector("h2")?.textContent!=="独立词条")continue;
      panel.remove();const solo=data.pages.filter(p=>p.standalone&&!p.sidebarContainer);
      if(solo.length){const clean=el("section",{class:"archive-panel"},[el("h2",{text:"独立词条"})]);solo.forEach(p=>clean.append(button(p.title,()=>{current=p.id;archiveNavigate("knowledge");},"archive-list-button")));$("blocks").append(clean);}
    }
    if(edits.baseline===null||edits.replaying)edits.baseline=snapshot();
    document.body.classList.toggle("yun-knowledge-top",Archive.view==="knowledge");
    const toolbar=$("yun-toolbar");if(toolbar&&!$("yun-back")){
      const b=yunButton("","arrow",back,"yun-tool yun-back");b.id="yun-back";b.title="返回上一界面";b.setAttribute("aria-label",b.title);toolbar.prepend(b);
    }
    // Home remains a home icon. The separate back arrow never jumps home.
  };
  document.addEventListener("keydown",e=>{
    if(e.isComposing||e.altKey)return;
    const key=e.key.toLowerCase();if(!(e.ctrlKey||e.metaKey)||!["z","y"].includes(key))return;
    const target=e.target;
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName)||document.querySelector("dialog[open]"))return;
    e.preventDefault();e.stopImmediatePropagation?.();
    if(key==="y"||e.shiftKey)restoreEdit(edits.redo,edits.undo);else restoreEdit(edits.undo,edits.redo);
  },true);
  // Public helpers are also used by regression tests and optional future toolbar controls.
  window.YunSidebar={createColumn,createKnowledge,back,undo:()=>restoreEdit(edits.undo,edits.redo),redo:()=>restoreEdit(edits.redo,edits.undo)};
})();
