# Next.js API image for Render or the optional VPS deployment.
# The Raspberry Pi remains the Ollama host; this image runs Next.js, SQLite
# and Thai TTS on the deployment host, not on the Raspberry Pi.
FROM node:22-bookworm-slim AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM docker.io/tailscale/tailscale:v1.102.4 AS tailscale-bin

FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libgomp1 libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=web-build /usr/local/bin/node /usr/local/bin/node
COPY --from=web-build /app/web /app/web
COPY --from=tailscale-bin /usr/local/bin/tailscale /usr/local/bin/tailscale
COPY --from=tailscale-bin /usr/local/bin/tailscaled /usr/local/bin/tailscaled
COPY tts/ /app/tts/
COPY deploy/start-api.sh /app/start-api.sh
RUN python -m venv /app/tts/.venv \
    && /app/tts/.venv/bin/pip install --no-cache-dir -r /app/tts/requirements.txt \
    && cd /app/tts && .venv/bin/python synthesize.py "ทดสอบระบบ" /tmp/luma-tts-warm.wav \
    && rm /tmp/luma-tts-warm.wav
RUN mkdir -p /data /app/tts/cache
ENV NODE_ENV=production DATABASE_PATH=/data/luma.sqlite NEXT_TELEMETRY_DISABLED=1 LUMA_PUBLIC_API_ONLY=1
WORKDIR /app/web
EXPOSE 3000
CMD ["/bin/sh", "/app/start-api.sh"]
