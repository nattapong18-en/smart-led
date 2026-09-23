#!/bin/sh
set -eu

# Render has no TUN device. Its Tailscale node exposes a loopback HTTP proxy
# for this container's outbound requests to the Pi and ESP32 subnet route.
if [ "${LUMA_REQUIRE_TAILSCALE:-0}" = "1" ] && [ -z "${TS_AUTHKEY:-}" ]; then
  echo "TS_AUTHKEY is required for this deployment" >&2
  exit 1
fi

if [ -n "${TS_AUTHKEY:-}" ]; then
  mkdir -p /var/run/tailscale
  tailscaled \
    --tun=userspace-networking \
    --outbound-http-proxy-listen=127.0.0.1:1055 \
    --socket=/var/run/tailscale/tailscaled.sock \
    --state=/tmp/luma-tailscale.state &

  ready=0
  attempt=0
  while [ "$attempt" -lt 30 ]; do
    if tailscale status >/dev/null 2>&1; then
      ready=1
      break
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  if [ "$ready" -ne 1 ]; then
    echo "Tailscale daemon did not start" >&2
    exit 1
  fi

  tailscale up --auth-key="$TS_AUTHKEY" --accept-routes --accept-dns=false --shields-up --hostname=luma-render --timeout=30s
  unset TS_AUTHKEY
  export HTTP_PROXY=http://127.0.0.1:1055
  export HTTPS_PROXY=http://127.0.0.1:1055
  export NO_PROXY=127.0.0.1,localhost
  export NODE_USE_ENV_PROXY=1
fi

exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port "${PORT:-3000}"
