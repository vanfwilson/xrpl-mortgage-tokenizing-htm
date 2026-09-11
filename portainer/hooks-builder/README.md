# hooks-builder (Portainer stack on the 72.x server)

Compiles `hooks/src/*.c` to `.wasm` on the server on every push to `v3`, behind Traefik, triggered by a GitHub webhook.
No compiler or container ever runs on a workstation.

## Deploy (Portainer paste)

1. Portainer → Stacks → Add stack → **Repository**: this repo, branch `v3`, compose path
   `portainer/hooks-builder/docker-compose.yml`, stack name **`hooks-builder`**.
2. Environment variables: `HOOKS_BUILDER_HOST`, `WEBHOOK_SECRET` (generate: `openssl rand -hex 32`), `TRAEFIK_NETWORK`,
   `CERT_RESOLVER`, `GIT_REPO=https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm.git`, `GIT_BRANCH=v3`.
3. Add a second Traefik router for artifacts if you want them public read-only:
   `Host(HOOKS_BUILDER_HOST) && PathPrefix(/artifacts)` → port `9001` with a `stripprefix` middleware. Without it the
   artifacts stay reachable only inside the docker network, which is fine for CI-style use.
4. GitHub → repo → Settings → Webhooks → Add: Payload URL `https://HOOKS_BUILDER_HOST/hooks/build-hooks`,
   content type `application/json`, secret = `WEBHOOK_SECRET`, event: pushes only.

## What happens on push

`webhook` verifies the `X-Hub-Signature-256` HMAC and that `ref == refs/heads/v3`, then runs `build-on-push.sh <sha>`:
checkout that commit, compile every `hooks/src/*.c` with the container's `clang` + `wasm-ld`, write
`/work/build/<sha>/<name>.wasm` + `build.log` + sha256, and refresh `/work/build/latest/`. The deploy/proof step
(`hooks/deploy.mjs --test` against Xahau Testnet) stays a deliberate operator action; it is not run by the webhook.

## Manual build without the webhook

```bash
docker compose -p hooks-builder exec hooks-builder /usr/local/bin/build-on-push.sh <sha> refs/heads/v3
```
