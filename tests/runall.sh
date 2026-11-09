#!/usr/bin/env bash
# Runs every tests/run*.mjs in parallel. Exits non-zero if any fail.
cd "$(dirname "$0")/.." || exit 1
pids=(); names=()
for t in tests/run*.mjs; do
  node "$t" > "tests/.out/$(basename "$t").log" 2>&1 &
  pids+=($!); names+=("$t")
done
fail=0
for i in "${!pids[@]}"; do
  if wait "${pids[$i]}"; then echo "ok   ${names[$i]}"; else echo "FAIL ${names[$i]}"; cat "tests/.out/$(basename "${names[$i]}").log"; fail=1; fi
done
exit $fail
