#!/usr/bin/env python3
import os
import sys
from pathlib import Path

# Keep language resources beside this service, not in the user's home directory.
os.environ.setdefault("PYTHAINLP_DATA", str(Path(__file__).resolve().parent / "cache" / "pythainlp"))

from vachanatts import TTS


if len(sys.argv) != 3:
    raise SystemExit("usage: synthesize.py TEXT OUTPUT.wav")

TTS(sys.argv[1], voice="th_f_2", output=sys.argv[2], speed=1.05)
