/**
 * 知识白板：固定标题区 + 自由布局的内容块。
 * 沿用 group / children 数据模型，保留旧模块 ID、练习标签和媒体引用。
 * 新建只创建知识块；知识块内只添加文本、鼓、音符块、图片和音频。
 */
"use strict";
let boardActiveContent = null;
let boardSelectedKnowledge = null;
const BOARD_TYPES = [
  ["text", "文本"],
  ["rhythm", "鼓"],
  ["midi", "音符块"],
  ["image", "图片"],
  ["audio", "音频"],
];
const BOARD_DEFAULTS = {
  text: { width: 440, height: 280 },
  rhythm: { width: 1050, height: 460 },
  midi: { width: 1050, height: 1000 },
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
      if (b.type === "group") boardEnsure(b);
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
        if (confirm("删除这个知识块及其内容？")) list.splice(index, 1);
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
  d.append(button("关闭", () => d.close()));
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
  child.layout = { x: point?.x ?? 24, y: point?.y ?? y, ...size };
  board.children.push(child);
  boardActiveContent = child.id;
  boardSelectedKnowledge = board.id;
  boardEnsure(board);
  return child;
}
function boardNewContainer(board) {
  const child = boardAddContent(board, "text");
  child.isContentContainer = true;
  child.title = "新内容块";
  child.content = "";
  child.layout.width = 1050;
  child.layout.height = 700;
  redraw();
}
function boardAddPart(board, type) {
  const target = board.children.find(c => c.id === boardActiveContent);
  if (!target) { status("请先点击一个内容块，或添加内容块。"); return; }
  if (!target.isContentContainer) {
    const original = clone(target);
    original.id = uid();
    delete original.layout;
    Object.keys(target).forEach(k => { if (!["id", "layout", "title"].includes(k)) delete target[k]; });
    Object.assign(target, {type:"text", content:"", children:[original], tags:[], practiceTags:[], isContentContainer:true});
  }
  target.children.push(createBlock(type));
  redraw();
}
contentMenu = function(list) {
  const board = allBlocks().find(x => x.b.type === "group" && x.b.children === list)?.b;
  if (board) boardNewContainer(board);
};
function boardEditorRail() {
  document.getElementById("board-editor-rail")?.remove();
  if (!editing) return;
  const rail = el("div", {id:"board-editor-rail", class:"board-editor-rail"});
  const boards = page().blocks.filter(b => b.type === "group");
  const board = boards.find(b => b.id === boardSelectedKnowledge) || boards[0];
  if (board) boardSelectedKnowledge = board.id;
  rail.append(el("strong", {text:"添加部件"}), button("＋ 知识块", () => { const b=createBlock("group");page().blocks.push(b);boardSelectedKnowledge=b.id;boardActiveContent=null;redraw(); }));
  if (board) {
    rail.append(choice("当前知识块", board.id, boards.map(b => [b.id, blockTitle(b)]), id => {boardSelectedKnowledge=id;boardActiveContent=null;render();}));
    rail.append(button("＋ 标题", () => boardAddHeading(board)), button("＋ 内容块", () => boardNewContainer(board)));
    const expanded = el("details", {open:""}, [el("summary", {text:"内容块部件"})]);
    BOARD_TYPES.forEach(([type,name]) => expanded.append(button("＋ " + name, () => boardAddPart(board,type))));
    rail.append(expanded, el("p", {class:"muted",text:"点击内容块激活，再添加部件。"}));
  }
  document.querySelector("aside").append(rail);
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
  const child = boardAddContent(board, type, point);
  child.src = "asset:" + id;
  child.assetId = id;
  child.assetName = file.name;
  child.title = file.name;
  return child;
}

function boardContent(b, list, owner) {
  repairBlock(b);
  const pageEditing = editing;
  const contentEditing = pageEditing && b.id === boardActiveContent;
  editing = contentEditing;
  const section = el("section", {
    id: (b.type === "group" ? "whiteboard-slot-" : "block-") + b.id,
    class: "whiteboard-content",
  });
  section.dataset.contentId = b.id;
  section.classList.toggle("content-active", contentEditing);
  if (pageEditing) {
    section.addEventListener("pointerdown", e => {
      if (boardActiveContent === b.id) return;
      e.preventDefault(); e.stopImmediatePropagation();
      boardActiveContent = b.id; boardSelectedKnowledge = owner.id;
      render();
    }, true);
  }
  const layout = b.layout;
  function apply() {
    section.style.left = layout.x + "px";
    section.style.top = layout.y + "px";
    section.style.width = layout.width + "px";
    section.style.height = layout.height + "px";
  }
  apply();
  const head = el("div", { class: "whiteboard-content-head" });
  if (editing) {
    const handle = button("⠿", () => {}, "content-drag-handle");
    handle.setAttribute("aria-label", "拖动内容块");
    head.append(handle);
    head.append(
      el("input", {
        value: blockTitle(b),
        "aria-label": "内容块标题",
        oninput: (e) => {
          b.title = e.target.value;
          b.name = b.title;
          changed();
          nav();
        },
      }),
    );
    head.append(
      button("⋯", () => {
        const d = el("dialog", {}, [el("h2", { text: "内容块操作" })]);
        d.append(
          button("复制", () => {
            const c = clone(b);
            walk([c], (n) => (n.id = uid()));
            c.layout.x += 24;
            c.layout.y += 24;
            list.push(c);
            d.close();
            redraw();
          }),
          button("删除", () => {
            if (confirm("删除这个内容块？")) {
              list.splice(list.indexOf(b), 1);
              d.close();
              redraw();
            }
          }),
          button("关闭", () => d.close()),
        );
        d.onclose = () => d.remove();
        document.body.append(d);
        d.showModal();
      }),
    );
    attachDrag(handle, false);
  } else head.append(el("span", { text: blockTitle(b) }));
  section.append(head);
  const body = el("div", {
    class: "whiteboard-content-body module-body " + b.type,
  });
  if (b.isContentContainer) {
    b.children.forEach(part => {
      const item = el("div", {class:"content-part"});
      const bar = el("div", {class:"content-part-head"}, [el("span", {text: BOARD_TYPES.find(t => t[0] === part.type)?.[1] || blockTitle(part)})]);
      if (editing) bar.append(button("删除部件", () => { b.children.splice(b.children.indexOf(part),1); redraw(); }));
      item.append(bar);
      if (part.type === "text") item.append(editing ? el("textarea", {oninput:e => {part.content=e.target.value;changed();}}, [document.createTextNode(part.content)]) : el("div", {class:"prose",text:part.content}));
      else if (part.type === "rhythm") rhythm(item,part);
      else if (part.type === "midi") midiRender(item,part);
      else media(item,part);
      body.append(item);
    });
    if (!b.children.length) body.append(el("p", {class:"muted",text:"从左侧添加文本、鼓、音符块、图片或音频。"}));
  } else if (b.type === "text")
    body.append(
      editing
        ? el(
            "textarea",
            {
              "aria-label": "文字内容",
              oninput: (e) => {
                b.content = e.target.value;
                changed();
              },
            },
            [document.createTextNode(b.content)],
          )
        : el("div", { class: "prose", text: b.content }),
    );
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
  if (!b.isContentContainer && b.type !== "group" && b.children.length)
    body.append(
      el(
        "div",
        { class: "legacy-child-content" },
        b.children.map((c) => renderBlock(c, b.children)),
      ),
    );
  section.append(body);
  if (editing) {
    const resize = button("◢", () => {}, "content-resize-handle");
    resize.setAttribute("aria-label", "调整内容块大小");
    section.append(resize);
    attachDrag(resize, true);
  }
  function attachDrag(handle, resizing) {
    let drag = null;
    handle.onpointerdown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      stop();
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
          e.clientX - drag.x + (drag.viewport?.scrollLeft || 0) - drag.scrollX,
        dy =
          e.clientY - drag.y + (drag.viewport?.scrollTop || 0) - drag.scrollY;
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
  editing = pageEditing;
  return section;
}

function renderBoard(b, list) {
  repairBlock(b);
  boardEnsure(b);
  const section = el("section", {
    id: "block-" + b.id,
    class: "block knowledge-board",
  });
  const titleRow = el("div", { class: "knowledge-board-title" });
  const collapse = button(b.collapsed ? "›" : "⌄", () => {
    b.collapsed = !b.collapsed;
    changed();
    render();
  });
  collapse.setAttribute("aria-label", "展开或折叠知识块");
  titleRow.append(collapse);
  if (editing)
    titleRow.append(
      el("input", {
        value: b.title,
        "aria-label": "知识块大标题",
        oninput: (e) => {
          b.title = e.target.value;
          changed();
          nav();
        },
      }),
      button("⋯", () => boardMenu(b, list)),
    );
  else titleRow.append(el("h2", { text: b.title }));
  section.append(titleRow, boardPracticeActions(b));
  if (b.collapsed) return section;
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
  const surface = el("div", {
    class: "knowledge-board-surface",
    style: "width:" + b.board.width + "px;height:" + b.board.height + "px",
  });
  surface.dataset.knowledgeId = b.id;
  b.children.forEach((child) =>
    surface.append(boardContent(child, b.children, b)),
  );
  if (!b.children.length)
    surface.append(
      el("p", {
        class: "whiteboard-empty",
        text: editing
          ? "从「＋ 内容块」添加内容，或把图片、音频拖到这里。"
          : "此知识块还没有内容。",
      }),
    );
  if (editing) {
    surface.ondragover = (e) => {
      if (
        !e.dataTransfer?.files?.length &&
        !Array.from(e.dataTransfer?.types || []).includes("Files")
      )
        return;
      e.preventDefault();
      surface.classList.add("file-over");
    };
    surface.ondragleave = (e) => {
      if (!surface.contains(e.relatedTarget))
        surface.classList.remove("file-over");
    };
    surface.ondrop = async (e) => {
      if (e.target.closest?.(".drop-zone")) return;
      e.preventDefault();
      e.stopPropagation();
      surface.classList.remove("file-over");
      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return;
      const rect = surface.getBoundingClientRect();
      const point = {
        x: Math.max(0, e.clientX - rect.left),
        y: Math.max(0, e.clientY - rect.top),
      };
      let added = 0;
      const errors = [];
      for (const file of files) {
        try {
          await boardFileContent(b, file, {
            x: point.x + added * 24,
            y: point.y + added * 24,
          });
          added++;
        } catch (error) {
          errors.push(error.message);
        }
      }
      if (added) {
        changed();
        render();
      }
      status(
        errors.length
          ? errors.join("；")
          : "已添加 " + added + " 个素材内容块。素材已保存到本机。",
      );
    };
  }
  viewport.append(surface);
  section.append(viewport);
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
  boardEditorRail();
};
