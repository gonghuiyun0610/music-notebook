/* 搜索、富文本、可撤销删除与轻量浮层。 */
"use strict";
let searchKind="knowledge";
let deletedKnowledge=null;
let deleteToastTimer=null;

function boardAddKnowledge(){
  stop();
  const b=createBlock("group");
  page().blocks.push(b);
  boardSelectedKnowledge=b.id;boardActiveContent=null;
  changed();render();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const node=document.getElementById("block-"+b.id);
    node?.scrollIntoView({behavior:"smooth",block:"start"});
    node?.classList.add("located");
    setTimeout(()=>node?.classList.remove("located"),1800);
  }));
}
function blockLocation(id){
  function find(list){
    for(let i=0;i<list.length;i++){
      if(list[i].id===id)return {list,index:i,b:list[i]};
      const found=find(list[i].children||[]);if(found)return found;
    }
    return null;
  }
  for(const p of data.pages){const found=find(p.blocks);if(found)return {...found,p};}
  return null;
}
function removeKnowledgeItem(id){
  const found=blockLocation(id);if(!found)return;
  stop();deletedKnowledge={...found};found.list.splice(found.index,1);
  if(boardActiveContent===id)boardActiveContent=null;
  document.getElementById("delete-undo")?.remove();
  const toast=el("div",{id:"delete-undo",class:"undo-toast",role:"status"},[
    el("span",{text:"已删除「"+blockTitle(found.b)+"」"}),
    button("撤销",()=>{
      const saved=deletedKnowledge;if(!saved)return;
      // 用保存的页面和父容器身份确认列表仍存在。
      const alive=data.pages.includes(saved.p) && (saved.list===saved.p.blocks || allBlocks().some(x=>x.b.children===saved.list));
      if(alive){saved.list.splice(Math.min(saved.index,saved.list.length),0,saved.b);deletedKnowledge=null;toast.remove();redraw();}
      else{toast.remove();deletedKnowledge=null;status("原页面已移除，无法撤销；可从备份恢复。");}
    })
  ]);
  document.body.append(toast);
  clearTimeout(deleteToastTimer);
  deleteToastTimer=setTimeout(()=>{toast.remove();deletedKnowledge=null;},3000);
}

function closeOutside(event){
  document.querySelectorAll(".board-add-menu[open]").forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});
  const dialogs=[...document.querySelectorAll("dialog[open]")];
  const d=dialogs.at(-1);if(!d)return;
  const r=d.getBoundingClientRect();
  const outside=event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;
  if(event.target===d && outside)d.close();
}
document.addEventListener("pointerdown",closeOutside,true);
function cleanDialogButtons(){
  document.querySelectorAll("dialog button").forEach(b=>{if(["关闭"].includes(b.textContent.trim()))b.remove();});
}
const dialogWatcher=new MutationObserver(cleanDialogButtons);
dialogWatcher.observe(document.body,{childList:true,subtree:true});cleanDialogButtons();

function searchEntries(kind,q){
  const entries=[];
  for(const p of data.pages){
    function visit(blocks,owner){for(const b of blocks){
      const group=b.type==="group",parent=group?b:owner;
      if((kind==="knowledge"?group:!group)&&blockTitle(b).toLowerCase().includes(q.toLowerCase()))entries.push({p,b,owner});
      visit(b.children||[],parent);
    }}visit(p.blocks,null);
  }
  return entries;
}
nav=function(){
  const navNode=$("nav");navNode.replaceChildren();
  const q=$("search").value.trim();
  const modes=el("div",{class:"search-modes","aria-label":"搜索范围"});
  for(const [kind,label] of [["knowledge","知识块"],["component","组件"]]){
    const control=button(label,()=>{searchKind=kind;nav();});control.setAttribute("aria-pressed",String(searchKind===kind));modes.append(control);
  }
  navNode.append(modes);
  if(q || searchKind==="component"){
    const results=searchEntries(searchKind,q);
    navNode.append(el("p",{class:"search-count",text:results.length+" 个结果"}));
    for(const {p,b,owner} of results){
      const result=button("",()=>{stop();locate(p,b);},"search-result");
      result.append(el("span",{text:blockTitle(b)}),el("small",{text:p.title+(owner?" / "+blockTitle(owner):"")}));
      navNode.append(result);
    }
    if(!results.length)navNode.append(el("p",{class:"muted",text:"没有匹配的名称"}));
    return;
  }
  for(const kind of ["knowledge","practice"]){
    const region=el("section",{class:"nav-region "+kind});region.append(el("h3",{text:kind==="knowledge"?"知识":"练习"}));
    if(kind==="practice")region.append(button("练习库",()=>{stop();practiceHome=true;render();},practiceHome?"selected":""));
    const pages=data.pages.filter(p=>(p.kind||"knowledge")===kind);
    for(const cat of [...new Set(pages.map(p=>p.category))]){
      const group=el("details",{class:"nav-group"}),key="nav:"+kind+":"+cat;group.open=viewState.get(key)!==false;
      group.ontoggle=()=>viewState.set(key,group.open);group.append(el("summary",{text:cat}));
      for(const p of pages.filter(p=>p.category===cat)){
        const chapter=el("details",{class:"nav-chapter"}),chapterKey="nav-page:"+p.id;
        chapter.open=viewState.has(chapterKey)?viewState.get(chapterKey):p.id===current&&!practiceHome;
        const summary=el("summary",{text:p.title,class:p.id===current&&!practiceHome?"selected":""});
        summary.onclick=e=>{
          e.preventDefault();const open=!chapter.open;viewState.set(chapterKey,open);
          if(p.id!==current||practiceHome){stop();current=p.id;practiceHome=false;viewState.set(chapterKey,true);render();}
          else chapter.open=open;
        };
        chapter.append(summary);
        function links(blocks,container){for(const b of blocks){
          const item=el("details",{class:"nav-block"}),itemKey="nav-block:"+b.id;
          item.open=viewState.has(itemKey)?viewState.get(itemKey):!b.collapsed;
          const label=el("summary",{text:blockTitle(b)});
          label.onclick=e=>{e.preventDefault();viewState.set(itemKey,!item.open);stop();locate(p,b);};
          item.append(label);links(b.children||[],item);container.append(item);
        }}links(p.blocks,chapter);group.append(chapter);
      }region.append(group);
    }
    if(kind==="knowledge"){
      const entry=el("details",{class:"knowledge-page-add board-add-menu"});
      entry.append(el("summary",{text:"＋","aria-label":"新增知识页面"}));
      const form=el("form",{class:"new-page-form"});
      const name=el("input",{placeholder:"知识页面名称","aria-label":"新知识页面名称",required:""});
      const submit=el("button",{text:"新增知识页面",type:"submit",class:"primary"});
      form.append(name,submit);form.onsubmit=e=>{e.preventDefault();const title=name.value.trim();if(!title)return;stop();const p={id:uid(),title,category:"未分类",kind:"knowledge",blocks:[]};data.pages.push(p);current=p.id;editing=true;practiceHome=false;redraw();};
      entry.append(form);region.append(entry);
    }
    navNode.append(region);
  }
};

const TEXT_FONTS=[
  ["system-ui","系统字体"],["Microsoft YaHei","微软雅黑"],["PingFang SC","苹方"],["Noto Sans CJK SC","思源黑体"],["SimSun","宋体"],["KaiTi","楷体"],["Arial","Arial"],["Georgia","Georgia"]
];
const TEXT_SIZES={1:"12px",2:"14px",3:"16px",4:"18px",5:"24px",6:"32px",7:"40px"};
function safeTextStyle(style){
  const result={};
  if(!style||typeof style!=="object")return result;
  if(["1.2","1.5","1.8","2"].includes(String(style.lineHeight)))result.lineHeight=String(style.lineHeight);
  if(["0px","8px","16px","24px"].includes(style.paragraphGap))result.paragraphGap=style.paragraphGap;
  return result;
}
function sanitizeRichText(html){
  const template=document.createElement("template");template.innerHTML=html;
  const allowed=new Set(["P","DIV","BR","SPAN","B","STRONG","I","EM","U","S","STRIKE","H1","H2","H3","H4","H5","H6","UL","OL","LI","BLOCKQUOTE","FONT"]);
  const discard=new Set(["SCRIPT","STYLE","IFRAME","OBJECT","EMBED","LINK","META","SVG","MATH","FORM","INPUT","BUTTON","IMG","VIDEO","AUDIO"]);
  const validStyle=(key,value)=>{
    if(key==="font-family")return TEXT_FONTS.some(([name])=>value.replace(/["']/g,"").trim()===name);
    if(key==="font-size")return /^([1-4]?\d|50)px$/.test(value);
    if(["color","background-color"].includes(key))return /^#[0-9a-f]{3,8}$/i.test(value)||/^rgba?\([\d\s.,%]+\)$/.test(value);
    if(key==="font-weight")return /^(normal|bold|[1-9]00)$/.test(value);
    if(key==="font-style")return /^(normal|italic)$/.test(value);
    if(key==="text-decoration")return /^(none|underline|line-through|underline line-through)$/.test(value);
    if(key==="text-align")return /^(left|center|right|justify)$/.test(value);
    if(key==="line-height")return /^(1\.2|1\.5|1\.8|2)$/.test(value);
    if(["margin-top","margin-bottom"].includes(key))return /^(0|8|16|24)px$/.test(value);
    return false;
  };
  function visit(parent){
    for(const node of [...parent.childNodes]){
      if(node.nodeType===8){node.remove();continue;}
      if(node.nodeType!==1)continue;
      if(discard.has(node.tagName)){node.remove();continue;}
      visit(node);
      if(!allowed.has(node.tagName)){node.replaceWith(...node.childNodes);continue;}
      const style=[];
      for(const key of Array.from(node.style)){const value=node.style.getPropertyValue(key).trim();if(validStyle(key,value))style.push(key+":"+value);}
      if(node.tagName==="FONT"){
        const face=node.getAttribute("face"),color=node.getAttribute("color"),size=node.getAttribute("size");
        if(face&&validStyle("font-family",face))style.push("font-family:"+face);
        if(color&&validStyle("color",color))style.push("color:"+color);
        if(TEXT_SIZES[size])style.push("font-size:"+TEXT_SIZES[size]);
      }
      const align=node.getAttribute("align");if(align&&validStyle("text-align",align))style.push("text-align:"+align);
      for(const attr of Array.from(node.attributes))node.removeAttribute(attr.name);
      if(style.length)node.setAttribute("style",style.join(";"));
    }
  }visit(template.content);return template.innerHTML;
}
function renderRichText(body,b){
  const style=safeTextStyle(b.textStyle);
  const editor=el("div",{class:editing?"rich-editor":"rich-reading",role:editing?"textbox":"document","aria-label":"文本内容"});
  editor.style.lineHeight=style.lineHeight||"1.8";editor.style.setProperty("--paragraph-gap",style.paragraphGap||"8px");
  if(b.richText)editor.innerHTML=sanitizeRichText(b.richText);else editor.textContent=b.content;
  if(!editing){body.append(editor);return;}
  editor.contentEditable=String(boardActiveContent===b.id);editor.setAttribute("aria-multiline","true");
  const toolbar=el("div",{class:"rich-toolbar edit-only","aria-label":"文本排版"});
  let savedRange=null, undoStack=[],redoStack=[];
  const snapshot=()=>({html:sanitizeRichText(editor.innerHTML),style:clone(safeTextStyle(b.textStyle))});
  let previous=snapshot();
  function rememberRange(){const selection=window.getSelection();if(selection?.rangeCount && editor.contains(selection.anchorNode)&&editor.contains(selection.focusNode))savedRange=selection.getRangeAt(0).cloneRange();}
  function restoreRange(){boardActivate(b.id);editor.contentEditable="true";editor.focus({preventScroll:true});if(savedRange&&editor.contains(savedRange.commonAncestorContainer)){const selection=window.getSelection();selection.removeAllRanges();selection.addRange(savedRange);}}
  function persist(history=true){
    const next=snapshot();
    if(history&&JSON.stringify(next)!==JSON.stringify(previous)){undoStack.push(previous);if(undoStack.length>100)undoStack.shift();redoStack=[];}
    previous=next;b.richText=next.html;b.content=editor.innerText ?? editor.textContent;b.textStyle=next.style;changed();
  }
  function command(name,value){
    restoreRange();const selection=window.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):null;
    if(range&&!range.collapsed&&["fontSize","fontName"].includes(name)){
      const key=name==="fontSize"?"font-size":"font-family",span=document.createElement("span"),fragment=range.extractContents();
      fragment.querySelectorAll?.("*").forEach(node=>{node.style.removeProperty(key);if(name==="fontSize")node.removeAttribute("size");else node.removeAttribute("face");});
      span.style.setProperty(key,name==="fontSize"?TEXT_SIZES[value]:value);span.append(fragment);range.insertNode(span);range.selectNodeContents(span);selection.removeAllRanges();selection.addRange(range);
    }else document.execCommand(name,false,value);
    rememberRange();persist();
  }
  function action(label,name,value){const control=button(label,()=>command(name,value));control.onpointerdown=e=>e.preventDefault();return control;}
  toolbar.append(choice("字体","system-ui",TEXT_FONTS,font=>command("fontName",font)),choice("字号",3,Object.entries(TEXT_SIZES).map(([key,label])=>[key,label.replace("px","")]),size=>command("fontSize",size)),action("加粗","bold"),action("斜体","italic"),action("下划线","underline"));
  for(const [label,name,value] of [["左对齐","justifyLeft"],["居中","justifyCenter"],["右对齐","justifyRight"],["编号","insertOrderedList"],["项目符号","insertUnorderedList"]])toolbar.append(action(label,name,value));
  toolbar.append(choice("段落","p",[["p","正文"],["h2","标题 2"],["h3","标题 3"],["h4","标题 4"]],value=>command("formatBlock",value)));
  for(const [label,name,color] of [["文字色","foreColor","#344054"],["高亮","hiliteColor","#f6e8a4"]]){
    const input=el("input",{type:"color",value:color,"aria-label":label});input.oninput=()=>command(name,input.value);toolbar.append(el("label",{text:label},[input]));
  }
  function spacing(key,value){b.textStyle={...safeTextStyle(b.textStyle),[key]:value};editor.style.lineHeight=b.textStyle.lineHeight||"1.8";editor.style.setProperty("--paragraph-gap",b.textStyle.paragraphGap||"8px");persist();}
  toolbar.append(choice("行距",style.lineHeight||"1.8",["1.2","1.5","1.8","2"].map(v=>[v,v]),v=>spacing("lineHeight",v)),choice("段间距",style.paragraphGap||"8px",["0px","8px","16px","24px"].map(v=>[v,v]),v=>spacing("paragraphGap",v)));
  function history(from,to){if(!from.length)return;to.push(snapshot());const next=from.pop();editor.innerHTML=next.html;b.textStyle=next.style;editor.style.lineHeight=next.style.lineHeight||"1.8";editor.style.setProperty("--paragraph-gap",next.style.paragraphGap||"8px");savedRange=null;persist(false);}
  toolbar.append(button("撤销",()=>history(undoStack,redoStack)),button("重做",()=>history(redoStack,undoStack)),button("清除格式",()=>{
    restoreRange();document.execCommand("removeFormat");b.textStyle={};editor.style.lineHeight="1.8";editor.style.setProperty("--paragraph-gap","8px");rememberRange();persist();
  }));
  toolbar.addEventListener("pointerdown",rememberRange,true);
  toolbar.addEventListener("mousedown",e=>{rememberRange();if(e.target.closest?.("button"))e.preventDefault();},true);
  editor.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&["z","y"].includes(e.key.toLowerCase())){e.preventDefault();e.stopPropagation();if(e.key.toLowerCase()==="y"||e.shiftKey)history(redoStack,undoStack);else history(undoStack,redoStack);}};
  editor.oninput=()=>{rememberRange();persist();};editor.onkeyup=rememberRange;editor.onmouseup=rememberRange;
  editor.onpaste=e=>{
    e.preventDefault();restoreRange();const html=e.clipboardData?.getData("text/html");
    if(html)document.execCommand("insertHTML",false,sanitizeRichText(html));else document.execCommand("insertText",false,e.clipboardData?.getData("text/plain")||"");
    rememberRange();persist();
  };
  body.append(toolbar,editor);
}
const workbenchValidate=validate;
validate=function(x){
  const result=workbenchValidate(x);
  walk(result.pages.flatMap(p=>p.blocks),b=>{
    if(b.toolY!==undefined && (!Number.isFinite(b.toolY)||b.toolY<0||b.toolY>20000))throw Error("白板工具位置格式错误。");
    if(b.type==="text"){
      if(b.richText!==undefined){if(typeof b.richText!=="string"||b.richText.length>2000000)throw Error("文本排版格式错误。");b.richText=sanitizeRichText(b.richText);}
      if(b.textStyle!==undefined)b.textStyle=safeTextStyle(b.textStyle);
    }
  });return result;
};

// 主滚动条移动时，当前白板的工具组自动留在可操作区域。
let toolFrame=0;
function followBoardTools(){
  toolFrame=0;
  document.querySelectorAll(".board-local-tools").forEach(tools=>{
    const board=tools.closest(".knowledge-board"),rect=board.getBoundingClientRect();
    const height=rect.height,toolHeight=tools.offsetHeight||94;
    tools.style.top=clamp(100-rect.top,58,Math.max(58,height-toolHeight-16))+"px";
  });
}
function queueBoardTools(){if(!toolFrame)toolFrame=requestAnimationFrame(followBoardTools);}
document.addEventListener("scroll",queueBoardTools,true);
window.addEventListener("resize",()=>{queueBoardTools();if(boardOverview)fitBoardOverview();});

let boardOverview=false,overviewWidth=0;
function exitBoardOverview(){
  if(!boardOverview)return;
  boardOverview=false;document.body.classList.remove("board-overview");
  const blocks=$("blocks");blocks.style.transform="";blocks.style.width="";blocks.style.left="";blocks.style.top="";
  document.getElementById("fit-whiteboards")?.setAttribute("aria-pressed","false");
}
function fitBoardOverview(){
  const blocks=$("blocks");blocks.style.transform="none";blocks.style.width=overviewWidth+"px";
  const width=Math.max(1,blocks.scrollWidth||blocks.getBoundingClientRect().width);
  const height=Math.max(1,blocks.scrollHeight||blocks.getBoundingClientRect().height);
  const availableWidth=(window.innerWidth||1200)-32,availableHeight=(window.innerHeight||800)-120;
  const scale=Math.min(1,availableWidth/width,availableHeight/height);
  blocks.style.transformOrigin="top left";blocks.style.transform="scale("+scale+")";
  blocks.style.left=(16+(availableWidth-width*scale)/2)+"px";blocks.style.top=(100+(availableHeight-height*scale)/2)+"px";
}
function toggleBoardOverview(){
  if(boardOverview){exitBoardOverview();return;}
  overviewWidth=$("blocks").clientWidth||900;boardOverview=true;
  document.body.classList.add("board-overview");
  document.getElementById("fit-whiteboards").setAttribute("aria-pressed","true");
  fitBoardOverview();requestAnimationFrame(fitBoardOverview);
}
document.addEventListener("keydown",e=>{if(e.key==="Escape")exitBoardOverview();});
const fitButton=button("",toggleBoardOverview,"fit-whiteboards");
fitButton.id="fit-whiteboards";fitButton.setAttribute("aria-label","全局自适应；再次点击恢复");fitButton.setAttribute("title","全局自适应 / 恢复");fitButton.setAttribute("aria-pressed","false");
fitButton.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
document.querySelector("header .actions").prepend(fitButton);
const workspacePreviousRender=render;
render=function(){exitBoardOverview();workspacePreviousRender();fitButton.hidden=practiceHome;queueBoardTools();};
