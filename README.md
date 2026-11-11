# Bonsai

Grow a forest of linked notes. Zones are subjects, trees are topics, and branches can be grafted between trees.

An installable 3D web app (PWA) for laptop and phone. Notes stay on each device for now; sync comes later.

The meaning view runs [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) (Apache 2.0) in the browser through [Transformers.js](https://github.com/huggingface/transformers.js) (Apache 2.0), arranged with [umap-js](https://github.com/PAIR-code/umap-js) (Apache 2.0). The model lives in `src/models/`, fetched by the "Fetch embedding model" workflow.

Plain JavaScript modules with no build step beyond a file copy. 3D is [Three.js](https://threejs.org) (MIT), vendored in `src/vendor/`.

## Install

Open the app's GitHub Pages address in Chrome or Edge, then choose **Install app** (or browser menu → Install / Add to home screen). After that, new releases show an **Update to x.y.z** button inside the app.

## Release

1. Bump `version` in `package.json` (minor for features, patch for fixes and tweaks).
2. Add a `## x.y.z — YYYY-MM-DD` entry at the top of `CHANGELOG.md`.
3. Push to `main`.

The Release workflow builds `src/` into `dist/`, publishes it to GitHub Pages, then tags the commit `vx.y.z` and creates a GitHub release with that version's changelog notes. A version that's already tagged doesn't release again.

One-time setting: repo **Settings → Pages → Source: GitHub Actions**.

## Licence

GNU Affero General Public License, version 3 or later (AGPL-3.0-or-later), from version 0.6.0. Free for anyone to use, change and share; if you pass on or host a changed version, you share its source under the same licence. See `LICENSE`. Versions 0.1.0 to 0.5.0 were released under the MIT licence.

Copyright (C) 2026 UmbraMortis343.

The bundled libraries keep their own licences: three.js and umap-js (MIT), Transformers.js and the all-MiniLM-L6-v2 model (Apache 2.0), ONNX Runtime (MIT).

## Develop

```
npm install
npm run build        # src → dist, stamps the version
npm run serve        # http://localhost:4173/Bonsai/
npm test             # Playwright regression suite (tests/run*.mjs, in parallel)
```
