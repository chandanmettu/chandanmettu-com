# chandanmettu.com

The live personal portfolio, links page and full profile.

- **Live:** [chandanmettu.com](https://chandanmettu.com)
- **Repository:** `saichandanmettu/chandanmettu-com` (public)
- **Stack:** static HTML and assets; no framework or build step

The repository carries `CNAME` and `.nojekyll`, while the public response is
delivered through Hostinger's CDN. Releases are pushed to `main` and verified
against the public URL after Hostinger's Git deployment completes.

## Pages

| URL | Source | Purpose |
|---|---|---|
| `/` | `index.html` | portfolio and product overview |
| `/links` | `links/index.html` | link-in-bio page |
| `/profile` | `profile/index.html` | extended profile/CV |
| `/variations` | `variations/index.html` | archived design explorations |

Shared files are root-relative under `assets/`, so test nested pages through an
HTTP server rather than moving assets beside each page.

```sh
python3 -m http.server 8040
```

## Known gaps

- placeholder photo filenames still leave intended image slots empty
- the links and profile pages do not yet share the homepage design system
- inline page styling makes cross-page maintenance repetitive
- live-site previews depend on the framed projects remaining publicly available

Follow the workspace [`DEPLOY.md`](../../DEPLOY.md), verify all three routes,
and review the live source after any release.
