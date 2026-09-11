# hooks-builder (compose stack on the 72.x server)

Compiles `hooks/src/*.c` to `.wasm` on the server on every push to `v3`, behind Traefik, triggered by a GitHub webhook.
No compiler or container ever runs on a workstation.

## Deployed (2026-09-11)

- Server dir `/root/portainer-stacks/hooks-builder` (compose project `hooks-builder`; Portainer lists it as an external
  stack). `.env` there holds `HOOKS_BUILDER_HOST`, `WEBHOOK_SECRET`, `GIT_REPO`, `GIT_BRANCH` and is not in git.
- Host `hooks.aiautomationauthority.com` (Cloudflare-proxied A record → 72.60.225.136), Traefik network `traefik-public`,
  entrypoint `websecure`, resolver `letsencrypt`.
- Routes: `POST /hooks/build-hooks` (webhook, port 9000) · `GET /artifacts/latest/mortgage_firewall.wasm` and
  `/artifacts/<sha>/build.log` (read-only, port 9001).
- GitHub webhook id `677882126` on `vanfwilson/xrpl-mortgage-tokenizing-htm`, pushes only, HMAC-SHA256.

## Redeploy / update

```bash
scp portainer/hooks-builder/{docker-compose.yml,Dockerfile,entrypoint.sh,serve-artifacts.py,hooks.json,build-on-push.sh} aiaa-server:/root/portainer-stacks/hooks-builder/
ssh aiaa-server 'cd /root/portainer-stacks/hooks-builder && docker compose -p hooks-builder up -d --build'
```

## What happens on push

`webhook` verifies the `X-Hub-Signature-256` HMAC and that `ref == refs/heads/v3`, then runs `build-on-push.sh <sha>`:
checkout that commit, compile every `hooks/src/*.c` with the container's `clang` + `wasm-ld`, write
`/work/build/<sha>/<name>.wasm` + `build.log` + sha256, and refresh `/work/build/latest/`. The deploy/proof step
(`hooks/deploy.mjs --test` against Xahau Testnet) stays a deliberate operator action; it is not run by the webhook.

## Manual build without the webhook

```bash
docker compose -p hooks-builder exec hooks-builder /usr/local/bin/build-on-push.sh <sha> refs/heads/v3
```
