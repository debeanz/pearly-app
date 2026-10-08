# Builds the Pearly site's pages from shared parts: every page gets the same
# head, navigation and footer. Page bodies live in pages/<name>.html; the first
# lines of each are "key: value" settings (title, description, nav), then "---".
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "docs")
V = "20261008b"          # bump on every CSS/JS change (Pages caches for 10 minutes)
SITE = "https://debeanz.github.io/pearly-app/"
GH = "https://github.com/debeanz/Madeira-actions"
GH_SVG = ('<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 '
          '0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 '
          '2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 '
          '1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 '
          '1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>')
LINKS = [("games", "games.html", "Compatibility"), ("progress", "progress.html", "Progress"), ("builds", "builds.html", "Builds"),
         ("guide", "guide.html", "Guide"), ("faq", "faq.html", "FAQ")]


def head(title, desc, extra=""):
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="theme-color" content="#101011">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="{SITE}assets/brand/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="assets/brand/icon-64.png" type="image/png">
  <link rel="apple-touch-icon" href="assets/brand/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="assets/style.css?v={V}">
  <script src="config.js" defer></script>
  <script src="assets/site.js?v={V}" defer></script>{extra}
</head>
<body>
"""


def nav(current):
    def a(key, href, label):
        cur = ' aria-current="page"' if key == current else ""
        return f'<a href="{href}"{cur}>{label}</a>'
    links = "\n      ".join(a(*l) for l in LINKS)
    sheet = "\n          ".join([a("home", "./", "Home")] + [a(*l) for l in LINKS] + [f'<a href="{GH}">GitHub</a>'])
    return f"""
<header class="nav">
  <div class="wrap">
    <a class="brand" href="./"><img src="assets/brand/icon-64.png" alt="">Pearly</a>
    <nav class="nav-links" aria-label="Main">
      {links}
      <a class="nav-gh" href="{GH}">{GH_SVG}GitHub</a>
    </nav>
    <details class="nav-menu">
      <summary aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary>
      <nav class="sheet" aria-label="Main">
          {sheet}
      </nav>
    </details>
  </div>
</header>
"""


FOOTER = f"""
<footer class="footer">
  <div class="wrap">
    <div class="cols">
      <div>
        <a class="brand" href="./"><img src="assets/brand/icon-64.png" alt="">Pearly</a>
        <p>Windows games on iPhone. A free, open-source research project under GPL-3.0, built on Madeira by Will Faust.</p>
      </div>
      <div>
        <h4>Games</h4>
        <ul>
          <li><a href="games.html">Compatibility list</a></li>
          <li><a href="games.html#how-to-report">Report a game</a></li>
          <li><a href="guide.html#limits">What doesn't run yet</a></li>
        </ul>
      </div>
      <div>
        <h4>Learn</h4>
        <ul>
          <li><a href="guide.html">Guide</a></li>
          <li><a href="faq.html">FAQ</a></li>
          <li><a href="./#how">How it works</a></li>
        </ul>
      </div>
      <div>
        <h4>Project</h4>
        <ul>
          <li><a href="progress.html">Progress reports</a></li>
          <li><a href="builds.html">Build history</a></li>
          <li><a href="{GH}">Source on GitHub</a></li>
          <li><a href="{GH}/blob/main/LICENSE">License</a></li>
        </ul>
      </div>
    </div>
    <div class="base">
      <span>Game names and artwork belong to their owners.</span>
      <span>&copy; <span data-year>2026</span> Pearly</span>
    </div>
  </div>
</footer>

</body>
</html>
"""


def include(name):
    t = open(os.path.join(HERE, name), encoding="utf-8").read().rstrip("\n")
    # the feature cards are glass panes now; the app's own label in its scene is shortened
    t = t.replace('class="feature reveal"', 'class="feature glass reveal"')
    t = t.replace("Override Madeira settings", "Override settings")
    return t


def build(name):
    src = open(os.path.join(HERE, "pages", name + ".html"), encoding="utf-8").read()
    meta, body = src.split("\n---\n", 1)
    # {{include:name.html}} pulls in a shared fragment kept beside this script
    body = re.sub(r"\{\{include:([\w.-]+)\}\}", lambda mm: include(mm.group(1)), body)
    m = dict(re.findall(r"^(\w+):\s*(.*)$", meta, re.M))
    html = head(m["title"], m["description"]) + nav(m.get("nav", "")) + "\n<main" + (f' id="{m["main"]}"' if m.get("main") else "") + ">\n" + body.rstrip() + "\n</main>\n" + FOOTER
    open(os.path.join(OUT, name + ".html"), "w", encoding="utf-8", newline="\n").write(html)
    return len(html)


if __name__ == "__main__":
    names = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(os.path.join(HERE, "pages")) if f.endswith(".html"))
    for n in names:
        print(n, build(n))
