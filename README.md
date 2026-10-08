<p align="center">
  <img src="docs/assets/brand/icon-256.png" width="110" alt="Pearly's icon">
</p>

<h1 align="center">Pearly — website</h1>

<p align="center"><b><a href="https://debeanz.github.io/pearly-app/">debeanz.github.io/pearly-app</a></b></p>

The website for **Pearly**, which runs Windows PC games on a non-jailbroken iPhone: what it is, how it works, the
compatibility list players fill from inside the app, progress reports, build history, a guide and an FAQ.
Pearly is built on [@willfaust](https://github.com/willfaust)'s Madeira.

## What's here

| | |
|---|---|
| `docs/` | The site GitHub Pages serves: plain HTML, CSS and JavaScript, no build step at load time. |
| `site-src/` | Where the pages are written. `pages/*.html` hold each page's body; `build_site.py` wraps them in the shared head, navigation and footer and writes `docs/`. |
| `supabase/` | The compatibility database: `schema.sql` (tables, rules, the log bucket) and how to set it up. |
| `.github/workflows/compat-keepalive.yml` | Reads one row every three days, so the free Supabase project never pauses. |

## Editing

```sh
python site-src/build_site.py      # regenerate docs/ after changing site-src/
python -m http.server 8790 --directory docs   # preview at http://localhost:8790
```

`docs/assets/style.css` and `docs/assets/site.js` are edited directly; bump `V` in `build_site.py` when they change,
since Pages caches for ten minutes. Everything a player writes reaches the page through `textContent`, never as
HTML, and logs are never public.

## License

GPL-3.0-or-later, like Pearly. See [`LICENSE`](LICENSE). Game names and artwork belong to their owners.
