#!/usr/bin/env bash
# Builds the whole site for GitHub Pages: the released app (this checkout of main) at the root,
# and the beta branch, if there is one, under beta/ as its own copy with its own data.
# Usage: scripts/site.sh [outDir]
set -euo pipefail
out=${1:-site}
rm -rf "$out" .beta
node scripts/build.mjs "$out"
if git ls-remote --exit-code --heads origin beta >/dev/null 2>&1; then
  git clone --quiet --depth 1 --branch beta "$(git remote get-url origin)" .beta
  v="$(node -p "require('./.beta/package.json').version")-beta.$(git -C .beta rev-parse --short HEAD)"
  node .beta/scripts/build.mjs "../$out/beta" "$v" beta
  rm -rf .beta
fi
