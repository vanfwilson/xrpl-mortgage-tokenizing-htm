# wasi-sdk (clang + wasm-ld for wasm32), Node.js for the Xahau deploy/proof, adnanh/webhook as the trigger. Server only.
FROM almir/webhook:2.8.1 AS webhook

FROM ghcr.io/webassembly/wasi-sdk:latest
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 curl gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*
COPY --from=webhook /usr/local/bin/webhook /usr/local/bin/webhook
COPY hooks.json /etc/webhook/hooks.json
COPY build-on-push.sh run-pipeline.sh serve-artifacts.py entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/build-on-push.sh /usr/local/bin/run-pipeline.sh /usr/local/bin/entrypoint.sh
WORKDIR /work
EXPOSE 9000 9001
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
