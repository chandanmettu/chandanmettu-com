# chandanmettu.com

The live source for Chandan Mettu's personal website.

| | |
|---|---|
| **Live** | [chandanmettu.com](https://chandanmettu.com) (www redirects to the apex with a 301) |
| **Repository** | `github.com/chandanmettu/chandanmettu-com` (public) |
| **Push via** | SSH host alias `github-chandanmettu` (deploy key `~/.ssh/chandanmettu-deploy`) |
| **Deploy** | Hostinger Git auto-deploy from `main`, about 1–2 minutes. **A push is a production release.** It is *not* GitHub Pages, and `CNAME` / `.nojekyll` are vestigial. |
| **Stack** | Static HTML, CSS, JS and images. No build step, no packages. |

## Public pages

| URL | Source | Purpose |
|---|---|---|
| `/` | `index.html` | Personal introduction with work, stories, athletics and teaching |
| `/links/` | `links/index.html` | Mobile-first directory of channels, products and contact routes |
| `/profile/` | `profile/index.html` | Extended profile and resume-style record |
| `/v1/` | `v1/index.html` | Compatibility redirect to the homepage |
| `/404.html` | `404.html` | Not-found page |

The homepage uses a circular selector for work and interests, palette transitions, profile-specific
proof cards and responsive content collections. Athlete results, galleries and the
Educator certificate loop use the shared files under `assets/css/` and `assets/js/`.

## Public identity

Use **Chandan Mettu** and **@chandanmettu** across every public page, social link,
metadata field, and generated card. The homepage introduces Chandan as a creator
and IIT Hyderabad student; products, athletics, and teaching support that story.
Each profile keeps its own handcrafted title, introduction, chip, palette, and
text transitions as visitors explore the rotating cards.

Canonical profiles use `chandanmettu` on YouTube, Instagram, X, LinkedIn, GitHub,
and Threads. All three indexed pages include the same Person identity and social
profiles in structured data. The current portrait and browser icons are the
`assets/brand/chandan-mettu-*` assets.

## Colour system (locked 2026-09-17)

Warm hues mean people and cool hues mean performance. Creator is coral
`#fe8167`, Educator marigold `#ffc75a`, Builder go-green `#89f35f`, and
Athlete race-day blue `#325bda` with **white** hero text. Overview, links,
profile and 404 use violet `#bcadff`. The tokens live in `index.html`
(`:root`, `body[data-mode]`, `[data-preview-mode]`). Each accent uses only its
own hue, and focus rings use `--deep`.

Confirmed public numbers (don't change them without him): 100K+ students
reached and 500K+ views across socials.

## Local preview

```sh
python3 -m http.server 8050 --bind 127.0.0.1
```

Open `http://127.0.0.1:8050/`. The site has no build step or package dependencies.

## Release boundary

The repository root maps to the public website. Never commit private documents,
analytics exports, credentials, raw photographs, archives or internal handoff files.
Older versions are recoverable through Git history.

**Cache-buster:** bump `?v=` on any changed file under `assets/css` or `assets/js`,
because pages cache for 7 days. Before a release, check all three public routes on mobile and desktop, validate local
assets and external destinations, review the complete diff, push `main`, then verify
the cache-busted public URL.
