# Music Notebook · 可编辑音乐学习库

这是可以直接上传 GitHub Pages 的静态网站。无需安装软件、依赖、Node.js 或运行构建命令。使用原生 JavaScript、CSS 和 Web Audio API。

## 1. 上传与访问（电脑操作最方便）

1. 解压 ZIP。在 GitHub 登录，点击右上角 `+` → `New repository`。
2. 仓库名填写 `music-notebook`，选择 **Public**，点击 `Create repository`。免费 GitHub Pages 通常使用公开仓库。
3. 点击 `uploading an existing file`，或 `Add file → Upload files`。
4. 上传解压后的文件夹**里面的文件**，而不是 ZIP，也不要再套一层文件夹。根目录必须直接看到：
   - `index.html`
   - `style.css`
   - `app.js`
   - `content.json`
   - `README.md`
   - `.nojekyll`（隐藏文件，若文件选择器看不到可在仓库 Add file → Create new file 创建此空文件）
5. 点击 `Commit changes`。
6. 进入仓库 `Settings → Pages`。在 `Build and deployment` 下：
   - `Source` 选择 `Deploy from a branch`。
   - `Branch` 选择 `main`，文件夹选择 `/(root)`。
   - 点击 `Save`。
7. 等待 Pages 部署完成，刷新这个设置页，点击 **Visit site**。这是最准确的实际访问链接。也可以查看仓库 `Actions` 中 Pages 的部署状态。

一般访问地址：`https://你的GitHub用户名.github.io/music-notebook/`。
例如用户名 `huiyun`，仓库名 `music-notebook`：`https://huiyun.github.io/music-notebook/`。
如果仓库使用其他名字，最后一段换成真实仓库名；如果仓库名就是 `用户名.github.io`，地址是 `https://用户名.github.io/`。
这里的示例地址不是已经发布的网站。你完成上传并启用 Pages 后才会生效。

参考 GitHub 官方说明：
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 2. 网页上编辑

- `编辑页面`：修改标题、分类、文字和节奏格子，添加独立模块。
- `新建知识页`：新增一个页面，分类可写节奏、和声、编曲、混音等。
- 模块工具：向上、向下、复制、删除。
- 节奏：固定 4/4、一小节 16 格、Kick/Snare/Hi-Hat 三轨。点播放循环试听，可调 40–220 BPM。
- Swing 使用长短比例：50% 为直拍，60% 为 60:40，70% 为 70:30。不等同于每个 DAW 的 Swing 参数标度。
- 鼓是浏览器合成的试听音色，并非真实鼓采样。切换后台或页面时停止播放。
- 文字为纯文本，可换行；暂不包含富文本工具栏、五线谱、MIDI 或 AI。
- 图片支持 PNG/JPG/GIF/WebP；音频播放格式取决于浏览器，建议 MP3。
- 素材可以粘贴链接，也可以选择小文件。内嵌文件单个最多 300 KB；全部知识内容保存到 GitHub 时不超过 900 KB。大音频请用你有权使用的稳定外部链接。链接资源须允许浏览器加载。

## 3. 保存的区别（请先读）

所有编辑自动保存到本机浏览器的 localStorage；`保存到本机` 再手动保存一次。
**本机保存不会自动同步到 GitHub 或其他设备。** 清除浏览器数据、隐私模式或更换浏览器可能丢失本机内容。务必定期 `导出备份`。

`导出备份` 会下载全部知识页为 `content.json`；`导入备份` 会替换本机知识库。备份不含授权令牌。
初次打开从仓库发布的 `content.json` 载入；之后优先恢复本机版本，避免覆盖草稿。如果另一台设备已更新，请用 `GitHub 同步 → 读取 GitHub 内容`。

## 4. 网页直接保存到 GitHub（一次配置，之后无需改 JSON）

这一版使用由你自己输入的 GitHub 细粒度令牌，不需要服务器。不是 GitHub OAuth 一键登录；常规 OAuth 授权码换令牌不能仅凭 Pages 安全存放客户端密钥。

首次准备：
1. GitHub 右上角头像 → `Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token`。
   也可访问 https://github.com/settings/personal-access-tokens/new
2. 设一个有效期；Resource owner 选择仓库所属账号。
3. Repository access 选 `Only select repositories`，只选择 `music-notebook`。
4. Repository permissions 中 `Contents` 设置 `Read and write`，其他额外权限不需要。
5. 生成后复制令牌。不要把它提交到仓库、粘贴到笔记或截图公开。

在网站上：
1. 点击 `GitHub 同步`，输入用户名、仓库名、分支 `main` 和令牌。
2. **先点击 `读取 GitHub 内容`，建立同步版本，再编辑。** 已有本机修改时先导出备份，读取后再导入备份，随后保存。
3. 日常修改后点 `保存到 GitHub`，将所有页面保存为仓库根目录的 `content.json`。
4. 另一个设备先读取 GitHub 最新内容，编辑后再保存。令牌仅保存在当前网页内存，刷新后重新输入；用户名、仓库名和分支可留在本机。
5. GitHub 提交完成后，Pages 自动部署；公开阅读版在部署完成后更新。本机版本立即保留。

读取会替换本机草稿，操作前会提示。保存会检查上次读取的文件版本（SHA）；如果别的设备改了内容，就会拒绝覆盖。此时先导出本机备份、读取最新内容，再人工整理。没有自动合并。

这是公开网站，没有私有账号体系。访客可以在自己的浏览器修改本机副本，但没有你的令牌不能提交到你的仓库。发布到公开仓库的文字与素材会公开，不要提交私人资料或无授权的课程资源。

错误提示：
- 401：令牌无效或过期。
- 403：权限不足、组织限制、API 限额或分支保护等，检查 GitHub 响应与权限。
- 404：用户名、仓库、分支或 content.json 不存在；授权不足也可能返回 404。
- 409：版本冲突，请重新读取并整理修改。
- 422：提交参数或分支规则不满足，检查仓库规则。

GitHub API 官方说明：
https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents

## 5. 可选：完全不用令牌

在网页编辑 → 导出备份 → 用 GitHub 的 `Add file → Upload files` 上传新的 `content.json` 覆盖根目录同名文件。这样也能更新网站，但需要到 GitHub 操作一次。

## 6. 常见问题

- 404 页面：确认 Pages 已开启、部署成功、文件在根目录。访问网站地址而不是 github.com 仓库地址。
- 只有 README：根目录缺少 index.html，或文件多套了一层目录。
- 无声音：先点播放，确认设备声音打开。手机浏览器通常需要手动点击启动音频。
- 内容没有更新：等待 Pages 部署；已有本机草稿时手动读取 GitHub 最新内容。
- 本地预览：可以双击 index.html 查看默认演示，但推荐部署后使用；file:// 下读取 content.json 和存储支持可能受浏览器限制。
- 手机 GitHub 看不到完整设置：使用电脑浏览器，或手机浏览器切换桌面网站。

网站不需要付费云服务器或数据库；GitHub 的产品规则和服务限额以其当前官方说明为准。
