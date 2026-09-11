#!/usr/bin/env bash
# Called by webhook with <commit sha> <ref>. Checks out that commit and compiles hooks/src/*.c with the container's clang.
set -euo pipefail
SHA="${1:?sha}"; REF="${2:-}"
REPO="${GIT_REPO:?GIT_REPO}"; BRANCH="${GIT_BRANCH:-v3}"
SRC=/work/src; OUT="/work/build/$SHA"; LOG="$OUT/build.log"
mkdir -p "$OUT"
{
  echo "build $SHA ($REF) $(date -u +%FT%TZ)"
  if [ ! -d "$SRC/.git" ]; then git clone --quiet --branch "$BRANCH" "$REPO" "$SRC"; fi
  git -C "$SRC" fetch --quiet origin "$BRANCH"
  git -C "$SRC" checkout --quiet "$SHA"
  for c in "$SRC"/hooks/src/*.c; do
    n=$(basename "$c" .c)
    /opt/wasi-sdk/bin/clang -O2 --target=wasm32 -nostdlib -nostartfiles -fno-builtin -Wno-unused-parameter \
      -I "$SRC/hooks/vendor/hook-macros" \
      -Wl,--no-entry -Wl,--export=hook -Wl,--export=cbak -Wl,--allow-undefined -Wl,--strip-all \
      -o "$OUT/$n.wasm" "$c"
    sha256sum "$OUT/$n.wasm"
  done
  rm -rf /work/build/latest && cp -r "$OUT" /work/build/latest
  echo "ok"
} 2>&1 | tee "$LOG"
