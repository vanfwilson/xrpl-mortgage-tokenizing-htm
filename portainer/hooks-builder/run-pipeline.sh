#!/usr/bin/env bash
# Pipeline for one commit: checkout -> compile hooks -> install proof deps -> deploy + prove on Xahau Testnet.
# Serialized with a lock (the proof signs from shared Testnet wallets). Status in /work/build/<sha>/status.json.
set -uo pipefail
SHA="${1:?sha}"; REF="${2:-}"
REPO="${GIT_REPO:?GIT_REPO}"; BRANCH="${GIT_BRANCH:-v3}"
SRC=/work/src; OUT="/work/build/$SHA"; XAHAU_DIR=/work/xahau
mkdir -p "$OUT" "$XAHAU_DIR"

status() {  # status <state> [extra json fields]
  printf '{"commit":"%s","ref":"%s","status":"%s","updated_at":"%s"%s}\n' "$SHA" "$REF" "$1" "$(date -u +%FT%TZ)" "${2:-}" > "$OUT/status.json"
}
fail() { echo "FAIL: $1"; status failed ",\"error\":\"$1\""; exit 1; }

exec 9>/work/pipeline.lock
flock 9 || fail "lock"
status running

echo "== checkout $SHA ($REF) $(date -u +%FT%TZ)"
if [ ! -d "$SRC/.git" ]; then git clone --quiet --branch "$BRANCH" "$REPO" "$SRC" || fail "clone"; fi
git -C "$SRC" fetch --quiet origin "$BRANCH" || fail "fetch"
git -C "$SRC" checkout --quiet "$SHA" || fail "checkout"

echo "== compile"
for c in "$SRC"/hooks/src/*.c; do
  n=$(basename "$c" .c)
  /opt/wasi-sdk/bin/clang -O2 --target=wasm32 -nostdlib -nostartfiles -fno-builtin -Wno-unused-parameter \
    -I "$SRC/hooks/vendor/hook-macros" \
    -Wl,--no-entry -Wl,--export=hook -Wl,--export=cbak -Wl,--allow-undefined -Wl,--strip-all \
    -o "$OUT/$n.wasm" "$c" 2>&1 | grep -vE 'backslash-newline|^\s+[0-9]+ \||^\s+\||warnings? generated' || true
  [ -s "$OUT/$n.wasm" ] || fail "compile $n"
  sha256sum "$OUT/$n.wasm"
done
status compiled

echo "== proof deps"
( cd "$SRC/hooks" && npm install --no-audit --no-fund --silent ) || fail "npm install"

echo "== deploy + prove on Xahau Testnet"
( cd "$SRC/hooks" && \
  HOOK_WASM="$OUT/mortgage_firewall.wasm" XAHAU_WALLETS_FILE="$XAHAU_DIR/wallets.json" XAHAU_OUT_DIR="$OUT" GIT_SHA="$SHA" \
  node deploy.mjs --test ) 2>&1 | tee "$OUT/xahau-proof.log"
PROOF=$(ls -t "$OUT"/xahau-test-*.json 2>/dev/null | head -1)
if [ -n "$PROOF" ] && grep -q '"pass": true' "$PROOF"; then
  cp "$PROOF" "$OUT/xahau-proof.json"
  status passed ",\"wasm_sha256\":\"$(sha256sum "$OUT/mortgage_firewall.wasm" | cut -c1-64)\",\"proof\":\"/artifacts/$SHA/xahau-proof.json\""
  rm -rf /work/build/latest && cp -r "$OUT" /work/build/latest
  echo "PASS"
else
  fail "xahau proof"
fi
