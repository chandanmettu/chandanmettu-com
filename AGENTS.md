# Agent instructions: chandanmettu.com

For any AI coding tool (Codex, Gemini/Antigravity, Cursor, Claude, …). Read these in order:

1. `README.md`. Its handover table gives the live URL, repo, SSH alias, deploy path and **whether you may push without asking**.
2. `KNOWN_ISSUES.md` and `docs/PROGRESS.md` where present.
3. **Workspace context outside this repo** (local only, when this folder sits in `~/My Projects/`): `../../AGENTS.md` for workspace rules, and `../../NOTES/` for the owner's working style, design taste, decisions and this project's history (`NOTES/projects/`).

Personal site. Bump `?v=` on changed `assets/css` / `assets/js`. Keep the persona colour system described in `README.md`.

## Non-negotiables

- **The repo root is `public_html`, and a push to `main` deploys to production** within about a minute. There's no staging, so verify locally first and on the live URL after.
- **Bump `?v=`** on every changed CSS/JS file in every page that loads it, because the CDN caches for days.
- **Never invent** names, numbers, results or usage. Leave a gap or use a checkable fact.
- **Never name a payment gateway** in user-facing copy or new code and docs.
- **Stage files by name, never `git add -A`**, because anything committed is publicly downloadable. Secrets live only in server-side `config.php`.
- After a change, update `KNOWN_ISSUES.md` / `docs/PROGRESS.md` where they exist. They are the handoff between tools.
