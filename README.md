# Second Opinion

A chart fairness check. Upload a chart or graph and Claude reads the real data off it, then
redraws it honestly — zero baseline, one axis, fair color — instead of just telling you
something looks off.

## Why

Color, saturation, scale, and framing all shape how a chart is read — and the same techniques
can be used to mislead. This is the countermeasure: a tool that reads a chart's actual data and
shows it fairly, so you can judge for yourself whether the original was being straight with you.

Grounded in the graphical-perception research literature — Cleveland & McGill's ranking of
elementary perceptual tasks, Stevens' power law, Tufte's Lie Factor, Borland & Taylor on
rainbow colormaps, and more — but not limited to a fixed checklist. Claude looks at each image
freely and cites whichever real principles actually explain what it found, case by case.

## How it works

- **Upload** an image, optionally with some **context** (e.g. "this is from a marketing deck,"
  or "the real axis min is 50").
- The backend shells out to the **`claude` CLI** — no Anthropic API key, no SDK. It passes the
  image to a one-shot, tool-restricted (`Read` + `Skill` only), non-interactive Claude Code
  session with a system prompt framing it as a senior data-visualization expert, and a
  `--json-schema` constraint so the response comes back as structured JSON rather than free text.
- That session is told to load Claude Code's built-in **`dataviz` skill** first and follow it
  for every chart it builds: its form heuristic picks the mark and encoding, and its palette and
  color rules set the colors.
- Claude reads the real underlying data as faithfully as it can and reconstructs it as one or
  more charts — genuinely free-form ones. Each chart is a real [Vega-Lite](https://vega.github.io/vega-lite/)
  spec fragment (any mark type, any encoding), not a fixed bar-or-line template, rendered
  client-side with [vega-embed](https://github.com/vega/vega-embed).
- One honesty rule is enforced in the renderer itself, not just asked for in the prompt: any
  bar chart's quantitative axis is forced to start at zero, regardless of what the spec says.
- If the image has no real chart, graph, or map in it, it says so plainly instead of inventing
  one.

## Getting started

**Prerequisites:**
- Node.js and npm
- The [Claude Code CLI](https://code.claude.com) (`claude`), installed and signed in — this is
  what the app actually calls, so run `claude -p "say hi"` once beforehand to confirm it works.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No `.env` file or API key needed — the app uses whatever `claude` auth is already set up on
the machine running it.

### Running it as a desktop app instead

```bash
npm run electron
```

A thin wrapper — Electron launches the same `next dev` server in the background and opens a
native window pointed at it. No code changes from the web version; same `claude` CLI
requirement (and the same single-machine-only caveat below) still applies.

On Linux, Electron needs a handful of system libraries (NSS, ALSA, ...) that aren't always
preinstalled — if it fails with an `error while loading shared libraries` message, run:
```bash
sudo npx playwright install-deps
```
(installs the missing OS packages for your exact distro; doesn't install Playwright itself as
a dependency of this project, just borrows its installer).

To avoid typing `npm run electron` every time, install a desktop launcher entry (adds it to
your application menu with its own icon):
```bash
electron/install-launcher.sh
```

## Project structure

```
app/page.tsx             the whole UI: upload, context, results
app/api/analyze/route.ts the only API route — runs the claude CLI, returns structured JSON
lib/schema.ts             the shared Zod schema (+ mirrored JSON Schema for --json-schema)
lib/claude-cli.ts         the claude CLI subprocess wrapper: temp file, system prompt, parsing
components/FairChart.tsx  renders one chart spec via vega-embed, enforces the zero-baseline rule
electron/main.js          the desktop wrapper: launches next dev, opens a window pointed at it
electron/launch.sh        double-click/launcher entry point (used by the installed launcher)
electron/install-launcher.sh  installs a desktop menu entry pointing at launch.sh
```

## Notes

- This is a local-dev tool, not something meant to be deployed as-is — it depends on an
  interactively-authenticated CLI on the machine it runs on, not a server-side credential. The
  Electron wrapper doesn't change this: it's a packaging convenience for one machine, not a way
  to ship the app to other people without them having their own `claude` CLI set up too.
- Uploaded images are written to a short-lived `.tmp-uploads/` folder (git-ignored) inside the
  project for the duration of one request, then deleted.
- Values Claude couldn't read directly (no printed numbers) are visually estimated and flagged
  as such in the UI.
