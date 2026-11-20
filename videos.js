/* Video prompt browser. Runs only for ?view=video.
   Image browsing stays in app.js. A daily video update should not need to edit this file. */
(() => {
  if (new URLSearchParams(location.search).get("view") !== "video") return;

  const els = {
    date: document.querySelector("#date"),
    q: document.querySelector("#q"),
    clear: document.querySelector("#clear"),
    chips: document.querySelector("#chips"),
    result: document.querySelector("#result"),
    gallery: document.querySelector("#gallery"),
    empty: document.querySelector("#empty"),
    status: document.querySelector("#status"),
    more: document.querySelector("#more"),
    toast: document.querySelector("#toast"),
    toTop: document.querySelector("#to-top"),
  };

  const state = {
    index: null,
    days: [],
    keys: new Map(),
    group: "全部",
    sort: "heat",
    query: "",
    cursor: 0,
    flight: null,
    toastTimer: 0,
  };

  const NS = "http://www.w3.org/2000/svg";
  const hoverFine = window.matchMedia("(hover: hover) and (pointer: fine)");

  document.documentElement.dataset.view = "video";
  document.title = "如水如画 · AI 视频提示词日报";
  const eyebrow = document.querySelector(".eyebrow");
  if (eyebrow) eyebrow.textContent = "AI 视频生成";
  document.querySelectorAll(".section-switch a").forEach((link) => {
    if (link.dataset.view === "video") link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  function formatDay(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!match) return iso || "";
    return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
  }

  function formatDayShort(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!match) return iso || "";
    return `${Number(match[2])}月${Number(match[3])}日`;
  }

  function parsePostTime(entry, dayIso) {
    const match = /^(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(entry.time || "");
    const yearMatch = /^(\d{4})-(\d{2})-/.exec(dayIso || "");
    if (!match || !yearMatch) {
      return { ms: 0, label: entry.time || "", iso: "" };
    }
    let year = Number(yearMatch[1]);
    const digestMonth = Number(yearMatch[2]);
    const month = Number(match[1]);
    if (month > digestMonth) year -= 1;
    const iso = `${year}-${match[1]}-${match[2]}T${match[3]}:${match[4]}:00+08:00`;
    const ms = Date.parse(iso);
    return {
      ms: Number.isNaN(ms) ? 0 : ms,
      label: `${month}月${Number(match[2])}日 ${match[3]}:${match[4]}`,
      iso,
    };
  }

  function heat(entry) {
    return (Number(entry.likes) || 0) + (Number(entry.bookmarks) || 0);
  }

  function norm(value) {
    return String(value || "").toLowerCase().normalize("NFKC");
  }

  function num(value) {
    return (Number(value) || 0).toLocaleString("zh-CN");
  }

  function safeLocal(path) {
    if (typeof path !== "string") return "";
    const trimmed = path.trim();
    if (!trimmed || trimmed.startsWith("/") || trimmed.includes("..") || trimmed.includes("\\") || trimmed.includes("://")) {
      return "";
    }
    return trimmed.split("/").map(encodeURIComponent).join("/");
  }

  function modelsOf(entry) {
    if (Array.isArray(entry.models) && entry.models.length) {
      const names = entry.models.map((name) => String(name || "").trim()).filter(Boolean);
      if (names.length) return names;
    }
    const raw = String(entry.model || "").trim();
    if (!raw || raw === "未注明") return ["未注明"];
    if (raw.includes(" / ")) {
      const parts = raw.split(" / ").map((name) => name.trim()).filter(Boolean);
      if (parts.length > 1) return parts;
    }
    return [raw || "未注明"];
  }

  function familyOf(models) {
    if (models.length > 1) return "多模型对比";
    const name = models[0] || "";
    if (name.startsWith("Grok")) return "Grok";
    if (name.startsWith("Seedance") || name.startsWith("Seedream")) return "Seedance";
    if (name.startsWith("Kling") || name.startsWith("可灵")) return "Kling";
    if (name.startsWith("Wan")) return "Wan";
    if (name.startsWith("Muse")) return "Muse";
    if (name.startsWith("Google") || name.startsWith("Flow")) return "Google";
    if (name.startsWith("FLUX") || name.startsWith("Flux")) return "FLUX";
    return name;
  }

  function formatDuration(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value <= 0) return "";
    const total = Math.round(value);
    const minutes = Math.floor(total / 60);
    const remain = total % 60;
    if (minutes <= 0) return `${remain} 秒`;
    return `${minutes}:${String(remain).padStart(2, "0")}`;
  }

  function clipsOf(entry) {
    const list = Array.isArray(entry.videos) ? entry.videos : [];
    return list.map((video, index) => {
      const src = safeLocal(video && video.src);
      const poster = safeLocal(video && video.poster);
      const width = Number(video && video.width) || 0;
      const height = Number(video && video.height) || 0;
      const duration = Number(video && video.duration);
      const label = video && typeof video.label === "string" ? video.label.trim() : "";
      return {
        src,
        poster,
        width: width > 0 ? width : 0,
        height: height > 0 ? height : 0,
        duration: Number.isFinite(duration) ? duration : 0,
        label: label || (list.length > 1 ? `片段 ${index + 1}` : ""),
      };
    }).filter((clip) => clip.src);
  }

  function handleOf(entry) {
    return /^[A-Za-z0-9_]{1,30}$/.test(entry.author || "") ? entry.author : "";
  }

  function postUrl(entry) {
    if (typeof entry.url === "string" && entry.url.trim()) {
      try {
        const parsed = new URL(entry.url.trim());
        const host = parsed.hostname.replace(/^www\./, "");
        if (parsed.protocol === "https:" && (host === "x.com" || host === "twitter.com")) {
          return parsed.href;
        }
      } catch {
        /* fall through to the composed status URL */
      }
    }
    const author = handleOf(entry);
    if (author && /^\d+$/.test(String(entry.id || ""))) {
      return `https://x.com/${author}/status/${entry.id}`;
    }
    return "";
  }

  function profileUrl(entry) {
    const author = handleOf(entry);
    if (author) return `https://x.com/${author}`;
    const post = postUrl(entry);
    if (!post) return "";
    try {
      const parsed = new URL(post);
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && parts[1] === "status") return `${parsed.origin}/${parts[0]}`;
    } catch {
      return "";
    }
    return "";
  }

  function icon(path) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("ico");
    const shape = document.createElementNS(NS, "path");
    shape.setAttribute("fill", "currentColor");
    shape.setAttribute("d", path);
    svg.appendChild(shape);
    return svg;
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("on");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => els.toast.classList.remove("on"), 1800);
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }

  async function copyPrompt(entry, button) {
    const text = entry.prompt || "";
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = fallbackCopy(text);
    toast(ok ? "已复制" : "复制失败，请展开后手动选择");
    if (ok && button) {
      button.textContent = "已复制";
      button.classList.add("is-done");
      window.setTimeout(() => {
        button.textContent = "复制 prompt";
        button.classList.remove("is-done");
      }, 1600);
    }
  }

  function syncExpand(card) {
    const text = card.querySelector(".prompt-text");
    const button = card.querySelector(".expand");
    if (!text || !button) return;
    const open = card.classList.contains("is-open");
    button.textContent = open ? "收起" : "展开";
    button.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      button.hidden = false;
      return;
    }
    if (card.hidden || text.clientHeight === 0) return;
    button.hidden = text.scrollHeight <= text.clientHeight + 2;
  }

  function syncVisibleExpands() {
    els.gallery.querySelectorAll(".card").forEach(syncExpand);
  }

  function pillText(clips, index) {
    const clip = clips[index];
    if (!clip) return "";
    const duration = formatDuration(clip.duration);
    if (clips.length > 1 && duration) return `${index + 1}/${clips.length} · ${duration}`;
    if (clips.length > 1) return `${index + 1}/${clips.length}`;
    return duration;
  }

  function pauseOthers(current) {
    document.querySelectorAll(".player video").forEach((video) => {
      if (video !== current && !video.paused) video.pause();
    });
  }

  function ensureSrc(video) {
    if (!video || video.dataset.armed === "1") return;
    const src = video.dataset.src;
    if (!src) return;
    delete video.dataset.ignoreError;
    video.preload = "none";
    video.src = src;
    video.dataset.armed = "1";
  }

  function resetSource(video) {
    if (!video) return;
    video.dataset.ignoreError = "1";
    video.pause();
    video.removeAttribute("src");
    delete video.dataset.armed;
    try {
      video.load();
    } catch {
      /* resetting a video with no resource */
    }
  }

  function playClip(video) {
    if (!video) return;
    ensureSrc(video);
    video.muted = video.dataset.hold === "1" ? video.muted : true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    const pending = video.play();
    if (pending && typeof pending.catch === "function") pending.catch(() => {});
  }

  function bindVideo(video, player) {
    video.addEventListener("play", () => {
      player.classList.add("is-playing");
      player.classList.remove("is-paused");
      pauseOthers(video);
    });
    video.addEventListener("pause", () => {
      player.classList.remove("is-playing");
      player.classList.add("is-paused");
    });
    video.addEventListener("ended", () => {
      player.classList.remove("is-playing");
      player.classList.add("is-paused");
    });
    video.addEventListener("volumechange", () => {
      if (!video.muted) video.dataset.hold = "1";
    });
    video.addEventListener("error", () => {
      if (video.dataset.ignoreError === "1" || video.dataset.armed !== "1") return;
      const fail = document.createElement("p");
      fail.className = "img-fail";
      fail.textContent = "视频未能加载";
      player.replaceWith(fail);
    });
    video.addEventListener("pointerdown", () => ensureSrc(video), { passive: true });
    player.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || !hoverFine.matches) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      playClip(video);
    });
    player.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse" || !hoverFine.matches) return;
      if (video.dataset.hold === "1") return;
      video.pause();
    });
  }

  function selectClip(card, index, play) {
    const found = state.keys.get(card.dataset.key);
    const clips = found?.clips || [];
    if (!clips.length) return;
    const next = Math.max(0, Math.min(index, clips.length - 1));
    const clip = clips[next];
    const video = card.querySelector(".player video");
    const player = card.querySelector(".player");
    if (!video || !player) return;
    card.dataset.clip = String(next);
    resetSource(video);
    video.dataset.src = clip.src;
    if (clip.poster) {
      video.poster = clip.poster;
      video.dataset.poster = clip.poster;
    } else {
      video.removeAttribute("poster");
      delete video.dataset.poster;
    }
    if (clip.width && clip.height) {
      video.width = clip.width;
      video.height = clip.height;
      video.style.aspectRatio = `${clip.width} / ${clip.height}`;
    }
    const pill = player.querySelector(".duration-pill");
    const label = pillText(clips, next);
    if (pill) {
      pill.textContent = label;
      pill.hidden = !label;
    }
    card.querySelectorAll(".clip-btn").forEach((button, buttonIndex) => {
      button.setAttribute("aria-selected", buttonIndex === next ? "true" : "false");
    });
    if (play) {
      video.dataset.hold = "1";
      playClip(video);
    }
  }

  const posterObserver = new IntersectionObserver((observed) => {
    observed.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const video = entry.target.querySelector("video");
      if (video && video.dataset.poster && !video.getAttribute("poster")) {
        video.poster = video.dataset.poster;
      }
      posterObserver.unobserve(entry.target);
    });
  }, { rootMargin: "600px 0px" });

  function buildCard(entry, dayDate, eager) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.key = `${dayDate}:${entry.id}`;
    card.dataset.clip = "0";

    const clips = clipsOf(entry);
    const models = modelsOf(entry);
    if (clips.length) {
      const clip = clips[0];
      const player = document.createElement("div");
      player.className = "player is-paused";
      const video = document.createElement("video");
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = true;
      video.preload = "none";
      video.setAttribute("muted", "");
      video.setAttribute("loop", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("preload", "none");
      video.setAttribute("aria-label", entry.title || "视频");
      video.dataset.src = clip.src;
      if (clip.poster) video.dataset.poster = clip.poster;
      if (clip.width && clip.height) {
        video.width = clip.width;
        video.height = clip.height;
        video.style.aspectRatio = `${clip.width} / ${clip.height}`;
      }
      if (eager && clip.poster) video.poster = clip.poster;
      player.appendChild(video);

      const duration = pillText(clips, 0);
      const pill = document.createElement("span");
      pill.className = "count-pill is-top duration-pill";
      pill.textContent = duration;
      pill.hidden = !duration;
      player.appendChild(pill);

      const play = document.createElement("button");
      play.type = "button";
      play.className = "play-hit";
      play.setAttribute("aria-label", `播放${entry.title ? `：${entry.title}` : "视频"}`);
      const glyph = document.createElement("span");
      glyph.className = "play-glyph";
      glyph.setAttribute("aria-hidden", "true");
      play.appendChild(glyph);
      player.appendChild(play);
      bindVideo(video, player);
      card.appendChild(player);
      if (!eager) posterObserver.observe(player);

      if (clips.length > 1) {
        const row = document.createElement("div");
        row.className = "clips";
        row.setAttribute("role", "tablist");
        row.setAttribute("aria-label", "选择片段");
        clips.forEach((item, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "clip-btn";
          button.dataset.index = String(index);
          button.setAttribute("role", "tab");
          button.setAttribute("aria-selected", index === 0 ? "true" : "false");
          const caption = [item.label, formatDuration(item.duration)].filter(Boolean).join(" · ");
          button.setAttribute("aria-label", caption || `片段 ${index + 1}`);
          if (item.poster) {
            const img = document.createElement("img");
            img.alt = "";
            img.loading = "lazy";
            img.decoding = "async";
            img.src = item.poster;
            button.appendChild(img);
          }
          const span = document.createElement("span");
          span.textContent = caption || `片段 ${index + 1}`;
          button.appendChild(span);
          row.appendChild(button);
        });
        card.appendChild(row);
      }
    } else {
      const fail = document.createElement("div");
      fail.className = "img-fail";
      fail.textContent = "暂无视频";
      card.appendChild(fail);
    }

    const body = document.createElement("div");
    body.className = "body";

    const title = document.createElement("h3");
    title.textContent = entry.title || "未命名";
    body.appendChild(title);

    const badges = document.createElement("div");
    badges.className = "badges";
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.dataset.group = familyOf(models);
    const dot = document.createElement("i");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");
    badge.append(dot, document.createTextNode(entry.model || models[0] || "未注明"));
    badges.appendChild(badge);
    if (models.length > 1) {
      const compare = document.createElement("span");
      compare.className = "tag-compare";
      compare.textContent = "多模型对比";
      badges.appendChild(compare);
    }
    if (entry.needsReference) {
      const tag = document.createElement("span");
      tag.className = "tag-ref";
      tag.textContent = "需参考素材";
      badges.appendChild(tag);
    }
    body.appendChild(badges);

    if (entry.note) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = entry.note;
      body.appendChild(note);
    }

    const meta = document.createElement("div");
    meta.className = "meta";
    const authorHref = profileUrl(entry);
    const author = document.createElement(authorHref ? "a" : "span");
    author.className = "author";
    author.textContent = entry.author ? `@${entry.author}` : "未知作者";
    if (entry.authorName) author.title = entry.authorName;
    if (authorHref) {
      author.href = authorHref;
      author.target = "_blank";
      author.rel = "noopener noreferrer";
    }
    meta.appendChild(author);

    const when = parsePostTime(entry, dayDate);
    const time = document.createElement("time");
    if (when.iso) time.dateTime = when.iso;
    time.textContent = when.label;
    meta.appendChild(time);

    const likes = document.createElement("span");
    likes.className = "stat";
    likes.append(icon("M12 21s-6.7-4.35-9.33-8.1C.8 10.4 1.1 7 3.6 5.4 5.4 4.2 7.6 4.6 9 6l3 3 3-3c1.4-1.4 3.6-1.8 5.4-.6 2.5 1.6 2.8 5 .93 7.5C18.7 16.65 12 21 12 21z"), document.createTextNode(num(entry.likes)));
    likes.setAttribute("aria-label", `${num(entry.likes)} 赞`);
    const marks = document.createElement("span");
    marks.className = "stat";
    marks.append(icon("M6 3h12a1 1 0 0 1 1 1v17l-7-3.5L5 21V4a1 1 0 0 1 1-1z"), document.createTextNode(num(entry.bookmarks)));
    marks.setAttribute("aria-label", `${num(entry.bookmarks)} 收藏`);
    meta.append(likes, marks);

    const href = postUrl(entry);
    if (href) {
      const origin = document.createElement("a");
      origin.className = "origin";
      origin.href = href;
      origin.target = "_blank";
      origin.rel = "noopener noreferrer";
      origin.textContent = "原帖";
      origin.setAttribute("aria-label", `在 X 上查看 @${entry.author || "作者"} 的原帖`);
      meta.appendChild(origin);
    }
    body.appendChild(meta);

    const prompt = document.createElement("p");
    prompt.className = "prompt-text";
    prompt.textContent = entry.prompt || "";
    body.appendChild(prompt);

    const actions = document.createElement("div");
    actions.className = "actions";
    if ((entry.prompt || "").trim()) {
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "btn btn-primary copy";
      copy.textContent = "复制 prompt";
      actions.appendChild(copy);
    }
    const expand = document.createElement("button");
    expand.type = "button";
    expand.className = "btn expand";
    expand.textContent = "展开";
    expand.setAttribute("aria-expanded", "false");
    expand.hidden = true;
    actions.appendChild(expand);
    body.appendChild(actions);
    card.appendChild(body);
    return { card, clips };
  }

  function allEntries() {
    return state.days.flatMap((day) => day.entries);
  }

  function tallyModels(entries) {
    const counts = new Map();
    entries.forEach((entry) => {
      [...new Set(modelsOf(entry))].forEach((name) => {
        counts.set(name, (counts.get(name) || 0) + 1);
      });
    });
    const names = [...counts.keys()].sort((a, b) => {
      if (a === "未注明") return 1;
      if (b === "未注明") return -1;
      return counts.get(b) - counts.get(a) || a.localeCompare(b, "zh");
    });
    return names.map((name) => ({ name, count: counts.get(name) }));
  }

  function renderChips() {
    const entries = allEntries();
    els.chips.replaceChildren();
    const items = [{ name: "全部", count: entries.length }, ...tallyModels(entries)];
    if (!items.some((item) => item.name === state.group)) state.group = "全部";
    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.group = item.name;
      button.setAttribute("aria-pressed", item.name === state.group ? "true" : "false");
      button.append(document.createTextNode(item.name));
      const count = document.createElement("span");
      count.className = "chip-count";
      count.textContent = String(item.count);
      button.appendChild(count);
      els.chips.appendChild(button);
    });
  }

  function sortEntries(entries, dayIso) {
    return entries.map((entry, index) => ({ entry, index })).sort((a, b) => {
      if (state.sort === "time") {
        const delta = parsePostTime(b.entry, dayIso).ms - parsePostTime(a.entry, dayIso).ms;
        if (delta) return delta;
      }
      const deltaHeat = heat(b.entry) - heat(a.entry);
      if (deltaHeat) return deltaHeat;
      return a.index - b.index;
    });
  }

  function applyView() {
    const query = norm(state.query.trim());
    let shown = 0;
    state.days.forEach((day) => {
      const section = document.getElementById(`day-${day.date}`);
      if (!section) return;
      const gallery = section.querySelector(".gallery");
      let visible = 0;
      sortEntries(day.entries, day.date).forEach(({ entry }) => {
        const key = `${day.date}:${entry.id}`;
        const card = gallery.querySelector(`[data-key="${CSS.escape(key)}"]`);
        if (!card) return;
        gallery.appendChild(card);
        const groupOk = state.group === "全部" || modelsOf(entry).includes(state.group);
        const textOk = !query || norm(entry.title).includes(query) || norm(entry.prompt).includes(query);
        const ok = groupOk && textOk;
        card.hidden = !ok;
        if (!ok) {
          const video = card.querySelector("video");
          if (video && !video.paused) video.pause();
        }
        if (ok) visible += 1;
      });
      section.hidden = visible === 0;
      shown += visible;
    });

    const loaded = allEntries().length;
    const total = (state.index?.dates || []).reduce((sum, day) => sum + (Number(day.count) || 0), 0);
    const sortLabel = state.sort === "time" ? "按时间" : "按热度（赞 + 收藏）";
    const more = state.cursor < (state.index?.dates.length || 0);
    els.result.textContent = loaded
      ? `显示 ${shown} / ${loaded} 条${more ? ` · 共 ${total} 条` : ""} · ${sortLabel}`
      : "";
    const finished = state.index && state.cursor >= state.index.dates.length && !state.flight;
    els.empty.hidden = shown !== 0 || !finished;
    els.empty.textContent = query || state.group !== "全部" ? "没有匹配的提示词" : "还没有提示词";
    chromeUi.setFiltered(Boolean(state.query.trim()) || state.group !== "全部" || state.sort !== "heat");
    requestAnimationFrame(syncVisibleExpands);
  }

  function appendDay(day, item) {
    const date = day.date || item.date;
    const section = document.createElement("section");
    section.className = "day";
    section.id = `day-${date}`;
    const heading = document.createElement("h2");
    heading.className = "day-head";
    heading.textContent = `${formatDayShort(date)} · ${day.entries.length}条`;
    const gallery = document.createElement("div");
    gallery.className = "gallery";
    const eagerBase = state.days.length === 0;
    sortEntries(day.entries, date).forEach(({ entry }, index) => {
      const built = buildCard(entry, date, eagerBase && index < 3);
      state.keys.set(built.card.dataset.key, { entry, date, clips: built.clips });
      gallery.appendChild(built.card);
    });
    section.append(heading, gallery);
    els.gallery.appendChild(section);
    state.days.push({ date, entries: day.entries });
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    return {
      date: params.get("date") || "",
      q: params.get("q") || "",
      g: params.get("g") || "全部",
      sort: params.get("sort") === "time" ? "time" : "heat",
    };
  }

  function writeUrl() {
    const params = new URLSearchParams();
    params.set("view", "video");
    if (state.query.trim()) params.set("q", state.query.trim());
    if (state.group && state.group !== "全部") params.set("g", state.group);
    if (state.sort === "time") params.set("sort", "time");
    const query = params.toString();
    const hash = location.hash || "";
    history.replaceState(null, "", `${location.pathname}?${query}${hash}`);
  }

  function syncSortButtons() {
    document.querySelectorAll(".sort button").forEach((button) => {
      button.setAttribute("aria-checked", button.dataset.sort === state.sort ? "true" : "false");
    });
  }

  async function loadJson(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }

  function setMoreLabel() {
    if (!state.index) return;
    if (state.cursor >= state.index.dates.length) {
      els.more.textContent = state.days.length ? "已经是最早的一天" : "";
    } else if (state.days.length) {
      els.more.textContent = "继续下拉，查看更早的日期";
    } else {
      els.more.textContent = "";
    }
  }

  function maybeFill() {
    if (state.flight || !state.index || state.cursor >= state.index.dates.length) return;
    const rect = els.more.getBoundingClientRect();
    if (rect.top < window.innerHeight + 700) loadNextDay();
  }

  async function loadNextDay() {
    if (state.flight) return state.flight;
    if (!state.index || state.cursor >= state.index.dates.length) return;
    const run = async () => {
      const item = state.index.dates[state.cursor];
      const first = state.days.length === 0;
      if (first) {
        els.status.hidden = false;
        els.status.textContent = "正在加载…";
      } else {
        els.more.textContent = "正在加载更早的日期…";
      }
      const day = await loadJson(item.file);
      if (!day || !Array.isArray(day.entries)) throw new Error("schema");
      if (!day.date) day.date = item.date;
      state.cursor += 1;
      appendDay(day, item);
      if (first) {
        els.status.hidden = true;
        document.title = "如水如画 · AI 视频提示词日报";
      }
      setMoreLabel();
      renderChips();
      applyView();
    };
    state.flight = run().finally(() => {
      state.flight = null;
    });
    try {
      await state.flight;
    } catch {
      if (state.days.length === 0) {
        els.status.hidden = false;
        els.status.textContent = "这一天的数据加载失败，请刷新重试。";
      } else {
        els.more.textContent = "更早的日期加载失败，继续下拉重试";
      }
      return;
    }
    maybeFill();
  }

  async function jumpTo(date) {
    if (!state.index.dates.some((day) => day.date === date)) return;
    let guard = 0;
    while (!state.days.some((day) => day.date === date) && guard < state.index.dates.length) {
      const before = state.cursor;
      await loadNextDay();
      guard += 1;
      if (state.cursor === before) break;
    }
    const section = document.getElementById(`day-${date}`);
    if (!section) {
      toast("这一天加载失败");
      return;
    }
    if (section.hidden) {
      toast("这一天没有符合当前筛选的提示词");
      return;
    }
    if (document.activeElement === els.date) els.date.blur();
    chromeUi.collapseForNav();
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const chromeUi = {
    collapseForNav() {},
    close() {},
    expand() {},
    setFiltered() {},
  };

  function installChrome(startOpen) {
    const chrome = document.querySelector("#chrome");
    const toggle = document.querySelector("#filter-toggle");
    const mast = document.querySelector(".mast");
    const mastSide = document.querySelector("#mast-side");
    if (!chrome || !toggle || !mast || !mastSide) return;

    const mq = window.matchMedia("(max-width: 680px)");
    let open = !!startOpen;
    let floatLatch = false;
    let lastY = window.scrollY || 0;
    let lastScrollAt = 0;
    let drift = 0;
    let guardUntil = 0;
    let suspendUntil = 0;
    let touchingChrome = false;
    let applied = "";

    function editingField() {
      const el = document.activeElement;
      return !!(el && chrome.contains(el) && el.matches("input, textarea"));
    }

    function render(force) {
      const mobileNow = mq.matches;
      const y = Math.max(0, window.scrollY || 0);
      if (!mobileNow || !open) floatLatch = false;
      else if (y <= 8) floatLatch = false;
      else if (y > 24) floatLatch = true;
      const float = mobileNow && open && floatLatch;
      const key = `${mobileNow ? 1 : 0}${open ? 1 : 0}${float ? 1 : 0}`;
      if (!force && key === applied) return;
      applied = key;

      toggle.hidden = !mobileNow;
      chrome.classList.toggle("is-collapsed", mobileNow && !open);
      chrome.classList.toggle("is-open", mobileNow && open);
      chrome.classList.toggle("is-float", float);
      toggle.setAttribute("aria-expanded", mobileNow && open ? "true" : "false");
      const label = mobileNow && open ? "收起" : "筛选";
      if (toggle.textContent !== label) toggle.textContent = label;

      if (float) {
        const dateH = Math.ceil(mastSide.getBoundingClientRect().height);
        if (dateH) chrome.style.setProperty("--date-h", `${dateH}px`);
      }
      if (!mobileNow || !open || float) {
        const bar = Math.ceil(chrome.getBoundingClientRect().height);
        if (bar) document.documentElement.style.setProperty("--chrome-bar", `${bar}px`);
      }
    }

    function setOpen(next) {
      const mobileNow = mq.matches;
      const resolved = mobileNow ? !!next : false;
      if (resolved === open && mobileNow) {
        render();
        return;
      }
      open = resolved;
      guardUntil = performance.now() + 320;
      render(true);
      lastY = Math.max(0, window.scrollY || 0);
    }

    toggle.addEventListener("click", () => {
      if (!mq.matches) return;
      setOpen(!open);
    });
    mast.addEventListener("click", (event) => {
      if (!mq.matches) return;
      if (event.target.closest("select, label, .filter-toggle, input, button, a")) return;
      setOpen(!open);
    });
    document.addEventListener("click", (event) => {
      if (!mq.matches || !open || chrome.contains(event.target)) return;
      setOpen(false);
    });
    chrome.addEventListener("touchstart", () => { touchingChrome = true; }, { passive: true });
    chrome.addEventListener("touchend", () => { touchingChrome = false; }, { passive: true });
    chrome.addEventListener("touchcancel", () => { touchingChrome = false; }, { passive: true });

    window.addEventListener("scroll", () => {
      const y = Math.max(0, window.scrollY || 0);
      const dy = y - lastY;
      lastY = y;
      if (!mq.matches) return;
      const now = performance.now();
      if (now < suspendUntil || touchingChrome || editingField() || now < guardUntil) {
        drift = 0;
        lastScrollAt = now;
        render();
        return;
      }
      if (now - lastScrollAt > 180) drift = 0;
      lastScrollAt = now;
      if ((dy > 0 && drift < 0) || (dy < 0 && drift > 0)) drift = 0;
      drift += dy;
      if (drift >= 40 && open) {
        drift = 0;
        setOpen(false);
      } else if (drift <= -40 && !open) {
        drift = 0;
        setOpen(true);
      } else render();
    }, { passive: true });

    mq.addEventListener("change", () => {
      if (!mq.matches) open = false;
      floatLatch = false;
      lastY = Math.max(0, window.scrollY || 0);
      render(true);
    });
    window.visualViewport?.addEventListener("resize", () => render(true), { passive: true });
    render(true);

    chromeUi.collapseForNav = () => {
      suspendUntil = performance.now() + 2200;
      drift = 0;
      setOpen(false);
      const release = () => { suspendUntil = 0; };
      window.setTimeout(() => {
        if (!suspendUntil) return;
        window.addEventListener("scrollend", release, { once: true });
      }, 80);
      window.setTimeout(release, 2200);
    };
    chromeUi.close = () => setOpen(false);
    chromeUi.expand = () => {
      if (!mq.matches) return;
      suspendUntil = 0;
      setOpen(true);
    };
    chromeUi.setFiltered = (on) => {
      toggle.classList.toggle("is-filtered", !!on);
    };
  }

  function onGalleryClick(event) {
    const play = event.target.closest(".play-hit");
    if (play) {
      const video = play.closest(".player")?.querySelector("video");
      if (!video) return;
      video.dataset.hold = "1";
      playClip(video);
      return;
    }
    const clipBtn = event.target.closest(".clip-btn");
    if (clipBtn) {
      const card = clipBtn.closest(".card");
      if (card) selectClip(card, Number(clipBtn.dataset.index), true);
      return;
    }
    const card = event.target.closest(".card");
    if (!card) return;
    const found = state.keys.get(card.dataset.key);
    if (!found) return;
    if (event.target.closest("a, video, .player")) return;
    const copy = event.target.closest(".copy");
    if (copy) {
      copyPrompt(found.entry, copy);
      return;
    }
    const expand = event.target.closest(".expand");
    if (expand) {
      card.classList.toggle("is-open");
      syncExpand(card);
    }
  }

  function fillDateSelect() {
    els.date.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "选择日期";
    els.date.appendChild(placeholder);
    state.index.dates.forEach((day) => {
      const option = document.createElement("option");
      option.value = day.date;
      option.textContent = `${formatDay(day.date)} · ${day.count} 条`;
      els.date.appendChild(option);
    });
    els.date.value = "";
  }

  async function init() {
    const urlState = readUrl();
    state.query = urlState.q;
    state.group = urlState.g || "全部";
    state.sort = urlState.sort;
    els.q.value = state.query;
    els.clear.hidden = !state.query;
    syncSortButtons();
    installChrome(Boolean(urlState.q) || (Boolean(urlState.g) && urlState.g !== "全部") || urlState.sort === "time");
    chromeUi.setFiltered(Boolean(state.query.trim()) || state.group !== "全部" || state.sort !== "heat");

    els.date.addEventListener("change", () => {
      const value = els.date.value;
      els.date.value = "";
      if (value) jumpTo(value);
    });
    els.q.addEventListener("input", () => {
      state.query = els.q.value;
      els.clear.hidden = !state.query;
      if (state.days.length) {
        applyView();
        writeUrl();
        maybeFill();
      }
    });
    els.clear.addEventListener("click", () => {
      els.q.value = "";
      state.query = "";
      els.clear.hidden = true;
      els.q.focus();
      if (state.days.length) {
        applyView();
        writeUrl();
        maybeFill();
      }
    });
    document.querySelector(".sort").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-sort]");
      if (!button || button.dataset.sort === state.sort) return;
      state.sort = button.dataset.sort;
      syncSortButtons();
      if (state.days.length) {
        applyView();
        writeUrl();
      }
    });
    els.chips.addEventListener("click", (event) => {
      const button = event.target.closest(".chip");
      if (!button) return;
      state.group = button.dataset.group;
      els.chips.querySelectorAll(".chip").forEach((chip) => {
        chip.setAttribute("aria-pressed", chip === button ? "true" : "false");
      });
      applyView();
      writeUrl();
      maybeFill();
    });
    els.gallery.addEventListener("click", onGalleryClick);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") chromeUi.close();
      const typing = event.target.closest("input, textarea, select");
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        chromeUi.expand();
        els.q.focus();
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) return;
      document.querySelectorAll(".player video").forEach((video) => {
        if (!video.paused) video.pause();
      });
    });

    function syncToTop() {
      const on = window.scrollY > 420;
      els.toTop.classList.toggle("is-on", on);
      els.toTop.setAttribute("aria-hidden", on ? "false" : "true");
      els.toTop.tabIndex = on ? 0 : -1;
    }
    window.addEventListener("scroll", syncToTop, { passive: true });
    syncToTop();
    els.toTop.addEventListener("click", () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(syncVisibleExpands, 120);
    });
    document.fonts?.ready?.then(syncVisibleExpands);

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadNextDay();
    }, { rootMargin: "700px 0px" });
    observer.observe(els.more);

    try {
      state.index = await loadJson("data/videos/index.json");
      if (!state.index?.dates?.length) throw new Error("empty");
      state.index.dates = state.index.dates
        .filter((day) => day && typeof day.date === "string" && typeof day.file === "string")
        .sort((a, b) => b.date.localeCompare(a.date));
      if (!state.index.dates.length) throw new Error("empty");
      fillDateSelect();
      await loadNextDay();
      if (urlState.date && urlState.date !== state.index.dates[0].date) jumpTo(urlState.date);
    } catch {
      els.status.hidden = false;
      els.status.textContent = "日期索引加载失败，请刷新重试。";
    }
  }

  init();
})();
