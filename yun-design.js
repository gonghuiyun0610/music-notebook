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
    if(parent.startsWith("point:")){archiveNotice("栏目不能放在知识块下，请选择栏目。");return null;}
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

/* V22: distinguish blocks, move directories, context deletion and shallow 3D tree. */
(() => {
  const ROOT="knowledge:root", UNCLASSIFIED="folder:yun-unclassified", protectedIds=new Set(["knowledge","practice","instrument","works",ROOT,UNCLASSIFIED,"yun-unclassified"]);
  let dragKey=null,contextMenu=null;
  const kindOf=key=>key.slice(0,key.indexOf(":")),idOf=key=>key.slice(key.indexOf(":")+1);
  const selectedKey=()=>Archive.selection?`${Archive.selection.kind}:${Archive.selection.id}`:ROOT;
  const isColumn=n=>n&&n.kind!=="point";
  function model(){
    data.sidebarFolders ||= [];
    if(!data.sidebarFolders.some(f=>f.id==="yun-unclassified"))data.sidebarFolders.unshift({id:"yun-unclassified",title:"未归类",parent:ROOT,sidebarOrder:-1});
    const nodes=[{key:ROOT,id:"root",kind:"root",title:"知识记录",parent:null,object:null}];
    const add=(kind,o,parent,list,p)=>nodes.push({key:`${kind}:${o.id}`,id:o.id,kind,title:kind==="point"?blockTitle(o):o.title,parent:o.sidebarParent||parent,object:o,list,p});
    for(const c of data.courses){if(!c.sidebarHidden)add("course",c,ROOT,data.courses);for(const ch of c.chapters)if(!ch.sidebarHidden)add("chapter",ch,`course:${c.id}`,c.chapters);}
    for(const p of data.pages.filter(p=>p.kind!=="practice"&&!p.sidebarContainer))add(p.standalone?"standalone":"lesson",p,p.standalone?ROOT:`chapter:${p.chapterId}`,data.pages,p);
    for(const f of data.sidebarFolders||[])nodes.push({key:`folder:${f.id}`,id:f.id,kind:"folder",title:f.title,parent:f.parent,object:f,list:data.sidebarFolders});
    for(const p of data.pages.filter(p=>p.kind!=="practice")){
      const visit=(list,parent)=>{for(const b of list){if(b.type==="group")add("point",b,parent,list,p);visit(b.children||[],b.type==="group"?`point:${b.id}`:parent);}};
      visit(p.blocks,p.sidebarContainer?p.sidebarParent:p.standalone?`standalone:${p.id}`:`lesson:${p.id}`);
    }
    const map=new Map(nodes.map(n=>[n.key,n]));
    for(const n of nodes)if(n.key!==ROOT&&!map.has(n.parent))n.parent=ROOT;
    return nodes;
  }
  function descendants(key,nodes=model()){
    const keys=new Set([key]);let added=true;
    while(added){added=false;for(const n of nodes)if(keys.has(n.parent)&&!keys.has(n.key)){keys.add(n.key);added=true;}}
    return keys;
  }
  function expand(key){const map=new Map(model().map(n=>[n.key,n])),seen=new Set();
    while(key&&!seen.has(key)){seen.add(key);viewState.set("archive-tree:"+idOf(key),true);key=map.get(key)?.parent;}
  }
  function pageFor(target){
    if(["lesson","standalone"].includes(target.kind))return target.object;
    let p=data.pages.find(p=>p.sidebarContainer&&p.sidebarParent===target.key);
    if(!p){p={id:uid(),title:target.title,category:"知识记录",kind:"knowledge",standalone:true,sidebarContainer:true,sidebarParent:target.key,blocks:[]};data.pages.push(p);}return p;
  }
  function move(sourceKey,targetKey,beforeKey=null){
    const nodes=model(),map=new Map(nodes.map(n=>[n.key,n])),source=map.get(sourceKey),target=map.get(targetKey);
    if(!source||!target||protectedIds.has(sourceKey)||sourceKey===targetKey)return false;
    if(!isColumn(target)){status("只能移动到栏目下，不能放入知识块。");return false;}
    if(descendants(sourceKey,nodes).has(targetKey)){status("不能移动到自己的子目录下。");return false;}
    if(source.kind==="point"){
      const destination=pageFor(target),moving=descendants(sourceKey,nodes);
      const attached=nodes.filter(n=>n.kind==="point"&&moving.has(n.key));
      const physicallyNested=new Set();walk(source.object.children||[],b=>physicallyNested.add(b.id));
      for(const n of attached){if(physicallyNested.has(n.id))continue;const i=n.list.indexOf(n.object);if(i>=0)n.list.splice(i,1);destination.blocks.push(n.object);}
      source.object.sidebarParent=targetKey;current=destination.id;
    }else if(source.kind==="folder")source.object.parent=targetKey;
    else source.object.sidebarParent=targetKey;
    if(beforeKey){const siblings=model().filter(n=>n.parent===targetKey&&n.key!==sourceKey);const index=siblings.findIndex(n=>n.key===beforeKey);siblings.splice(index<0?siblings.length:index,0,source);siblings.forEach((n,i)=>{n.object.sidebarOrder=i;});}
    Archive.selection={kind:source.kind,id:source.id};expand(targetKey);changed();render();return true;
  }
  const previousDelete=archiveDelete;
  archiveDelete=function(kind,id){
    if(protectedIds.has(id)||protectedIds.has(`${kind}:${id}`))return;
    if(!["course","chapter","lesson","standalone","folder","point"].includes(kind))return previousDelete(kind,id);
    const nodes=model(),n=nodes.find(n=>n.key===`${kind}:${id}`);if(!n)return;
    archiveConfirm("删除「"+n.title+"」？",n.kind==="point"?"知识块及其中的内容将删除，可使用撤销恢复。":"栏目及子栏目将删除，其中的知识块会保留并移入未归类。",()=>{
      const keys=descendants(n.key),removedIds=new Set([...keys].map(idOf));stop();
      if(n.kind!=="point"){
        const preserved=nodes.filter(x=>x.kind==="point"&&keys.has(x.key));
        if(preserved.length){const destination=pageFor(model().find(x=>x.key===UNCLASSIFIED)),nested=new Set();
          preserved.forEach(x=>walk(x.object.children||[],b=>nested.add(b.id)));
          for(const x of preserved){if(nested.has(x.id))continue;const i=x.list.indexOf(x.object);if(i>=0)x.list.splice(i,1);destination.blocks.push(x.object);}
          for(const x of preserved){if(!nodes.some(p=>p.key===x.parent&&p.kind==="point"))x.object.sidebarParent=UNCLASSIFIED;keys.delete(x.key);removedIds.delete(x.id);}
        }
      }
      data.sidebarFolders=(data.sidebarFolders||[]).filter(f=>!keys.has(`folder:${f.id}`));
      data.pages=data.pages.filter(p=>!keys.has(`lesson:${p.id}`)&&!keys.has(`standalone:${p.id}`));
      // Preserve hidden legacy metadata carriers for chapters/pages moved elsewhere.
      data.courses=data.courses.filter(c=>{
        c.chapters=c.chapters.filter(ch=>{if(!keys.has(`chapter:${ch.id}`))return true;
          if(data.pages.some(p=>p.chapterId===ch.id)){ch.sidebarHidden=true;return true;}return false;
        });
        if(!keys.has(`course:${c.id}`))return true;
        if(c.chapters.length||data.pages.some(p=>p.courseId===c.id)){c.sidebarHidden=true;return true;}return false;
      });
      const prune=list=>list.filter(b=>!keys.has(`point:${b.id}`)).map(b=>{if(b.children)b.children=prune(b.children);return b;});data.pages.forEach(p=>p.blocks=prune(p.blocks));
      data.relations=data.relations.filter(r=>!removedIds.has(r.from)&&!removedIds.has(r.to));data.practiceLists.forEach(l=>l.items=l.items.filter(id=>!removedIds.has(id)));
      Archive.selection=null;Archive.view="directory";current=data.pages.find(p=>p.id===current)?.id||data.pages[0]?.id||null;changed();render();
    });
  };
  function closeContext(){contextMenu?.remove();contextMenu=null;}
  function context(e,n){e.preventDefault();e.stopPropagation();closeContext();Archive.selection={kind:n.kind,id:n.id};nav();
    contextMenu=el("div",{class:"yun-context-menu",role:"menu"});const del=button("删除"+(n.kind==="point"?"知识块":"栏目"),()=>{closeContext();archiveDelete(n.kind,n.id);});del.setAttribute("role","menuitem");contextMenu.append(del);
    contextMenu.style.left=Math.max(8,Math.min(e.clientX,window.innerWidth-180))+"px";contextMenu.style.top=Math.max(8,Math.min(e.clientY,window.innerHeight-60))+"px";document.body.append(contextMenu);del.focus();
  }
  document.addEventListener("click",e=>{if(contextMenu&&!contextMenu.contains(e.target))closeContext();});document.addEventListener("keydown",e=>{if(e.key==="Escape")closeContext();});
  const pointIcon=()=>{const n=el("span",{class:"yun-icon yun-knowledge-icon","aria-hidden":"true"});n.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>';return n;};
  function openNode(n){if(n.key===ROOT){Archive.selection=null;archiveNavigate("directory");return;}
    Archive.selection={kind:n.kind,id:n.id};if(n.kind==="point")locate(n.p,n.object);else archiveDirectoryOverview(n.kind,n.id);
  }
  function wireDrop(row,target){
    row.ondragover=e=>{if(!dragKey)return;const source=model().find(n=>n.key===dragKey);const rect=row.getBoundingClientRect(),edge=e.clientY<rect.top+rect.height*.25;
      const destination=edge?model().find(n=>n.key===target.parent):target;
      if(source&&isColumn(destination)&&!descendants(dragKey).has(destination.key)){e.preventDefault();e.stopPropagation();row.classList.add("yun-drop-target");e.dataTransfer.dropEffect="move";}
    };
    row.ondragleave=()=>row.classList.remove("yun-drop-target");
    row.ondrop=e=>{if(!dragKey)return;e.preventDefault();e.stopPropagation();row.classList.remove("yun-drop-target");
      const rect=row.getBoundingClientRect(),edge=e.clientY<rect.top+rect.height*.25;const key=dragKey;dragKey=null;move(key,edge?target.parent:target.key,edge?target.key:null);
    };
  }
  yunKnowledgeTree=function(){
    const nodes=model(),visited=new Set();
    function branch(key){if(visited.has(key))return [];visited.add(key);
      const children=nodes.filter(n=>n.parent===key).sort((a,b)=>(a.object?.sidebarOrder??1e6)-(b.object?.sidebarOrder??1e6));
      return children.map(n=>{
        const box=yunTree(n.title,n.kind,n.id,n.list,v=>{if(n.kind==="point")n.object.title=v;else n.object.title=v;},()=>openNode(n),nodes.some(x=>x.parent===n.key)?()=>branch(n.key):null);
        const row=box.querySelector(".yun-tree-row");row.dataset.nodeKey=n.key;
        if(n.key===UNCLASSIFIED){row.draggable=false;}
        // The leading folder symbol belongs only to columns.
        const glyph=[...row.children].find(c=>c.classList.contains("yun-icon"));if(glyph){glyph.replaceWith(n.kind==="point"?pointIcon():yunIcon("folder"));}
        row.oncontextmenu=e=>{if(protectedIds.has(n.key)){e.preventDefault();return;}context(e,n);};row.draggable=!protectedIds.has(n.key);
        row.ondragstart=e=>{if(protectedIds.has(n.key)||e.target.closest?.("input")){e.preventDefault();return;}dragKey=n.key;row.classList.add("dragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("application/x-yun-directory",n.key);e.dataTransfer.setData("text/plain",n.key);e.stopPropagation();};
        row.ondragend=()=>{dragKey=null;row.classList.remove("dragging");document.querySelectorAll(".yun-drop-target").forEach(x=>x.classList.remove("yun-drop-target"));};
        const grip=row.querySelector(".yun-grip");if(grip)grip.ondragstart=row.ondragstart;
        if(protectedIds.has(n.key)){row.querySelector(".yun-minus")?.remove();grip?.remove();}
        if(isColumn(n)){
          const name=row.querySelector(".yun-tree-link");
          let openTimer;
          const contextHandler=row.oncontextmenu;row.oncontextmenu=e=>{clearTimeout(openTimer);contextHandler(e);};
          if(name){name.onclick=e=>{e.stopPropagation();clearTimeout(openTimer);openTimer=setTimeout(()=>openNode(n),280);};
          name.ondblclick=e=>{e.preventDefault();e.stopPropagation();clearTimeout(openTimer);
            const input=archiveInput(n.title);input.className="yun-sidebar-rename";input.setAttribute("aria-label","修改栏目名称");name.replaceWith(input);row.draggable=false;
            let done=false;const finish=save=>{if(done)return;done=true;const title=input.value.trim();if(save&&title&&title!==n.title){n.object.title=title;changed();}nav();};
            input.onclick=e=>e.stopPropagation();input.ondblclick=e=>e.stopPropagation();input.onblur=()=>finish(true);
            input.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();finish(true);}if(e.key==="Escape"){e.preventDefault();finish(false);}};input.focus();input.select?.();
          };
          }
        }
        wireDrop(row,n);return box;
      });
    }return branch(ROOT);
  };
  const oldNav=nav;
  nav=function(){oldNav();const rootRow=[...$("nav").querySelectorAll(".yun-module-row")].find(r=>r.querySelector(".yun-module-name")?.textContent.includes("知识百科"));
    if(rootRow){const b=rootRow.querySelector(".yun-module-name");const text=b.children[b.children.length-1];if(text)text.textContent="知识记录";wireDrop(rootRow,model()[0]);}
    for(const r of $("nav").querySelectorAll(".yun-module-row"))r.setAttribute("data-protected","true");
  };
  function positions(nodes){
    const children=new Map();for(const n of nodes){if(!children.has(n.parent))children.set(n.parent,[]);children.get(n.parent).push(n);}
    for(const list of children.values())list.sort((a,b)=>(a.object?.sidebarOrder??1e6)-(b.object?.sidebarOrder??1e6));
    let leaf=0;const assigned=new Map(),seen=new Set();
    function visit(n,depth){if(seen.has(n.key))return;seen.add(n.key);const cs=children.get(n.key)||[];cs.forEach(c=>visit(c,depth+1));
      const x=cs.length?cs.reduce((s,c)=>s+(assigned.get(c.key)?.x??0),0)/cs.length:leaf++*115;
      assigned.set(n.key,{...n,x,y:Math.min(depth,3)*70,z:depth>3?(depth-3)*34:(depth%2)*24});}
    visit(nodes[0],0);for(const n of nodes)if(!seen.has(n.key))visit(n,1);
    const center=(Math.max(1,leaf)-1)*115/2;return [...assigned.values()].map(n=>({...n,x:n.x-center,y:n.y-105}));
  }
  let showingColumnBlocks=false;
  archiveRenderDirectory=function(){
    const selected=selectedKey(),direct=model().filter(n=>n.kind==="point"&&n.parent===selected);
    showingColumnBlocks=direct.length>0;
    if(!direct.length){renderGraph($("blocks"));return;}
    editing=false;const root=$("blocks");root.classList.add("yun-column-blocks");
    direct.forEach(n=>root.append(renderBlock(n.object,n.list)));
    $("edit").hidden=false;$("edit").textContent="编辑知识块";
  };
  function renderGraph(root){
    const nodes=model(),points=positions(nodes),map=new Map(nodes.map(n=>[n.key,n]));
    const panel=el("section",{class:"yun-knowledge-graph"}),head=el("div",{class:"archive-section-head"},[el("span",{class:"muted",text:`${nodes.filter(n=>n.kind==="point").length} 个知识块 · 拖动旋转 · 滚轮缩放`})]);
    const viewport=el("div",{class:"yun-knowledge-viewport"}),canvas=el("canvas",{role:"img","aria-label":"3D知识目录树，拖动旋转，点击节点打开"});viewport.append(canvas);
    const picker=archiveSelect([["","选择栏目或知识块"],...nodes.slice(1).map(n=>[n.key,(n.kind==="point"?"知识块 · ":"栏目 · ")+n.title])],"");picker.onchange=()=>{const n=map.get(picker.value);if(n)openNode(n);};
    const controls=el("div",{class:"archive-actions"},[picker,button("正面",()=>{ay=0;ax=.12;zoom=1;draw();}),button("＋",()=>{zoom=Math.min(3,zoom*1.2);draw();}),button("－",()=>{zoom=Math.max(.2,zoom/1.2);draw();})]);
    panel.append(head,el("p",{class:"muted",text:"文件夹代表栏目，蓝色知识卡代表知识块。浅层树状排列，可旋转查看深度；点击节点打开。"}),viewport,controls);root.append(panel);
    const g=canvas.getContext("2d");if(!g)return;
    let ay=0,ax=.12,zoom=1,projected=[],drag=null;const selected=selectedKey();
    function draw(){const w=viewport.clientWidth||700,h=viewport.clientHeight||480,ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=w*ratio;canvas.height=h*ratio;canvas.style.width=w+"px";canvas.style.height=h+"px";g.setTransform(ratio,0,0,ratio,0,0);g.clearRect(0,0,w,h);
      const extent=Math.max(360,...points.map(p=>Math.abs(p.x)*2+120));const scale=Math.min(w/extent,h/420)*zoom;
      projected=points.map(p=>{const x=p.x*Math.cos(ay)+p.z*Math.sin(ay),z=-p.x*Math.sin(ay)+p.z*Math.cos(ay),y=p.y*Math.cos(ax)-z*Math.sin(ax),depth=p.y*Math.sin(ax)+z*Math.cos(ax),perspective=900/Math.max(300,900+depth);return {...p,px:w/2+x*scale*perspective,py:h/2+y*scale*perspective,depth,size:Math.max(5,12*scale*perspective)};});
      const lookup=new Map(projected.map(p=>[p.key,p]));g.strokeStyle="#c2cbd4";g.lineWidth=1;for(const p of projected){const parent=lookup.get(p.parent);if(!parent)continue;g.beginPath();g.moveTo(parent.px,parent.py);g.lineTo(parent.px,p.py-18);g.lineTo(p.px,p.py-18);g.lineTo(p.px,p.py);g.stroke();}
      projected.sort((a,b)=>b.depth-a.depth).forEach(p=>{g.globalAlpha=1;const s=p.size;g.fillStyle=p.key===selected?"#d5c2aa":p.kind==="point"?"#dce8f4":"#f0e5d5";
        g.fillRect(p.px-s*1.3,p.py-s,s*2.6,s*2);g.strokeStyle=p.kind==="point"?"#6b8faa":"#9b8267";g.lineWidth=1.5;g.beginPath();g.moveTo(p.px-s*1.3,p.py-s);g.lineTo(p.px+s*1.3,p.py-s);g.lineTo(p.px+s*1.3,p.py+s);g.lineTo(p.px-s*1.3,p.py+s);g.lineTo(p.px-s*1.3,p.py-s);g.stroke();
        if(p.kind==="point"){g.beginPath();g.moveTo(p.px-s*.65,p.py-s*.35);g.lineTo(p.px+s*.65,p.py-s*.35);g.moveTo(p.px-s*.65,p.py+s*.25);g.lineTo(p.px+s*.35,p.py+s*.25);g.stroke();}
        else{g.fillStyle="#c9b293";g.fillRect(p.px-s*1.3,p.py-s*1.3,s*1.1,s*.3);}
        if(p.key!==ROOT&&(nodes.length<80||p.key===selected)){g.font="12px system-ui";g.textAlign="center";g.fillStyle="#5d6268";const label=p.title.length>15?p.title.slice(0,14)+"…":p.title;g.fillText(label,p.px,p.py+s+18);}
      });
    }
    canvas.style.touchAction="none";canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture?.(e.pointerId);};
    canvas.onpointermove=e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)drag.moved=true;ay+=(e.clientX-drag.x)*.007;ax=Math.max(-.65,Math.min(.65,ax+(e.clientY-drag.y)*.007));drag.x=e.clientX;drag.y=e.clientY;draw();};
    canvas.onpointerup=e=>{const click=drag&&!drag.moved;drag=null;if(click){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const p=[...projected].reverse().find(p=>Math.hypot(p.px-x,p.py-y)<Math.max(18,p.size*1.7));if(p)openNode(map.get(p.key));}};
    canvas.onpointercancel=()=>drag=null;canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(.2,Math.min(3,zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
    const observer=new ResizeObserver(draw);observer.observe(viewport);draw();Archive.graphDispose=()=>{observer.disconnect();drag=null;};
  }
  const previousRender=render;
  render=function(){closeContext();showingColumnBlocks=false;$("blocks").classList.remove("yun-column-blocks");previousRender();if(Archive.view==="directory"){$("title").replaceChildren();$("meta").replaceChildren();$("crumb").textContent="";
      // The legacy render wrapper may append standalone cards; graph already includes them.
      for(const panel of $("blocks").querySelectorAll(".archive-panel"))if(panel.querySelector("h2")?.textContent==="独立词条")panel.remove();
    }
    document.body.classList.toggle("yun-content-edit",Archive.view==="knowledge"&&editing);
    document.body.classList.toggle("yun-node-page",Archive.view==="directory");
    if(Archive.view==="knowledge"){$("title").replaceChildren();$("meta").replaceChildren();$("crumb").textContent="";}
    const header=document.querySelector("main header");if(header&&!$("yun-content-back")){const back=button("←",()=>window.YunSidebar.back(),"yun-content-back");back.id="yun-content-back";back.title="返回上一界面";back.setAttribute("aria-label",back.title);header.prepend(back);}
    for(const span of document.querySelectorAll(".yun-map-hub span"))if(span.textContent==="知识百科")span.textContent="知识记录";
  };
  Object.assign(window.YunSidebar,{model,move,positions});
  const oldEdit=$("edit").onclick;
  $("edit").onclick=()=>{if(Archive.view==="directory"&&showingColumnBlocks){const first=model().find(n=>n.kind==="point"&&n.parent===selectedKey());
      if(first){current=first.p.id;Archive.view="knowledge";editing=true;render();return;}}
    oldEdit();
  };
  const previousPopup=yunPopup;yunPopup=function(anchor,title,items){return previousPopup(anchor,title.replace(/知识百科/g,"知识记录"),items);};
})();
