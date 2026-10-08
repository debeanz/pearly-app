/* Pearly — site script. No dependencies, no build step.
   Everything people write (titles, descriptions, settings) reaches the page
   through textContent, never as HTML. */
(function () {
  "use strict";

  var cfg = window.MADEIRA_CONFIG || {};
  var REPO = "debeanz/Madeira-actions";

  // ── Vocabulary — the same ids the app sends and supabase/schema.sql checks ──

  var RATINGS = [
    { id: "perfect",  label: "Perfect",  blurb: "Plays like it does on a PC." },
    { id: "playable", label: "Playable", blurb: "Small problems that don't get in the way." },
    { id: "runs",     label: "Runs",     blurb: "Reaches gameplay, with problems you notice." },
    { id: "boots",    label: "Boots",    blurb: "Starts, but can't really be played." },
    { id: "broken",   label: "Broken",   blurb: "Doesn't start, or crashes right away." }
  ];
  var RATING = {};
  RATINGS.forEach(function (r, i) { RATING[r.id] = { id: r.id, label: r.label, blurb: r.blurb, rank: i }; });

  var ISSUES = {
    crash: "Crashes", slow: "Low frame rate", graphics: "Graphics glitches",
    audio: "Audio problems", controls: "Controls", video: "Videos don't play"
  };
  var FPS = {
    "under-20": "Under 20 fps", "20-30": "20–30 fps", "30-45": "30–45 fps", "45-60": "45–60 fps", "60": "60 fps"
  };
  var FPS_ORDER = ["60", "45-60", "30-45", "20-30", "under-20"];
  var DEVICES = {
    "iPhone14,2": "iPhone 13 Pro", "iPhone14,3": "iPhone 13 Pro Max", "iPhone14,4": "iPhone 13 mini",
    "iPhone14,5": "iPhone 13", "iPhone14,6": "iPhone SE (3rd gen)", "iPhone14,7": "iPhone 14",
    "iPhone14,8": "iPhone 14 Plus", "iPhone15,2": "iPhone 14 Pro", "iPhone15,3": "iPhone 14 Pro Max",
    "iPhone15,4": "iPhone 15", "iPhone15,5": "iPhone 15 Plus", "iPhone16,1": "iPhone 15 Pro",
    "iPhone16,2": "iPhone 15 Pro Max", "iPhone17,1": "iPhone 16 Pro", "iPhone17,2": "iPhone 16 Pro Max",
    "iPhone17,3": "iPhone 16", "iPhone17,4": "iPhone 16 Plus", "iPhone17,5": "iPhone 16e",
    "iPhone18,1": "iPhone 17 Pro", "iPhone18,2": "iPhone 17 Pro Max", "iPhone18,3": "iPhone 17", "iPhone18,4": "iPhone Air"
  };

  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── DOM helper ─────────────────────────────────────────────────────────────

  function h(tag, props) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k === "style") n.setAttribute("style", v);
        else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? "" : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(n, arguments[i]);
    return n;
  }
  function append(n, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(n, k); }); return; }
    n.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ── Covers — Steam header art, else the app's own placeholder ───────────────

  // FNV-1a over UTF-8, exactly LauncherPalette.hue(for:) in the app, so a game
  // without art gets the same colours here as in the Games tab.
  function hue(title) {
    var x = 0x811c9dc5, bytes = new TextEncoder().encode(title);
    for (var i = 0; i < bytes.length; i++) { x ^= bytes[i]; x = Math.imul(x, 0x01000193) >>> 0; }
    return (x >>> 0) % 360;
  }
  function placeholderStyle(title) {
    var hh = hue(title);
    return "background:linear-gradient(135deg,hsl(" + hh + " 37.9% 39.9%),hsl(" + hh + " 48.1% 14.9%))";
  }
  function steamId(v) { var n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; }
  var STEAM = [
    function (id) { return "https://shared.steamstatic.com/store_item_assets/steam/apps/" + id + "/header.jpg"; },
    function (id) { return "https://cdn.cloudflare.steamstatic.com/steam/apps/" + id + "/header.jpg"; }
  ];
  function cover(title, sid, eager) {
    var ph = h("div", { class: "ph", style: placeholderStyle(title) }, title);
    var box = h("div", { class: "cover" }, ph);
    var id = steamId(sid);
    if (id) {
      var tried = 0;
      var img = h("img", { alt: "", class: "loading", decoding: "async", loading: eager ? "eager" : "lazy" });
      img.addEventListener("load", function () { img.classList.remove("loading"); ph.remove(); });
      img.addEventListener("error", function () {
        tried += 1;
        if (tried < STEAM.length) img.src = STEAM[tried](id); else img.remove();
      });
      img.src = STEAM[0](id);
      box.insertBefore(img, ph);
    }
    return box;
  }
  function headerUrl(sid) { var id = steamId(sid); return id ? STEAM[0](id) : null; }

  // ── Small formatters ───────────────────────────────────────────────────────

  var rtf = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;
  function ago(iso) {
    var s = (new Date(iso).getTime() - Date.now()) / 1000;
    var units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (var i = 0; i < units.length; i++) {
      if (Math.abs(s) >= units[i][1]) {
        return rtf ? rtf.format(Math.round(s / units[i][1]), units[i][0]) : new Date(iso).toLocaleDateString();
      }
    }
    return "just now";
  }
  function day(iso) { return new Date(iso).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" }); }
  function deviceName(id) { return DEVICES[id] || id; }
  // "0.1.125 (125, 5b4a587+wow64)" → "0.1.125"
  function shortVersion(v) { return String(v).split(" ")[0]; }
  // "0.1.197" or "1.2.3": a number that sorts the way the versions do
  function versionNumber(v) { var m = /^(\d+)\.(\d+)\.(\d+)/.exec(shortVersion(v)); return m ? (+m[1]) * 1e8 + (+m[2]) * 1e4 + (+m[3]) : 0; }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
  function pct(n, d) { return d ? Math.round(n / d * 100) : 0; }
  function frameCapText(v) {
    if (/^\d+$/.test(v)) return v + " fps cap";
    if (/^MAX/i.test(v)) return "Display-rate cap";
    if (/^RAW/i.test(v)) return "Unthrottled";
    return null;
  }

  // ── Ratings ────────────────────────────────────────────────────────────────

  // The rating most reports agree on; a tie goes to the better one.
  function verdict(g) {
    var best = null;
    RATINGS.forEach(function (r) {
      var n = Number(g[r.id]) || 0;
      if (n > 0 && (!best || n > best.n)) best = { id: r.id, n: n };
    });
    return best ? best.id : null;
  }
  function rank(g) { var v = verdict(g); return v ? RATING[v].rank : 9; }
  function ratingBadge(id, large) {
    var r = RATING[id];
    return h("span", { class: "rating r-" + (r ? id : "none") + (large ? " lg" : "") }, r ? r.label : "No reports");
  }
  function distBar(g, size) {
    var total = 0;
    RATINGS.forEach(function (r) { total += Number(g[r.id]) || 0; });
    var label = RATINGS.map(function (r) { return r.label + ": " + (Number(g[r.id]) || 0); }).join(", ");
    var bar = h("div", { class: "dist" + (size ? " " + size : ""), role: "img", "aria-label": label });
    RATINGS.forEach(function (r) {
      var n = Number(g[r.id]) || 0;
      if (!n) return;
      var seg = h("span", { class: "r-" + r.id, title: r.label + ": " + n });
      seg.dataset.w = (n / (total || 1) * 100).toFixed(2) + "%";
      bar.appendChild(seg);
    });
    grow(bar);
    return bar;
  }

  // ── Motion ─────────────────────────────────────────────────────────────────

  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var t = e.target;
      if (t.dataset.grow) {
        $$("[data-w]", t).forEach(function (s) { s.style.width = s.dataset.w; });
      } else {
        t.classList.add("in");
      }
      io.unobserve(t);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }) : null;

  function grow(el) {
    el.dataset.grow = "1";
    if (!io || reduceMotion) $$("[data-w]", el).forEach(function (s) { s.style.width = s.dataset.w; });
    else io.observe(el);
  }
  function reveal(root) {
    $$(".reveal:not(.in)", root).forEach(function (el) {
      if (io && !reduceMotion) io.observe(el); else el.classList.add("in");
    });
  }

  // The hero's iPhone: focus walks the Games tab like a controller would, and
  // the games that run get a press of Play.
  function initDevice() {
    var stage = $(".device-stage"), dev = $(".device");
    if (!stage || !dev) return;
    var gt = $(".gt", dev), track = $(".gt-track", dev);
    var tiles = $$(".gt-tile", dev);
    if (!gt || !track || !tiles.length) return;

    tiles.forEach(function (t) {
      var c = cover(t.dataset.title, t.dataset.steam, true);
      if (t.dataset.fav) c.appendChild(h("span", { class: "gt-star" }, "★"));
      c.appendChild(h("span", { class: "gt-badge" }, "PLAYING"));
      t.insertBefore(c, t.firstChild);
    });

    // LauncherView's landscape row in points: 196 pt covers, 300 pt for the
    // highlighted one, 14 pt apart, 20 pt in from the 59 pt safe area,
    // scrolled to centre the highlight (never past either end).
    var PAD = 79, SMALL = 196, BIG = 300, GAP = 14, SCREEN = 932;
    var i = 0, visible = true;
    function focus(n) {
      tiles.forEach(function (t, k) { t.classList.toggle("focus", k === n); });
      var content = PAD * 2 + (tiles.length - 1) * (SMALL + GAP) + BIG;
      var centre = PAD + n * (SMALL + GAP) + BIG / 2;
      var x = Math.min(0, Math.max(SCREEN - content, SCREEN / 2 - centre));
      track.style.setProperty("--x", x.toFixed(1));
    }
    var cardCover = $(".gt-card-cover", dev), cardTitle = $(".gt-card-title", dev);
    var cardExe = $(".gt-card-details code", dev), cardLine = $(".gt-card-details span", dev), play = $(".gt-play", dev);
    function openCard(t) {
      var d = t.dataset.play.split("|");
      cardTitle.textContent = t.dataset.title;
      cardExe.textContent = d[0];
      cardLine.textContent = "  ·  Last played " + d[1] + "  ·  Played " + d[2];
      cardCover.replaceChildren(cover(t.dataset.title, t.dataset.steam, true));
      gt.classList.add("open");
    }
    focus(0);
    if (reduceMotion) return;
    if (io) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(stage);

    function step() {
      if (!visible || document.hidden) { setTimeout(step, 700); return; }
      i = (i + 1) % tiles.length;
      focus(i);
      var t = tiles[i];
      if (!t.dataset.play) { setTimeout(step, 1700); return; }
      setTimeout(function () { openCard(t); }, 1000);
      setTimeout(function () { play.classList.add("press"); }, 2500);
      setTimeout(function () {
        play.classList.remove("press");
        gt.classList.remove("open");
        tiles.forEach(function (o) { o.classList.toggle("playing", o === t); });
      }, 2750);
      setTimeout(step, 4800);
    }
    setTimeout(step, 1700);

    if (matchMedia("(pointer: fine)").matches) {
      stage.addEventListener("pointermove", function (e) {
        var r = stage.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        dev.style.setProperty("--ty", (x * 12).toFixed(2) + "deg");
        dev.style.setProperty("--tx", (-y * 9 + 3).toFixed(2) + "deg");
      });
      stage.addEventListener("pointerleave", function () {
        dev.style.removeProperty("--ty"); dev.style.removeProperty("--tx");
      });
    }
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  function configured() { return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey); }
  // A publishable key (sb_publishable_…) goes on apikey alone: it isn't a JWT,
  // and Supabase rejects one sent as a Bearer token. A legacy anon key wants both.
  function keyHeaders() {
    var key = cfg.supabaseAnonKey;
    return key.indexOf("sb_") === 0 ? { apikey: key } : { apikey: key, Authorization: "Bearer " + key };
  }
  var cache = {};
  function api(path) {
    if (cache[path]) return cache[path];
    cache[path] = fetch(cfg.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/" + path, { headers: keyHeaders() })
      .then(function (res) {
        if (!res.ok) throw new Error("The compatibility database answered " + res.status + ".");
        return res.json();
      });
    cache[path].catch(function () { delete cache[path]; });
    return cache[path];
  }
  function summaries() { return api("game_summary?select=*&order=last_report.desc&limit=2000"); }
  var REPORT_COLUMNS = "id,created_at,game,steam_app_id,rating,issues,fps,description,madeira_version,device,ios,arch,settings,has_log";

  // Builds: every successful run of the app's workflow is build 0.1.<run number>.
  function builds(page, perPage) {
    var url = "https://api.github.com/repos/" + REPO + "/actions/runs?branch=wow64&status=success&event=push&per_page=" +
      (perPage || 30) + "&page=" + (page || 1);
    var key = "gh:" + url;
    if (cache[key]) return cache[key];
    cache[key] = fetch(url, { headers: { Accept: "application/vnd.github+json" } }).then(function (res) {
      if (res.status === 403 || res.status === 429) throw new Error("GitHub's hourly limit for this connection is used up. Try again later.");
      if (!res.ok) throw new Error("GitHub answered " + res.status + ".");
      return res.json();
    }).then(function (j) {
      return (j.workflow_runs || []).map(function (r) {
        var msg = String((r.head_commit && r.head_commit.message) || r.display_title || "");
        var lines = msg.split("\n");
        return {
          version: "0.1." + r.run_number, number: r.run_number, date: r.created_at, sha: r.head_sha,
          title: lines[0].replace(/\s*\(ml\d+[a-z]?\)\s*$/i, "").trim(),
          body: lines.slice(1).join("\n").replace(/Co-Authored-By:.*$/gim, "").trim()
        };
      });
    });
    cache[key].catch(function () { delete cache[key]; });
    return cache[key];
  }

  function notice(title, lines) {
    return h("div", { class: "notice glass" }, h("h3", { text: title }),
      (lines || []).map(function (l) { return h("p", null, l); }));
  }
  function notConnected() {
    return notice("Reports aren't connected yet", [
      "The compatibility database is still being set up. Once it is, games show up here as people report them from Pearly."
    ]);
  }
  function failed(err) { return notice("Couldn't load this", [String(err && err.message || err), "Try again in a moment."]); }
  function skeletonCards(n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push(h("div", { class: "game-card skeleton", "aria-hidden": "true" },
        h("div", { class: "cover" }), h("div", { class: "bar" }), h("div", { class: "bar short" })));
    }
    return out;
  }

  function gameCard(g, i) {
    var v = verdict(g), n = Number(g.reports) || 0;
    return h("a", { class: "game-card reveal", href: "game.html?g=" + encodeURIComponent(g.key), style: "--d:" + Math.min(i || 0, 8) },
      cover(g.game, g.steam_app_id),
      h("div", { class: "info" },
        h("div", { class: "row" }, h("span", { class: "title", text: g.game }), ratingBadge(v)),
        distBar(g),
        h("span", { class: "sub" }, plural(n, "report") + " · " + ago(g.last_report))));
  }

  function totals(rows) {
    var t = { games: rows.length, reports: 0, tiers: {} };
    RATINGS.forEach(function (r) { t.tiers[r.id] = 0; });
    rows.forEach(function (g) {
      t.reports += Number(g.reports) || 0;
      var v = verdict(g); if (v) t.tiers[v] += 1;
    });
    t.good = t.tiers.perfect + t.tiers.playable;
    return t;
  }

  // ── Live numbers (home, compatibility) ─────────────────────────────────────

  function setNum(name, value, note) {
    $$('[data-num="' + name + '"]').forEach(function (el) {
      var b = $("b", el); if (b) b.textContent = value;
      var s = $("small", el); if (s && note != null) s.textContent = note;
    });
  }
  function initNumbers() {
    if (!$("[data-num]")) return;
    if (configured()) {
      summaries().then(function (rows) {
        var t = totals(rows);
        setNum("games", String(t.games), t.games ? "with at least one report" : "be the first to report one");
        setNum("reports", String(t.reports), "sent from inside the app");
        setNum("good", t.games ? pct(t.good, t.games) + "%" : "—", "of reported games");
      }).catch(function () { setNum("games", "—"); setNum("reports", "—"); setNum("good", "—"); });
    }
    if ($('[data-num="build"]')) {
      builds(1, 1).then(function (list) {
        if (list[0]) setNum("build", list[0].version, "built " + ago(list[0].date));
      }).catch(function () { setNum("build", "—", "build history on GitHub"); });
    }
  }

  // ── Home: the most recently reported games ─────────────────────────────────

  function initHome() {
    var box = $("#recent");
    if (!box) return;
    if (!configured()) { box.replaceChildren(notConnected()); return; }
    box.replaceChildren(h("div", { class: "games-grid" }, skeletonCards(6)));
    summaries().then(function (rows) {
      if (!rows.length) {
        box.replaceChildren(notice("No reports yet", ["Be the first: open a game's ⋯ menu in Pearly and choose Report Compatibility."]));
        return;
      }
      box.replaceChildren(h("div", { class: "games-grid" }, rows.slice(0, 6).map(gameCard)));
      reveal(box);
    }).catch(function (e) { box.replaceChildren(failed(e)); });
  }

  // ── Compatibility list ─────────────────────────────────────────────────────

  function initGames() {
    var list = $("#games");
    if (!list) return;
    var input = $("#q"), sort = $("#sort"), count = $("#count"), archSel = $("#arch");
    var toggles = $$(".toggle[data-r]"), views = $$(".seg [data-view]");
    var all = [], arch = {}, active = {}, view = "grid";
    try { view = localStorage.getItem("pearly.view") === "list" ? "list" : "grid"; } catch (e) { /* private mode */ }

    // A shared link can carry the search: games.html?q=celeste
    var qs = new URLSearchParams(location.search);
    if (qs.get("q")) input.value = qs.get("q");

    function render() {
      var q = (input.value || "").trim().toLowerCase(), want = archSel ? archSel.value : "";
      var on = Object.keys(active).filter(function (k) { return active[k]; });
      var rows = all.filter(function (g) {
        if (q && String(g.game).toLowerCase().indexOf(q) < 0) return false;
        if (on.length && on.indexOf(verdict(g)) < 0) return false;
        if (want && !(arch[g.key] && arch[g.key][want])) return false;
        return true;
      });
      if (sort.value === "reports") rows.sort(function (a, b) { return b.reports - a.reports || a.game.localeCompare(b.game); });
      else if (sort.value === "name") rows.sort(function (a, b) { return a.game.localeCompare(b.game); });
      else if (sort.value === "best") rows.sort(function (a, b) { return rank(a) - rank(b) || b.reports - a.reports; });
      else rows.sort(function (a, b) { return new Date(b.last_report) - new Date(a.last_report); });
      count.textContent = rows.length === all.length ? plural(all.length, "game") : rows.length + " of " + plural(all.length, "game");
      views.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.view === view ? "true" : "false"); });
      if (!rows.length) { list.replaceChildren(notice("Nothing matches", ["Try a different name, or clear the filters."])); return; }
      if (view === "list") list.replaceChildren(table(rows));
      else list.replaceChildren(h("div", { class: "games-grid" }, rows.map(gameCard)));
      reveal(list);
    }
    function table(rows) {
      return h("table", { class: "gtable" },
        h("thead", null, h("tr", null, h("th", null, "Game"), h("th", null, "Rating"), h("th", { class: "hide-s" }, "Reports"),
          h("th", { class: "hide-s" }, "Bits"), h("th", null, "Last report"))),
        h("tbody", null, rows.map(function (g) {
          var href = "game.html?g=" + encodeURIComponent(g.key), a = arch[g.key] || {};
          var bits = [a.x64 ? "64" : null, a.x86 ? "32" : null].filter(Boolean).join(" · ") || "—";
          return h("tr", { onclick: function (e) { if (e.target.tagName !== "A") location.href = href; } },
            h("td", null, h("div", { class: "t" }, cover(g.game, g.steam_app_id), h("a", { href: href, text: g.game }))),
            h("td", null, ratingBadge(verdict(g))),
            h("td", { class: "num hide-s" }, String(g.reports)),
            h("td", { class: "num hide-s" }, bits),
            h("td", { class: "num" }, ago(g.last_report)));
        })));
    }

    toggles.forEach(function (t) {
      t.addEventListener("click", function () {
        active[t.dataset.r] = !active[t.dataset.r];
        t.setAttribute("aria-pressed", active[t.dataset.r] ? "true" : "false");
        render();
      });
    });
    views.forEach(function (b) {
      b.addEventListener("click", function () {
        view = b.dataset.view;
        try { localStorage.setItem("pearly.view", view); } catch (e) { /* private mode */ }
        render();
      });
    });
    input.addEventListener("input", render);
    sort.addEventListener("change", render);
    if (archSel) archSel.addEventListener("change", render);

    if (!configured()) { count.textContent = ""; list.replaceChildren(notConnected()); return; }
    list.replaceChildren(h("div", { class: "games-grid" }, skeletonCards(9)));
    Promise.all([summaries(), api("reports?select=game_key,arch,game,rating,created_at,steam_app_id&order=created_at.desc&limit=5000")])
      .then(function (res) {
        all = res[0];
        res[1].forEach(function (r) { if (r.arch) { (arch[r.game_key] = arch[r.game_key] || {})[r.arch] = 1; } });
        overview(all, res[1]);
        if (!all.length) {
          count.textContent = "";
          list.replaceChildren(notice("No reports yet", ["Be the first: open a game's ⋯ menu in Pearly and choose Report Compatibility."]));
          return;
        }
        render();
      }).catch(function (e) { list.replaceChildren(failed(e)); });
  }

  // The top of the compatibility page: totals, the tiers, the latest reports.
  function overview(rows, reports) {
    var box = $("#overview");
    if (!box) return;
    var t = totals(rows);
    var tierRows = RATINGS.map(function (r) {
      var n = t.tiers[r.id];
      return h("div", { class: "r-" + r.id }, ratingBadge(r.id),
        h("span", { class: "bar" }, h("i", { "data-w": pct(n, t.games) + "%" })), h("em", null, String(n)));
    });
    var tiers = h("div", { class: "tier-table" }, tierRows);
    var left = h("div", { class: "glass reveal" },
      h("h3", null, "Games reported"),
      h("div", { class: "big pearl-text" }, String(t.games)),
      h("p", { class: "muted", style: "margin:4px 0 0;font-size:14px" },
        plural(t.reports, "report") + " · " + (t.games ? pct(t.good, t.games) + "% Playable or better" : "no ratings yet")),
      distBar(t.tiers, "xl"), tiers);
    grow(tiers);
    var recent = reports.slice(0, 6).map(function (r) {
      return h("a", { href: "game.html?g=" + encodeURIComponent(r.game_key) },
        cover(r.game, r.steam_app_id),
        h("span", { style: "min-width:0" }, h("b", { text: r.game }), h("small", null, ago(r.created_at))),
        ratingBadge(r.rating));
    });
    var right = h("div", { class: "glass reveal", style: "--d:1" }, h("h3", null, "Latest reports"),
      recent.length ? h("div", { class: "feed" }, recent) : h("p", { class: "muted" }, "None yet."));
    box.replaceChildren(left, right);
    reveal(box);
  }

  // ── One game ───────────────────────────────────────────────────────────────

  var ICON = {
    tag: "M3 12V4h8l9 9-8 8z M7.5 7.5h.01",
    phone: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M11 18h2",
    chip: "M7 7h10v10H7z M10 3v4 M14 3v4 M10 17v4 M14 17v4 M3 10h4 M3 14h4 M17 10h4 M17 14h4",
    screen: "M3 5h18v12H3z M8 21h8 M12 17v4",
    gauge: "M12 14l4-4 M4 18a9 9 0 1 1 16 0",
    bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
    sparkle: "M10 5l1.8 6.2L18 13l-6.2 1.8L10 21l-1.8-6.2L2 13l6.2-1.8z M18 3v4 M16 5h4",
    doc: "M6 2h8l4 4v16H6z M14 2v4h4 M9 13h6 M9 17h6",
    alert: "M12 3l10 18H2z M12 10v5 M12 18h.01",
    sliders: "M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M16 4v4 M10 10v4 M18 16v4"
  };
  function icon(name) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(ns, "path"); p.setAttribute("d", ICON[name]); svg.appendChild(p);
    return svg;
  }
  function meta(name, text) { return h("span", null, icon(name), text); }
  function settingsOf(r) { return r.settings && typeof r.settings === "object" ? r.settings : {}; }

  function reportCard(r, i) {
    var tags = [];
    (Array.isArray(r.issues) ? r.issues : []).forEach(function (k) { if (ISSUES[k]) tags.push(h("span", { class: "chip" }, ISSUES[k])); });
    if (FPS[r.fps]) tags.push(h("span", { class: "chip" }, FPS[r.fps]));

    var m = [], st = settingsOf(r);
    if (r.madeira_version) m.push(meta("tag", "Build " + shortVersion(r.madeira_version)));
    if (r.device) m.push(meta("phone", deviceName(r.device) + (r.ios ? " · iOS " + r.ios : "")));
    if (r.arch) m.push(meta("chip", r.arch === "x86" ? "32-bit" : "64-bit"));
    if (typeof st.resolution === "string" && /^\d{2,5}x\d{2,5}$/.test(st.resolution)) m.push(meta("screen", st.resolution.replace("x", "×")));
    if (typeof st.frameCap === "string" && frameCapText(st.frameCap)) m.push(meta("gauge", frameCapText(st.frameCap)));
    // MetalFX upscaling (DirectX 11 games): the app sends it only when the game
    // ran with it, as the multiplier it used.
    if (typeof st.metalFX === "number" && st.metalFX > 1 && st.metalFX <= 3) m.push(meta("sparkle", "MetalFX upscaling " + Math.round(st.metalFX * 100) / 100 + "×"));
    // The app's "x86 memory-ordering" switch (On by default since ml875): a
    // report carries x86MemoryOrdering false only when the game ran with it Off.
    if (st.x86MemoryOrdering === false) m.push(meta("bolt", "x86 memory-ordering: Off"));
    if (r.has_log) m.push(meta("doc", "Log sent"));

    var desc = String(r.description || "").trim();
    var when = h("time", { datetime: r.created_at, title: new Date(r.created_at).toLocaleString() }, ago(r.created_at));
    return h("article", { class: "report glass reveal", style: "--d:" + Math.min(i || 0, 6), "data-rating": r.rating },
      h("div", { class: "report-top" }, ratingBadge(r.rating), when),
      desc ? h("p", { class: "report-desc", text: desc }) : h("p", { class: "report-desc empty" }, "No description."),
      tags.length ? h("div", { class: "report-tags" }, tags) : null,
      m.length ? h("div", { class: "report-meta" }, m) : null);
  }

  // What the reports add up to: frame rates, what worked, where it was tried.
  function insights(reports) {
    function countBy(list, key) {
      var c = {}; list.forEach(function (r) { var k = key(r); if (k != null && k !== "") c[k] = (c[k] || 0) + 1; }); return c;
    }
    function top(c, n) { return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).slice(0, n || 4); }
    function bars(c, order, label) {
      var max = 0; order.forEach(function (k) { max = Math.max(max, c[k] || 0); });
      return h("div", { class: "bars" }, order.filter(function (k) { return c[k]; }).map(function (k) {
        return h("div", null, h("span", null, label(k)), h("span", { class: "bar" }, h("i", { style: "width:" + pct(c[k], max) + "%" })), h("em", null, String(c[k])));
      }));
    }
    var good = reports.filter(function (r) { return r.rating === "perfect" || r.rating === "playable"; });
    var basis = good.length ? good : reports;
    var fps = countBy(reports, function (r) { return r.fps; });
    var res = countBy(basis, function (r) { var s = settingsOf(r).resolution; return typeof s === "string" && /^\d{2,5}x\d{2,5}$/.test(s) ? s.replace("x", "×") : null; });
    var cap = countBy(basis, function (r) { var s = settingsOf(r).frameCap; return typeof s === "string" ? frameCapText(s) : null; });
    var mfx = basis.filter(function (r) { var s = settingsOf(r).metalFX; return typeof s === "number" && s > 1; }).length;
    var tso = basis.filter(function (r) { return settingsOf(r).x86MemoryOrdering === false; }).length;
    var dev = countBy(reports, function (r) { return r.device ? deviceName(r.device) : null; });
    var iss = countBy([].concat.apply([], reports.map(function (r) { return Array.isArray(r.issues) ? r.issues : []; })), function (k) { return ISSUES[k] || null; });

    var setRows = [];
    if (top(res, 1)[0]) setRows.push(h("li", null, "Resolution", h("b", null, top(res, 1)[0])));
    if (top(cap, 1)[0]) setRows.push(h("li", null, "Frame rate", h("b", null, top(cap, 1)[0])));
    if (mfx) setRows.push(h("li", null, "MetalFX upscaling", h("b", null, mfx + " of " + basis.length)));
    if (tso) setRows.push(h("li", null, "x86 memory-ordering Off", h("b", null, tso + " of " + basis.length)));

    return h("div", { class: "insights" },
      h("div", { class: "insight glass reveal" }, h("h3", null, icon("gauge"), "Frame rate reported"),
        Object.keys(fps).length ? bars(fps, FPS_ORDER, function (k) { return FPS[k]; }) : h("p", { class: "muted", style: "margin:0" }, "No frame rates given yet.")),
      h("div", { class: "insight glass reveal", style: "--d:1" },
        h("h3", null, icon("sliders"), good.length ? "Settings in Playable reports" : "Settings people used"),
        setRows.length ? h("ul", null, setRows) : h("p", { class: "muted", style: "margin:0" }, "Defaults: no custom settings reported.")),
      h("div", { class: "insight glass reveal", style: "--d:2" }, h("h3", null, icon("phone"), "Tried on"),
        h("ul", null, top(dev, 4).map(function (d) { return h("li", null, d, h("b", null, String(dev[d]))); })),
        Object.keys(iss).length ? h("div", { class: "report-tags", style: "margin-top:14px" },
          top(iss, 6).map(function (k) { return h("span", { class: "chip" }, icon("alert"), k + " · " + iss[k]); })) : null));
  }

  function initGame() {
    var root = $("#game");
    if (!root) return;
    var key = new URLSearchParams(location.search).get("g") || "";
    if (!/^[a-z0-9-]{1,120}$/.test(key)) {
      root.replaceChildren(h("div", { class: "wrap section tight" },
        notice("No game picked", ["Choose a game from the ", h("a", { href: "games.html" }, "compatibility list"), "."])));
      return;
    }
    if (!configured()) { root.replaceChildren(h("div", { class: "wrap section tight" }, notConnected())); return; }

    var k = encodeURIComponent(key);
    Promise.all([
      api("game_summary?select=*&key=eq." + k),
      api("reports?select=" + REPORT_COLUMNS + "&game_key=eq." + k + "&order=created_at.desc&limit=200")
    ]).then(function (res) {
      var g = res[0][0], reports = res[1];
      if (!g) {
        root.replaceChildren(h("div", { class: "wrap section tight" },
          notice("No reports for this game yet", ["Open its ⋯ menu in Pearly and choose Report Compatibility to add the first."])));
        return;
      }
      document.title = g.game + " — Pearly compatibility";
      var v = verdict(g), devices = {}, newest = null;
      reports.forEach(function (r) {
        if (r.device) devices[r.device] = 1;
        if (r.madeira_version && (!newest || versionNumber(r.madeira_version) > versionNumber(newest))) newest = r.madeira_version;
      });
      var bg = headerUrl(g.steam_app_id), sid = steamId(g.steam_app_id);
      var backdrop = h("div", { class: "backdrop", style: bg ? "background-image:url('" + bg + "')" : placeholderStyle(g.game) });

      var hero = h("section", { class: "game-hero" }, backdrop,
        h("div", { class: "wrap" },
          h("div", { class: "reveal" }, cover(g.game, g.steam_app_id, true)),
          h("div", { class: "reveal", style: "--d:1" },
            h("a", { href: "games.html", class: "muted", style: "font-size:14px;text-decoration:none" }, "← All games"),
            h("h1", { text: g.game }),
            h("div", { class: "verdict-row" }, ratingBadge(v, true), v ? h("span", { class: "muted", style: "font-size:15px" }, RATING[v].blurb) : null),
            distBar(g, "lg"),
            h("div", { class: "tier-key" }, RATINGS.map(function (r) { return h("span", { class: "r-" + r.id }, h("i"), r.label + " " + (Number(g[r.id]) || 0)); })),
            h("div", { class: "stats" },
              h("div", null, h("b", null, String(g.reports)), h("span", null, Number(g.reports) === 1 ? "report" : "reports")),
              h("div", null, h("b", null, ago(g.last_report)), h("span", null, "latest report")),
              newest ? h("div", null, h("b", null, shortVersion(newest)), h("span", null, "newest build tested")) : null,
              h("div", null, h("b", null, String(Object.keys(devices).length || "—")), h("span", null, "devices"))),
            sid ? h("div", { class: "links" }, h("a", { class: "btn btn-glass btn-sm", href: "https://store.steampowered.com/app/" + sid + "/", rel: "noopener" }, "View on Steam")) : null)));

      var filterBar = h("div", { class: "seg", role: "group", "aria-label": "Show reports" },
        [{ id: "", label: "All" }].concat(RATINGS).map(function (r) {
          var n = r.id ? reports.filter(function (x) { return x.rating === r.id; }).length : reports.length;
          if (r.id && !n) return null;
          return h("button", { "aria-pressed": r.id ? "false" : "true", "data-f": r.id }, r.label + " " + n);
        }));
      var listBox = h("div", { class: "reports" }, reports.map(reportCard));
      filterBar.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        $$("button", filterBar).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        listBox.replaceChildren.apply(listBox, reports.filter(function (r) { return !b.dataset.f || r.rating === b.dataset.f; }).map(reportCard));
        reveal(listBox);
      });

      var list = h("section", { class: "section tight" }, h("div", { class: "wrap" },
        insights(reports),
        h("div", { class: "section-head row" },
          h("div", null, h("span", { class: "eyebrow" }, "Reports"), h("h2", { class: "h2" }, "What people saw")),
          filterBar),
        listBox,
        h("p", { class: "muted", style: "margin:26px 0 0;font-size:15px" },
          "Add yours from Pearly: open the game's ⋯ menu and choose Report Compatibility.")));

      root.replaceChildren(hero, list);
      reveal(root);
    }).catch(function (e) { root.replaceChildren(h("div", { class: "wrap section tight" }, failed(e))); });
  }

  // ── Builds ─────────────────────────────────────────────────────────────────

  function initBuilds() {
    var box = $("#builds");
    if (!box) return;
    var more = $("#more-builds"), page = 1, shown = 0;
    function row(b, i) {
      return h("div", { class: "build glass reveal" + (shown === 0 && i === 0 ? " latest" : ""), style: "--d:" + Math.min(i, 8) },
        h("span", { class: "v" }, b.version),
        h("div", { class: "msg" }, h("b", { text: b.title || "Build " + b.version }),
          h("small", null, h("a", { href: "https://github.com/" + REPO + "/commit/" + b.sha, rel: "noopener" }, b.sha.slice(0, 7)))),
        h("time", { datetime: b.date, title: new Date(b.date).toLocaleString() }, day(b.date)));
    }
    function load() {
      if (more) { more.disabled = true; more.textContent = "Loading…"; }
      builds(page, 30).then(function (list) {
        if (page === 1) box.replaceChildren();
        list.forEach(function (b, i) { box.appendChild(row(b, i)); });
        shown += list.length;
        reveal(box);
        page += 1;
        if (more) {
          more.hidden = list.length < 30; more.disabled = false; more.textContent = "Show older builds";
        }
      }).catch(function (e) {
        if (page === 1) box.replaceChildren(failed(e));
        if (more) { more.disabled = false; more.textContent = "Try again"; }
      });
    }
    if (more) more.addEventListener("click", load);
    load();
  }

  // ── Guide: highlight the part of the contents you're reading ───────────────

  function initToc() {
    var links = $$(".toc a[href^='#']");
    if (!links.length || !("IntersectionObserver" in window)) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove("on"); });
        var a = map[e.target.id]; if (a) a.classList.add("on");
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
  }

  // The phone menu closes when you pick a page or a section.
  function initMenu() {
    $$(".nav-menu").forEach(function (m) {
      m.addEventListener("click", function (e) { if (e.target.closest("a")) m.removeAttribute("open"); });
      document.addEventListener("click", function (e) { if (!m.contains(e.target)) m.removeAttribute("open"); });
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  function boot() {
    $$("[data-year]").forEach(function (y) { y.textContent = new Date().getFullYear(); });
    initMenu();
    initDevice();
    initNumbers();
    initHome();
    initGames();
    initGame();
    initBuilds();
    initToc();
    reveal();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
