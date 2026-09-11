#!/usr/bin/env bash
# webhook answers POST /hooks/build-hooks on :9000; artifacts are served read-only on :9001 and reached through the
# same Traefik router with a path prefix (see README). Both processes are supervised here.
set -euo pipefail
mkdir -p /work/build/latest
python3 /usr/local/bin/serve-artifacts.py /work/build 9001 &
# -template renders {{ getenv "WEBHOOK_SECRET" }} in hooks.json; without it the literal text becomes the HMAC secret
exec webhook -hooks /etc/webhook/hooks.json -port 9000 -verbose -hotreload -template
