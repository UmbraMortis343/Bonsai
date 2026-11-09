# Bonsai

Grow a forest of linked notes. Zones are subjects, trees are topics, and branches can be grafted between trees.

An installable web app (PWA) for laptop and phone. Notes stay on each device for now; sync comes later.

## Install

Open the app's GitHub Pages address in Chrome or Edge, then choose **Install app** (or browser menu → Install / Add to home screen). After that, new releases show an **Update to x.y.z** button inside the app.

## Release

Bump `version` in `package.json` and push to `main`. The Release workflow builds `src/` into `dist/` and publishes it to GitHub Pages. Pushes that don't change the version don't release.

One-time setting: repo **Settings → Pages → Source: GitHub Actions**.

## Develop

```
npm install
npm run build        # src → dist, stamps the version
npm run serve        # http://localhost:4173/Bonsai/
npm test             # Playwright regression suite (tests/run*.mjs, in parallel)
```
