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

`webhook` verifies the `X-Hub-Signature-256` HMAC and that `ref == refs/heads/v3`, answers GitHub immediately with
`queued`, and `run-pipeline.sh <sha>` runs detached, serialized on a lock:

1. checkout that commit;
2. compile every `hooks/src/*.c` with the container's `clang` + `wasm-ld` → `/work/build/<sha>/<name>.wasm`;
3. `npm install` in `hooks/` (the `xahau` SDK);
4. `node deploy.mjs --test`: install the hook on the servicer's Xahau Testnet account (wallets persist in the volume at
   `/work/xahau/wallets.json`, faucet-funded once) and run the seven-step proof;
5. on pass, write `xahau-proof.json` and refresh `/work/build/latest/`.

Watch a run: `https://hooks.aiautomationauthority.com/artifacts/<sha>/status.json` (`queued` → `running` →
`compiled` → `passed` | `failed`), `pipeline.log`, `xahau-proof.log`, `xahau-proof.json`. `/artifacts/latest/` is the
newest passing commit.

## Manual run without the webhook

```bash
ssh aiaa-server 'docker exec hooks-builder /usr/local/bin/run-pipeline.sh <sha> refs/heads/v3'
```
