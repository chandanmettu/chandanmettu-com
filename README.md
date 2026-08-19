# chandanmettu.com

The personal site — portfolio, links page and full profile. Plain static HTML,
no build step, no framework.

## Pages

| URL | File | What it is |
|---|---|---|
| `/` | `index.html` | Portfolio — work, campus tools, athletics, clients |
| `/links` | `links/index.html` | Link-in-bio page, for social profiles |
| `/profile` | `profile/index.html` | Full profile / CV |

Clean URLs come from the folder layout (`links/index.html` → `/links`), so they
work on any static host without server rewrite rules.

## Assets

Everything lives in `/assets` and is referenced **root-relative** (`/assets/…`),
not relatively — pages in `/links` and `/profile` would otherwise look for their
own local copies.

## Deploying

GitHub Pages, from the default branch, root folder. `CNAME` holds the custom
domain and `.nojekyll` stops Jekyll from processing the files.

Push to `main` and Pages rebuilds. No build step — files are served exactly as
committed.

## Known gaps

- **26 images were never supplied.** `YOUR_IMAGE_*`, `ATHLETE_IMG_*`, `CERT_IMG_*`
  and `EDU_IMG_*` are placeholder filenames from the original template. Each has
  `onerror="this.style.display='none'"`, so they hide themselves rather than
  showing broken icons — the page degrades cleanly, but those slots are empty
  until real images are dropped into `/assets` under the same names.
- **The three pages don't link to each other.** They were built standalone; there
  is no shared nav. Worth adding in the revamp.
- Styling is inline per page, so the three don't share a design system yet.
