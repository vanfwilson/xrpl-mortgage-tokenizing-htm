# wasi-sdk (clang + wasm-ld for wasm32) plus adnanh/webhook as the HTTP trigger. Runs on the server only.
FROM almir/webhook:2.8.1 AS webhook

FROM ghcr.io/webassembly/wasi-sdk:latest
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 && rm -rf /var/lib/apt/lists/*
COPY --from=webhook /usr/local/bin/webhook /usr/local/bin/webhook
COPY hooks.json /etc/webhook/hooks.json
COPY build-on-push.sh /usr/local/bin/build-on-push.sh
COPY serve-artifacts.py /usr/local/bin/serve-artifacts.py
RUN chmod +x /usr/local/bin/build-on-push.sh
WORKDIR /work
EXPOSE 9000
# webhook on :9000 (/hooks/*); artifacts served on the same port under /artifacts/ by a tiny python server proxied via webhook's static option is not available, so both listen on 9000 through a shared entrypoint script.
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
