# 如水如画

来自 X 的 AI 图像提示词日报。静态网站，托管在 GitHub Pages：从 `main` 分支**根目录**直接发布，打开页面时不需要构建。

界面语言是简体中文。打开后直接从最新一天往下看，滚到底会自动接上更早的日期，每一天有自己的日期标题。右上角「跳到」只是定位到某一天，不是进入页面前的必选项。可按模型分组筛选、搜索标题和提示词，并一键复制原始 prompt。筛选作用于已经载入的内容；继续下拉会把更早的日期也放进同一套筛选。

本地预览（不要用 `file://` 打开，浏览器会拦截 `fetch`）：

```bash
python3 -m http.server 8080
```

然后访问 <http://localhost:8080>。

GitHub Pages：仓库 Settings → Pages → Build and deployment → Deploy from a branch → Branch `main`、文件夹 `/ (root)`。根目录的空文件 `.nojekyll` 让 Pages 按原样提供全部文件（包括 `images/`）。资源都用相对路径，项目页（`https://<user>.github.io/<repo>/`）和用户页都能用。

## 每天早上怎么加一天

只改三处，**不要**改 `index.html`、`styles.css`、`app.js`：

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

Do only these three things. Do not edit `index.html`, `styles.css`, or `app.js`.

1. Add JPEGs under `images/YYYY-MM-DD/`, named `<author>_<postId>_<n>.jpg` (`n` starts at 1, same order as the `images` array). Handles may contain underscores; do not parse filenames with `split("_")`.
2. Add `data/YYYY-MM-DD.json` using schemaVersion `1` and the fields above. `id` must be a JSON string. Keep the prompt verbatim, including newlines. Set `images[].local` to the site-relative path when that file exists, otherwise `""`. Set `images[].remote` to the `https://pbs.twimg.com/...` URL or `""`. When you know the pixel size (always, for a local JPEG), also set optional `width` and `height` so cards do not jump. The page does not scan the image folder.
3. Prepend `{ "date", "file", "count" }` to `data/index.json` → `dates` (`count` = `entries.length`). Keep `dates` newest-first.

The page prefers `local`, and requests `remote` only when `local` is empty or fails to load. `time` is `MM-DD HH:mm` in `Asia/Shanghai`. Heat sort is `likes + bookmarks`.
