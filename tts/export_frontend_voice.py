#!/usr/bin/env python3
"""Build small static MP3 replies for the Cloudflare control page.

Run after warm_cache.py. The browser can play these without waiting for Render
or using Chrome's lower-quality Thai speech synthesis.
"""

import hashlib
import subprocess
from pathlib import Path

from warm_cache import ROOT, light_replies


VOICE_PACK = "f2-v1"
DESTINATION = ROOT.parent / "web" / "frontend" / "public" / "voice" / VOICE_PACK


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    replies = light_replies()
    for index, text in enumerate(replies, 1):
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        source = ROOT / "cache" / f"{digest}.wav"
        if not source.is_file():
            raise SystemExit(f"Missing {source.name}; run .venv/bin/python warm_cache.py first")
        target = DESTINATION / f"{digest}.mp3"
        if not target.is_file() or target.stat().st_size < 512 or source.stat().st_mtime > target.stat().st_mtime:
            subprocess.run(
                ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                 "-i", str(source), "-ac", "1", "-b:a", "96k", str(target)],
                check=True,
            )
        if target.stat().st_size < 512:
            raise RuntimeError(f"Invalid MP3 for: {text}")
        if index % 50 == 0:
            print(f"Exported {index}/{len(replies)} Thai replies", flush=True)
    print(f"Exported {len(replies)} Thai replies to {DESTINATION}", flush=True)


if __name__ == "__main__":
    main()
