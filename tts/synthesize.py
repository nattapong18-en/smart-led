#!/usr/bin/env python3
import os
import sys
import json
import wave
from pathlib import Path

# Keep language resources beside this service, not in the user's home directory.
os.environ.setdefault("PYTHAINLP_DATA", str(Path(__file__).resolve().parent / "cache" / "pythainlp"))

import onnxruntime
from vachanatts import TTS
from vachanatts.config import Config, SpeechConfig
from vachanatts.voice import Voice


if len(sys.argv) != 3:
    raise SystemExit("usage: synthesize.py TEXT OUTPUT.wav")

model = Path("voices/th_f_2.onnx")
config = Path("voices/speaker_config.json")
if model.is_file() and config.is_file():
    # ONNX Runtime otherwise starts a pool sized for the host's CPUs, even
    # though Render Free only grants this process 0.1 CPU. A single worker
    # avoids spending the quota on thread scheduling instead of synthesis.
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    options.execution_mode = onnxruntime.ExecutionMode.ORT_SEQUENTIAL
    voice = Voice(
        session=onnxruntime.InferenceSession(
            str(model), sess_options=options, providers=["CPUExecutionProvider"]
        ),
        config=Config.from_dict(json.loads(config.read_text(encoding="utf-8"))),
    )
    settings = SpeechConfig(length_scale=1 / 1.05, noise_scale=0.667, noise_w_scale=0.8)
    with wave.open(sys.argv[2], "wb") as output:
        voice.synthesize_wav(sys.argv[1], output, settings)
else:
    # Local development still downloads the model on first use.
    TTS(sys.argv[1], voice="th_f_2", output=sys.argv[2], speed=1.05)
