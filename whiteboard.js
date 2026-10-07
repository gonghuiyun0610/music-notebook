/**
 * 知识白板：固定标题区 + 自由布局的内容块。
 * 沿用 group / children 数据模型，保留旧模块 ID、练习标签和媒体引用。
 * 新建只创建知识块；知识块内只添加文本、鼓、音符块、图片和音频。
 */
"use strict";
let boardActiveContent = null;
let boardSelectedKnowledge = null;
const boardViews=new Map();
function boardView(id){if(!boardViews.has(id))boardViews.set(id,{scale:1,left:0,top:0});return boardViews.get(id);}
const BOARD_TYPES = [
  ["text", "文本"],
  ["rhythm", "鼓"],
  ["midi", "音符块"],
  ["image", "图片"],
  ["audio", "音频"],
];
const BOARD_DEFAULTS = {
  text: { width: 620, height: 540 },
  rhythm: { width: 1050, height: 460 },
  midi: { width: 1050, height: 830 },
  image: { width: 460, height: 460 },
  audio: { width: 460, height: 260 },
  group: { width: 1200, height: 900 },
  reference: { width: 440, height: 230 },
};

// 修复布局只补缺失值，不改变原知识内容。
function boardEnsure(b) {
  b.board ||= { width: 1600, height: 1000 };
  b.headings ||= [];
  if (!Number.isFinite(b.board.width)) b.board.width = 1600;
  if (!Number.isFinite(b.board.height)) b.board.height = 1000;
  let nextY = 24;
  for (const child of b.children) {
    const size = BOARD_DEFAULTS[child.type] || BOARD_DEFAULTS.text;
    child.layout ||= { x: 24, y: nextY, ...size };
    for (const [key, value] of Object.entries({ x: 24, y: nextY, ...size }))
      if (child.layout[key] === undefined) child.layout[key] = value;
    nextY = Math.max(nextY, child.layout.y + child.layout.height + 24);
  }
  b.board.width = Math.max(
    600,
    b.board.width,
    ...b.children.map((c) => c.layout.x + c.layout.width + 24),
  );
  b.board.height = Math.max(600, b.board.height, nextY);
}
function boardMigrate(x) {
  const ids = new Set();
  x.pages.forEach((p) => walk(p.blocks, (b) => ids.add(b.id)));
  x.pages.forEach((p) => {
    p.blocks = p.blocks.map((b) => {
      if (b.type === "group") return b;
      let id = "knowledge-wrap-" + b.id;
      while (ids.has(id)) id += "-board";
      ids.add(id);
      const wrapper = {
        id,
        type: "group",
        title: blockTitle(b),
        tags: [],
        practiceTags: [],
        children: [b],
      };
      repairBlock(wrapper);
      return wrapper;
    });
    walk(p.blocks, (b) => {
      if (b.type === "group") {
        boardEnsure(b);
        const parts = [];
        for (const child of b.children) {
          if (!child.isContentContainer) continue;
          let y = child.layout.y + child.layout.height + 24;
          for (const part of child.children) {
            part.layout ||= {x:child.layout.x,y,...(BOARD_DEFAULTS[part.type] || BOARD_DEFAULTS.text)};
            y = part.layout.y + part.layout.height + 24;
            parts.push(part);
          }
          child.children = [];
          delete child.isContentContainer;
        }
        b.children.push(...parts);
        boardEnsure(b);
      }
    });
  });
  return x;
}
const boardPreviousValidate = validate;
validate = function (x) {
  const result = boardMigrate(boardPreviousValidate(x));
  walk(
    result.pages.flatMap((p) => p.blocks),
    (b) => {
      if (b.type === "group") {
        if (
          !Array.isArray(b.headings) ||
          b.headings.some(
            (h) =>
              !h ||
              typeof h.id !== "string" ||
              typeof h.text !== "string" ||
              !Number.isInteger(h.level) ||
              h.level < 2 ||
              h.level > 6,
          )
        )
          throw Error("知识块标题格式错误。");
        if (
          !b.board ||
          ![b.board.width, b.board.height].every(
            (v) => Number.isFinite(v) && v >= 100 && v <= 20000,
          )
        )
          throw Error("白板尺寸格式错误。");
      }
      if (
        b.layout &&
        (![b.layout.x, b.layout.y].every(
          (v) => Number.isFinite(v) && v >= 0 && v <= 20000,
        ) ||
          ![b.layout.width, b.layout.height].every(
            (v) => Number.isFinite(v) && v >= 120 && v <= 20000,
          ))
      )
        throw Error("内容块位置或尺寸格式错误。");
    },
  );
  return result;
};
const boardPreviousCreate = createBlock;
createBlock = function (type) {
  const b = boardPreviousCreate(type);
  if (BOARD_TYPES.some(([t])=>t===type)) b.title="未命名"+BOARD_TYPES.find(([t])=>t===type)[1];
  if (type === "group") {
    b.title = "新知识块";
    boardEnsure(b);
  }
  if (type === "rhythm") {
    b.bars = 8;
    b.editorView ||= {};
    b.editorView.drumSelection = null;
  }
  return b;
};

function boardPracticeActions(b) {
  if (editing) return el("div");
  return el("div", { class: "board-practice-actions" }, [
    button(b.needsPractice ? "✓ 需要练习" : "＋ 练习标签", () =>
      markPractice(b),
    ),
    button(b.review ? "✓ 待复习" : "加入待复习", () => {
      b.review = !b.review;
      changed();
      render();
    }),
    ...(b.needsPractice
      ? [
          button("练习分类：" + (b.practiceTags.join("、") || "未分类"), () =>
            classify(b),
          ),
        ]
      : []),
  ]);
}
function boardMenu(b, list) {
  const d = el("dialog", {}, [el("h2", { text: "知识块操作" })]);
  const index = list.indexOf(b);
  for (const [text, fn] of [
    [
      "上移",
      () => {
        if (index > 0)
          [list[index - 1], list[index]] = [list[index], list[index - 1]];
      },
    ],
    [
      "下移",
      () => {
        if (index < list.length - 1)
          [list[index + 1], list[index]] = [list[index], list[index + 1]];
      },
    ],
    [
      "复制",
      () => {
        const copy = clone(b);
        walk([copy], (n) => {
          n.id = uid();
          if (n.headings) n.headings.forEach((h) => (h.id = uid()));
        });
        list.splice(index + 1, 0, copy);
      },
    ],
    [
      "删除",
      () => {
        removeKnowledgeItem(b.id);
      },
    ],
  ])
    d.append(
      button(text, () => {
        fn();
        d.close();
        redraw();
      }),
    );
  d.onclose = () => d.remove();
  document.body.append(d);
  d.showModal();
}
function boardAddHeading(b) {
  const d = el("dialog", {}, [el("h2", { text: "添加标题" })]);
  const text = el("input", {
    placeholder: "标题文字",
    "aria-label": "新标题文字",
  });
  let level = 2;
  d.append(
    text,
    choice(
      "标题级别",
      2,
      [2, 3, 4, 5, 6].map((n) => [n, n + " 级标题"]),
      (n) => (level = Number(n)),
    ),
    button(
      "添加",
      () => {
        if (!text.value.trim()) return;
        b.headings.push({ id: uid(), level, text: text.value.trim() });
        d.close();
        redraw();
      },
      "primary",
    ),
    button("取消", () => d.close()),
  );
  d.onclose = () => d.remove();
  document.body.append(d);
  d.showModal();
}
function boardTags(b) {
  const tags = el(
    "div",
    { class: "tags" },
    b.tags.map((t) => el("span", { class: "pill", text: t })),
  );
  return tags;
}
function boardAddContent(board, type, point) {
  const child = createBlock(type);
  const size = BOARD_DEFAULTS[type];
  const y = board.children.length
    ? Math.max(...board.children.map((c) => c.layout.y + c.layout.height)) + 24
    : 24;
  child.layout = { x: point?.x ?? 24, y: point?.y ?? y, ...size, z:Math.max(0,...board.children.map(c=>c.layout.z||0))+1 };
  board.children.push(child);
  boardActiveContent = child.id;
  boardSelectedKnowledge = board.id;
  boardEnsure(board);
  return child;
}
function boardActivate(id) {
  boardActiveContent = id;
  document.querySelectorAll(".whiteboard-content").forEach(section => {
    const active = editing && section.dataset.contentId === id;
    section.classList.toggle("content-active", active);
    section.querySelectorAll("textarea").forEach(input => input.readOnly = !active);
    section.querySelectorAll(".rich-editor").forEach(input => input.contentEditable = String(active));
  });
}
function boardPositionNew(board,size) {
  exitBoardOverview();
  const viewport=document.getElementById("block-"+board.id)?.querySelector(".knowledge-board-scroll");
  viewport?.scrollIntoView({block:"nearest",inline:"nearest"});
  const view=boardView(board.id);
  const rect=viewport?.getBoundingClientRect();
  const width=viewport?.clientWidth || 900;
  const screenHeight=window.innerHeight || 800;
  const visibleTop=Math.max(rect?.top || 0,80), visibleBottom=Math.min(rect?.bottom ?? screenHeight,screenHeight-28);
  const height=Math.max(220,visibleBottom-visibleTop);
  const centerY=Math.max(0,visibleTop-(rect?.top || 0))+height/2;
  const oldScale=view.scale;
  const centerX=((viewport?.scrollLeft||0)+width/2)/oldScale;
  const center=((viewport?.scrollTop||0)+centerY)/oldScale;
  view.scale=Math.min(1,(width-48)/size.width,(height-48)/size.height);
  view.scale=Math.max(.05,view.scale);
  const point={x:Math.max(24,centerX-size.width/2,(width/view.scale-size.width)/2),y:Math.max(24,center-size.height/2,(centerY/view.scale-size.height/2))};
  view.left=Math.max(0,(point.x+size.width/2)*view.scale-width/2);
  view.top=Math.max(0,(point.y+size.height/2)*view.scale-centerY);
  return point;
}
function boardAddPart(board, type) {
  boardAddContent(board,type,boardPositionNew(board,BOARD_DEFAULTS[type]));
  redraw();
}
contentMenu = function(list) {
  const board = allBlocks().find(x => x.b.type === "group" && x.b.children === list)?.b;
  if (board) document.getElementById("block-"+board.id)?.querySelector(".board-add-menu")?.setAttribute("open", "");
};
function boardLocalTools(board, list) {
  const tools = el("div", {class:"board-local-tools"});
  tools.style.top="72px";
  const menu = el("details", {class:"board-add-menu"});
  menu.append(el("summary", {text:"＋", "aria-label":"添加白板部件"}));
  const panel = el("div", {class:"board-add-options"});
  panel.append(button("标题", () => {menu.open=false;boardAddHeading(board);}));
  BOARD_TYPES.forEach(([type,name]) => panel.append(button(name, () => {menu.open=false;boardAddPart(board,type);})));
  menu.append(panel);tools.append(menu,button("⋯",()=>boardMenu(board,list),"board-options-button"));
  return tools;
}

// 图片或音频直接拖到白板，先持久保存文件，再添加相应内容块。
async function boardFileContent(board, file, point) {
  const extension = file.name.split(".").pop().toLowerCase();
  const imageTypes = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  const audioTypes = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    flac: "audio/flac",
    aac: "audio/aac",
  };
  const isImage =
    /^image\/(png|jpeg|gif|webp)$/.test(file.type) || !!imageTypes[extension];
  const isAudio = file.type.startsWith("audio/") || !!audioTypes[extension];
  if (!isImage && !isAudio)
    throw Error("请拖入 PNG/JPG/GIF/WebP 图片或音频文件。");
  const type = isImage ? "image" : "audio",
    limit = type === "image" ? 10 : 50;
  if (file.size > limit * 1024 * 1024)
    throw Error(
      "单个" + (type === "image" ? "图片" : "音频") + "最大 " + limit + " MB。",
    );
  const id = uid(),
    mime =
      file.type || (isImage ? imageTypes[extension] : audioTypes[extension]);
  await dbPut(id, new File([file], file.name, { type: mime }));
  const child = boardAddContent(board, type, boardPositionNew(board,BOARD_DEFAULTS[type]));
  child.src = "asset:" + id;
  child.assetId = id;
  child.assetName = file.name;
  child.title = file.name;
  return child;
}


function inboxTypeForBlock(item){
  if(item.type==="图片") return "image";
  if(["录音","音频"].includes(item.type)) return "audio";
  return "text";
}
function inboxApplyToBlock(item,b){
  const wanted=inboxTypeForBlock(item);
  if(b.type!==wanted) throw Error(wanted==="image"?"图片只能拖入图片模块":wanted==="audio"?"录音只能拖入音频模块":"这类素材请拖入文本模块或白板空白处");
  b.title=item.name||b.title||"收集箱素材";
  b.inboxSource={id:item.id||item.fs_id||"",path:item.path||"",type:item.type||"文件"};
  if(wanted==="image"||wanted==="audio"){
    b.src=item.media||item.preview||item.url||"";
    b.caption=b.caption||item.name||"";
  }else{
    b.content=item.type==="文字"?(item.text||item.content||item.name||""):[item.name||"文件",item.media||item.preview||item.url||item.path||""].filter(Boolean).join("\n");
  }
}
function boardCollapseActive(board){
  if(!editing||!boardActiveContent)return false;
  const active=board.children.find(c=>c.id===boardActiveContent);
  if(!active)return false;
  active.collapsed=true; boardActiveContent=null; changed(); redraw(); return true;
}

function boardContent(b, list, owner) {
  repairBlock(b);
  const pageEditing = editing;
  const contentEditing = pageEditing && b.id === boardActiveContent;
  const section = el("section", {
    id: (b.type === "group" ? "whiteboard-slot-" : "block-") + b.id,
    class: "whiteboard-content" + (editing && b.collapsed ? " content-collapsed" : ""),
  });
  section.dataset.contentId = b.id;
  section.classList.toggle("content-active", contentEditing);
  if (pageEditing) {
    section.addEventListener("pointerdown", (e) => {
      if(b.collapsed){
        e.preventDefault(); e.stopPropagation();
        owner.children.forEach(c=>{ if(c.id!==b.id && c.id===boardActiveContent) c.collapsed=true; });
        b.collapsed=false; boardActiveContent=b.id; boardSelectedKnowledge=owner.id; changed(); redraw(); return;
      }
      boardActivate(b.id); boardSelectedKnowledge = owner.id;
    }, true);
  }
  const layout = b.layout;
  function apply() {
    if(editing && b.collapsed){
      // V5：收纳不是“裁掉一块”，而是把整个模块等比例缩成鸟瞰缩略图。
      // 保留模块原始宽高，让内部所有组件仍按展开状态排版，再整体 scale 到停靠区。
      const docked=owner.children.filter(c=>c.collapsed);
      const i=Math.max(0,docked.findIndex(c=>c.id===b.id));
      const maxW=280, maxH=160;
      const scale=Math.min(1,maxW/Math.max(1,layout.width),maxH/Math.max(1,layout.height));
      let dockY=18;
      for(let n=0;n<i;n++){
        const c=docked[n], l=c.layout||BOARD_DEFAULTS[c.type]||{width:320,height:180};
        const cs=Math.min(1,maxW/Math.max(1,l.width),maxH/Math.max(1,l.height));
        dockY+=Math.max(58,l.height*cs)+14;
      }
      section.style.left="16px";
      section.style.top=dockY+"px";
      section.style.width=layout.width+"px";
      section.style.height=layout.height+"px";
      section.style.transformOrigin="top left";
      section.style.transform=`scale(${scale})`;
      section.style.setProperty("--dock-scale",String(scale));
      section.style.zIndex=String(500+i);
    }else{
      section.style.left = layout.x + "px"; section.style.top = layout.y + "px";
      section.style.width = layout.width + "px"; section.style.height = layout.height + "px";
      section.style.transform=""; section.style.transformOrigin=""; section.style.removeProperty("--dock-scale");
      section.style.zIndex=String(layout.z||0);
    }
  }
  apply();
  const head = el("div", { class: "whiteboard-content-head" });
  if(editing && b.collapsed) head.title="点击缩略卡片重新展开编辑";
  if (editing) {
    const handle = button("⠿", () => {}, "content-drag-handle");
    handle.setAttribute("aria-label", "拖动内容块");
    head.append(handle);
    const name=el("input",{value:blockTitle(b),"aria-label":"内容块标题",readonly:""});
    name.readOnly=true;
    const sizeName=()=>{name.style.width=Math.min(600,Math.max(64,Array.from(name.value).reduce((n,c)=>n+(/[^\x00-\xff]/.test(c)?14:8),0)+20))+"px";};
    sizeName();
    head.ondblclick=e=>{if(e.target.closest?.("button"))return;e.stopPropagation();name.readOnly=false;head.classList.add("naming");name.focus();name.select?.();};
    name.oninput=()=>{sizeName();};
    name.onblur=()=>{b.title=name.value.trim()||blockTitle(b);b.name=b.title;name.value=b.title;name.readOnly=true;head.classList.remove("naming");sizeName();changed();nav();};
    name.onkeydown=e=>{if(!name.readOnly && e.key==="Enter"){e.preventDefault();name.blur();}if(!name.readOnly && e.key==="Escape"){name.value=blockTitle(b);name.blur();}};
    head.append(name);
    head.append(
      button("⋯", () => {
        const d = el("dialog", {}, [el("h2", { text: "内容块操作" })]);
        d.append(
          button("复制", () => {
            const c = clone(b);
            walk([c], (n) => (n.id = uid()));
            Object.assign(c.layout,boardPositionNew(owner,c.layout));
            c.layout.z=Math.max(0,...owner.children.map(n=>n.layout.z||0))+1;
            list.push(c);
            d.close();
            redraw();
          }),
          button("删除", () => {
            d.close();
            removeKnowledgeItem(b.id);
            redraw();
          }),
        );
        d.onclose = () => d.remove();
        document.body.append(d);
        d.showModal();
      }),
    );
    head.tabIndex=0;head.setAttribute("aria-label","拖动组件标题栏；双击名称修改");
    attachDrag(head, false);
  } else head.append(el("span", { text: blockTitle(b) }));
  section.append(head);
  const body = el("div", {
    class: "whiteboard-content-body module-body " + b.type,
  });
  if (b.type === "text") renderRichText(body,b);
  else if (b.type === "rhythm") rhythm(body, b);
  else if (b.type === "midi") midiRender(body, b);
  else if (["image", "audio"].includes(b.type)) media(body, b);
  else if (b.type === "group") body.append(renderBoard(b, list));
  else if (b.type === "reference") {
    const found = allBlocks().find((x) => x.b.id === b.target);
    body.append(
      found
        ? button("定位对应知识：" + blockTitle(found.b), () =>
            locate(found.p, found.b),
          )
        : el("p", { text: "对应知识块已删除。" }),
    );
  }
  // 旧内容块下的嵌套结构仍可阅读，避免丢掉此前已经写入的内容。
  if (b.type !== "group" && b.children.length)
    body.append(
      el(
        "div",
        { class: "legacy-child-content" },
        b.children.map((c) => renderBlock(c, b.children)),
      ),
    );
  section.append(body);
  if (editing && !b.collapsed) {
    const resize = button("◢", () => {}, "content-resize-handle");
    resize.setAttribute("aria-label", "调整内容块大小");
    section.append(resize);
    attachDrag(resize, true);
  }
  function attachDrag(handle, resizing) {
    let drag = null;
    handle.onpointerdown = (e) => {
      if(boardOverview)return;
      if (e.button !== undefined && e.button !== 0) return;
      if(!resizing && (e.target.closest?.("button") || e.target.closest?.("input")?.readOnly===false))return;
      e.preventDefault();
      e.stopPropagation();
      stop();
      layout.z=Math.max(0,...owner.children.map(c=>c.layout.z||0))+1;apply();
      const viewport = section.closest(".knowledge-board-scroll");
      drag = {
        x: e.clientX,
        y: e.clientY,
        start: { ...layout },
        scrollX: viewport?.scrollLeft || 0,
        scrollY: viewport?.scrollTop || 0,
        viewport,
      };
      handle.setPointerCapture?.(e.pointerId);
      section.classList.add("moving");
    };
    handle.onpointermove = (e) => {
      if (!drag) return;
      const dx =
          (e.clientX - drag.x + (drag.viewport?.scrollLeft || 0) - drag.scrollX)/boardView(owner.id).scale,
        dy =
          (e.clientY - drag.y + (drag.viewport?.scrollTop || 0) - drag.scrollY)/boardView(owner.id).scale;
      if (resizing) {
        layout.width = clamp(
          drag.start.width + dx,
          b.type === "rhythm" ? 620 : b.type === "midi" ? 720 : 240,
          20000 - layout.x - 24,
        );
        layout.height = clamp(
          drag.start.height + dy,
          160,
          20000 - layout.y - 24,
        );
      } else {
        layout.x = clamp(drag.start.x + dx, 0, 20000 - layout.width - 24);
        layout.y = clamp(drag.start.y + dy, 0, 20000 - layout.height - 24);
      }
      apply();
      boardEnsure(owner);
      const surface = section.parentElement;
      if (surface) {
        surface.style.width = owner.board.width + "px";
        surface.style.height = owner.board.height + "px";
        boardScaleSurface(drag.viewport,surface,owner);
      }
    };
    handle.onpointerup = () => {
      if (!drag) return;
      drag = null;
      section.classList.remove("moving");
      changed();
    };
    handle.onpointercancel = () => {
      if (!drag) return;
      Object.assign(layout, drag.start);
      drag = null;
      apply();
      section.classList.remove("moving");
    };
    handle.onkeydown = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      e.preventDefault();
      stop();
      const amount = e.shiftKey ? 20 : 5;
      if (resizing) {
        if (e.key === "ArrowRight") layout.width += amount;
        if (e.key === "ArrowLeft")
          layout.width = Math.max(240, layout.width - amount);
        if (e.key === "ArrowDown") layout.height += amount;
        if (e.key === "ArrowUp")
          layout.height = Math.max(160, layout.height - amount);
      } else {
        if (e.key === "ArrowRight") layout.x += amount;
        if (e.key === "ArrowLeft") layout.x = Math.max(0, layout.x - amount);
        if (e.key === "ArrowDown") layout.y += amount;
        if (e.key === "ArrowUp") layout.y = Math.max(0, layout.y - amount);
      }
      apply();
      boardEnsure(owner);
      changed();
    };
  }
  section.querySelectorAll("textarea").forEach(input => input.readOnly = pageEditing && !contentEditing);
  if(editing){
    // 使用捕获阶段接收收集箱拖拽：图片/音频模块内部自己的 drop-zone
    // 会处理本机文件，捕获阶段可保证收集箱素材先被正确接住。
    section.addEventListener("dragover",e=>{
      if(!Array.from(e.dataTransfer?.types||[]).includes("application/x-yun-inbox"))return;
      e.preventDefault(); e.stopPropagation(); section.classList.add("inbox-target");
      if(e.dataTransfer) e.dataTransfer.dropEffect="copy";
    },true);
    section.addEventListener("dragleave",e=>{if(!section.contains(e.relatedTarget))section.classList.remove("inbox-target");},true);
    section.addEventListener("drop",e=>{
      const raw=e.dataTransfer?.getData("application/x-yun-inbox"); if(!raw)return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); section.classList.remove("inbox-target");
      try{
        const item=JSON.parse(raw);
        inboxApplyToBlock(item,b);
        b.collapsed=false; boardActiveContent=b.id; boardSelectedKnowledge=owner.id;
        changed(); redraw(); status("已放入模块："+(item.name||"素材"));
      } catch(err){status(err.message);}
    },true);
  }
  return section;
}

function renderBoard(b, list) {
  repairBlock(b);
  boardEnsure(b);
  const section = el("section", {
    id: "block-" + b.id,
    class: "block knowledge-board " + (editing ? "board-editing" : "board-reading"),
  });
  const titleRow = el("div", { class: "knowledge-board-title" });
  const title = el("h2", {text:b.title, class:"board-name", "aria-label":"白板名称"});
  if(editing) {
    title.tabIndex=0;
    function beginName() {
      title.contentEditable="true";title.focus();
      const range=document.createRange();range.selectNodeContents(title);
      const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    }
    const original=()=>b.title;
    title.onclick=()=>{if(title.contentEditable!=="true")beginName();};
    title.onkeydown=e=>{
      if(e.key==="Enter") {e.preventDefault();if(title.contentEditable!=="true")beginName();else title.blur();}
      if(e.key==="Escape") {e.preventDefault();title.textContent=original();title.contentEditable="false";title.blur();}
    };
    title.onblur=()=>{
      const next=title.textContent.trim() || b.title;
      title.contentEditable="false";title.textContent=next;
      if(next!==b.title){b.title=next;changed();nav();}
    };
  }
  titleRow.append(title);section.append(titleRow);
  if(editing) section.append(boardLocalTools(b,list));
  else section.append(boardPracticeActions(b));
  // 顶部仅保留名称；旧版折叠白板自动展示，避免出现没有展开入口的空白。
  section.append(boardTags(b));
  const headings = el("div", { class: "knowledge-headings" });
  b.headings.forEach((h) => {
    if (!editing) {
      headings.append(el("h" + h.level, { text: h.text }));
      return;
    }
    const row = el("div", { class: "heading-editor" }, [
      choice(
        "标题级别",
        h.level,
        [2, 3, 4, 5, 6].map((n) => [n, n + " 级标题"]),
        (n) => {
          h.level = Number(n);
          changed();
        },
      ),
      el("input", {
        value: h.text,
        "aria-label": "分级标题文字",
        oninput: (e) => {
          h.text = e.target.value;
          changed();
        },
      }),
      button("删除标题", () => {
        b.headings = b.headings.filter((item) => item !== h);
        redraw();
      }),
    ]);
    headings.append(row);
  });
  section.append(headings);
  const viewport = el("div", { class: "knowledge-board-scroll" });
  const view=boardView(b.id);
  const surface = el("div", {
    class: "knowledge-board-surface",
    style: "width:" + b.board.width + "px;height:" + b.board.height + "px",
  });
  surface.dataset.knowledgeId = b.id;
  if(editing) surface.addEventListener("pointerdown",e=>{
    // 点击真正的白板空白区域（包括空白提示/舞台区域）就收纳当前模块；
    // 只有点在内容模块本身时才不收纳。
    if(e.target.closest?.(".whiteboard-content")) return;
    if(e.target.closest?.("button,input,textarea,select,a,[contenteditable=true]")) return;
    boardCollapseActive(b);
  });
  const ordered = editing ? b.children : [...b.children].sort((a,c)=>a.layout.y-c.layout.y || a.layout.x-c.layout.x);
  ordered.forEach(child=>surface.append(boardContent(child,b.children,b)));
  if (!b.children.length)
    surface.append(
      el("p", {
        class: "whiteboard-empty",
        text: editing
          ? "点击白板边缘的 ＋ 添加部件，也可拖入图片或音频。"
          : "此知识块还没有内容。",
      }),
    );
  // 本机文件仍只在编辑模式接收；收集箱素材在浏览/编辑模式都可拖入。
  surface.ondragover = (e) => {
    const inbox = Array.from(e.dataTransfer?.types || []).includes("application/x-yun-inbox");
    const local = editing && (e.dataTransfer?.files?.length || Array.from(e.dataTransfer?.types || []).includes("Files"));
    if (!inbox && !local) return;
    e.preventDefault();
    surface.classList.toggle("inbox-over", inbox);
    surface.classList.toggle("file-over", !inbox);
  };
  surface.ondragleave = (e) => {
    if (!surface.contains(e.relatedTarget)) surface.classList.remove("file-over","inbox-over");
  };
  surface.ondrop = async (e) => {
    if (e.target.closest?.(".drop-zone")) return;
    const raw=e.dataTransfer?.getData("application/x-yun-inbox");
    if(raw){
      e.preventDefault(); e.stopPropagation(); surface.classList.remove("inbox-over","file-over");
      try{
        const item=JSON.parse(raw), rect=surface.getBoundingClientRect();
        const point={x:Math.max(0,(e.clientX-rect.left)/view.scale),y:Math.max(0,(e.clientY-rect.top)/view.scale)};
        let type=inboxTypeForBlock(item);
        const child=boardAddContent(b,type,point); inboxApplyToBlock(item,child); child.collapsed=false;
        changed(); render(); status("已从收集箱加入："+(item.name||"素材"));
      }catch(err){status("收集箱素材添加失败："+err.message);}
      return;
    }
    if(!editing) return;
    e.preventDefault(); e.stopPropagation(); surface.classList.remove("file-over");
    const files=Array.from(e.dataTransfer?.files||[]); if(!files.length)return;
    const rect=surface.getBoundingClientRect(), point={x:Math.max(0,(e.clientX-rect.left)/view.scale),y:Math.max(0,(e.clientY-rect.top)/view.scale)};
    let added=0;const errors=[];
    for(const file of files){try{await boardFileContent(b,file,{x:point.x+added*24,y:point.y+added*24});added++;}catch(error){errors.push(error.message);}}
    if(added){changed();render();}
    status(errors.length?errors.join("；"):"已添加 "+added+" 个素材内容块。素材已保存到本机。");
  };
  if (editing) {
    /* 收集箱与本机文件的 drop 已统一在上方处理。 */
  }
  const stage=el("div",{class:"board-stage"});stage.append(surface);viewport.append(stage);
  if(editing)boardScaleSurface(viewport,surface,b);
  section.append(viewport);
  requestAnimationFrame(()=>{viewport.scrollLeft=view.left;viewport.scrollTop=view.top;});
  viewport.addEventListener("scroll",()=>{view.left=viewport.scrollLeft;view.top=viewport.scrollTop;});
  return section;
}
renderBlock = function (b, list) {
  if (b.type === "group") return renderBoard(b, list);
  // 仅处理旧版本在非白板子节点中保留的内容。
  const wrapper = {
    id: "legacy-board-" + b.id,
    type: "group",
    title: blockTitle(b),
    tags: [],
    practiceTags: [],
    children: [b],
  };
  repairBlock(wrapper);
  boardEnsure(wrapper);
  return renderBoard(wrapper, list);
};
const boardPreviousRender = render;
render = function () {
  boardMigrate(data);
  boardPreviousRender();
  $("add").replaceChildren();
  $("add").hidden = true;
  document.getElementById("board-editor-rail")?.remove();
  if(editing && !practiceHome) {
    const blocks=$("blocks");
    blocks.append(button("＋ 新知识块",boardAddKnowledge,"new-board-entry"));
  }
};

function boardScaleSurface(viewport,surface,board){
  if(!viewport||!editing)return;
  const scale=boardView(board.id).scale;
  surface.style.transform="scale("+scale+")";
  surface.style.transformOrigin="top left";
  const stage=surface.parentElement;
  if(stage?.classList.contains("board-stage")){
    stage.style.width=board.board.width*scale+"px";stage.style.height=board.board.height*scale+"px";
  }
}
