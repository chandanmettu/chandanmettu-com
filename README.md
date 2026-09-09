# chandanmettu.com

The live source for Chandan Mettu's personal website.

- **Live:** [chandanmettu.com](https://chandanmettu.com)
- **Repository:** `saichandanmettu/chandanmettu-com` (public)
- **Stack:** static HTML, CSS, JavaScript and image assets
- **Delivery:** Git push to `main`, followed by Hostinger deployment

## Public pages

| URL | Source | Purpose |
|---|---|---|
| `/` | `index.html` | Interactive overview of Builder, Creator, Athlete and Educator |
| `/links/` | `links/index.html` | Mobile-first directory of channels, products and contact routes |
| `/profile/` | `profile/index.html` | Extended profile and resume-style record |
| `/v1/` | `v1/index.html` | Compatibility redirect to the homepage |
| `/404.html` | `404.html` | Not-found page |

The homepage uses a circular identity selector, palette transitions, profile-specific
proof cards and responsive content collections. Athlete results, galleries and the
Educator certificate loop use the shared files under `assets/css/` and `assets/js/`.

## Local preview

```sh
python3 -m http.server 8050 --bind 127.0.0.1
```

Open `http://127.0.0.1:8050/`. The site has no build step or package dependencies.

## Release boundary

The repository root maps to the public website. Never commit private documents,
analytics exports, credentials, raw photographs, archives or internal handoff files.
Older versions are recoverable through Git and the dated local backup outside this
repository.

Before a release, check all three public routes on mobile and desktop, validate local
assets and external destinations, review the complete diff, push `main`, then verify
the cache-busted public URL.
