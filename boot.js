// ---------- 启动：先恢复本机草稿，再读取仓库发布的数据 ----------
(async () => {
  try {
    settings = JSON.parse(localStorage.getItem(CONFIG) || "{}");
    const stored = await dbGet(STORE).catch(() => null);
    const saved = stored || JSON.parse(localStorage.getItem(STORE) || "null");
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
      data = validate(clone(defaults));
    }
  }
  current = data.pages[0]?.id || null;
  render();
  status(
    dirty ? "已恢复本机草稿 · 尚未保存到 GitHub" : "准备就绪 · 点击播放听节奏",
  );
})();
