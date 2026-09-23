# Persistent-server image for the Next.js web/API on a VPS.
# The Raspberry Pi remains the Ollama host; this image runs Next.js, SQLite
# and Thai TTS on the deployment host, not on the user's computer.
FROM node:22-bookworm-slim AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libgomp1 libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=web-build /usr/local/bin/node /usr/local/bin/node
COPY --from=web-build /app/web /app/web
COPY tts/ /app/tts/
RUN python -m venv /app/tts/.venv \
    && /app/tts/.venv/bin/pip install --no-cache-dir -r /app/tts/requirements.txt \
    && cd /app/tts && .venv/bin/python synthesize.py "ทดสอบระบบ" /tmp/luma-tts-warm.wav \
    && rm /tmp/luma-tts-warm.wav
RUN mkdir -p /data /app/tts/cache
ENV NODE_ENV=production DATABASE_PATH=/data/luma.sqlite NEXT_TELEMETRY_DISABLED=1 LUMA_PUBLIC_API_ONLY=1
WORKDIR /app/web
EXPOSE 3000
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port ${PORT:-3000}"]
