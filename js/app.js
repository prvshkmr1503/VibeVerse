/* =========================================
   VibeVerse • app.js
   ========================================= */

(() => {
  // ---------- Config ----------
  const CFG = window.__VIBEVERSE__ || {};
  const VIDEO_DIR = (CFG.videoFolder || "assets/Videos").replace(/\/+$/, "");
  const IMG_DIR = (CFG.imageFolder || "assets/images").replace(/\/+$/, "");
  let PLAYLIST = Array.isArray(CFG.videos) ? [...CFG.videos] : [];
  let IMAGE_LIST = Array.isArray(CFG.images) ? [...CFG.images] : [];
  let STARTER_QUOTES = Array.isArray(CFG.starterQuotes) ? CFG.starterQuotes : [];

  // ---------- DOM ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const bgVideo = $("#bgVideo");
  const bgImage = $("#bgImage");
  const statusBar = $("#statusBar");

  const quoteText = $("#quoteText");
  const quoteMeta = $("#quoteMeta");
  const newQuoteBtn = $("#newQuoteBtn");
  const favBtn = $("#favBtn");
  const copyBtn = $("#copyBtn");
  const shareBtn = $("#shareBtn");

  const toggleThemeBtn = $("#toggleThemeBtn");
  const nextBGBtn = $("#nextBGBtn");
  const toggleBGModeBtn = $("#toggleBGModeBtn");

  const openAddBtn = $("#openAddBtn");
  const closeAddBtn = $("#closeAddBtn");
  const addPanel = $("#addPanel");
  const addForm = $("#addForm");
  const addInput = $("#addInput");
  const addSource = $("#addSource");

  const openFavoritesBtn = $("#openFavoritesBtn");
  const closeFavoritesBtn = $("#closeFavoritesBtn");
  const favoritesPanel = $("#favoritesPanel");
  const favoritesList = $("#favoritesList");

  const year = $("#year");

  // ---------- Storage Keys ----------
  const LS_KEYS = {
    QUOTES: "vibeverse.quotes",
    FAVS: "vibeverse.favorites",
    THEME: "vibeverse.theme",
    BG_MODE: "vibeverse.bgMode" // "video" or "image"
  };

  // ---------- State ----------
  let quotes = loadJSON(LS_KEYS.QUOTES, STARTER_QUOTES);
  let favorites = loadJSON(LS_KEYS.FAVS, []);
  let current = null;           // { id, text, source }
  let currentBGIndex = -1;
  let usingVideo = load(LS_KEYS.BG_MODE, "video") === "video";
  let theme = load(LS_KEYS.THEME, prefersLight() ? "light" : "dark");

  // ---------- Utils ----------
  function load(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
  function loadJSON(key, fallback = []) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }
  function saveJSON(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch {}
  }
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function setStatus(msg, timeout = 1400) {
    if (!statusBar) return;
    statusBar.textContent = msg;
    if (timeout) {
      setTimeout(() => {
        if (statusBar.textContent === msg) statusBar.textContent = "";
      }, timeout);
    }
  }

  // Accessibility helper for panels
  function togglePanel(panelEl, open) {
    if (!panelEl) return;
    panelEl.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("panel-open", open);
  }

  // ---------- Theme ----------
  function prefersLight() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  }
  function applyTheme(t) {
    document.body.classList.toggle("light", t === "light");
    save(LS_KEYS.THEME, t);
  }

  // ---------- Backgrounds ----------
  const dataSaver =
    (navigator.connection && navigator.connection.saveData) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function applyImageBG(src) {
    document.body.classList.add("image-bg");
    if (bgImage) bgImage.style.backgroundImage = `url("${IMG_DIR}/${src}")`;
    if (toggleBGModeBtn) {
      toggleBGModeBtn.textContent = "Video: Off";
      toggleBGModeBtn.setAttribute("aria-pressed", "false");
    }
  }

  function applyVideoBG(src) {
    document.body.classList.remove("image-bg");
    if (!bgVideo) return;
    bgVideo.src = `${VIDEO_DIR}/${src}`;
    // ensure autoplay after source change (mobile)
    const play = () => bgVideo.play().catch(() => {});
    bgVideo.addEventListener("loadeddata", play, { once: true });
    if (toggleBGModeBtn) {
      toggleBGModeBtn.textContent = "Video: On";
      toggleBGModeBtn.setAttribute("aria-pressed", "true");
    }
  }

  function nextBackground(forceMode) {
    // Decide whether to use video or image
    const useVideo = forceMode === "video" ? true :
                     forceMode === "image" ? false :
                     (usingVideo && !dataSaver && PLAYLIST.length > 0);

    if (useVideo) {
      usingVideo = true;
      if (!PLAYLIST.length) {
        // fallback to image if no videos
        usingVideo = false;
        if (IMAGE_LIST.length) applyImageBG(rand(IMAGE_LIST));
        return;
      }
      currentBGIndex = (currentBGIndex + 1) % PLAYLIST.length;
      applyVideoBG(PLAYLIST[currentBGIndex]);
    } else {
      usingVideo = false;
      if (IMAGE_LIST.length) {
        applyImageBG(rand(IMAGE_LIST));
      } else if (PLAYLIST.length) {
        // fallback to video if no images
        usingVideo = true;
        currentBGIndex = (currentBGIndex + 1) % PLAYLIST.length;
        applyVideoBG(PLAYLIST[currentBGIndex]);
      }
    }
    save(LS_KEYS.BG_MODE, usingVideo ? "video" : "image");
  }

  // ---------- Quotes ----------
  function renderQuote(q) {
    quoteText.textContent = q.text;
    quoteMeta.textContent = q.source && q.source.trim() !== "" ? `— ${q.source}` : "—";
    favBtn.setAttribute("aria-pressed", isFavorite(q) ? "true" : "false");
  }

  function isFavorite(q) {
    return favorites.some((f) => f.text === q.text && f.source === q.source);
  }

  function newQuote() {
    if (!quotes.length) {
      setStatus("No quotes yet. Add one!");
      return;
    }
    const q = rand(quotes);
    current = { ...q };
    renderQuote(current);

    // change background too
    nextBackground();
  }

  function addQuote(text, source) {
    const q = { id: uid(), text: text.trim(), source: (source || "").trim() || "—" };
    quotes.push(q);
    saveJSON(LS_KEYS.QUOTES, quotes);
    setStatus("Saved your quote.");
    return q;
  }

  function toggleFavorite(q) {
    const idx = favorites.findIndex((f) => f.text === q.text && f.source === q.source);
    if (idx >= 0) {
      favorites.splice(idx, 1);
      setStatus("Removed from favorites.");
    } else {
      favorites.push({ ...q, id: q.id || uid() });
      setStatus("Added to favorites.");
    }
    saveJSON(LS_KEYS.FAVS, favorites);
    favBtn.setAttribute("aria-pressed", isFavorite(q) ? "true" : "false");
    renderFavorites();
  }

  function renderFavorites() {
    favoritesList.innerHTML = "";
    if (!favorites.length) {
      favoritesList.innerHTML = `<li><em>No favorites yet.</em></li>`;
      return;
    }
    favorites.forEach((f, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="text">${escapeHTML(f.text)}</div>
        <div class="meta">${escapeHTML(f.source || "—")}</div>
        <div class="fav-actions">
          <button class="btn small ghost" data-action="copy" data-idx="${i}">Copy</button>
          <button class="btn small ghost" data-action="share" data-idx="${i}">Share</button>
          <button class="btn small" data-action="remove" data-idx="${i}">Remove</button>
        </div>
      `;
      favoritesList.appendChild(li);
    });
  }

  function escapeHTML(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Clipboard / Share ----------
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied to clipboard.");
    } catch {
      setStatus("Copy failed.");
    }
  }

  async function shareText(text) {
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await copyText(text);
        setStatus("Share not supported — copied instead.");
      }
    } catch {
      setStatus("Share canceled.");
    }
  }

  // ---------- Events ----------
  document.addEventListener("click", (e) => {
    const t = e.target;

    // Favorites panel item actions
    if (t.closest(".fav-actions")) {
      const btn = t.closest("button");
      const action = btn?.dataset.action;
      const idx = clamp(parseInt(btn?.dataset.idx, 10), 0, favorites.length - 1);
      const f = favorites[idx];
      if (!f) return;

      if (action === "copy") copyText(`${f.text} — ${f.source}`);
      if (action === "share") shareText(`${f.text} — ${f.source}`);
      if (action === "remove") {
        favorites.splice(idx, 1);
        saveJSON(LS_KEYS.FAVS, favorites);
        renderFavorites();
        setStatus("Removed favorite.");
      }
    }
  });

  newQuoteBtn?.addEventListener("click", () => {
    newQuote();
  });

  favBtn?.addEventListener("click", () => {
    if (current) toggleFavorite(current);
  });

  copyBtn?.addEventListener("click", () => {
    if (current) copyText(`${current.text} — ${current.source}`);
  });

  shareBtn?.addEventListener("click", () => {
    if (current) shareText(`${current.text} — ${current.source}`);
  });

  // Theme
  toggleThemeBtn?.addEventListener("click", () => {
    theme = theme === "light" ? "dark" : "light";
    applyTheme(theme);
  });

  // Background controls
  nextBGBtn?.addEventListener("click", () => nextBackground());
  toggleBGModeBtn?.addEventListener("click", () => {
    usingVideo = !usingVideo;
    save(LS_KEYS.BG_MODE, usingVideo ? "video" : "image");
    nextBackground(usingVideo ? "video" : "image");
  });

  // Panels
  openAddBtn?.addEventListener("click", () => {
    togglePanel(addPanel, true);
    addInput?.focus();
  });
  closeAddBtn?.addEventListener("click", () => togglePanel(addPanel, false));

  openFavoritesBtn?.addEventListener("click", () => {
    togglePanel(favoritesPanel, true);
    renderFavorites();
    openFavoritesBtn.setAttribute("aria-expanded", "true");
  });
  closeFavoritesBtn?.addEventListener("click", () => {
    togglePanel(favoritesPanel, false);
    openFavoritesBtn.setAttribute("aria-expanded", "false");
  });

  // Add form
  addForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = (addInput?.value || "").trim();
    const source = (addSource?.value || "").trim();
    if (!text) {
      setStatus("Type something uplifting first.");
      return;
    }
    const q = addQuote(text, source);
    addInput.value = "";
    addSource.value = "";
    togglePanel(addPanel, false);
    current = q;
    renderQuote(current);
  });

  // ---------- Init ----------
  function normalizeFilenames() {
    // Remove obvious duplicates like "name.mp4" and "name (1).mp4"
    const clean = new Set();
    const deduped = [];
    for (const f of PLAYLIST) {
      const base = f.replace(/\s*\(\d+\)(\.\w+)$/, "$1");
      if (!clean.has(base)) {
        clean.add(base);
        deduped.push(f);
      }
    }
    PLAYLIST = deduped;
  }

  function bootstrap() {
    // Year
    if (year) year.textContent = new Date().getFullYear();

    // Theme
    applyTheme(theme);

    // Videos/Images sanity
    normalizeFilenames();

    if (dataSaver) {
      // Prefer images when user wants to save data / reduce motion
      usingVideo = false;
      save(LS_KEYS.BG_MODE, "image");
    }

    // If no images and no poster exists, it's still fine; video layer sits under overlay.
    nextBackground(usingVideo ? "video" : "image");

    // Seed at least one quote
    if (!quotes.length) {
      quotes = [...STARTER_QUOTES];
      saveJSON(LS_KEYS.QUOTES, quotes);
    }

    // First quote
    newQuote();
  }

  bootstrap();
})();
