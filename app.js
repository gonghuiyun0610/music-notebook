/**
 * 音乐学习库主程序。
 * 负责：页面导航、文字与鼓模块、浏览器保存、备份、GitHub 同步。
 * MIDI 网格与导出逻辑在 midi.js；两者使用同一份知识页数据。
 */
"use strict";
const $ = (id) => document.getElementById(id),
  uid = () => crypto.randomUUID(),
  clone = (x) => JSON.parse(JSON.stringify(x));
const STORE = "music-notebook-v1:" + location.pathname,
  CONFIG = STORE + ":github";
let data,
  current,
  editing = false,
  dirty = false,
  ctx,
  transport = null,
  busy = false;
let settings = {},
  bases = {};
const defaults = {
  version: 1,
  pages: [
    {
      id: "welcome",
      title: "十六分音符 · 看见节奏",
      category: "节奏",
      blocks: [
        {
          id: "intro",
          type: "text",
          content:
            "节奏从这里开始\n\n在 4/4 拍里，把每一拍分成四格，就得到一小节的 16 格。上方的 1 e & a 对应第一拍的四个位置。\n\n先听这个基础节奏，再进入编辑模式，试着移动底鼓。文字与节奏是两个独立模块，你可以随时添加、排序和删除。",
        },
        {
          id: "demo",
          type: "rhythm",
          name: "基础 Pop Groove",
          bpm: 90,
          swing: 50,
          tracks: {
            kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
            snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
          },
        },
        {
          id: "note",
          type: "text",
          content:
            "我的练习\n\n① 以 70 BPM 聆听，数出四个大拍。\n② 把底鼓移动一格，听听推动感怎样变化。\n③ 把 Swing 从 50% 调到 60%，比较直拍与摇摆。\n\n保存到本机：仅在当前浏览器保存。\nGitHub 同步：配置后，将全部知识页保存到仓库。",
        },
      ],
    },
    {
      id: "harmony",
      title: "和声 · 我的学习笔记",
      category: "和声",
      blocks: [
        {
          id: "harmony-note",
          type: "text",
          content:
            "在这里记录你学过的和弦、进行与听感。\n\n点击「编辑页面」即可改写。可以为每个知识点新建页面，再独立插入文字、节奏、图片或音频。",
        },
      ],
    },
  ],
};
// 校验整个知识库。保存、导入、读取 GitHub 时共用，防止错误数据进入编辑器。
function validate(x) {
  if (
    !x ||
    x.version !== 1 ||
    !Array.isArray(x.pages) ||
    !x.pages.length ||
    x.pages.length > 500
  )
    throw Error("备份格式不正确（需要 version:1 和 pages）。");
  const ids = new Set();
  for (const p of x.pages) {
    if (
      typeof p.id !== "string" ||
      ids.has(p.id) ||
      typeof p.title !== "string" ||
      typeof p.category !== "string" ||
      !Array.isArray(p.blocks)
    )
      throw Error("知识页格式不正确。");
    ids.add(p.id);
    const bids = new Set();
    for (const b of p.blocks) {
      if (b?.type === "midi") midiRepairLegacyBlock(b);
      if (typeof b.id !== "string" || bids.has(b.id))
        throw Error("模块编号重复或缺失。");
      bids.add(b.id);
      if (!["text", "rhythm", "midi", "image", "audio"].includes(b.type))
        throw Error("未知模块类型。");
      if (b.type === "midi") midiValidate(b);
      if (b.type === "text" && typeof b.content !== "string")
        throw Error("文字格式不正确。");
      if (b.type === "rhythm") {
        if (
          typeof b.name !== "string" ||
          !Number.isFinite(b.bpm) ||
          b.bpm < 40 ||
          b.bpm > 220 ||
          !Number.isFinite(b.swing) ||
          b.swing < 50 ||
          b.swing > 70
        )
          throw Error("节奏速度或 Swing 格式不正确。");
        for (const t of ["kick", "snare", "hihat"])
          if (
            !Array.isArray(b.tracks?.[t]) ||
            b.tracks[t].length !== 16 ||
            b.tracks[t].some((v) => v !== 0 && v !== 1)
          )
            throw Error("节奏需要每轨 16 个 0/1。");
      }
      if (
        ["image", "audio"].includes(b.type) &&
        (typeof b.src !== "string" ||
          typeof b.caption !== "string" ||
          (b.src && !safeURL(b.src, b.type)))
      )
        throw Error("图片或音频地址不正确。");
    }
  }
  return x;
}
// 只允许网页资源链接和受支持的图片／音频 Data URL，拒绝脚本地址。
function safeURL(s, type) {
  try {
    const u = new URL(s, location.href);
    return (
      ["https:", "http:"].includes(u.protocol) ||
      (type === "image"
        ? /^data:image\/(png|jpeg|gif|webp);base64,/
        : /^data:audio\/[a-z0-9.+-]+;base64,/i
      ).test(s)
    );
  } catch {
    return false;
  }
}
// 创建 DOM 节点。文字使用 textContent，不把笔记作为 HTML 执行。
function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else n.setAttribute(k, v);
  }
  for (const c of children) n.append(c);
  return n;
}
// 取出当前知识页。
function page() {
  return data.pages.find((p) => p.id === current) || data.pages[0];
}
// 在页面底部显示保存状态或错误提示。
function status(s) {
  $("status").textContent = s;
}
// 编辑后自动保存本机草稿；GitHub 提交需由用户单独点击。
function changed() {
  dirty = true;
  try {
    localStorage.setItem(STORE, JSON.stringify({ data, bases, dirty }));
    status("已自动保存到本机 · 尚未保存到 GitHub");
  } catch {
    status("本机存储空间不足，请导出备份或保存到 GitHub。");
  }
}
// 只保存当前数据与同步版本，不修改 GitHub。
function cache() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ data, bases, dirty }));
    return true;
  } catch {
    status("本机存储失败，请导出备份。");
    return false;
  }
}
// 根据分类和搜索词生成左侧目录。
function nav() {
  const q = $("search").value.toLowerCase();
  $("nav").replaceChildren();
  for (const cat of [...new Set(data.pages.map((p) => p.category))]) {
    const ps = data.pages.filter(
      (p) =>
        p.category === cat && (p.title + " " + cat).toLowerCase().includes(q),
    );
    if (!ps.length) continue;
    $("nav").append(el("h3", { text: cat }));
    ps.forEach((p) =>
      $("nav").append(
        el("button", {
          text: p.title,
          class: p.id === current ? "selected" : "",
          onclick: () => {
            stop();
            current = p.id;
            render();
          },
        }),
      ),
    );
  }
}
// 所有模块共用的排序、复制和删除工具。
function tools(b, i) {
  return el(
    "div",
    { class: "block-tools" },
    [
      ["↑", () => move(i, -1)],
      ["↓", () => move(i, 1)],
      [
        "复制",
        () => {
          stop();
          const c = clone(b);
          c.id = uid();
          page().blocks.splice(i + 1, 0, c);
          changed();
          render();
        },
      ],
      [
        "删除",
        () => {
          if (confirm("删除这个模块？")) {
            stop();
            page().blocks.splice(i, 1);
            changed();
            render();
          }
        },
      ],
    ].map(([text, fn]) =>
      el("button", { text, onclick: fn, "aria-label": text + "模块" }),
    ),
  );
}
// 移动模块时先停止播放，再保存新的排列。
function move(i, d) {
  const a = page().blocks,
    j = i + d;
  if (j < 0 || j >= a.length) return;
  stop();
  [a[i], a[j]] = [a[j], a[i]];
  changed();
  render();
}
// 模块显示入口。MIDI 必须进入 midiRender，不能落入素材模块 media。
function render() {
  nav();
  $("title").replaceChildren();
  if (editing) {
    const input = el("input", {
      value: page().title,
      "aria-label": "页面标题",
      oninput: (e) => {
        page().title = e.target.value;
        changed();
        nav();
      },
    });
    $("title").append(input);
    $("meta").replaceChildren(
      el("span", { text: "分类" }),
      el("input", {
        value: page().category,
        "aria-label": "分类",
        onchange: (e) => {
          page().category = e.target.value.trim() || "未分类";
          changed();
          nav();
        },
      }),
    );
  } else {
    $("title").textContent = page().title;
    $("meta").replaceChildren(
      el("span", { class: "pill", text: page().category }),
      el("span", {
        class: "muted",
        text: page().blocks.length + " 个独立模块",
      }),
    );
  }
  $("edit").textContent = editing ? "完成编辑" : "编辑页面";
  $("add").hidden = !editing;
  $("deletePage").hidden = !editing;
  $("blocks").replaceChildren();
  page().blocks.forEach((b, i) => {
    const card = el("section", { class: "block " + b.type });
    if (editing) card.append(tools(b, i));
    if (b.type === "text") {
      card.append(
        editing
          ? el(
              "textarea",
              {
                "aria-label": "文字模块",
                oninput: (e) => {
                  b.content = e.target.value;
                  changed();
                },
              },
              [document.createTextNode(b.content)],
            )
          : el("div", { text: b.content }),
      );
    } else if (b.type === "rhythm") rhythm(card, b);
    else if (b.type === "midi") midiRender(card, b);
    else media(card, b);
    $("blocks").append(card);
  });
}
// 鼓节奏模块：三轨、16 格、BPM 与 Swing 控件。
function rhythm(card, b) {
  const heading = editing
    ? el("input", {
        value: b.name,
        "aria-label": "节奏名称",
        oninput: (e) => {
          b.name = e.target.value;
          changed();
        },
      })
    : el("h2", { text: b.name });
  card.append(
    el("div", { class: "block-head" }, [
      heading,
      el("span", { class: "pill", text: "4/4 · 16 STEPS" }),
    ]),
  );
  const grid = el("div", { class: "grid" });
  grid.append(el("span", {}));
  for (let n = 0; n < 16; n++)
    grid.append(
      el("span", {
        class: "count",
        text: n % 4 === 0 ? String(n / 4 + 1) : ["", "e", "&", "a"][n % 4],
        "data-step": n,
        "data-rhythm": b.id,
      }),
    );
  for (const t of ["kick", "snare", "hihat"]) {
    grid.append(
      el("span", {
        class: "track",
        text: { kick: "Kick", snare: "Snare", hihat: "Hi-Hat" }[t],
      }),
    );
    b.tracks[t].forEach((v, n) => {
      const btn = el("button", {
        class: "step " + t + (v ? " on" : "") + (n % 4 === 0 ? " beat" : ""),
        "data-step": n,
        "data-rhythm": b.id,
        "aria-label": t + " 第" + (n + 1) + "格",
        "aria-pressed": String(!!v),
        onclick: () => {
          if (!editing) {
            status("点击「编辑页面」后可修改节奏。");
            return;
          }
          b.tracks[t][n] = 1 - b.tracks[t][n];
          btn.classList.toggle("on", !!b.tracks[t][n]);
          btn.setAttribute("aria-pressed", String(!!b.tracks[t][n]));
          changed();
        },
      });
      grid.append(btn);
    });
  }
  card.append(el("div", { class: "grid-wrap" }, [grid]));
  const play = el("button", {
    text: "▶ 播放",
    class: "primary",
    "data-play": b.id,
    onclick: async () => {
      if (transport?.id === b.id) {
        stop();
        return;
      }
      try {
        await start(b);
        play.textContent = "■ 停止";
      } catch {
        status("无法启动音频，请使用支持 Web Audio 的浏览器。");
      }
    },
  });
  const bpm = el("input", {
    type: "number",
    min: 40,
    max: 220,
    value: b.bpm,
    "aria-label": "BPM",
    onchange: (e) => {
      b.bpm = Math.min(220, Math.max(40, Number(e.target.value) || 90));
      e.target.value = b.bpm;
      changed();
    },
  });
  const swingValue = el("span", { text: b.swing + "%" });
  const swing = el("input", {
    type: "range",
    min: 50,
    max: 70,
    value: b.swing,
    "aria-label": "Swing",
    oninput: (e) => {
      b.swing = Number(e.target.value);
      swingValue.textContent = b.swing + "%";
      changed();
    },
  });
  card.append(
    el("div", { class: "controls" }, [
      play,
      el("label", { text: "BPM " }, [bpm]),
      el("label", { text: "Swing " }, [swing, swingValue]),
    ]),
  );
  card.append(
    el("div", {
      class: "hint",
      text: "底鼓 / 军鼓 / 闭合踩镲 · 合成鼓音色 · 50% 为直拍；60% 为 60:40 的长短比例。",
    }),
  );
}
// 图片和音频模块：支持资源链接或小文件内嵌。
function media(card, b) {
  if (editing) {
    const fields = el("div", { class: "media-fields" });
    fields.append(
      el("input", {
        value: b.caption,
        placeholder: "说明文字",
        "aria-label": "素材说明",
        oninput: (e) => {
          b.caption = e.target.value;
          changed();
        },
      }),
      el("input", {
        value: b.src,
        placeholder: "粘贴 https 链接，或选择小文件",
        "aria-label": "素材链接",
        onchange: (e) => {
          if (e.target.value && !safeURL(e.target.value, b.type)) {
            status("请使用有效的图片或音频地址。");
            e.target.value = b.src;
            return;
          }
          b.src = e.target.value;
          changed();
          render();
        },
      }),
    );
    fields.append(
      el("input", {
        type: "file",
        accept:
          b.type === "image"
            ? "image/png,image/jpeg,image/gif,image/webp"
            : "audio/*",
        "aria-label": "上传" + b.type,
        onchange: (e) => {
          const f = e.target.files[0];
          if (!f) return;
          if (f.size > 300000) {
            status("单个素材限 300 KB，大音频请使用外部链接。");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            if (!safeURL(reader.result, b.type)) {
              status("不支持此格式，请换成 PNG/JPG 或 MP3/WAV。");
              return;
            }
            b.src = reader.result;
            changed();
            render();
          };
          reader.readAsDataURL(f);
        },
      }),
    );
    card.append(fields);
  }
  if (b.src && safeURL(b.src, b.type))
    card.append(
      b.type === "image"
        ? el("img", {
            src: b.src,
            alt: b.caption,
            class: "media",
            loading: "lazy",
          })
        : el("audio", { src: b.src, controls: "", preload: "none" }),
    );
  else if (!editing)
    card.append(el("p", { class: "muted", text: "尚未添加素材" }));
  if (b.caption && !editing) card.append(el("p", { text: b.caption }));
}
// 用 Web Audio 合成鼓声，不依赖外部采样或音频服务器。
function sound(kind, time) {
  const g = ctx.createGain();
  g.connect(transport.bus);
  if (kind === "kick") {
    const o = ctx.createOscillator();
    o.connect(g);
    o.frequency.setValueAtTime(145, time);
    o.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    g.gain.setValueAtTime(0.65, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    o.start(time);
    o.stop(time + 0.26);
  } else {
    const len = kind === "snare" ? 0.16 : 0.045,
      buf = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * len),
        ctx.sampleRate,
      ),
      a = buf.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter();
    s.buffer = buf;
    filter.type = "highpass";
    filter.frequency.value = kind === "snare" ? 1100 : 7500;
    s.connect(filter);
    filter.connect(g);
    g.gain.setValueAtTime(kind === "snare" ? 0.28 : 0.14, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + len);
    s.start(time);
    s.stop(time + len);
  }
}
// 鼓循环播放：提前排程声音，按实际音频时钟绘制播放位置。
async function start(b) {
  stop();
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  await ctx.resume();
  const bus = ctx.createGain();
  bus.connect(ctx.destination);
  const tr = {
    bus,
    id: b.id,
    step: 0,
    next: ctx.currentTime + 0.06,
    queue: [],
    timer: null,
    raf: null,
  };
  transport = tr;
  function schedule() {
    if (transport !== tr) return;
    while (tr.next < ctx.currentTime + 0.1) {
      const n = tr.step;
      for (const t of ["kick", "snare", "hihat"])
        if (b.tracks[t][n]) sound(t, tr.next);
      tr.queue.push({ n, time: tr.next });
      const pair = 60 / b.bpm / 2;
      tr.next += pair * (n % 2 === 0 ? b.swing / 100 : 1 - b.swing / 100);
      tr.step = (n + 1) % 16;
    }
  }
  function draw() {
    if (transport !== tr) return;
    let n;
    while (tr.queue.length && tr.queue[0].time <= ctx.currentTime)
      n = tr.queue.shift().n;
    if (n !== undefined)
      document
        .querySelectorAll("[data-rhythm]")
        .forEach((e) =>
          e.classList.toggle(
            "playing",
            e.dataset.rhythm === b.id && Number(e.dataset.step) === n,
          ),
        );
    tr.raf = requestAnimationFrame(draw);
  }
  schedule();
  tr.timer = setInterval(schedule, 25);
  draw();
}
// 统一停止鼓或 MIDI 播放，并移除网格高亮。
function stop() {
  if (transport) {
    clearInterval(transport.timer);
    cancelAnimationFrame(transport.raf);
    transport.bus.disconnect();
    transport = null;
    ctx?.suspend();
  }
  document
    .querySelectorAll(".playing")
    .forEach((e) => e.classList.remove("playing"));
  document
    .querySelectorAll("[data-play]")
    .forEach((e) => (e.textContent = "▶ 播放"));
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
// 下载全部知识页为 content.json，方便备份和搬到其他设备。
function download() {
  const a = el("a", {
    href: URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    ),
    download: "content.json",
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// ---------- 页面编辑与模块添加事件 ----------
$("search").oninput = nav;
$("edit").onclick = () => {
  stop();
  editing = !editing;
  render();
};
$("save").onclick = () => {
  if (cache()) status("已保存到本机 · 跨设备请使用 GitHub 同步。");
};
$("newPage").onclick = () => {
  const title = prompt("新知识页的标题");
  if (!title?.trim()) return;
  stop();
  const p = {
    id: uid(),
    title: title.trim(),
    category: "未分类",
    blocks: [{ id: uid(), type: "text", content: "" }],
  };
  data.pages.push(p);
  current = p.id;
  editing = true;
  changed();
  render();
};
$("deletePage").onclick = () => {
  if (data.pages.length === 1) {
    status("至少保留一个知识页。");
    return;
  }
  if (!confirm("删除整个知识页？")) return;
  stop();
  data.pages = data.pages.filter((p) => p.id !== current);
  current = data.pages[0].id;
  changed();
  render();
}; // 点击添加按钮，按类型创建数据；新增 MIDI 会带有 notes 数组。
document.querySelectorAll("[data-add]").forEach(
  (btn) =>
    (btn.onclick = () => {
      stop();
      const type = btn.dataset.add,
        b = { id: uid(), type };
      if (type === "text") b.content = "";
      else if (type === "rhythm")
        Object.assign(b, {
          name: "我的新节奏",
          bpm: 90,
          swing: 50,
          tracks: {
            kick: Array(16).fill(0),
            snare: Array(16).fill(0),
            hihat: Array(16).fill(0),
          },
        });
      else if (type === "midi") Object.assign(b, midiDefaults());
      else Object.assign(b, { src: "", caption: "" });
      page().blocks.push(b);
      changed();
      render();
    }),
);
$("export").onclick = download;
$("import").onclick = () => $("importFile").click();
$("importFile").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (f.size > 900000) throw Error("备份文件不能超过 900 KB。");
    const next = validate(JSON.parse(await f.text()));
    if (!confirm("导入将替换本机全部知识页。建议先导出备份，是否继续？"))
      return;
    stop();
    data = next;
    current = data.pages[0].id;
    changed();
    render();
  } catch (err) {
    status(err.message);
  } finally {
    e.target.value = "";
  }
};
// 读取 GitHub 配置；授权令牌不写入 localStorage。
function getConfig() {
  const c = {
    owner: $("owner").value.trim(),
    repo: $("repo").value.trim(),
    branch: $("branch").value.trim() || "main",
  };
  if (!/^[a-zA-Z0-9-]+$/.test(c.owner) || !/^[\w.-]+$/.test(c.repo))
    throw Error("请填写有效的用户名和仓库名。");
  settings = c;
  try {
    localStorage.setItem(CONFIG, JSON.stringify(c));
  } catch {}
  return c;
}
// 为每个仓库／分支分别保存已读取的文件版本。
function key(c) {
  return c.owner + "/" + c.repo + "/" + c.branch;
}
// 固定只读写仓库根目录的 content.json。
function url(c) {
  return (
    "https://api.github.com/repos/" +
    encodeURIComponent(c.owner) +
    "/" +
    encodeURIComponent(c.repo) +
    "/contents/content.json"
  );
}
// 令牌只发送到 GitHub API，用于读取和写入内容。
function headers() {
  const h = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if ($("token").value.trim())
    h.Authorization = "Bearer " + $("token").value.trim();
  return h;
}
// 读取 GitHub 最新内容和 SHA，供同步时检查版本冲突。
async function remote(c) {
  const r = await fetch(
    url(c) + "?ref=" + encodeURIComponent(c.branch) + "&t=" + Date.now(),
    { headers: headers(), cache: "no-store" },
  );
  if (!r.ok)
    throw Error(
      "GitHub 读取失败（" +
        r.status +
        "）。请检查仓库、分支、content.json 和授权。",
    );
  const x = await r.json();
  if (!x.content) throw Error("GitHub 文件过大，请减少内嵌素材。");
  const bytes = Uint8Array.from(atob(x.content.replace(/\s/g, "")), (c) =>
    c.charCodeAt(0),
  );
  return {
    sha: x.sha,
    data: validate(JSON.parse(new TextDecoder().decode(bytes))),
  };
}
// 同步期间锁住编辑区，避免提交过程中修改内容产生保存状态误判。
async function task(fn) {
  if (busy) return;
  busy = true;
  document.querySelector("main").inert = true;
  document.querySelector("aside").inert = true;
  $("pull").disabled = $("push").disabled = true;
  $("syncStatus").textContent = "处理中…";
  try {
    await fn();
  } catch (e) {
    $("syncStatus").textContent = e.message;
  } finally {
    busy = false;
    document.querySelector("main").inert = false;
    document.querySelector("aside").inert = false;
    $("pull").disabled = $("push").disabled = false;
  }
}
// ---------- GitHub 读取与保存按钮 ----------
$("cloud").onclick = () => {
  for (const k of ["owner", "repo", "branch"])
    $(k).value = settings[k] || (k === "branch" ? "main" : "");
  $("syncStatus").textContent =
    "先读取 GitHub 内容建立同步版本，再编辑并保存。";
  $("sync").showModal();
};
$("closeSync").onclick = () => $("sync").close();
$("pull").onclick = () =>
  task(async () => {
    const c = getConfig(),
      r = await remote(c);
    if (!confirm("读取会替换本机知识库，请先导出本机修改。是否继续？")) {
      $("syncStatus").textContent = "已取消读取。";
      return;
    }
    stop();
    data = r.data;
    bases[key(c)] = r.sha;
    dirty = false;
    current = data.pages[0].id;
    cache();
    render();
    $("syncStatus").textContent = "已读取 GitHub 最新内容。";
    status("已读取 GitHub · 当前内容已同步");
  });
$("push").onclick = () =>
  task(async () => {
    const c = getConfig();
    if (!$("token").value.trim()) throw Error("请先输入只授权这个仓库的令牌。");
    const r = await remote(c),
      base = bases[key(c)];
    if (!base && JSON.stringify(r.data) !== JSON.stringify(data))
      throw Error(
        "尚未建立同步版本。请先导出本机备份，再读取 GitHub；需要保留本机内容时，读取后导入备份再保存。",
      );
    if (base && base !== r.sha)
      throw Error(
        "GitHub 内容已被其他设备更新。请导出本机备份，再读取最新内容并整理，防止覆盖。",
      );
    const raw = JSON.stringify(validate(data), null, 2),
      bytes = new TextEncoder().encode(raw);
    if (bytes.length > 900000)
      throw Error("内容超过 900 KB，请减少内嵌图片或音频，改用链接。");
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const res = await fetch(url(c), {
      method: "PUT",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Update music notebook",
        branch: c.branch,
        sha: r.sha,
        content: btoa(binary),
      }),
    });
    if (!res.ok)
      throw Error(
        "保存失败（" +
          res.status +
          "）。检查 Contents 写权限、令牌有效期及分支保护；409 表示版本冲突。",
      );
    const out = await res.json();
    bases[key(c)] = out.content.sha;
    dirty = false;
    cache();
    $("syncStatus").textContent =
      "已保存到 GitHub。网页公开版本将在 Pages 部署完成后更新。";
    status("已保存到 GitHub ✓");
  });
// ---------- 启动：先恢复本机草稿，再读取仓库发布的数据 ----------
(async () => {
  try {
    settings = JSON.parse(localStorage.getItem(CONFIG) || "{}");
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved) {
      data = validate(saved.data);
      bases = saved.bases || {};
      dirty = !!saved.dirty;
    }
  } catch {
    status("本机备份无法读取，将载入初始内容。");
  }
  if (!data) {
    try {
      const r = await fetch("./content.json", { cache: "no-store" });
      if (!r.ok) throw Error();
      data = validate(await r.json());
    } catch {
      data = clone(defaults);
    }
  }
  current = data.pages[0].id;
  render();
  status(
    dirty ? "已恢复本机草稿 · 尚未保存到 GitHub" : "准备就绪 · 点击播放听节奏",
  );
})();
