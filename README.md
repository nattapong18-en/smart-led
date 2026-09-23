# Luma Smart Light

Luma controls the ESP32's onboard GPIO2 (D2) LED from a Next.js web app. It supports brightness and blink controls, Thai/English light commands, browser speech recognition, and spoken replies. A rule-based interpreter handles clear commands; a small Ollama model on a Raspberry Pi is a guarded fallback. The project does not use a paid AI API.

## Architecture

| Component | Responsibility |
| --- | --- |
| ESP32 | Owns the physical LED and exposes a LAN-only HTTP API. |
| Raspberry Pi 5 (4 GB) | Runs Ollama `qwen3:0.6b`; Tailscale only provides private connectivity to the VPS. No web app, SQLite, or TTS runs on the Pi. |
| VPS | Runs the Next.js website and API, SQLite, and VachanaTTS in containers. Caddy provides HTTPS and password protection for the original site. |
| Friend's website | Implements its own frontend and calls the authenticated `/api/v1/*` API. |

The VPS design is **prepared but not deployed**. A GitHub upload alone does not create a running service. Deployment needs a VPS, a domain, and a Tailscale connection to the Pi/ESP32. The last-known addresses (`192.168.1.118` for the Pi and `192.168.1.108` for the ESP32) must be verified before use.

## ESP32 firmware

Copy `include/secrets.example.h` to `include/secrets.h`, add the Wi-Fi credentials, then upload with PlatformIO:

```bash
pio run
pio run --target upload
pio device monitor
```

The serial monitor prints the board's LAN IP. Reserve that IP in your router if possible. The firmware provides:

| Method and path | Action |
| --- | --- |
| `GET /status` | Read brightness and blink state. |
| `POST /light?brightness=70` | Set brightness from 0 to 100%; zero turns the LED off. |
| `POST /blink?brightness=80&onMs=200&offMs=300&count=5` | Blink five times. Use `count=0` for continuous blinking. |
| `POST /blink/stop` | Stop blinking and restore the previous steady brightness. |

To test only the onboard D2 LED, upload the dedicated test firmware with `pio run -e d2test --target upload`, then restore the normal firmware with `pio run -e esp32dev --target upload`.

## Local development

Install Node.js/npm and, for Thai speech, Python 3.12 and `uv`. The default web process runs on your computer; the Pi still runs only Ollama.

```bash
cd web
cp .env.example .env.local
npm ci
npm run dev
```

Set `ESP32_BASE_URL` to the board's current LAN URL. Use `OLLAMA_BASE_URL=http://127.0.0.1:11434` if you have a local Ollama instance or an SSH tunnel to the Pi (`ssh -N -L 11434:127.0.0.1:11434 pi@<PI_LAN_IP>`). Open `http://localhost:3000`.

For local Thai TTS, from the repository root:

```bash
uv venv --python 3.12 tts/.venv
uv pip install --python tts/.venv/bin/python -r tts/requirements.txt
cd tts
.venv/bin/python synthesize.py "ทดสอบเสียงไทย" /tmp/luma-tts-test.wav
```

The first synthesis downloads the voice model into `tts/voices/`. The web serves Thai speech through `/api/speech` on the same port; no separate TTS server is required. Browser speech recognition provides voice input, so support depends on the user's browser.

## Deploy to a VPS

This deployment keeps the web, database, and TTS off the Pi. The checked-in [`compose.yaml`](compose.yaml) builds the web image, keeps SQLite on a named volume, and places Caddy in front of the app. Caddy requires a username/password for the original website and legacy `/api/*` routes. Only `/api/v1/*` bypasses that site password; those endpoints require a separate Bearer API key and enforce the configured browser origins. The Next.js container has no public host port.

1. Obtain a Linux VPS with Docker Compose and a domain whose DNS A record points to the VPS. Permit inbound TCP 80/443 and UDP 443 for Caddy; do **not** expose ports 3000, 11434, or the ESP32 HTTP port to the internet. Caddy obtains HTTPS certificates for a valid public domain.
2. Install Tailscale on both the VPS and Pi, sign them into the same private tailnet, and restrict tailnet access so only the VPS can reach the Pi Ollama port and ESP32 route. Keep Ollama listening on Pi loopback; on the Pi, publish only its TCP port inside the tailnet:

   ```bash
   sudo tailscale serve --bg --tcp=11434 tcp://127.0.0.1:11434
   ```

3. On the Pi, enable persistent IP forwarding as described in the [Tailscale subnet-router guide](https://tailscale.com/docs/features/subnet-routers/how-to/setup). Advertise only the ESP32's current IP, for example `sudo tailscale set --advertise-routes=192.168.1.108/32`. Approve this route in the Tailscale admin console. On the VPS, run `sudo tailscale set --accept-routes=true`. This network helper does not run the website or database on the Pi.
4. On the VPS, copy [`deploy/vps.env.example`](deploy/vps.env.example) to a root `.env` file and fill every required value. Set `OLLAMA_BASE_URL` to `http://<PI_TAILSCALE_IP>:11434` and `ESP32_BASE_URL` to the actual ESP32 LAN IP. Generate `LUMA_API_KEY` with `openssl rand -hex 32`. Generate a Caddy bcrypt hash interactively with `docker run -it --rm caddy:2 caddy hash-password` so the plaintext password is not in shell history. Keep the resulting hash **single-quoted** in `.env` so Compose does not expand `$` characters. Do not commit `.env` or share its values in screenshots.
5. Verify connectivity from the VPS before starting the app: `curl --max-time 5 http://<PI_TAILSCALE_IP>:11434/api/tags` and `curl --max-time 5 http://<ESP32_LAN_IP>/status`. If either fails, fix Tailscale routing/ACLs or the board's LAN connection first. Then run `docker compose config` and `docker compose up -d --build` from the repository root.
6. Open `https://<YOUR_DOMAIN>` and enter the site username/password. Test `/api/v1/status` separately with the Bearer key. Caddy's password protects the original UI; the friend's API uses only its own key. If the board is offline, API commands correctly fail rather than claiming the LED changed.

The example Caddy password is for a small trusted group, not individual user accounts. Each friend who receives the API key can control the same physical LED. Rotate the key if it leaks. Never put the key directly in a public frontend bundle; the friend's app should ask for it at runtime. The full API contract and a frontend-generation prompt are in [`web/FRIEND_API.md`](web/FRIEND_API.md).

For implementation details, see the [Tailscale Serve TCP documentation](https://tailscale.com/docs/reference/tailscale-cli/serve), [Tailscale subnet-router setup](https://tailscale.com/docs/features/subnet-routers/how-to/setup), [Caddy Basic Auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth), and [Docker volume documentation](https://docs.docker.com/engine/storage/volumes/).

## Commands and data

The assistant is intentionally limited to this one light. It understands on/off, brightness, blink speed and count, stop-blink, and status questions in Thai and English. Unknown or unrelated input returns usage examples without changing the LED. Saying “turn on” while the LED is already on reports that state and preserves its brightness. Do not automatically retry a timed-out POST: the ESP32 may have acted even if the response was lost.

Examples: `เปิดไฟ`, `กระพริบไฟช้า ความสว่าง 70%`, `หยุดกระพริบ`, `blink slowly 2 times at 40 percent`, `is the light on?`.

SQLite stores `sessions`, `chat_turns`, `commands`, and `presets` (schema in `web/lib/database.ts`). A page refresh creates a new visible chat session, but historical audit rows remain in SQLite. Saved presets persist independently. In the VPS setup, the database is `/data/luma.sqlite` on the `luma_data` volume. Back it up regularly; on a local install, `cd web && node scripts/backup-database.mjs data/luma-backup.sqlite` uses SQLite's backup API.

## Verification

From `web/`, run `npm test` and `npm run build`. `node scripts/check-public-api.mjs` tests auth, CORS, chat help, history, validation, and presets without changing the physical LED (set `LUMA_URL`, `LUMA_API_KEY`, and `LUMA_ORIGIN` for the target server). `node --experimental-strip-types scripts/probe-light-intents.mjs` checks command interpretation and does not command the ESP32. The physical integration script `node scripts/evaluate-light-integration.mjs` **does change the LED** and should only run when the board is reachable and it is safe to interrupt its current state.

The last live board check timed out, so a successful container/API test is not proof that the ESP32 is currently online. Verify its power, Wi-Fi connection, and IP before claiming end-to-end success.

## Security

Never commit `include/secrets.h`, `.env`, `web/.env.local`, SQLite files, voice caches, or private credentials. These paths are ignored by Git/Docker. If a credential was committed previously, rotate it; deleting it from the current file does not remove it from Git history. The VPS must use HTTPS, keep the Next.js port private, and protect the original UI/legacy API with Caddy as configured here.
