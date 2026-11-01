(() => {
  const PREVIEW_LINES = 4;

  const els = {
    date: document.querySelector("#date"),
    q: document.querySelector("#q"),
    clear: document.querySelector("#clear"),
    chips: document.querySelector("#chips"),
    result: document.querySelector("#result"),
    gallery: document.querySelector("#gallery"),
    empty: document.querySelector("#empty"),
    status: document.querySelector("#status"),
    toast: document.querySelector("#toast"),
    lightbox: document.querySelector("#lightbox"),
    lbCaption: document.querySelector("#lb-caption"),
    lbClose: document.querySelector("#lb-close"),
    lbPrev: document.querySelector("#lb-prev"),
    lbNext: document.querySelector("#lb-next"),
    lbImg: document.querySelector("#lb-img"),
    lbCounter: document.querySelector("#lb-counter"),
    lbThumbs: document.querySelector("#lb-thumbs"),
    lbStage: document.querySelector("#lb-stage"),
  };

  const state = {
    index: null,
    day: null,
    date: "",
    group: "全部",
    sort: "heat",
    query: "",
    lb: null,
    lastFocus: null,
    toastTimer: 0,
    loadToken: 0,
  };

  const NS = "http://www.w3.org/2000/svg";

  function formatDay(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!match) return iso || "";
    return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
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

  function safeRemote(url) {
    if (typeof url !== "string" || !url.trim()) return "";
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "https:") return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  function sourcesOf(entry) {
    return (entry.images || []).map((image) => {
      const local = safeLocal(image.local);
      const remote = safeRemote(image.remote);
    const width = Number(image.width) || 0;
    const height = Number(image.height) || 0;
    return {
      src: local || remote,
      fallback: local && remote ? remote : "",
      width: width > 0 ? width : 0,
      height: height > 0 ? height : 0,
    };
  }).filter((item) => item.src);
}

  function handle(entry) {
    return /^[A-Za-z0-9_]{1,30}$/.test(entry.author || "") ? entry.author : "";
  }

  function postUrl(entry) {
    const author = handle(entry);
    if (!author || !/^\d+$/.test(entry.id || "")) return "";
    return `https://x.com/${author}/status/${entry.id}`;
  }

  function profileUrl(entry) {
    const author = handle(entry);
    return author ? `https://x.com/${author}` : "";
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
    toast(ok ? "已复制 prompt" : "复制失败，请展开后手动选择");
    if (ok && button) {
      button.textContent = "已复制";
      button.classList.add("is-done");
      window.setTimeout(() => {
        button.textContent = "复制 prompt";
        button.classList.remove("is-done");
      }, 1600);
    }
  }

  function attachImage(img, source) {
    img.referrerPolicy = "no-referrer";
    img.decoding = "async";
    img.alt = img.alt || "";
    if (source.width > 0 && source.height > 0) {
      img.width = source.width;
      img.height = source.height;
    }
    if (source.fallback) img.dataset.fallback = source.fallback;
    img.addEventListener("error", () => {
      if (img.dataset.fallback && !img.dataset.fellback) {
        img.dataset.fellback = "1";
        img.removeAttribute("srcset");
        img.src = img.dataset.fallback;
        return;
      }
      const fail = document.createElement("span");
      fail.className = "img-fail";
      fail.textContent = "图片未能加载";
      img.replaceWith(fail);
    });
    img.src = source.src;
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

  function buildCard(entry, index) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = entry.id;
    card.dataset.index = String(index);

    const sources = sourcesOf(entry);
    if (sources.length) {
      const shot = document.createElement("button");
      shot.type = "button";
      shot.className = "shot";
      shot.setAttribute("aria-label", sources.length > 1 ? `查看图片，共 ${sources.length} 张` : "查看图片");
      const img = document.createElement("img");
      img.alt = entry.title || "配图";
      if (index < 3) {
        img.loading = "eager";
        img.fetchPriority = "high";
      } else {
        img.loading = "lazy";
      }
      attachImage(img, sources[0]);
      shot.appendChild(img);
      if (sources.length > 1) {
        const pill = document.createElement("span");
        pill.className = "count-pill";
        pill.textContent = `${sources.length} 张`;
        shot.appendChild(pill);
      }
      card.appendChild(shot);
    } else {
      const fail = document.createElement("div");
      fail.className = "img-fail";
      fail.textContent = "暂无配图";
      card.appendChild(fail);
    }

    const body = document.createElement("div");
    body.className = "body";

    const title = document.createElement("h2");
    title.textContent = entry.title || "未命名";
    body.appendChild(title);

    const badges = document.createElement("div");
    badges.className = "badges";
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.dataset.group = entry.group || "";
    const dot = document.createElement("i");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");
    badge.append(dot, document.createTextNode(entry.model || "未注明"));
    badges.appendChild(badge);
    if (entry.needsReference) {
      const tag = document.createElement("span");
      tag.className = "tag-ref";
      tag.textContent = "需配参考图";
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
    if (authorHref) {
      author.href = authorHref;
      author.target = "_blank";
      author.rel = "noopener noreferrer";
    }
    meta.appendChild(author);

    const when = parsePostTime(entry, state.day.date);
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
      origin.setAttribute("aria-label", `在 X 上查看 @${entry.author} 的原帖`);
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
    return card;
  }

  function groupsOf(entries) {
    const counts = new Map();
    entries.forEach((entry) => {
      const name = entry.group || "未分组";
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    const names = [...counts.keys()].sort((a, b) => {
      if (a === "未注明") return 1;
      if (b === "未注明") return -1;
      return counts.get(b) - counts.get(a) || a.localeCompare(b, "zh");
    });
    return names.map((name) => ({ name, count: counts.get(name) }));
  }

  function renderChips() {
    const entries = state.day.entries;
    els.chips.replaceChildren();
    const items = [{ name: "全部", count: entries.length }, ...groupsOf(entries)];
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

  function applyView() {
    const entries = state.day.entries.map((entry, index) => ({ entry, index }));
    entries.sort((a, b) => {
      if (state.sort === "time") {
        const delta = parsePostTime(b.entry, state.day.date).ms - parsePostTime(a.entry, state.day.date).ms;
        if (delta) return delta;
      }
      const deltaHeat = heat(b.entry) - heat(a.entry);
      if (deltaHeat) return deltaHeat;
      return a.index - b.index;
    });

    const query = norm(state.query.trim());
    let shown = 0;
    entries.forEach(({ entry }) => {
      const card = els.gallery.querySelector(`.card[data-id="${CSS.escape(entry.id)}"]`);
      if (!card) return;
      els.gallery.appendChild(card);
      const groupOk = state.group === "全部" || (entry.group || "未分组") === state.group;
      const textOk = !query || norm(entry.title).includes(query) || norm(entry.prompt).includes(query);
      const visible = groupOk && textOk;
      card.hidden = !visible;
      if (visible) shown += 1;
    });

    const total = state.day.entries.length;
    const sortLabel = state.sort === "time" ? "按时间" : "按热度（赞 + 收藏）";
    els.result.textContent = total ? `显示 ${shown} / ${total} 条 · ${sortLabel}` : "这一天还没有提示词";
    els.empty.hidden = shown !== 0;
    els.empty.textContent = query || state.group !== "全部" ? "没有匹配的提示词" : "这一天还没有提示词";
    requestAnimationFrame(syncVisibleExpands);
  }

  function renderDay(day) {
    state.day = day;
    els.gallery.replaceChildren();
    const fragment = document.createDocumentFragment();
    day.entries.forEach((entry, index) => fragment.appendChild(buildCard(entry, index)));
    els.gallery.appendChild(fragment);
    renderChips();
    applyView();
    document.title = `${formatDay(day.date)} · 如水如画`;
    els.status.hidden = true;
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
    if (state.date) params.set("date", state.date);
    if (state.query.trim()) params.set("q", state.query.trim());
    if (state.group && state.group !== "全部") params.set("g", state.group);
    if (state.sort === "time") params.set("sort", "time");
    const query = params.toString();
    history.replaceState(null, "", query ? `${location.pathname}?${query}` : location.pathname);
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

  async function loadDay(date) {
    const token = ++state.loadToken;
    const item = state.index.dates.find((day) => day.date === date) || state.index.dates[0];
    els.status.hidden = false;
    els.status.textContent = "正在加载…";
    els.empty.hidden = true;
    els.gallery.replaceChildren();
    try {
      const day = await loadJson(item.file);
      if (token !== state.loadToken) return;
      if (!day || !Array.isArray(day.entries)) throw new Error("schema");
      if (!day.date) day.date = item.date;
      state.date = item.date;
      els.date.value = item.date;
      renderDay(day);
      writeUrl();
    } catch {
      if (token !== state.loadToken) return;
      els.status.hidden = false;
      els.status.textContent = "这一天的数据加载失败，请刷新重试。";
    }
  }

  function entryById(id) {
    return state.day?.entries.find((entry) => entry.id === id) || null;
  }

  function closeLightbox() {
    if (!state.lb) return;
    state.lb = null;
    els.lightbox.hidden = true;
    document.documentElement.style.overflow = "";
    els.lbImg.removeAttribute("src");
    if (state.lastFocus && typeof state.lastFocus.focus === "function") state.lastFocus.focus();
  }

  function renderLightbox() {
    const entry = entryById(state.lb.id);
    const sources = entry ? sourcesOf(entry) : [];
    if (!entry || !sources.length) {
      closeLightbox();
      return;
    }
    state.lb.index = (state.lb.index + sources.length) % sources.length;
    const source = sources[state.lb.index];
    els.lbCaption.textContent = entry.title || "";
    els.lbCounter.textContent = sources.length > 1 ? `${state.lb.index + 1} / ${sources.length}` : "";
    els.lbCounter.hidden = sources.length < 2;
    const single = sources.length < 2;
    els.lbPrev.classList.toggle("is-dim", single);
    els.lbNext.classList.toggle("is-dim", single);
    els.lbPrev.disabled = single;
    els.lbNext.disabled = single;
    els.lbThumbs.hidden = single;
    const img = document.createElement("img");
    img.id = "lb-img";
    img.alt = entry.title || "配图";
    attachImage(img, source);
    els.lbImg.replaceWith(img);
    els.lbImg = img;

    els.lbThumbs.replaceChildren();
    sources.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `第 ${index + 1} 张`);
      button.setAttribute("aria-current", index === state.lb.index ? "true" : "false");
      const thumb = document.createElement("img");
      thumb.alt = "";
      attachImage(thumb, item);
      button.appendChild(thumb);
      button.addEventListener("click", () => {
        state.lb.index = index;
        renderLightbox();
      });
      els.lbThumbs.appendChild(button);
    });
  }

  function openLightbox(entry, index) {
    const sources = sourcesOf(entry);
    if (!sources.length) return;
    state.lastFocus = document.activeElement;
    state.lb = { id: entry.id, index };
    els.lightbox.hidden = false;
    document.documentElement.style.overflow = "hidden";
    renderLightbox();
    els.lbClose.focus();
  }

  function stepLightbox(delta) {
    if (!state.lb) return;
    state.lb.index += delta;
    renderLightbox();
  }

  function onGalleryClick(event) {
    const card = event.target.closest(".card");
    if (!card) return;
    const entry = entryById(card.dataset.id);
    if (!entry) return;
    if (event.target.closest(".shot")) {
      openLightbox(entry, 0);
      return;
    }
    const copy = event.target.closest(".copy");
    if (copy) {
      copyPrompt(entry, copy);
      return;
    }
    const expand = event.target.closest(".expand");
    if (expand) {
      card.classList.toggle("is-open");
      syncExpand(card);
    }
  }

  function trapTab(event) {
    if (event.key !== "Tab" || els.lightbox.hidden) return;
    const nodes = [...els.lightbox.querySelectorAll("button, a, input")].filter((node) => !node.hidden && node.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function init() {
    const urlState = readUrl();
    state.query = urlState.q;
    state.group = urlState.g || "全部";
    state.sort = urlState.sort;
    els.q.value = state.query;
    els.clear.hidden = !state.query;
    syncSortButtons();

    els.date.addEventListener("change", () => loadDay(els.date.value));
    els.q.addEventListener("input", () => {
      state.query = els.q.value;
      els.clear.hidden = !state.query;
      if (state.day) {
        applyView();
        writeUrl();
      }
    });
    els.clear.addEventListener("click", () => {
      els.q.value = "";
      state.query = "";
      els.clear.hidden = true;
      els.q.focus();
      if (state.day) {
        applyView();
        writeUrl();
      }
    });
    document.querySelector(".sort").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-sort]");
      if (!button || button.dataset.sort === state.sort) return;
      state.sort = button.dataset.sort;
      syncSortButtons();
      if (state.day) {
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
    });
    els.gallery.addEventListener("click", onGalleryClick);
    els.lbClose.addEventListener("click", closeLightbox);
    els.lbPrev.addEventListener("click", () => stepLightbox(-1));
    els.lbNext.addEventListener("click", () => stepLightbox(1));
    els.lightbox.addEventListener("click", (event) => {
      const target = event.target;
      if (target === els.lightbox || target === els.lbStage || target.classList?.contains("lb-figure")) {
        closeLightbox();
      }
    });
    document.addEventListener("keydown", (event) => {
      trapTab(event);
      if (event.key === "Escape" && state.lb) closeLightbox();
      if (state.lb && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        stepLightbox(event.key === "ArrowRight" ? 1 : -1);
      }
      const typing = event.target.closest("input, textarea, select");
      if (event.key === "/" && !typing && !state.lb && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        els.q.focus();
      }
    });

    let touchX = null;
    els.lbStage.addEventListener("touchstart", (event) => {
      touchX = event.changedTouches[0].clientX;
    }, { passive: true });
    els.lbStage.addEventListener("touchend", (event) => {
      if (touchX == null) return;
      const delta = event.changedTouches[0].clientX - touchX;
      if (delta > 48) stepLightbox(-1);
      else if (delta < -48) stepLightbox(1);
      touchX = null;
    }, { passive: true });

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(syncVisibleExpands, 120);
    });
    document.fonts?.ready?.then(syncVisibleExpands);

    try {
      state.index = await loadJson("data/index.json");
    if (!state.index?.dates?.length) throw new Error("empty");
    state.index.dates = state.index.dates
      .filter((day) => day && typeof day.date === "string" && typeof day.file === "string")
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!state.index.dates.length) throw new Error("empty");
    els.date.replaceChildren();
      state.index.dates.forEach((day) => {
        const option = document.createElement("option");
        option.value = day.date;
        option.textContent = `${formatDay(day.date)} · ${day.count} 条`;
        els.date.appendChild(option);
      });
      const known = state.index.dates.some((day) => day.date === urlState.date);
      await loadDay(known ? urlState.date : state.index.dates[0].date);
    } catch {
      els.status.hidden = false;
      els.status.textContent = "日期索引加载失败，请刷新重试。";
    }
  }

  init();
})();
