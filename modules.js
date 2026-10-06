/**
 * 可嵌套知识块、练习引用、目录、媒体文件和统一播放。
 * 数据仍使用 version:1，以兼容旧 content.json；新增字段均为可选。
 */
"use strict";
const DRUMS = {
  kick: "底鼓",
  kickSoft: "柔和底鼓",
  snare: "军鼓",
  rim: "军鼓边击",
  cross: "交叉边击",
  hihat: "闭合踩镲",
  openhat: "开镲",
  pedal: "脚踩镲",
  tomHigh: "高音通鼓",
  tomMid: "中音通鼓",
  tomLow: "落地通鼓",
  crash: "吊镲",
  ride: "叮叮镲",
  bell: "叮叮镲帽",
};
const viewState = new Map();
const selectedNotes = new Map();
let activeBlock = null;
let practiceHome = false;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function meterSteps(b) {
  const [a, d] = (b.meter || "4/4").split("/").map(Number);
  return (a * 16) / d;
}
function walk(blocks, fn) {
  for (const b of blocks) {
    fn(b);
    walk(b.children || [], fn);
  }
}
function allBlocks() {
  const out = [];
  data.pages.forEach((p) => walk(p.blocks, (b) => out.push({ p, b })));
  return out;
}
function blockTitle(b) {
  return (
    b.title ||
    b.name ||
    b.caption ||
    (b.type === "text" ? b.content?.split("\n")[0] : "") ||
    "未命名知识块"
  );
}
function repairBlock(b) {
  b.children ||= [];
  b.tags ||= [];
  b.practiceTags ||= [];
  if (!b.title) b.title = blockTitle(b);
  if (["rhythm", "midi"].includes(b.type)) {
    b.meter ||= "4/4";
    b.bars ||=
      b.type === "rhythm"
        ? Math.max(1, Math.ceil((b.tracks?.kick?.length || 16) / 16))
        : 1;
    b.bpm ||= 90;
  }
  if (b.type === "rhythm") {
    b.swing ||= 50;
    b.visible ||= Object.keys(b.tracks || {});
    b.muted ||= [];
    for (const track of Object.values(b.tracks || {})) {
      while (track.length < b.bars * meterSteps(b)) track.push(0);
    }
  }
  if (b.type === "midi") {
    b.notes ||= [];
    b.octave ??= 3;
    b.snap ||= 1;
    b.notes.forEach((n) => (n.id ||= uid()));
  }
  b.children.forEach(repairBlock);
}
// 替代旧版的固定 16 格校验。递归检查所有子模块。
validate = function (x) {
  if (!x || x.version !== 1 || !Array.isArray(x.pages) || !x.pages.length)
    throw Error("笔记格式不正确。");
  const ids = new Set();
  function check(b, depth = 0) {
    if (depth > 20 || !b || typeof b.id !== "string" || ids.has(b.id))
      throw Error("模块编号重复、缺失或嵌套过深。");
    ids.add(b.id);
    if (
      ![
        "group",
        "text",
        "rhythm",
        "midi",
        "image",
        "audio",
        "reference",
      ].includes(b.type)
    )
      throw Error("不支持的模块类型。");
    if (b.children && !Array.isArray(b.children))
      throw Error("子模块格式不正确。");
    repairBlock(b);
    if (!Array.isArray(b.tags) || !Array.isArray(b.practiceTags))
      throw Error("标签格式不正确。");
    if (["rhythm", "midi"].includes(b.type)) {
      if (!["4/4", "3/4", "6/4", "6/8"].includes(b.meter))
        throw Error("不支持的拍号。");
      if (
        !Number.isInteger(b.bars) ||
        b.bars < 1 ||
        b.bars > 4096 ||
        !Number.isFinite(b.bpm) ||
        b.bpm < 20 ||
        b.bpm > 300
      )
        throw Error("小节数或速度不正确。");
    }
    if (b.type === "midi") midiValidate(b);
    if (b.type === "rhythm") {
      if (
        !b.tracks ||
        typeof b.tracks !== "object" ||
        !Array.isArray(b.visible) ||
        !Array.isArray(b.muted)
      )
        throw Error("鼓轨格式错误。");
      for (const [k, t] of Object.entries(b.tracks))
        if (!DRUMS[k] || !Array.isArray(t) || t.some((v) => v !== 0 && v !== 1))
          throw Error("鼓点格式错误。");
    }
    if (b.type === "text" && typeof b.content !== "string")
      throw Error("文字格式不正确。");
    if (["image", "audio"].includes(b.type) && b.src && !safeURL(b.src, b.type))
      throw Error("素材链接不正确。");
    b.children.forEach((c) => check(c, depth + 1));
  }
  const pageIds = new Set();
  for (const p of x.pages) {
    if (
      !p ||
      typeof p.id !== "string" ||
      pageIds.has(p.id) ||
      typeof p.title !== "string" ||
      !Array.isArray(p.blocks)
    )
      throw Error("页面格式错误。");
    pageIds.add(p.id);
    p.category ||= "未分类";
    p.kind ||= "knowledge";
    p.blocks.forEach((b) => check(b));
  }
  x.presets ||= [];
  x.practiceCategories ||= [];
  if (
    !Array.isArray(x.practiceCategories) ||
    x.practiceCategories.some((t) => typeof t !== "string")
  )
    throw Error("练习分类格式错误。");
  if (!Array.isArray(x.presets)) throw Error("示例库格式错误。");
  for (const preset of x.presets) midiValidate({ ...preset, type: "midi" });
  return x;
};
const legacySafeURL = safeURL;
safeURL = (s, t) => /^asset:[a-zA-Z0-9-]+$/.test(s) || legacySafeURL(s, t);

// IndexedDB 同时保存笔记和媒体，避免大素材挤占 localStorage。
const notebookDB = new Promise((resolve, reject) => {
  const request = indexedDB.open("music-notebook-assets", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("items");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function dbGet(id) {
  const db = await notebookDB;
  return new Promise((resolve, reject) => {
    const r = db.transaction("items").objectStore("items").get(id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function dbPut(id, value) {
  const db = await notebookDB;
  await new Promise((resolve, reject) => {
    const tx = db.transaction("items", "readwrite");
    tx.objectStore("items").put(value, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error("本地保存失败"));
  });
}
const oldChanged = changed;
changed = function () {
  oldChanged();
  dbPut(STORE, clone({ data, bases, dirty })).catch(() =>
    status("本地保存失败，请导出备份。"),
  );
};
function button(text, fn, className = "") {
  return el("button", { text, class: className, onclick: fn, type: "button" });
}
function choice(label, value, options, fn) {
  const input = el("select", {
    "aria-label": label,
    onchange: (e) => fn(e.target.value),
  });
  options.forEach(([v, text]) => {
    const o = el("option", { value: v, text });
    o.selected = String(v) === String(value);
    input.append(o);
  });
  return el("label", { text: label + " " }, [input]);
}
function numberControl(label, value, lo, hi, fn) {
  return el("label", { text: label + " " }, [
    el("input", {
      type: "number",
      value,
      min: lo,
      max: hi,
      "aria-label": label,
      onchange: (e) => {
        const n = clamp(Math.round(Number(e.target.value) || value), lo, hi);
        e.target.value = n;
        fn(n);
      },
    }),
  ]);
}
function redraw() {
  stop();
  changed();
  render();
}
function createBlock(type) {
  const b = { id: uid(), type, title: "", tags: [], children: [] };
  if (type === "group") b.title = "新知识点";
  else if (type === "text") b.content = "";
  else if (type === "midi") Object.assign(b, midiDefaults());
  else if (type === "rhythm")
    Object.assign(b, {
      name: "新节奏",
      bars: 8,
      meter: "4/4",
      bpm: 90,
      swing: 50,
      tracks: {
        kick: Array(128).fill(0),
        snare: Array(128).fill(0),
        hihat: Array(128).fill(0),
      },
    });
  else Object.assign(b, { src: "", caption: "" });
  repairBlock(b);
  return b;
}
function addTo(list, type) {
  const b = createBlock(type);
  list.push(b);
  redraw();
  requestAnimationFrame(() =>
    document
      .getElementById("block-" + b.id)
      ?.scrollIntoView({ block: "center", behavior: "smooth" }),
  );
}
function contentMenu(list) {
  const d = el("dialog", {}, [el("h2", { text: "添加到当前模块" })]);
  for (const [type, name] of [
    ["group", "细分模块"],
    ["text", "文字"],
    ["rhythm", "鼓节奏"],
    ["midi", "MIDI"],
    ["image", "图片"],
    ["audio", "音频"],
  ])
    d.append(
      button(name, () => {
        d.close();
        addTo(list, type);
      }),
    );
  d.append(button("取消", () => d.close()));
  d.onclose = () => d.remove();
  document.body.append(d);
  d.showModal();
}
function markPractice(b) {
  b.needsPractice = !b.needsPractice;
  changed();
  render();
}
function classify(b) {
  data.practiceCategories ||= [];
  const d = el("dialog", {}, [el("h2", { text: "选择练习分类" })]);
  const picked = new Set(b.practiceTags);
  const options = [
    ...new Set([
      ...data.practiceCategories,
      ...allBlocks().flatMap((x) => x.b.practiceTags),
    ]),
  ];
  const list = el("div", { class: "category-options" });
  function addOption(tag, checked) {
    const checkbox = el("input", { type: "checkbox" });
    checkbox.checked = checked;
    checkbox.onchange = () =>
      checkbox.checked ? picked.add(tag) : picked.delete(tag);
    list.append(
      el("label", { class: "category-check", text: tag }, [checkbox]),
    );
  }
  options.forEach((tag) => addOption(tag, picked.has(tag)));
  if (!options.length)
    list.append(
      el("p", {
        class: "muted",
        text: "还没有分类，可在下方新建；不选择则保留在未分类。",
      }),
    );
  const input = el("input", {
    placeholder: "新分类，如：节奏/切分练习",
    "aria-label": "新练习分类",
  });
  d.append(
    list,
    input,
    button("＋ 新建分类", () => {
      const tag = input.value.trim();
      if (!tag) return;
      if (!data.practiceCategories.includes(tag))
        data.practiceCategories.push(tag);
      if (!options.includes(tag)) {
        options.push(tag);
        addOption(tag, true);
      }
      picked.add(tag);
      input.value = "";
    }),
    button(
      "保存分类",
      () => {
        b.practiceTags = [...picked];
        b.needsPractice = true;
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
function locate(p, b) {
  practiceHome = false;
  current = p.id;
  walk(p.blocks, (n) => (n.collapsed = false));
  render();
  requestAnimationFrame(() => {
    const node = document.getElementById("block-" + b.id);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    node?.classList.add("located");
    setTimeout(() => node?.classList.remove("located"), 3000);
  });
}
nav = function () {
  const navNode = $("nav");
  navNode.replaceChildren();
  const q = $("search").value.toLowerCase();
  for (const kind of ["knowledge", "practice"]) {
    const region = el("section", { class: "nav-region " + kind });
    region.append(el("h3", { text: kind === "knowledge" ? "知识" : "练习" }));
    if (kind === "practice")
      region.append(
        button(
          "练习库 · 未分类 / 已分类",
          () => {
            stop();
            practiceHome = true;
            render();
          },
          practiceHome ? "selected" : "",
        ),
      );
    const pages = data.pages.filter((p) => (p.kind || "knowledge") === kind);
    for (const cat of [...new Set(pages.map((p) => p.category))]) {
      const group = el("details", { class: "nav-group" });
      const key = "nav:" + kind + ":" + cat;
      group.open = q ? true : viewState.get(key) !== false;
      group.ontoggle = () => viewState.set(key, group.open);
      group.append(el("summary", { text: cat }));
      for (const p of pages.filter((p) => p.category === cat)) {
        let matches = (p.title + cat).toLowerCase().includes(q);
        walk(p.blocks, (b) => {
          if ((blockTitle(b) + b.tags.join(" ")).toLowerCase().includes(q))
            matches = true;
        });
        if (!matches) continue;
        const chapter = el("details", { class: "nav-chapter" });
        chapter.open = p.id === current && !practiceHome;
        chapter.append(
          el("summary", {}, [
            button(
              p.title,
              () => {
                stop();
                current = p.id;
                practiceHome = false;
                render();
              },
              p.id === current && !practiceHome ? "selected" : "",
            ),
          ]),
        );
        function links(blocks, container) {
          for (const b of blocks) {
            const item = el("details", { class: "nav-block" });
            item.open = !b.collapsed;
            item.append(
              el("summary", {}, [button(blockTitle(b), () => locate(p, b))]),
            );
            links(b.children || [], item);
            container.append(item);
          }
        }
        links(p.blocks, chapter);
        group.append(chapter);
      }
      region.append(group);
    }
    region.append(
      button(
        kind === "knowledge" ? "＋ 新增知识页面" : "＋ 新增练习页面",
        () => {
          const title = prompt("页面标题");
          if (!title?.trim()) return;
          const p = {
            id: uid(),
            title: title.trim(),
            category: "未分类",
            kind,
            blocks: [],
          };
          data.pages.push(p);
          current = p.id;
          editing = true;
          practiceHome = false;
          redraw();
        },
      ),
    );
    navNode.append(region);
  }
};
function renderBlock(b, list, depth = 0) {
  repairBlock(b);
  const section = el("section", {
    class: "block nested-block",
    id: "block-" + b.id,
  });
  const head = el("div", { class: "module-heading" });
  const collapse = button(b.collapsed ? "›" : "⌄", () => {
    b.collapsed = !b.collapsed;
    changed();
    render();
  });
  collapse.setAttribute("aria-expanded", String(!b.collapsed));
  collapse.setAttribute("aria-label", "展开或折叠 " + blockTitle(b));
  head.append(collapse);
  if (editing)
    head.append(
      el("input", {
        value: blockTitle(b),
        "aria-label": "模块标题",
        oninput: (e) => {
          b.title = e.target.value;
          b.name = b.title;
          changed();
          nav();
        },
      }),
    );
  else
    head.append(button(blockTitle(b), () => collapse.click(), "heading-title"));
  const actions = el("div", { class: "module-actions" }, [
    button(b.needsPractice ? "✓ 需要练习" : "＋ 练习标签", () =>
      markPractice(b),
    ),
    button(b.review ? "✓ 待复习" : "加入待复习", () => {
      b.review = !b.review;
      changed();
      render();
    }),
  ]);
  if (editing)
    actions.append(
      button("＋ 细分模块", () => addTo(b.children, "group")),
      button("⋯", () => {
        const d = el("dialog", {}, [el("h2", { text: "模块操作" })]);
        const index = list.indexOf(b);
        for (const [label, fn] of [
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
              const c = clone(b);
              walk([c], (n) => (n.id = uid()));
              list.splice(index + 1, 0, c);
            },
          ],
          [
            "删除",
            () => {
              if (confirm("删除这个模块及其子模块？")) list.splice(index, 1);
            },
          ],
        ])
          d.append(
            button(label, () => {
              fn();
              d.close();
              redraw();
            }),
          );
        d.append(button("关闭", () => d.close()));
        d.onclose = () => d.remove();
        document.body.append(d);
        d.showModal();
      }),
    );
  head.append(actions);
  section.append(head);
  if (b.collapsed) return section;
  const tags = el("div", { class: "tags" });
  b.tags.forEach((t) => tags.append(el("span", { class: "pill", text: t })));
  if (editing)
    tags.append(
      button("＋ 标签", () => {
        const t = prompt("标签（逗号分隔）", b.tags.join(", "));
        if (t !== null) {
          b.tags = [
            ...new Set(
              t
                .split(/[,，]/)
                .map((x) => x.trim())
                .filter(Boolean),
            ),
          ];
          redraw();
        }
      }),
    );
  if (b.needsPractice)
    tags.append(
      button(
        "练习分类：" + (b.practiceTags.join("、") || "未分类"),
        () => classify(b),
        "practice-tag",
      ),
    );
  section.append(tags);
  const body = el("div", { class: "module-body " + b.type });
  if (b.type === "text")
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
  else if (b.type === "reference") {
    const found = allBlocks().find((x) => x.b.id === b.target);
    body.append(
      found
        ? button("定位对应知识：" + blockTitle(found.b), () =>
            locate(found.p, found.b),
          )
        : el("p", { text: "对应知识块已被删除。" }),
    );
  }
  section.append(body);
  if (b.children.length)
    section.append(
      el(
        "div",
        { class: "child-list" },
        b.children.map((c) => renderBlock(c, b.children, depth + 1)),
      ),
    );
  if (editing)
    section.append(
      el("div", { class: "module-footer" }, [
        button("＋ 内容块", () => contentMenu(b.children)),
        button("＋ 细分模块", () => addTo(b.children, "group")),
      ]),
    );
  return section;
}
render = function () {
  data.presets ||= [];
  data.pages.forEach((p) => {
    p.kind ||= "knowledge";
    p.blocks.forEach(repairBlock);
  });
  nav();
  $("title").replaceChildren();
  $("blocks").replaceChildren();
  document.body.classList.toggle(
    "practice-page",
    practiceHome || page().kind === "practice",
  );
  $("edit").hidden = practiceHome;
  $("add").hidden = practiceHome || !editing;
  $("deletePage").hidden = practiceHome || !editing;
  $("edit").textContent = editing ? "完成编辑" : "编辑页面";
  $("crumb").textContent =
    practiceHome || page().kind === "practice"
      ? "练习 · 音乐学习库"
      : "知识 · 音乐学习库";
  if (practiceHome) {
    $("title").textContent = "我的练习";
    $("meta").replaceChildren();
    renderPractice();
    return;
  }
  const p = page();
  const audioBlocks = [];
  walk(p.blocks, (b) => {
    if (["midi", "rhythm"].includes(b.type)) audioBlocks.push(b);
  });
  if (!audioBlocks.includes(activeBlock)) activeBlock = audioBlocks[0] || null;
  if (editing) {
    $("title").append(
      el("input", {
        value: p.title,
        "aria-label": "页面标题",
        oninput: (e) => {
          p.title = e.target.value;
          changed();
          nav();
        },
      }),
    );
    $("meta").replaceChildren(
      el("label", { text: "分类 " }, [
        el("input", {
          value: p.category,
          "aria-label": "分类",
          onchange: (e) => {
            p.category = e.target.value.trim() || "未分类";
            changed();
            nav();
          },
        }),
      ]),
    );
  } else {
    $("title").textContent = p.title;
    $("meta").replaceChildren(
      el("span", { class: "pill", text: p.category }),
      el("span", { class: "muted", text: p.blocks.length + " 个独立模块" }),
    );
  }
  p.blocks.forEach((b) => $("blocks").append(renderBlock(b, p.blocks)));
  if (!p.blocks.length)
    $("blocks").append(
      el("p", { class: "muted", text: "点击编辑页面，在顶部添加第一个模块。" }),
    );
};
function practiceCard(p, b) {
  const card = el("section", { class: "practice-card", draggable: "true" });
  card.ondragstart = (e) => e.dataTransfer.setData("text/plain", b.id);
  card.append(
    el("h3", { text: blockTitle(b) }),
    el("p", {
      class: "muted",
      text: p.title + " › " + b.practiceTags.join(" / "),
    }),
  );
  if (b.type === "midi") card.append(midiThumbnail(b));
  if (b.type === "text")
    card.append(el("p", { text: b.content.slice(0, 180) }));
  card.append(
    button("分类", () => classify(b)),
    button("定位知识 / 开始练习", () => locate(p, b)),
    button("练习完成", () => {
      b.needsPractice = false;
      redraw();
    }),
  );
  return card;
}
function renderPractice() {
  const entries = allBlocks().filter(
    (x) => x.b.needsPractice && x.p.kind !== "practice",
  );
  const cols = el("div", { class: "practice-columns" });
  const un = el("section", { class: "practice-column" }, [
    el("h2", { text: "未分类" }),
  ]);
  entries
    .filter((x) => !x.b.practiceTags.length)
    .forEach((x) => un.append(practiceCard(x.p, x.b)));
  const classified = el("section", { class: "practice-column" }, [
    el("h2", { text: "已分类" }),
  ]);
  data.practiceCategories ||= [];
  const tags = [
    ...new Set([
      ...data.practiceCategories,
      ...entries.flatMap((x) => x.b.practiceTags),
    ]),
  ];
  function drop(node, tag) {
    node.ondragover = (e) => {
      e.preventDefault();
      node.classList.add("drag-over");
    };
    node.ondragleave = () => node.classList.remove("drag-over");
    node.ondrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const found = entries.find(
        (x) => x.b.id === e.dataTransfer.getData("text/plain"),
      );
      if (found) {
        found.b.practiceTags = tag ? [tag] : [];
        redraw();
      }
    };
  }
  drop(un, "");
  // 路径分类用真正的折叠层级显示，不只是显示带斜线的文字。
  const folders = new Map();
  tags.forEach((tag) => {
    let container = classified,
      path = "";
    for (const part of tag
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean)) {
      path = path ? path + "/" + part : part;
      if (!folders.has(path)) {
        const group = el("details", { open: "" }, [
          el("summary", { text: part }),
        ]);
        folders.set(path, group);
        container.append(group);
        drop(group, path);
      }
      container = folders.get(path);
    }
    entries
      .filter((x) => x.b.practiceTags.includes(tag))
      .forEach((x) => container.append(practiceCard(x.p, x.b)));
  });
  classified.append(
    button("＋ 新建分类", () => {
      const tag = prompt("分类名，如：节奏/切分练习");
      if (!tag?.trim()) return;
      if (!data.practiceCategories.includes(tag.trim()))
        data.practiceCategories.push(tag.trim());
      redraw();
    }),
  );
  cols.append(un, classified);
  $("blocks").append(cols);
}
// 图片 10 MB、音频 50 MB。每次上传先持久保存，再更新笔记引用。
media = function (card, b) {
  if (editing) {
    const file = el("input", {
      type: "file",
      accept:
        b.type === "image"
          ? "image/png,image/jpeg,image/gif,image/webp"
          : "audio/*",
      hidden: "",
    });
    const limit = b.type === "image" ? 10 : 50;
    const drop = el("div", { class: "drop-zone" }, [
      button(
        "拖拽" +
          (b.type === "image" ? "图片" : "音频") +
          "到这里，或点击选择文件",
        () => file.click(),
      ),
      el("p", { class: "muted", text: "单个文件最大 " + limit + " MB" }),
      file,
    ]);
    async function load(f) {
      if (!f) return;
      if (f.size > limit * 1024 * 1024)
        return status("文件过大：单个文件最大 " + limit + " MB。");
      const imageOK = /image\/(png|jpeg|gif|webp)/.test(f.type);
      const audioOK =
        f.type.startsWith("audio/") ||
        /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(f.name);
      if (!(b.type === "image" ? imageOK : audioOK))
        return status("文件格式不支持。");
      try {
        const id = uid();
        const ext = f.name.split(".").pop().toLowerCase();
        const audioTypes = {
          mp3: "audio/mpeg",
          wav: "audio/wav",
          m4a: "audio/mp4",
          ogg: "audio/ogg",
          flac: "audio/flac",
          aac: "audio/aac",
        };
        const type = f.type.startsWith(b.type + "/")
          ? f.type
          : audioTypes[ext] || "application/octet-stream";
        await dbPut(id, new File([f], f.name, { type }));
        b.src = "asset:" + id;
        b.assetId = id;
        b.assetName = f.name;
        changed();
        render();
      } catch {
        status("素材保存失败，请检查浏览器存储空间。");
      }
    }
    file.onchange = (e) => load(e.target.files[0]);
    drop.ondragover = (e) => {
      e.preventDefault();
      drop.classList.add("drag-over");
    };
    drop.ondragleave = () => drop.classList.remove("drag-over");
    drop.ondrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      load(e.dataTransfer.files[0]);
    };
    card.append(
      drop,
      el("input", {
        value: b.src.startsWith("asset:") ? "" : b.src,
        placeholder: "也可粘贴图片或音频链接",
        "aria-label": "素材链接",
        onchange: (e) => {
          if (e.target.value && !safeURL(e.target.value, b.type))
            return status("链接无效。");
          b.src = e.target.value;
          redraw();
        },
      }),
    );
    if (b.src)
      card.append(
        button("移除素材", () => {
          b.src = "";
          redraw();
        }),
      );
  }
  if (b.src) {
    const node = el(
      b.type === "image" ? "img" : "audio",
      b.type === "image"
        ? { alt: blockTitle(b), class: "media" }
        : { controls: "", preload: "none" },
    );
    card.append(node);
    const localID = b.src.startsWith("asset:") ? b.src.slice(6) : b.assetId;
    if (localID)
      dbGet(localID)
        .then((blob) => {
          if (!blob) {
            if (!b.src.startsWith("asset:")) node.src = b.src;
            else
              node.replaceWith(
                el("p", { text: "此素材仅在原设备保存；请导入完整备份。" }),
              );
            return;
          }
          const url = URL.createObjectURL(blob);
          node.src = url;
          // 节点离开页面时释放 URL，不在媒体加载后立即释放。
          const observer = new MutationObserver(() => {
            if (!node.isConnected) {
              URL.revokeObjectURL(url);
              observer.disconnect();
            }
          });
          observer.observe($("blocks"), { childList: true, subtree: true });
        })
        .catch(() => status("无法读取本地素材。"));
    else node.src = b.src;
  }
};
// 共用八小节视窗。逻辑网格不压缩为小到无法点击的按钮。
function stateFor(b) {
  if (!viewState.has(b.id) || viewState.get(b.id) !== b.editorView) {
    b.editorView = {
      left: 0,
      start: 0,
      cursor: 0,
      origin: "bar",
      hand: false,
      followStart: true,
      loop: true,
      loopA: 0,
      loopB: b.bars * meterSteps(b),
      ...(b.editorView || {}),
    };
    viewState.set(b.id, b.editorView);
  }
  return viewState.get(b.id);
}
// 手型拖动默认以新窗口位置为起点；按选项对齐到小节头或网格。
function panStart(b, v) {
  if (!v.followStart) return;
  const s = v.left * meterSteps(b);
  v.start =
    v.origin === "bar"
      ? Math.floor(s / meterSteps(b)) * meterSteps(b)
      : Math.round(s / (b.snap || 1)) * (b.snap || 1);
  v.cursor = v.start;
}
function transportControls(card, b) {
  const v = stateFor(b);
  const controls = el("div", { class: "controls timeline-controls" });
  controls.append(button("▶ 播放", () => togglePlayback(b), "primary"));
  controls.firstChild.dataset.play = b.id;
  controls.append(
    numberControl("BPM", b.bpm, 20, 300, (n) => {
      stop();
      b.bpm = n;
      changed();
    }),
    choice(
      "拍号",
      b.meter,
      ["4/4", "3/4", "6/4", "6/8"].map((s) => [s, s]),
      (s) => {
        if (
          b.type === "midi" &&
          b.notes.length &&
          !confirm(
            "按新拍号重新划分小节，音符位置保留，必要时延长总长度。继续？",
          )
        )
          return render();
        b.meter = s;
        b.bars = Math.max(
          b.bars,
          Math.ceil(
            Math.max(
              1,
              ...(b.notes || []).map((n) => n.start + n.duration),
              ...Object.values(b.tracks || {}).map((t) => t.lastIndexOf(1) + 1),
            ) / meterSteps(b),
          ),
        );
        v.loopB = b.bars * meterSteps(b);
        redraw();
      },
    ),
    numberControl("总小节", b.bars, 1, 4096, (n) => {
      const end = n * meterSteps(b);
      const beyond =
        b.type === "midi"
          ? b.notes.some((x) => x.start + x.duration > end)
          : Object.values(b.tracks).some((t) => t.slice(end).some(Boolean));
      if (beyond && !confirm("缩短将删除超出结尾的内容，继续？"))
        return render();
      b.bars = n;
      if (b.type === "midi")
        b.notes = b.notes
          .filter((x) => x.start < end)
          .map((x) => ({
            ...x,
            duration: Math.min(x.duration, end - x.start),
          }));
      else
        Object.keys(b.tracks).forEach(
          (k) => (b.tracks[k] = b.tracks[k].slice(0, end)),
        );
      v.left = clamp(v.left, 0, Math.max(0, n - 8));
      v.loopB = end;
      redraw();
    }),
  );
  controls.append(
    button(v.hand ? "✋ 手型：开启" : "✋ 手型：关闭", () => {
      stop();
      v.hand = !v.hand;
      changed();
      render();
    }),
    choice(
      "起点",
      v.origin,
      [
        ["bar", "对齐小节头"],
        ["pointer", "鼠标位置"],
      ],
      (s) => {
        v.origin = s;
        changed();
      },
    ),
  );
  const follow = el("input", { type: "checkbox" });
  follow.checked = v.followStart;
  follow.onchange = () => {
    v.followStart = follow.checked;
    changed();
  };
  controls.append(
    el("label", { class: "inline-check", text: "起点跟随拖动 " }, [follow]),
  );
  controls.append(
    button(v.loop ? "循环：开" : "循环：关", () => {
      stop();
      v.loop = !v.loop;
      changed();
      render();
    }),
  );
  if (b.type === "midi")
    controls.append(
      numberControl(
        "循环起小节",
        Math.floor(v.loopA / meterSteps(b)) + 1,
        1,
        b.bars,
        (n) => {
          stop();
          v.loopA = (n - 1) * meterSteps(b);
          if (v.loopB <= v.loopA) v.loopB = v.loopA + meterSteps(b);
          v.cursor = v.loopA;
          changed();
        },
      ),
      numberControl(
        "循环止小节",
        Math.ceil(v.loopB / meterSteps(b)),
        1,
        b.bars,
        (n) => {
          stop();
          v.loopB = Math.max(v.loopA + 1, n * meterSteps(b));
          changed();
        },
      ),
    );
  card.append(controls);
  function jump(left) {
    stop();
    v.left = left;
    panStart(b, v);
    changed();
    render();
  }
  const pager = el("div", { class: "viewport-controls" }, [
    button("‹ 前八小节", () => jump(Math.max(0, v.left - 8))),
    numberControl(
      "窗口起小节",
      Math.floor(v.left) + 1,
      1,
      Math.max(1, b.bars - 7),
      (n) => jump(n - 1),
    ),
    button("后八小节 ›", () =>
      jump(Math.min(Math.max(0, b.bars - 8), v.left + 8)),
    ),
    el("span", {
      class: "muted",
      text: "可见 8 小节 · 共 " + b.bars + " 小节",
    }),
  ]);
  card.append(pager);
}
function drumSound(kind, when, bus) {
  const gain = ctx.createGain();
  gain.connect(bus);
  if (/kick|tom/.test(kind)) {
    const o = ctx.createOscillator();
    o.connect(gain);
    const freq = {
      kick: 130,
      kickSoft: 100,
      tomHigh: 260,
      tomMid: 180,
      tomLow: 110,
    }[kind];
    o.frequency.setValueAtTime(freq, when);
    o.frequency.exponentialRampToValueAtTime(freq / 3, when + 0.16);
    gain.gain.setValueAtTime(0.4, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
    o.start(when);
    o.stop(when + 0.31);
  } else if (["rim", "cross", "bell", "ride"].includes(kind)) {
    [1, 1.48, 2.1].forEach((r) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = (kind === "rim" || kind === "cross" ? 800 : 1800) * r;
      o.connect(gain);
      o.start(when);
      o.stop(when + 0.22);
    });
    gain.gain.setValueAtTime(0.08, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
  } else {
    const len = { snare: 0.18, openhat: 0.35, crash: 0.8 }[kind] || 0.07;
    const buf = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * len),
      ctx.sampleRate,
    );
    const a = buf.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = kind === "snare" ? 1200 : 6500;
    src.connect(f);
    f.connect(gain);
    gain.gain.setValueAtTime(kind === "snare" ? 0.28 : 0.1, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + len);
    src.start(when);
  }
}
function pausePlayback() {
  if (!transport) return;
  const t = transport;
  const v = stateFor(t.block);
  const elapsed = Math.max(0, ctx.currentTime - t.started) / t.seconds;
  const end = t.end;
  v.cursor = v.loop
    ? t.lo + ((t.from - t.lo + elapsed) % (end - t.lo))
    : Math.min(end - 0.001, t.from + elapsed);
  clearInterval(t.timer);
  cancelAnimationFrame(t.raf);
  t.bus.disconnect();
  transport = null;
  if (t.block.type === "rhythm") drawDrumPlayhead(t.block, v.cursor);
  document
    .querySelectorAll("[data-play]")
    .forEach((e) => (e.textContent = "▶ 继续"));
}
stop = function () {
  pausePlayback();
  document
    .querySelectorAll("[data-play]")
    .forEach((e) => (e.textContent = "▶ 播放"));
};
async function togglePlayback(b) {
  activeBlock = b;
  if (transport?.id === b.id) {
    pausePlayback();
    return;
  }
  stop();
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    const v = stateFor(b);
    const total = b.bars * meterSteps(b);
    const lo = v.loop ? clamp(v.loopA, 0, total - 1) : 0;
    const end = v.loop ? clamp(v.loopB, lo + 1, total) : total;
    const from = clamp(v.cursor ?? v.start, lo, end - 0.001);
    const bus = ctx.createGain();
    bus.connect(ctx.destination);
    const tr = {
      id: b.id,
      block: b,
      bus,
      from,
      lo,
      end,
      seconds: 60 / b.bpm / 4,
      started: ctx.currentTime + 0.05,
      timer: null,
      raf: null,
    };
    transport = tr;
    const play = document.querySelector('[data-play="' + b.id + '"]');
    if (play) play.textContent = "Ⅱ 暂停";
    let nextStep = Math.floor(from);
    let nextTime = tr.started + (nextStep - from) * tr.seconds;
    if (b.type !== "midi" && nextTime < tr.started) {
      nextStep++;
      nextTime += tr.seconds;
    }
    if (b.type === "midi") {
      // 从暂停位置继续时，恢复跨越起点的长音。
      for (const n of b.notes)
        if (!(b.mutedPitches || []).includes(n.pitch) && n.start < from && n.start + n.duration > from)
          midiSound(
            n,
            tr.started,
            Math.min(n.start + n.duration, end) * tr.seconds -
              from * tr.seconds,
            bus,
          );
    }
    function schedule() {
      while (transport === tr && nextTime < ctx.currentTime + 0.12) {
        if (nextStep >= end) {
          if (!v.loop) return;
          nextStep = lo;
        }
        if (b.type === "midi") {
          for (const n of b.notes) {
            const at = nextTime + (n.start - nextStep) * tr.seconds;
            if (
              !(b.mutedPitches || []).includes(n.pitch) &&
              n.start >= nextStep &&
              n.start < nextStep + 1 &&
              n.start < end &&
              at >= tr.started - 0.0001
            )
              midiSound(
                n,
                at,
                Math.min(n.duration, end - n.start) * tr.seconds,
                bus,
              );
          }
        } else {
          const swingDelay =
            nextStep % 2 ? (((b.swing || 50) - 50) / 100) * 2 * tr.seconds : 0;
          for (const [k, values] of Object.entries(b.tracks))
            if (
              values[nextStep] &&
              b.visible.includes(k) &&
              !b.muted.includes(k)
            )
              drumSound(k, nextTime + swingDelay, bus);
        }
        nextStep++;
        nextTime += tr.seconds;
      }
    }
    function draw() {
      if (transport !== tr) return;
      let position =
        from + Math.max(0, ctx.currentTime - tr.started) / tr.seconds;
      if (position >= end) {
        if (!v.loop) {
          stop();
          v.cursor = v.start;
          return;
        }
        position = lo + ((position - lo) % (end - lo));
      }
      v.cursor = position;
      if (b.type === "rhythm") drawDrumPlayhead(b, position);
      const canvas = document.querySelector(
        '[data-midi-canvas="' + b.id + '"]',
      );
      if (canvas?.paint) canvas.paint();
      tr.raf = requestAnimationFrame(draw);
    }
    schedule();
    tr.timer = setInterval(schedule, 25);
    draw();
  } catch (e) {
    status("播放失败：" + e.message);
  }
}
start = togglePlayback;
function drumParts(b) {
  const d = el("dialog", {}, [
    el("h2", { text: "管理鼓部件" }),
    el("p", {
      class: "muted",
      text: "隐藏保留鼓点；静音控制是否发声。音色为浏览器合成。",
    }),
  ]);
  for (const [key, name] of Object.entries(DRUMS)) {
    const show = el("input", {
      type: "checkbox",
      "aria-label": "显示 " + name,
    });
    show.checked = b.visible.includes(key);
    show.onchange = () => {
      if (show.checked) {
        if (!b.tracks[key])
          b.tracks[key] = Array(b.bars * meterSteps(b)).fill(0);
        b.visible.push(key);
      } else b.visible = b.visible.filter((x) => x !== key);
      changed();
    };
    const mute = el("input", {
      type: "checkbox",
      "aria-label": "静音 " + name,
    });
    mute.checked = b.muted.includes(key);
    mute.onchange = () => {
      b.muted = mute.checked
        ? [...b.muted, key]
        : b.muted.filter((x) => x !== key);
      changed();
    };
    d.append(
      el("div", { class: "part-row" }, [
        el("span", { text: name }),
        el("label", { text: "显示 " }, [show]),
        el("label", { text: "静音 " }, [mute]),
      ]),
    );
  }
  d.append(
    button(
      "完成",
      () => {
        d.close();
        render();
      },
      "primary",
    ),
  );
  d.onclose = () => d.remove();
  document.body.append(d);
  d.showModal();
}
rhythm = function (card, b) {
  repairBlock(b);
  const v = stateFor(b);
  const steps = meterSteps(b);
  const first = Math.floor(v.left * steps);
  const length = steps * 8;
  card.onpointerdown = () => (activeBlock = b);
  transportControls(card, b);
  card.append(button("管理鼓部件", () => drumParts(b)));
  if (editing)
    card.append(
      numberControl("Swing %", b.swing, 50, 70, (n) => {
        b.swing = n;
        changed();
      }),
    );
  const scroll = el("div", { class: "drum-scroll" });
  const grid = el("div", {
    class: "drum-grid",
    style: "grid-template-columns:95px repeat(" + length + ", minmax(3px,1fr))",
  });
  grid.append(el("span"));
  for (let bar = 0; bar < 8; bar++)
    grid.append(
      el("span", {
        class: "measure-label",
        text: Math.floor(v.left) + bar + 1,
        style: "grid-column:span " + steps,
      }),
    );
  grid.append(el("span", { text: "拍点", class: "track" }));
  for (let i = 0; i < length; i++) {
    const s = first + i;
    const beatUnit = b.meter === "6/8" ? 2 : 4;
    const mark =
      s % beatUnit === 0
        ? String(Math.floor((s % steps) / beatUnit) + 1)
        : beatUnit === 4
          ? ["", "e", "&", "a"][s % 4]
          : "&";
    const groupAccent = b.meter === "6/8" && (s % steps) % 6 === 0;
    grid.append(
      button(
        mark,
        () => {
          stop();
          v.start = v.origin === "bar" ? Math.floor(s / steps) * steps : s;
          v.cursor = v.start;
          changed();
          status("起点已设为第 " + (Math.floor(v.start / steps) + 1) + " 小节");
        },
        "beat-label " +
          (s % beatUnit === 0 ? "strong" : mark === "&" ? "and" : "") +
          (groupAccent ? " group-accent" : ""),
      ),
    );
  }
  b.visible.forEach((k) => {
    grid.append(
      el("span", {
        class: "track",
        text: DRUMS[k] + (b.muted.includes(k) ? " 🔇" : ""),
      }),
    );
    for (let i = 0; i < length; i++) {
      const s = first + i;
      const cell = button(
        "",
        () => {
          if (v.hand) return;
          if (!editing) return status("进入编辑页面后可以修改鼓点。");
          if (s >= b.bars * steps) {
            b.bars = Math.floor(s / steps) + 1;
            v.loopB = b.bars * steps;
          }
          while (b.tracks[k].length <= s) b.tracks[k].push(0);
          b.tracks[k][s] = b.tracks[k][s] ? 0 : 1;
          cell.classList.toggle("on", !!b.tracks[k][s]);
          cell.setAttribute("aria-pressed", String(!!b.tracks[k][s]));
          changed();
        },
        "step " +
          k +
          (b.tracks[k][s] ? " on" : "") +
          (s % steps === 0 ? "bar-start" : ""),
      );
      cell.dataset.drum = b.id;
      cell.dataset.step = s;
      cell.setAttribute("aria-label", DRUMS[k] + " 第 " + (s + 1) + " 格");
      cell.setAttribute("aria-pressed", String(!!b.tracks[k][s]));
      grid.append(cell);
    }
  });
  let drag = null;
  scroll.onpointerdown = (e) => {
    if (!v.hand) return;
    stop();
    e.preventDefault();
    scroll.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, left: v.left };
  };
  scroll.onpointermove = (e) => {
    if (!drag) return;
    const delta = ((e.clientX - drag.x) / Math.max(1, scroll.clientWidth)) * 8;
    v.left = clamp(drag.left - delta, 0, Math.max(0, b.bars - 8));
  };
  scroll.onpointerup = () => {
    if (drag) {
      panStart(b, v);
      drag = null;
      changed();
      render();
    }
  };
  scroll.onpointercancel = () => {
    drag = null;
    render();
  };
  scroll.classList.toggle("hand", v.hand);
  scroll.append(grid);
  card.append(scroll);
  card.append(
    el("p", {
      class: "hint",
      text: "每次显示八小节；可继续延长。空格播放 / 暂停。点击拍点设起点，手型拖动浏览。",
    }),
  );
};
document.addEventListener("keydown", (e) => {
  if (
    e.code !== "Space" ||
    /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
    e.target.isContentEditable ||
    document.querySelector("dialog[open]")
  )
    return;
  if (practiceHome) return;
  if (!activeBlock)
    walk(page().blocks, (b) => {
      if (!activeBlock && ["rhythm", "midi"].includes(b.type)) activeBlock = b;
    });
  if (activeBlock) {
    e.preventDefault();
    togglePlayback(activeBlock);
  }
});
// 顶部添加区，包括外层知识点容器。
$("add").prepend(button("＋ 知识点模块", () => addTo(page().blocks, "group")));
document
  .querySelectorAll("[data-add]")
  .forEach(
    (btn) => (btn.onclick = () => addTo(page().blocks, btn.dataset.add)),
  );
$("newPage").hidden = true;
document.querySelector("header .actions").prepend(
  button("待复习库", () => {
    const d = el("dialog", {}, [el("h2", { text: "待复习库" })]);
    const found = allBlocks().filter((x) => x.b.review);
    if (!found.length)
      d.append(el("p", { text: "在知识块上点击加入待复习。" }));
    found.forEach((x) =>
      d.append(
        button(x.p.title + " › " + blockTitle(x.b), () => {
          d.close();
          locate(x.p, x.b);
        }),
      ),
    );
    d.append(button("关闭", () => d.close()));
    d.onclose = () => d.remove();
    document.body.append(d);
    d.showModal();
  }),
);

// 完整备份包含本地媒体；导入到另一设备时重新写入 IndexedDB。
function blobDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
download = async function () {
  try {
    const backup = clone(data);
    backup.assets = {};
    const ids = [
      ...new Set(
        allBlocks()
          .filter(
            (x) => x.b.src && (x.b.src.startsWith("asset:") || x.b.assetId),
          )
          .map((x) =>
            x.b.src.startsWith("asset:") ? x.b.src.slice(6) : x.b.assetId,
          ),
      ),
    ];
    for (const id of ids) {
      const blob = await dbGet(id);
      if (!blob) {
        if (allBlocks().some((x) => x.b.src === "asset:" + id))
          throw Error("素材缺失，请先在原设备重新添加。");
        continue;
      }
      backup.assets[id] = {
        name: blob.name || "media",
        data: await blobDataURL(blob),
      };
      // 即使曾同步到 GitHub，完整备份也携带原设备上的本地文件。
      backup.pages.forEach((p) =>
        walk(p.blocks, (b) => {
          if (b.assetId === id) b.src = "asset:" + id;
        }),
      );
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    );
    el("a", { href: url, download: "Music_Notebook_Backup.json" }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("已导出完整备份（包含本地图片和音频）。");
  } catch (e) {
    status("备份失败：" + e.message);
  }
};
$("export").onclick = download;
$("importFile").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (f.size > 200 * 1024 * 1024) throw Error("备份最大 200 MB。");
    const raw = JSON.parse(await f.text());
    const next = validate(raw);
    if (!confirm("导入将替换本机全部笔记，请先导出备份。继续？")) return;
    for (const [id, asset] of Object.entries(raw.assets || {})) {
      if (
        !/^[a-zA-Z0-9-]+$/.test(id) ||
        typeof asset.data !== "string" ||
        !/^data:(image|audio)\/[a-z0-9.+-]+;base64,/i.test(asset.data)
      )
        throw Error("备份素材格式无效。");
      const response = await fetch(asset.data);
      const blob = await response.blob();
      if (blob.size > 50 * 1024 * 1024) throw Error("单个备份素材过大。");
      await dbPut(
        id,
        new File([blob], asset.name || "media", { type: blob.type }),
      );
    }
    delete next.assets;
    stop();
    data = next;
    current = data.pages[0].id;
    practiceHome = false;
    changed();
    render();
  } catch (err) {
    status("导入失败：" + err.message);
  }
  e.target.value = "";
};
const oldCache = cache;
cache = function () {
  const ok = oldCache();
  dbPut(STORE, clone({ data, bases, dirty })).catch(() =>
    status("本机保存失败。"),
  );
  return ok;
};

// 保存 GitHub 时先上传本地媒体到 assets/，再提交引用它们的 content.json。
// 媒体名使用随机编号，避免覆盖用户已有文件；令牌只发送到 GitHub API。
const oldPush = $("push").onclick;
$("push").onclick = async function () {
  const assets = allBlocks().filter((x) => x.b.src?.startsWith("asset:"));
  if (!assets.length) return oldPush();
  if (busy) return;
  busy = true;
  document.querySelector("main").inert = document.querySelector("aside").inert =
    true;
  $("push").disabled = $("pull").disabled = true;
  try {
    const c = getConfig();
    if (!$("token").value.trim()) throw Error("请先输入仓库授权令牌。");
    const latest = await remote(c);
    const base = bases[key(c)];
    if (!base || base !== latest.sha)
      throw Error(
        "先读取 GitHub 建立同步版本，再导入本机备份并保存，避免覆盖其他设备内容。",
      );
    const paths = new Map();
    for (const { b } of assets) {
      const id = b.src.slice(6);
      if (paths.has(id)) continue;
      const blob = await dbGet(id);
      if (!blob) throw Error("素材不存在：" + blockTitle(b));
      const extension =
        (b.assetName || blob.name || "").match(/\.[a-z0-9]{1,5}$/i)?.[0] ||
        (b.type === "image" ? ".png" : ".mp3");
      const path = "assets/" + id + extension;
      const api =
        "https://api.github.com/repos/" +
        encodeURIComponent(c.owner) +
        "/" +
        encodeURIComponent(c.repo) +
        "/contents/" +
        path;
      $("syncStatus").textContent =
        "上传素材：" + (b.assetName || blockTitle(b));
      const exists = await fetch(api + "?ref=" + encodeURIComponent(c.branch), {
        headers: headers(),
      });
      if (exists.status === 404) {
        const encoded = (await blobDataURL(blob)).split(",")[1];
        const r = await fetch(api, {
          method: "PUT",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Add notebook media",
            branch: c.branch,
            content: encoded,
          }),
        });
        if (!r.ok)
          throw Error("素材上传失败（" + r.status + "），本地文件仍保留。");
      } else if (!exists.ok)
        throw Error("无法检查素材（" + exists.status + "）。");
      paths.set(id, "./" + path);
    }
    assets.forEach(({ b }) => {
      b.src = paths.get(b.src.slice(6));
    });
    changed();
    render();
  } catch (e) {
    $("syncStatus").textContent = e.message;
    busy = false;
    document.querySelector("main").inert = document.querySelector(
      "aside",
    ).inert = false;
    $("push").disabled = $("pull").disabled = false;
    return;
  }
  busy = false;
  document.querySelector("main").inert = document.querySelector("aside").inert =
    false;
  $("push").disabled = $("pull").disabled = false;
  return oldPush();
};
