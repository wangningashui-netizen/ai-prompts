# 如水如画

来自 X 的 AI 提示词日报，分两个分区：

- **图片提示词**（打开页面就是这个）：下面这套图像日报。数据仍是 `data/index.json`、`data/YYYY-MM-DD.json` 和 `images/YYYY-MM-DD/`。
- **视频提示词**（页顶切换，地址加 `?view=video`）：另一套数据，见文末「视频提示词」。不要把视频写进图片的 JSON 或 `images/`。

静态网站，托管在 GitHub Pages：从 `main` 分支**根目录**直接发布，打开页面时不需要构建。

界面语言是简体中文。打开后直接从最新一天往下看，滚到底会自动接上更早的日期，每一天有自己的日期标题。右上角「跳到」只是定位到某一天，不是进入页面前的必选项。可按模型分组筛选、搜索标题和提示词，并一键复制原始 prompt。筛选作用于已经载入的内容；继续下拉会把更早的日期也放进同一套筛选。

本地预览（不要用 `file://` 打开，浏览器会拦截 `fetch`）：

```bash
python3 -m http.server 8080
```

然后访问 <http://localhost:8080>。

GitHub Pages：仓库 Settings → Pages → Build and deployment → Deploy from a branch → Branch `main`、文件夹 `/ (root)`。根目录的空文件 `.nojekyll` 让 Pages 按原样提供全部文件（包括 `images/`）。资源都用相对路径，项目页（`https://<user>.github.io/<repo>/`）和用户页都能用。

## 每天早上怎么加一天

只改三处，**不要**改 `index.html`、`styles.css`、`app.js`、`videos.js`：

1. 新建目录 `images/YYYY-MM-DD/`，放入当天的 JPEG。
2. 新建 `data/YYYY-MM-DD.json`（schema 见下）。
3. 在 `data/index.json` 的 `dates` **最前面**插入这一天（最新在前）。

页面不扫描图片目录。某张图要显示，就必须写进当天 JSON 的 `images`。信息流按日期从新到旧接成一条，`dates[0]` 在最上面。页面也会再按 `date` 降序排一次，所以即使插错位置，最新日期仍会排到前面。「跳到」菜单的顺序同样如此。文件本身仍应保持最新在前。

### 图片文件

- 路径：`images/YYYY-MM-DD/<author>_<postId>_<n>.jpg`
- `<author>` 是不含 `@` 的 X 用户名，可以含下划线（例如 `Levi_D_Ackerman`）。不要用 `split("_")` 解析文件名。
- `<postId>` 是帖子 id 字符串。
- `<n>` 从 **1** 开始，对应 `images` 数组的顺序（第 1 张是 `_1.jpg`）。
- 建议宽约 480px 的 JPEG。没有本地文件的图不要编造路径，把 `local` 留空，只填 `remote`。

### 页面怎么选图

对 `images` 里的每一项：

- `local` 非空：用这个相对路径。
- `local` 为空：用 `remote`。
- `local` 加载失败（404 等）且 `remote` 是 `https://` 地址：页面会改去请求 `remote`。这是唯一的回退，不要把 pbs.twimg.com 地址写进 `local`。

`local` 和 `remote` 都空的对象不要写入数组。

## `data/index.json`

```json
{
  "schemaVersion": 1,
  "dates": [
    { "date": "2026-11-02", "file": "data/2026-11-02.json", "count": 40 },
    { "date": "2026-11-01", "file": "data/2026-11-01.json", "count": 93 }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `schemaVersion` | number | 固定 `1`。改 schema 时才递增，并同时改页面。 |
| `dates` | array | 可用日期。请按日期从新到旧排列。 |
| `dates[].date` | string | `YYYY-MM-DD`，与文件名、图片目录名相同。 |
| `dates[].file` | string | 相对网站根目录，形如 `data/YYYY-MM-DD.json`。不要以 `/` 开头。 |
| `dates[].count` | number | 当天 `entries.length`。 |

## `data/YYYY-MM-DD.json`

```json
{
  "schemaVersion": 1,
  "date": "2026-11-01",
  "timezone": "Asia/Shanghai",
  "entries": [
    {
      "id": "2115756782144590000",
      "author": "chichipuijaian",
      "title": "90 年代胶片感床底找东西抓拍",
      "model": "Grok Imagine",
      "group": "Grok",
      "note": "日文提示词，写在原帖图片的 ALT 里；需上传人物参考图。",
      "needsReference": true,
      "time": "10-29 18:45",
      "likes": 791,
      "bookmarks": 886,
      "images": [
        {
          "local": "images/2026-11-01/chichipuijaian_2115756782144590000_1.jpg",
          "remote": "",
          "width": 480,
          "height": 400
        }
      ],
      "prompt": "原始提示词，保留换行，不要翻译。"
    }
  ]
}
```

多图、且只有第一张有本地文件时：

```json
"images": [
  { "local": "images/2026-11-01/author_123_1.jpg", "remote": "https://pbs.twimg.com/media/AAA.jpg" },
  { "local": "", "remote": "https://pbs.twimg.com/media/BBB.jpg" }
]
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `schemaVersion` | number | 是 | 固定 `1`。 |
| `date` | string | 是 | `YYYY-MM-DD`，与文件名一致。 |
| `timezone` | string | 是 | 固定 `Asia/Shanghai`。`time` 是北京时间。 |
| `entries` | array | 是 | 当天条目。建议按热度从高到低。可为空数组。 |
| `entries[].id` | **string** | 是 | X 帖子 id。必须是 JSON 字符串，禁止写成数字。雪花 id 超过 `Number.MAX_SAFE_INTEGER`，写成数字会丢精度，原帖链接会错。 |
| `entries[].author` | string | 是 | 用户名，不含 `@`。只应包含字母、数字、下划线。 |
| `entries[].title` | string | 是 | 简体中文标题。 |
| `entries[].model` | string | 是 | 模型名称，显示在卡片上。未知时写 `未注明`。 |
| `entries[].group` | string | 是 | 筛选用分组。已知值：`Grok`、`Nano Banana`、`GPT Image`、`Midjourney`、`Seedream`、`多模型对比`、`未注明`。新分组会自动出现在筛选条里，不用改代码。 |
| `entries[].note` | string | 是 | 一行中文说明。没有就写 `""`。 |
| `entries[].needsReference` | boolean | 是 | `true` 表示这条 prompt 需要用户自己的参考图。卡片会标「需配参考图」。 |
| `entries[].time` | string | 是 | 发帖时间，格式严格为 `MM-DD HH:mm`（24 小时，北京时间）。跨年时月份大于日报月份的条目，页面会算作上一年。 |
| `entries[].likes` | number | 是 | 点赞，整数 ≥ 0。 |
| `entries[].bookmarks` | number | 是 | 收藏，整数 ≥ 0。 |
| `entries[].images` | array | 是 | 图片列表，顺序与原帖一致。没有图就写 `[]`。 |
| `entries[].images[].local` | string | 是 | 相对路径，或 `""`。 |
| `entries[].images[].remote` | string | 是 | `https://pbs.twimg.com/...`，或 `""`。 |
| `entries[].images[].width` | number | 否 | 像素宽。有本地文件时请填上，页面用来预留比例，避免图片加载后卡片跳动。 |
| `entries[].images[].height` | number | 否 | 像素高。与 `width` 成对出现。 |
| `entries[].prompt` | string | 是 | 原始提示词，保留原文和换行，不要翻译、不要截断。 |

页面行为（加数据时不用改）：

- **热度** = `likes + bookmarks`，默认按热度从高到低。热度相同则保持文件中的先后顺序。
- **时间**按 `time` 从新到旧。
- 搜索只匹配标题和 prompt（大小写不敏感），不匹配说明或作者。
- 原帖链接由页面拼出：`https://x.com/<author>/status/<id>`。作者名指向 `https://x.com/<author>`。
- 复制按钮复制完整 `prompt`。

未知字段可以留着，当前页面会忽略。不要改已有字段的类型。

## Daily update checklist

Do only these three things. Do not edit `index.html`, `styles.css`, `app.js`, or `videos.js`.

1. Add JPEGs under `images/YYYY-MM-DD/`, named `<author>_<postId>_<n>.jpg` (`n` starts at 1, same order as the `images` array). Handles may contain underscores; do not parse filenames with `split("_")`.
2. Add `data/YYYY-MM-DD.json` using schemaVersion `1` and the fields above. `id` must be a JSON string. Keep the prompt verbatim, including newlines. Set `images[].local` to the site-relative path when that file exists, otherwise `""`. Set `images[].remote` to the `https://pbs.twimg.com/...` URL or `""`. When you know the pixel size (always, for a local JPEG), also set optional `width` and `height` so cards do not jump. The page does not scan the image folder.
3. Prepend `{ "date", "file", "count" }` to `data/index.json` → `dates` (`count` = `entries.length`). Keep `dates` newest-first.

The page prefers `local`, and requests `remote` only when `local` is empty or fails to load. `time` is `MM-DD HH:mm` in `Asia/Shanghai`. Heat sort is `likes + bookmarks`.

## 视频提示词

视频分区和图片分区互相独立。每天加视频时**只改视频这三处**，不要改 `index.html`、`styles.css`、`app.js`、`videos.js`，也不要改 `data/index.json`、`data/YYYY-MM-DD.json` 或 `images/`。

1. 把当天的 MP4 和封面 JPEG 放进 `videos/YYYY-MM-DD/`。
2. 新建 `data/videos/YYYY-MM-DD.json`（schema 见下）。
3. 在 `data/videos/index.json` 的 `dates` **最前面**插入这一天（最新在前）。

页面不扫描 `videos/`。某段片子要出现，就必须写进当天 JSON 的 `videos`。打开 `?view=video` 后直接从最新一天往下看，滚到底接上更早的日期。筛选、搜索、排序只作用于视频分区，和图片分区的地址参数互不覆盖（视频地址始终带着 `view=video`）。

校验：

```bash
python3 scripts/validate-videos.py
```

### 媒体文件

- 视频：`videos/YYYY-MM-DD/<author>_<postId>_<n>.mp4`
- 封面：同一目录、同一主文件名的 `.jpg`，例如 `videos/2026-11-20/author_123_1.jpg`
- `<author>` 是不含 `@` 的 X 用户名，可以含下划线。不要用 `split("_")` 解析文件名。
- `<n>` 从 **1** 开始，顺序与 `videos` 数组一致。
- 建议 H.264、约 480px 宽、`moov` 在 `mdat` 前面（faststart）、时长不超过 15 秒。封面用同尺寸的 JPEG。
- 路径相对网站根目录，不要以 `/` 开头，不要写远程视频地址。

### `data/videos/index.json`

```json
{
  "schemaVersion": 1,
  "dates": [
    { "date": "2026-11-20", "file": "data/videos/2026-11-20.json", "count": 27 }
  ]
}
```

字段和图片的 `data/index.json` 相同：`schemaVersion` 固定 `1`，`dates` 最新在前，`count` 等于当天 `entries.length`。`file` 形如 `data/videos/YYYY-MM-DD.json`。

### `data/videos/YYYY-MM-DD.json`

```json
{
  "schemaVersion": 1,
  "date": "2026-11-20",
  "timezone": "Asia/Shanghai",
  "entries": [
    {
      "id": "2121887196063940951",
      "author": "Dheepanratnam",
      "authorName": "Dheepan Ratnam",
      "title": "画笔一挥，颜料炸成世界",
      "model": "Seedance 2.5 Flash / Seedance 2.0 / Wan 3.0",
      "models": ["Seedance 2.5 Flash", "Seedance 2.0", "Wan 3.0"],
      "note": "同一句提示词交给三个模型。",
      "needsReference": false,
      "time": "11-15 16:45",
      "likes": 40,
      "bookmarks": 5,
      "url": "https://x.com/Dheepanratnam/status/2121887196063940951",
      "videos": [
        {
          "src": "videos/2026-11-20/Dheepanratnam_2121887196063940951_1.mp4",
          "poster": "videos/2026-11-20/Dheepanratnam_2121887196063940951_1.jpg",
          "duration": 15,
          "width": 480,
          "height": 270,
          "label": "Seedance 2.5 Flash"
        }
      ],
      "prompt": "原始提示词，保留换行，不要翻译。"
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `schemaVersion` | number | 是 | 固定 `1`。这是视频 schema，和图片 schema 各记各的。 |
| `date` | string | 是 | `YYYY-MM-DD`，与文件名、媒体目录名相同。 |
| `timezone` | string | 是 | 固定 `Asia/Shanghai`。 |
| `entries` | array | 是 | 当天条目。建议按热度从高到低。可为空数组。 |
| `entries[].id` | **string** | 是 | X 帖子 id。必须是 JSON 字符串，禁止写成数字。 |
| `entries[].author` | string | 是 | 用户名，不含 `@`。只应包含字母、数字、下划线。 |
| `entries[].authorName` | string | 是 | 显示名。没有就写 `""`。页面作者链接仍用 `@author`。 |
| `entries[].title` | string | 是 | 简体中文标题。 |
| `entries[].model` | string | 是 | 卡片上的模型原文。未知写 `未注明`。多个模型用 ` / ` 连接（两侧各一个空格）。 |
| `entries[].models` | string[] | 是 | 筛选用的模型名。单个模型就是 `[model]`。`未注明` 就是 `["未注明"]`。对比条目按 ` / ` 拆开，顺序与 `model` 一致。 |
| `entries[].note` | string | 是 | 一行中文说明。没有就写 `""`。 |
| `entries[].needsReference` | boolean | 是 | `true` 时卡片标「需参考素材」。 |
| `entries[].time` | string | 是 | 发帖时间，`MM-DD HH:mm`，北京时间。 |
| `entries[].likes` | number | 是 | 点赞，整数 ≥ 0。 |
| `entries[].bookmarks` | number | 是 | 收藏，整数 ≥ 0。 |
| `entries[].url` | string | 是 | `https://x.com/<author>/status/<id>`，或 `""`。为空时页面用 author 和 id 拼原帖链接。 |
| `entries[].videos` | array | 是 | 至少一段。顺序与文件名 `_n` 一致。 |
| `entries[].videos[].src` | string | 是 | 相对路径，指向 mp4。 |
| `entries[].videos[].poster` | string | 是 | 相对路径，指向同名 jpg。 |
| `entries[].videos[].duration` | number | 是 | 秒，可以有小数。 |
| `entries[].videos[].width` | number | 是 | 像素宽。页面用来预留比例。 |
| `entries[].videos[].height` | number | 是 | 像素高。 |
| `entries[].videos[].label` | string | 否 | 这一段对应的模型名。见下面的对比规则。 |
| `entries[].prompt` | string | 是 | 原始提示词，保留原文和换行，不要翻译、不要截断。 |

对比条目：

- 一段片子里已经并排了多个模型（`videos.length` 和 `models.length` 不同）：不要给 `label`。卡片仍显示完整 `model`，筛选时这段会出现在每一个列出的模型下面。
- 每个模型各一段，且段数等于模型数：按同样的顺序写 `label`，`videos[i].label` 等于 `models[i]`。

页面行为（加数据时不用改）：

- **热度** = `likes + bookmarks`，默认从高到低。热度相同则保持文件中的先后顺序。
- **时间**按 `time` 从新到旧。
- 搜索只匹配标题和 prompt（大小写不敏感）。
- 模型筛选用 `models` 里的名字，包含 `未注明`。一条对比可以同时算进多个模型。
- 作者名指向 `https://x.com/<author>`，原帖用 `url`（没有则拼 status 链接）。
- 复制按钮复制完整 `prompt`。
- 视频用 `<video>` 播放：封面、`playsinline`、静音、循环、`preload="none"`。悬停或点按播放，控件可用来开声音和拖动。不在视口里的封面晚一点再取，未播放的片子不请求 mp4。

未知字段可以留着，当前页面会忽略。不要改已有字段的类型。

## Video daily update checklist

Do only these three things. Do not edit `index.html`, `styles.css`, `app.js`, `videos.js`, `data/index.json`, or `images/`.

1. Add each clip under `videos/YYYY-MM-DD/` as `<author>_<postId>_<n>.mp4` plus a same-basename `.jpg` poster (`n` starts at 1). H.264, about 480px wide, faststart, preferably ≤ 15s. Handles may contain underscores; do not parse filenames with `split("_")`.
2. Add `data/videos/YYYY-MM-DD.json` with schemaVersion `1`. `id` is a JSON string. Keep `prompt` verbatim. `model` is the label shown on the card (`未注明`, or several names joined with ` / `). `models` is that list split for filtering. Set `needsReference` true to show 需参考素材. When each model has its own clip, set `videos[i].label` to `models[i]`. Paths are site-relative (`videos/YYYY-MM-DD/...`), never remote URLs.
3. Prepend `{ "date", "file", "count" }` to `data/videos/index.json` → `dates` (`file` is `data/videos/YYYY-MM-DD.json`, `count` = `entries.length`). Keep `dates` newest-first.

Check with `python3 scripts/validate-videos.py`. Heat sort is `likes + bookmarks`. `time` is `MM-DD HH:mm` in `Asia/Shanghai`.
