#!/usr/bin/env python3
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


HOST = "127.0.0.1"
PORT = 8765
MAX_REQUEST_BYTES = 1024
ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "cache"
SYNTHESIZER = ROOT / "synthesize.py"
CACHE.mkdir(exist_ok=True)


def cache_path(text):
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return CACHE / f"{digest}.wav"


def synthesize(text):
    destination = cache_path(text)
    if destination.exists():
        return destination.read_bytes(), True

    file_descriptor, temporary_name = tempfile.mkstemp(prefix="tts-", suffix=".wav", dir=CACHE)
    os.close(file_descriptor)
    try:
        subprocess.run(
            [sys.executable, str(SYNTHESIZER), text, temporary_name],
            cwd=ROOT,
            timeout=15,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        os.replace(temporary_name, destination)
        return destination.read_bytes(), False
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_error(404)
            return
        self._send_json(200, {"ok": True, "voice": "th_f_2", "cache": len(list(CACHE.glob("*.wav")))})

    def do_POST(self):
        if self.path != "/speech":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > MAX_REQUEST_BYTES:
                raise ValueError("invalid request size")
            payload = json.loads(self.rfile.read(length))
            text = payload.get("text")
            if not isinstance(text, str) or not text.strip() or len(text) > 200:
                raise ValueError("text must contain 1-200 characters")
            audio, cached = synthesize(text.strip())
        except (ValueError, json.JSONDecodeError) as error:
            self._send_json(400, {"error": str(error)})
            return
        except (subprocess.SubprocessError, OSError) as error:
            print(f"synthesis failed: {error}", flush=True)
            self._send_json(500, {"error": "speech synthesis failed"})
            return

        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("Cache-Control", "private, max-age=86400")
        self.send_header("X-TTS-Cache", "hit" if cached else "miss")
        self.end_headers()
        self.wfile.write(audio)

    def log_message(self, message, *args):
        print(f"{self.client_address[0]} - {message % args}", flush=True)

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"Thai TTS cache ready on http://{HOST}:{PORT}", flush=True)
    HTTPServer((HOST, PORT), Handler).serve_forever()
