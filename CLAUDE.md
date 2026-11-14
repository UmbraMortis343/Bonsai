# Bonsai: notes for Claude

Read this first in every session. It replaces the long design conversation the project grew out of.

## What it is
A knowledge-retention app. You build knowledge graphs of ideas, grouped into topics, and keep them alive by reviewing them. The home screen is a garden of floating voxel islands: each topic is a biome that grows as ideas are added and dries out when ideas wait too long to be reviewed.

- Live: https://umbramortis343.github.io/Bonsai/ (installable web app, laptop and phone)
- Repo: https://github.com/UmbraMortis343/Bonsai (public, AGPL-3.0-or-later from 0.6.0)
- Owner: Karthik (GitHub UmbraMortis343). Use the handle, not his name, in anything public.

## Words
Hub → island → topic → knowledge graph → idea. In code a topic is still a `zone`, a knowledge graph a `tree` and an idea a `node`. The old screens still say zone and tree; renaming them is part of the knowledge view card.

## How he wants it
- Very little text in the app. No explanatory copy, labels only where needed.
- Every action reachable by keyboard, with its key shown on screen. Phone gets a touch compromise.
- Replies short and plain. Show pictures of visual work; he judges looks himself.
- He decides direction. Ask before changing something he designed; just fix bugs.

## Code
Plain ES modules, no bundler. `src/` is the app; `scripts/build.mjs` copies it to `dist/`, stamps the version and writes the service worker's file list.

| File | What |
|---|---|
| `src/main.js` | App state `S`, routes, views, panels, keys. Routes: `#/` garden (home), `#/forest`, `#/tree/<id>`, `#/garden` (watering with potted plants), `#/meaning[/<zoneId>]` |
| `src/isles.js` | Draws the garden: hubs, islands, bridges, mist, animals, sky, labels, picking, camera. API `createIsles(opts)` → `setData(islands, pairs, hubs)`, `focus`, `focusHub`, `select`, `setActive`, `setNight`, `setQuality` |
| `src/gardenmap.js` | Pure logic for Import map: `readMap`, `missing`, `mergeMap`. No browser needed |
| `src/isles-world.js` | Builds one island's voxels and meshes: terrain, water, biomes, plants, landmarks, bones |
| `src/store.js` | IndexedDB, schema v3: zones, trees, nodes, links, events, meta, patches, inbox, vectors. Garden arrangement lives in `meta` key `garden`: `hubs`, `islands` (`hubId`, `mapId` if it came from the map, `split` if made by a split), `zone[id]` (biome, mark, and `mapId`/`mapName`/`mapIsle`/`fromMap` for map topics), `mapAt` once a map has been imported |
| `src/srs.js` | Spaced repetition |
| `src/stage.js`, `flora.js`, `layout.js` | 3D tree and forest views |
| `src/ai.js`, `ai-worker.js`, `semantic.js` | On-device embeddings (all-MiniLM-L6-v2) for the meaning view and search |
| `src/dom.js`, `md.js`, `styles.css`, `app.js`, `sw.js` | Helpers, Markdown, styles, app shell and offline cache |

Growth = ideas in the topic / 150 (a "full plot"), shaped by a power of 0.6, capped at 2. Health = share of reviewable ideas not due.

Garden levels: every hub → one hub → one island → one topic (`S.hub`, `S.isle`, `S.topic`; a garden with one hub skips the hub step). An island holds six topics. An island has a mountain if its centrepiece is the arches or its `mountain` flag is set (island menu); it rises on the first topic's plot, and without the arches' river its waterfall lands in a small lake at its foot. Water never lies under a centrepiece: `isles-world.js` measures each centrepiece's reach per direction from the blocks it lays (`spanOf`, `keepAt`) and places ponds, the lake and the stream around it; `tests/run13-water.mjs` checks this over many islands. Use `keepAt` for anything new that carves or floods ground. The map is the only place hubs and islands are made once `mapAt` is set: Import map (menu) takes the text the Bonsai Map page copies. The map wins for what is on it; a topic moved by hand stays until it moves on the map. A topic with no ideas is under mist (only when `mapAt` is set), an empty hub is a mist bank. Split (S, at 200%): merges the topic's graphs under one trunk, then its largest main branches (up to five) become topics on a new island, each linked back to the trunk.

## Test and release
- `npm test` runs `tests/run*.mjs` in parallel (Playwright, headless). All must pass before a release.
- Release: bump `version` in `package.json`, add `## x.y.z — YYYY-MM-DD` at the top of `CHANGELOG.md`, push to `main`. GitHub Actions builds, deploys to Pages, tags and creates the release.
- Commits are authored as Claude and end with the attribution lines the session gives.
- The workspace can't open the live site; check the Actions run with `gh run list -R UmbraMortis343/Bonsai`.
- In the cloud workspace: `export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` and `mkdir -p tests/.out` first. Drawing is in software there and very slow, so a test that makes hundreds of writes should pause the garden (`bonsai.isles.setActive(false)`) around them. `run07` sometimes times out for that reason; run it again on its own.
- Pictures for him: `bonsai.isles.look(yaw, pitch)` sets the camera angle; `look(0, 2)` looks straight down, which is the view to use when checking whether anything overlaps (the mountain is then at the top).

## Landmarks
`tools/landmarks/`: `BRIEF.md` (give this to whoever makes landmarks), `kit.mjs`, `render.mjs` (`node tools/landmarks/render.mjs <file.mjs> <out.png>`), and `library/` with the approved ones. Bell tower and gear tower are to be redone. Agreed route: Opus 5.5 on high, two renders per landmark, several landmarks per run. Not yet wired into the app: the app still draws its own built-in landmarks in `isles-world.js`.

## Elsewhere (private pages in his Claude account)
- Roadmap board: artifact `26c36fae-f85e-467b-8dc3-70cfd487c895`, collection `cards`. Fields: title, note, tag (feature, tweak, bug), col (todo, doing, done), order, owner (you, claude, both), fit (which model suits it), source. Writes to existing cards need `ifVersion`. Move cards as work lands; keep his order.
- Bonsai Map: artifact `cc91880e-7fbd-4b5b-af9f-013f6274cffb`. Hubs, islands and topics he arranges, plus drafted topic maps. Docs `map/main` and `trees/<topicId>`. Its Copy for Bonsai button copies the layout as text for the app's Import map (the page can't download files).
- Greenhouse prototype: artifact `2956bbd2-4c90-4a88-858a-6fa6728f5e8d`. The look-development page the garden came from.

## Agreed, not built
- Knowledge view from his sketch: numbered nodes, a key to jump to a number, a controls bar with shortcuts, a right panel of node cards that changes only on click, hover card, notes beside it. Stays 3D. A 2D tech tree with draggable nodes.
- Notes section; nested bullets turn into a graph.
- Review that makes you work: Recall, Feynman, Rebuild, Patch and Stitch, scored for coverage by the on-device model.
- Exams by tier, run as a page inside Claude that exports a file for the app; topic maps drafted from syllabuses (CIE for school level) and competency frameworks for non-academic skills. Pilot: Physics and Leadership.
- Three colours per topic (main plants, accents, glow).

## Keeping sessions cheap
One card per session. Start by reading this file and the card. Don't re-read whole large files when a section will do; avoid loading pictures you don't need. End the session after the release and update the board.
