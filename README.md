# Bonsai

Grow a forest of linked notes. Zones are subjects, trees are topics, and branches can be grafted between trees.

An installable 3D web app (PWA) for laptop and phone. Notes stay on each device for now; sync comes later.

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

MIT. Free for anyone to use, change and share. See `LICENSE`.

## Develop

```
npm install
npm run build        # src → dist, stamps the version
npm run serve        # http://localhost:4173/Bonsai/
npm test             # Playwright regression suite (tests/run*.mjs, in parallel)
```
