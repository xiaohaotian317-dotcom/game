"""Read-only audit of original T38 audio and score. Python + NumPy only."""
import hashlib
import json
from pathlib import Path
import wave

import numpy as np

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / "music-manifest-v1.json").read_text(encoding="utf-8"))
scores = {s["id"]: s for s in json.loads((ROOT / "scores-v1.json").read_text(encoding="utf-8"))["scores"]}

for info in manifest["tracks"]:
    path = ROOT / info["filename"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == info["sha256"], "Hash mismatch"
    with wave.open(str(path), "rb") as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (2, 2, 44100)
        assert w.getnframes() == info["frames"]
        assert w.getnframes() / w.getframerate() == info["duration_seconds"]
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, 2)
    x = pcm.astype(np.float64) / 32768
    assert np.max(np.abs(x)) < 0.24, "Insufficient headroom"
    assert np.max(np.abs(np.mean(x, axis=0))) < 1e-5, "DC offset"
    assert not np.any(np.abs(pcm.astype(np.int32)) >= 32767), "Clipping"
    assert np.max(np.abs(x[0] - x[-1])) < np.quantile(np.abs(np.diff(x, axis=0)), 0.99), "Loop seam outlier"
    assert np.max(np.abs((x[1] - x[0]) - (x[0] - x[-1]))) < 0.001, "Loop slope discontinuity"
    for segment in (x[:4410], x[-4410:]):
        assert np.sqrt(np.mean(segment ** 2)) > 0.005, "Unexpected silence at loop edge"
    score = scores[info["id"]]
    assert score["bars"] * 4 * 60 / score["bpm"] == info["duration_seconds"]
    assert len(score["events"]) == info["note_events"]
    assert len(score["chords"]) == 16
    assert all(1 <= e["bar"] <= 16 and 1 <= e["beat"] < 5 and e["duration_beats"] > 0 for e in score["events"])
    print(f"PASS {path.name}: exact duration, stereo PCM16, original score structure, hash, headroom, no clipping, no silent padding, loop seam/slope")

print("Signal/score audit passed. Subjective listening approval is not claimed.")
