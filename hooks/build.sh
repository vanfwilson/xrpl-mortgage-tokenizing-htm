#!/usr/bin/env bash
# Compile src/*.c to build/*.wasm with clang + wasm-ld from the wasi-sdk container (Apple clang has no wasm32 backend).
set -euo pipefail
cd "$(dirname "$0")"
IMAGE="${WASI_SDK_IMAGE:-ghcr.io/webassembly/wasi-sdk:latest}"
mkdir -p build
for src in src/*.c; do
  name=$(basename "$src" .c)
  docker run --rm -v "$PWD":/work -w /work "$IMAGE" /opt/wasi-sdk/bin/clang \
    -O2 --target=wasm32 -nostdlib -nostartfiles -fno-builtin -Wno-unused-parameter \
    -I vendor/hook-macros \
    -Wl,--no-entry -Wl,--export=hook -Wl,--export=cbak -Wl,--allow-undefined -Wl,--strip-all \
    -o "build/$name.wasm" "$src"
  printf '%s -> build/%s.wasm (%s bytes)\n' "$src" "$name" "$(stat -f %z "build/$name.wasm" 2>/dev/null || stat -c %s "build/$name.wasm")"
done
