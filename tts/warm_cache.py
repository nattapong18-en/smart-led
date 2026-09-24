#!/usr/bin/env python3
"""Pre-render the most common replies for low-CPU Render deployments."""

import hashlib
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.environ.setdefault("PYTHAINLP_DATA", str(ROOT / "cache" / "pythainlp"))

from vachanatts import TTS  # noqa: E402


COMMON_REPLIES = (
    "กำลังเปิดไฟให้ครับ",
    "กำลังปิดไฟให้ครับ",
    "ไฟเปิดอยู่แล้วครับ",
    "ไฟปิดอยู่แล้วครับ",
    "ตอนนี้ไฟปิดอยู่ครับ",
    "ตอนนี้ไฟกำลังกระพริบอยู่ครับ",
    "กำลังหยุดไฟกระพริบให้ครับ",
    "กำลังปรับไฟให้กระพริบช้าลงครับ",
    "กำลังปรับไฟให้กระพริบเร็วขึ้นครับ",
    "กำลังปรับไฟให้กระพริบความเร็วปกติครับ",
)


def main():
    cache = ROOT / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    replies = list(COMMON_REPLIES)
    for brightness in range(1, 101):
        replies.append(f"ตอนนี้ไฟเปิดอยู่ที่ {brightness} เปอร์เซ็นต์ครับ")
        if brightness < 100:
            replies.append(f"กำลังปรับความสว่างเป็น {brightness} เปอร์เซ็นต์ให้ครับ")
            replies.append(f"ไฟตั้งไว้ที่ {brightness} เปอร์เซ็นต์อยู่แล้วครับ")

    for index, text in enumerate(replies, 1):
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        destination = cache / f"{digest}.wav"
        TTS(text, voice="th_f_2", output=str(destination), speed=1.05)
        audio = destination.read_bytes()
        if len(audio) < 44 or audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
            raise RuntimeError(f"Invalid WAV for: {text}")
        if index % 50 == 0:
            print(f"Warmed {index}/{len(replies)} Thai TTS replies", flush=True)
    print(f"Warmed {len(replies)} Thai TTS replies", flush=True)


if __name__ == "__main__":
    main()
