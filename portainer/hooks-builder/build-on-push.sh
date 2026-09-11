#!/usr/bin/env bash
# Webhook entry: called with <commit sha> <ref>. Enqueues the pipeline and returns within GitHub's 10 s window.
set -euo pipefail
SHA="${1:?sha}"; REF="${2:-}"
OUT="/work/build/$SHA"; mkdir -p "$OUT"
printf '{"commit":"%s","ref":"%s","status":"queued","queued_at":"%s"}\n' "$SHA" "$REF" "$(date -u +%FT%TZ)" > "$OUT/status.json"
nohup /usr/local/bin/run-pipeline.sh "$SHA" "$REF" > "$OUT/pipeline.log" 2>&1 &
echo "queued $SHA -> /artifacts/$SHA/status.json"
