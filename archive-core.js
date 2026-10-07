/* 音乐档案：课程目录、主页与兼容迁移。保留原数据 version:1 和模块 ID。 */
"use strict";
const Archive={view:"home",directoryEdit:false,selection:null,practiceTab:"organize",limit:6,category:null,instrument:null,instrumentTab:"plan",work:null,workType:"全部",graphDispose:null,undo:[],timer:null,activePlan:null};
const archiveLegacyValidate=validate;
function archiveMigrate(x){
  boardMigrate(x);
  if(!x.archiveInitialized)x.pages.forEach(p=>walk(p.blocks,b=>{if(b.type==="group"&&!b.needsPractice){const child=b.children.find(c=>c.needsPractice);if(child){b.needsPractice=true;b.practiceTags=[...(child.practiceTags||[])];b.proficiency=child.proficiency||"again";}}}));
  x.courses ||= []; x.relations ||= []; x.practiceLists ||= []; x.dailyPlans ||= [];
  x.practiceSessions ||= []; x.instruments ||= []; x.works ||= [];
  x.archiveSettings ||= {title:"YUN的音乐档案",tagline:"听过，练过，留下过"};
  for(const p of x.pages){
    if(p.kind==="practice"||p.standalone)continue;
    let c=x.courses.find(c=>c.id===p.courseId);
    if(!c){c=x.courses.find(c=>c.title===(p.category||"未分类"));if(!c){c={id:uid(),title:p.category||"我的课程",chapters:[]};x.courses.push(c);}p.courseId=c.id;}
    let ch=c.chapters.find(ch=>ch.id===p.chapterId);
    if(!ch){ch=c.chapters[0];if(!ch){ch={id:uid(),title:"课程内容"};c.chapters.push(ch);}p.chapterId=ch.id;}
    p.kind ||= "knowledge";
    walk(p.blocks,b=>{if(b.needsPractice&&!b.practiceAddedAt)b.practiceAddedAt=new Date(0).toISOString();b.proficiency ||= "again";});
  }
  if(!x.instruments.length&&!x.archiveInitialized){x.instruments=[{id:uid(),name:"电吉他",items:[],sessions:[],plans:[]},{id:uid(),name:"键盘",items:[],sessions:[],plans:[]}];}
  x.archiveInitialized=true; return x;
}
validate=function(x){
  const result=archiveLegacyValidate(x);
  for(const key of ["courses","relations","practiceLists","dailyPlans","practiceSessions","instruments","works"]){if(result[key]!==undefined&&!Array.isArray(result[key]))throw Error(key+" 数据格式不正确");}
  result.courses ||= [];
  for(const c of result.courses){if(!c||typeof c.id!=="string"||typeof c.title!=="string"||!Array.isArray(c.chapters))throw Error("课程格式不正确");for(const ch of c.chapters)if(!ch||typeof ch.id!=="string"||typeof ch.title!=="string")throw Error("章节格式不正确");}
  const unique=list=>new Set(list.map(a=>a.id)).size===list.length;
  if(!unique(result.courses))throw Error("课程编号重复");
  for(const r of result.relations||[])if(!r||typeof r.from!=="string"||typeof r.to!=="string"||!["related","prerequisite"].includes(r.type))throw Error("知识关联格式错误");
  for(const l of result.practiceLists||[])if(!l||typeof l.id!=="string"||typeof l.name!=="string"||!Array.isArray(l.items)||l.items.some(id=>typeof id!=="string"))throw Error("练习单格式错误");
  for(const s of result.practiceSessions||[])if(!s||typeof s.id!=="string"||typeof s.nodeId!=="string"||!Number.isFinite(s.seconds)||s.seconds<0||s.seconds>86400||!["again","stuck","fluent"].includes(s.feedback))throw Error("练习记录格式错误");
  for(const p of result.dailyPlans||[])if(!p||typeof p.id!=="string"||typeof p.date!=="string"||!Array.isArray(p.items))throw Error("计划格式错误");
  for(const i of result.instruments||[]){if(!i||typeof i.id!=="string"||typeof i.name!=="string"||!Array.isArray(i.items)||!Array.isArray(i.sessions)||!Array.isArray(i.plans))throw Error("乐器档案格式错误");for(const item of i.items)if(!item||typeof item.id!=="string"||typeof item.title!=="string")throw Error("乐器条目格式错误");}
  for(const w of result.works||[]){if(!w||typeof w.id!=="string"||typeof w.title!=="string"||!Array.isArray(w.types)||!Array.isArray(w.stages))throw Error("作品档案格式错误");for(const s of w.stages){if(!s||typeof s.id!=="string"||!Array.isArray(s.files))throw Error("阶段格式错误");for(const f of s.files)if(!f||typeof f.src!=="string"||!archiveSafeAsset(f.src))throw Error("作品附件链接格式错误");}}
  return archiveMigrate(result);
};
function archiveSafeAsset(src){return /^asset:[a-zA-Z0-9-]+$/.test(src)||/^\.\/assets\/[a-zA-Z0-9_.-]+$/.test(src)||/^https:\/\//i.test(src);}
function archiveDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function archiveTime(s){return new Date(s).toLocaleString("zh-CN",{hour12:false});}
function archiveMinutes(seconds){return Math.round(seconds/60*10)/10+" 分钟";}
function archiveEntries(){return allBlocks().filter(({p,b})=>p.kind!=="practice"&&b.type==="group"&&b.needsPractice);}
function archiveNodes(){return allBlocks().filter(({p,b})=>p.kind!=="practice"&&b.type==="group");}
function archiveFind(id){return allBlocks().find(x=>x.b.id===id);}
function archiveChapterTitle(c,ch){return `第${c.chapters.indexOf(ch)+1}章 · ${ch.title.replace(/^第[\d一二三四五六七八九十]+章\s*[·、.：:]?\s*/,"")}`;}
function archivePath(p){const c=data.courses.find(c=>c.id===p.courseId),ch=c?.chapters.find(ch=>ch.id===p.chapterId);return [c?.title,ch?.title,p.title].filter(Boolean).join(" / ");}
function archivePersist(){changed();render();}
function archiveField(label,node){return el("label",{class:"archive-field",text:label},[node]);}
function archiveInput(value="",placeholder=""){return el("input",{value,placeholder});}
function archiveSelect(values,value){const s=el("select");for(const [v,t]of values){const o=el("option",{value:v,text:t});o.selected=String(v)===String(value);s.append(o);}return s;}
function archiveCheck(label,checked=false){const input=el("input",{type:"checkbox"});input.checked=checked;return {input,node:el("label",{class:"archive-check"},[input,el("span",{text:label})])};}
function archiveDialog(title){const d=el("dialog",{class:"archive-dialog"});d.append(el("h2",{text:title}));document.body.append(d);d.onclose=()=>d.remove();d.showModal();return d;}
function archiveCloseRow(d,save,label="保存"){const row=el("div",{class:"archive-actions"},[button("取消",()=>d.close())]);if(save)row.append(button(label,save,"primary"));d.append(row);return row;}
function archiveNotice(msg){const d=archiveDialog("提示");d.append(el("p",{text:msg}),button("知道了",()=>d.close(),"primary"));}
function archiveConfirm(title,description,fn){const d=archiveDialog(title);d.append(el("p",{text:description}));archiveCloseRow(d,()=>{d.close();fn();},"确认");}
function archiveUndo(snapshot,label){Archive.undo.push(snapshot);const old=$("archive-undo");old?.remove();const toast=el("div",{class:"undo-toast",id:"archive-undo"},[el("span",{text:label}),button("撤销",()=>{const restore=Archive.undo.pop();if(restore){restore();changed();render();}toast.remove();})]);document.body.append(toast);}
function archiveNavigate(view){exitBoardOverview();stop();Archive.graphDispose?.();Archive.graphDispose=null;Archive.view=view;practiceHome=view==="practice";editing=false;render();}
const archiveLegacyLocate=locate;
locate=function(p,b){Archive.view="knowledge";archiveLegacyLocate(p,b);};
const archiveLegacyNav=nav;
nav=function(){
  const container=$("nav");container.replaceChildren();
  const q=$("search").value.trim();
  if(q){container.append(brand);const results=searchEntries(searchKind,q);container.append(el("p",{class:"search-count",text:results.length+" 个结果"}));for(const {p,b,owner}of results){const row=button("",()=>locate(p,b),"search-result");row.append(el("span",{text:blockTitle(b)}),el("small",{text:p.title+(owner?" / "+blockTitle(owner):"")}));container.append(row);}if(!results.length)container.append(el("p",{class:"muted",text:"没有匹配的名称"}));return;}
  const head=el("div",{class:"archive-nav-head"});const home=brand;home.classList.add("archive-home");head.append(home,el("strong",{text:"课程目录"}),button("＋",archiveAddDialog),button(Archive.directoryEdit?"完成":"⋯",()=>{Archive.directoryEdit=!Archive.directoryEdit;nav();}));container.append(head);
  function node(label,select,children,kind,id,extra={}){
    const wrapper=el("div",{class:"archive-tree-node"});const row=el("div",{class:"archive-tree-row"});
    if(Archive.directoryEdit){const minus=button("⊖",()=>archiveDelete(kind,id),"archive-minus");minus.setAttribute("aria-label","删除"+label);row.append(minus);const name=archiveInput(label);name.setAttribute("aria-label","修改名称");name.onchange=()=>{extra.rename?.(name.value.trim());changed();render();};row.append(name);}
    else{const selectButton=button(label,()=>{Archive.selection={kind,id};select?.();},"archive-tree-link");if(Archive.selection?.id===id)selectButton.classList.add("selected");row.append(selectButton);}
    wrapper.append(row);if(children){const key="archive-tree:"+id;const details=el("details");details.open=viewState.get(key)??true;const summary=el("summary",{text:"展开 / 收起"});details.ontoggle=()=>viewState.set(key,details.open);details.append(summary,children);wrapper.append(details);}return wrapper;
  }
  for(const c of data.courses){const chapters=el("div",{class:"archive-tree-children"});for(const ch of c.chapters){const lessons=el("div",{class:"archive-tree-children"});for(const p of data.pages.filter(p=>p.courseId===c.id&&p.chapterId===ch.id)){const points=el("div",{class:"archive-tree-children"});p.blocks.filter(b=>b.type==="group").forEach((b,i)=>points.append(node(`${i+1}. ${blockTitle(b)}`,()=>locate(p,b),null,"point",b.id,{rename:v=>{if(v)b.title=v.replace(/^\d+\.\s*/,"");}})));const index=data.pages.filter(p=>p.chapterId===ch.id).indexOf(p)+1;lessons.append(node(`第${index}课 · ${p.title}`,()=>{Archive.view="knowledge";practiceHome=false;current=p.id;editing=false;render();},points,"lesson",p.id,{rename:v=>{if(v)p.title=v.replace(/^第\d+课\s*·\s*/,"");}}));}chapters.append(node(archiveChapterTitle(c,ch),()=>archiveDirectoryOverview("chapter",ch.id),lessons,"chapter",ch.id,{rename:v=>{if(v)ch.title=v.replace(/^第[\d一二三四五六七八九十]+章\s*[·、.：:]?\s*/,"");}}));}container.append(node(c.title,()=>archiveDirectoryOverview("course",c.id),chapters,"course",c.id,{rename:v=>{if(v)c.title=v;}}));}
  const modules=el("div",{class:"archive-module-links"});for(const [v,t]of [["practice","练习库"],["instrument","乐器练习"],["works","作品档案"]])modules.append(button(t,()=>archiveNavigate(v),Archive.view===v?"selected":""));container.append(modules);
};
function archiveDirectoryOverview(kind,id){Archive.view="directory";Archive.selection={kind,id};practiceHome=false;render();}
function archiveAddDialog(){
  const d=archiveDialog("新增目录");let parent=Archive.selection;const kinds=[["course","课程"],["chapter","章节"],["lesson","课次"],["point","知识点"]];const order=kinds.map(a=>a[0]);const type=archiveSelect(kinds,parent?order[Math.min(3,order.indexOf(parent.kind)+1)]:"course");
  const name=archiveInput("","输入名称"),where=el("div",{class:"archive-form-grid"});d.append(archiveField("新增类型",type),where,archiveField("名称",name));let course,chapter,lesson;
  const update=()=>{where.replaceChildren();const depth=order.indexOf(type.value);let selectedCourse=data.courses.find(c=>c.id===parent?.id);let selectedPage=data.pages.find(p=>p.id===parent?.id);if(parent?.kind==="point")selectedPage=archiveFind(parent.id)?.p;if(parent?.kind==="chapter")selectedCourse=data.courses.find(c=>c.chapters.some(ch=>ch.id===parent.id));if(selectedPage)selectedCourse=data.courses.find(c=>c.id===selectedPage.courseId);
    course=archiveSelect(data.courses.map(c=>[c.id,c.title]),selectedCourse?.id||data.courses[0]?.id);const rebuild=()=>{const c=data.courses.find(c=>c.id===course.value);chapter=archiveSelect((c?.chapters||[]).map(ch=>[ch.id,ch.title]),selectedPage?.chapterId||(parent?.kind==="chapter"?parent.id:c?.chapters[0]?.id));const lessonRow=el("div");const rebuildLesson=()=>{lesson=archiveSelect(data.pages.filter(p=>p.chapterId===chapter.value).map(p=>[p.id,p.title]),selectedPage?.id);lessonRow.replaceChildren();if(depth===3)lessonRow.append(archiveField("第几课",lesson));};chapter.onchange=rebuildLesson;where.replaceChildren();if(depth>=1)where.append(archiveField("课程",course));if(depth>=2)where.append(archiveField("章节",chapter));rebuildLesson();where.append(lessonRow);};course.onchange=rebuild;rebuild();if(depth===0)where.replaceChildren();};type.onchange=update;update();
  archiveCloseRow(d,()=>{const title=name.value.trim();if(!title)return name.focus();const result=archiveCreate(type.value,title,{courseId:course?.value,chapterId:chapter?.value,pageId:lesson?.value});if(!result)return;d.close();changed();render();},"创建");
}
function archiveCreate(kind,title,parent){
  if(kind==="course"){const c={id:uid(),title,chapters:[]};data.courses.push(c);Archive.selection={kind,id:c.id};Archive.view="directory";return c;}
  const c=data.courses.find(c=>c.id===parent.courseId);if(!c){archiveNotice("先创建课程。");return null;}
  if(kind==="chapter"){const ch={id:uid(),title};c.chapters.push(ch);Archive.selection={kind,id:ch.id};Archive.view="directory";return ch;}
  const ch=c.chapters.find(ch=>ch.id===parent.chapterId);if(!ch){archiveNotice("先创建章节。");return null;}
  if(kind==="lesson"){const p={id:uid(),title,courseId:c.id,chapterId:ch.id,category:c.title,kind:"knowledge",blocks:[]};data.pages.push(p);current=p.id;Archive.selection={kind,id:p.id};Archive.view="knowledge";practiceHome=false;editing=true;return p;}
  const p=data.pages.find(p=>p.id===parent.pageId&&p.chapterId===ch.id);if(!p){archiveNotice("先创建课次。");return null;}const b=createBlock("group");b.title=title;p.blocks.push(b);current=p.id;Archive.view="knowledge";practiceHome=false;editing=true;Archive.selection={kind:"point",id:b.id};return b;
}
function archiveDelete(kind,id){
  let name="",pages=[],point=null;
  if(kind==="course"){const c=data.courses.find(c=>c.id===id);name=c?.title;pages=data.pages.filter(p=>p.courseId===id);}
  if(kind==="chapter"){name=data.courses.flatMap(c=>c.chapters).find(ch=>ch.id===id)?.title;pages=data.pages.filter(p=>p.chapterId===id);}
  if(kind==="lesson"){const p=data.pages.find(p=>p.id===id);name=p?.title;pages=p?[p]:[];}
  if(kind==="point"){point=blockLocation(id);name=point?blockTitle(point.b):"";}
  if(!name)return;const count=pages.reduce((n,p)=>n+p.blocks.filter(b=>b.type==="group").length,0);
  archiveConfirm("删除「"+name+"」？",kind==="point"?"这个知识点及里面的组件将一起删除，可撤销。":`将删除 ${pages.length} 个课次、${count} 个知识点及其组件，可撤销。`,()=>{
    const snapshot=clone(data);stop();if(point)point.list.splice(point.index,1);else{const ids=new Set(pages.map(p=>p.id));data.pages=data.pages.filter(p=>!ids.has(p.id));if(kind==="course")data.courses=data.courses.filter(c=>c.id!==id);if(kind==="chapter")data.courses.forEach(c=>c.chapters=c.chapters.filter(ch=>ch.id!==id));}
    current=data.pages[0]?.id||null;Archive.view="home";Archive.selection=null;changed();render();archiveUndo(()=>{data=validate(snapshot);current=data.pages[0]?.id||null;},"已删除「"+name+"」");
  });
}
const archiveLegacyRender=render;
render=function(){
  if(!data)return;archiveMigrate(data);Archive.graphDispose?.();Archive.graphDispose=null;
  if(Archive.view==="knowledge"&&data.pages.length){practiceHome=false;archiveLegacyRender();document.body.classList.remove("archive-special");$("crumb").textContent=archivePath(page());$("meta").replaceChildren(el("span",{class:"muted",text:archivePath(page())}));archiveRenderTimer();return;}
  exitBoardOverview();document.body.classList.add("archive-special");document.body.classList.toggle("practice-page",Archive.view==="practice");nav();$("blocks").replaceChildren();$("title").replaceChildren();$("meta").replaceChildren();$("add").hidden=true;$("edit").hidden=true;$("deletePage").hidden=true;fitButton.hidden=true;practiceHome=Archive.view==="practice";
  const titles={home:data.archiveSettings.title,directory:"知识百科",practice:"练习库",instrument:"乐器练习",works:"作品档案"};$("title").textContent=titles[Archive.view]||titles.home;$("crumb").textContent="主页 / "+(titles[Archive.view]||titles.home);
  if(Archive.view==="home")archiveRenderHome();else if(Archive.view==="directory")archiveRenderDirectory();else if(Archive.view==="practice")archiveRenderPractice();else if(Archive.view==="instrument")archiveRenderInstruments();else if(Archive.view==="works")archiveRenderWorks();archiveRenderTimer();
};
function archiveRenderHome(){
  const root=$("blocks");root.append(el("p",{class:"archive-tagline",text:data.archiveSettings.tagline}));const surface=el("section",{class:"archive-home-map"});const center=el("div",{class:"archive-map-center",text:"我的音乐世界"});surface.append(center);
  const knowledge=el("section",{class:"archive-map-branch"},[button("课程知识",()=>{Archive.view="directory";Archive.selection=null;render();},"archive-map-title")]);for(const c of data.courses){const lessons=data.pages.filter(p=>p.courseId===c.id);knowledge.append(button(c.title+" · "+lessons.length+"课",()=>archiveDirectoryOverview("course",c.id),"archive-map-leaf"));}knowledge.append(button("＋ 新增课程",()=>{Archive.selection=null;archiveAddDialog();},"archive-map-leaf"));
  const practice=el("section",{class:"archive-map-branch"},[button("练习库",()=>archiveNavigate("practice"),"archive-map-title")]);for(const [v,t]of [["plan","今日计划"],["lists","我的练习单"],["graph","知识关系图"],["organize","分类整理"]])practice.append(button(t,()=>{Archive.practiceTab=v;archiveNavigate("practice");},"archive-map-leaf"));
  const instrument=el("section",{class:"archive-map-branch"},[button("乐器练习",()=>archiveNavigate("instrument"),"archive-map-title")]);data.instruments.forEach(i=>instrument.append(button(i.name,()=>{Archive.instrument=i.id;archiveNavigate("instrument");},"archive-map-leaf")));
  const works=el("section",{class:"archive-map-branch"},[button("作品档案",()=>archiveNavigate("works"),"archive-map-title")]);for(const t of ["演唱","编曲","作曲","乐器","其他"])works.append(button(t,()=>{Archive.workType=t;Archive.work=null;archiveNavigate("works");},"archive-map-leaf"));surface.append(knowledge,practice,instrument,works);root.append(surface);
}
function archiveRenderDirectory(){const root=$("blocks"),sel=Archive.selection;const courses=data.courses.filter(c=>!sel||sel.kind!=="course"||c.id===sel.id);for(const c of courses){const card=el("section",{class:"archive-panel"},[el("h2",{text:c.title})]);for(const ch of c.chapters.filter(ch=>!sel||sel.kind!=="chapter"||ch.id===sel.id)){card.append(el("h3",{text:archiveChapterTitle(c,ch)}));const lessons=data.pages.filter(p=>p.chapterId===ch.id);lessons.forEach((p,i)=>card.append(button(`第${i+1}课 · ${p.title} · ${p.blocks.length}个知识点`,()=>{current=p.id;archiveNavigate("knowledge");},"archive-list-button")));if(!lessons.length)card.append(el("p",{class:"muted",text:"点击目录旁的＋，添加课次。"}));}if(!c.chapters.length)card.append(el("p",{class:"muted",text:"点击目录旁的＋，添加章节。"}));root.append(card);}if(!courses.length)root.append(button("＋ 创建第一门课程",archiveAddDialog,"primary"));}
// 为已有白板增加练习入口；已加入不会重复创建节点。
boardPracticeActions=function(b){return el("div",{class:"board-practice-actions"},[button(b.needsPractice?"✓ 已加入练习库":"加入练习库",()=>{if(!b.needsPractice){b.needsPractice=true;b.practiceAddedAt=new Date().toISOString();b.proficiency||="again";changed();render();}else archivePracticeMenu(b);}),...(b.needsPractice?[button("开始练习",()=>archiveStartPractice(b.id))]:[])]);};
markPractice=function(b){if(!b.needsPractice){b.needsPractice=true;b.practiceAddedAt=new Date().toISOString();changed();render();}else archivePracticeMenu(b);};
$("deletePage").onclick=()=>archiveDelete("lesson",current);
const brand=document.querySelector(".brand");brand.textContent="⌂";brand.setAttribute("aria-label","返回主页");brand.onclick=e=>{e.preventDefault();archiveNavigate("home");};
