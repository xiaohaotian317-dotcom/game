"""T38 original score + offline stereo synthesis. No samples or external music.

Run with Python 3.12 + NumPy. All writes remain beside this script.
Deterministic note score, acoustic-inspired additive instruments, and circular
room reflections produce a true seamless loop, without a silent fade at ends.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import wave

import numpy as np

HERE = Path(__file__).resolve().parent
SR = 44100
TAU = 2 * np.pi
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def pitch_name(midi):
    return NOTE_NAMES[midi % 12] + str(midi // 12 - 1)


def envelope(t, gate, attack, release):
    """Zero endpoints and a rounded attack/release, with no discontinuities."""
    up = np.sin(np.minimum(t / attack, 1) * np.pi / 2) ** 2
    down = np.cos(np.maximum(t - gate, 0) / release * np.pi / 2) ** 2
    down[t >= gate + release] = 0
    return up * down


def synth(kind, midi, gate, seed):
    rng = np.random.default_rng(seed)
    f = 440 * 2 ** ((midi - 69) / 12)
    spec = {
        "silk_strings": (0.72, 1.8),
        "low_bow": (0.48, 1.25),
        "harp": (0.008, 2.15),
        "celesta": (0.012, 2.5),
        "alto_flute": (0.14, 0.5),
        "dusky_reed": (0.12, 0.38),
        "pizzicato": (0.012, 0.7),
        "wood_pulse": (0.012, 0.33),
    }
    attack, release = spec[kind]
    t = np.arange(math.ceil((gate + release) * SR), dtype=np.float64) / SR
    sig = np.zeros_like(t)
    phase0 = rng.uniform(0, TAU)
    if kind in ("silk_strings", "low_bow"):
        harmonics = (1.0, 0.29, 0.17, 0.075, 0.03, 0.014)
        # Three independent, gently detuned bow strands, with slight bow sway.
        for strand, cents in enumerate((-4.7, 0, 4.1)):
            detuned = f * 2 ** (cents / 1200)
            slow = 0.085 * np.sin(TAU * (0.23 + 0.014 * strand) * t + phase0)
            vibrato = 0.055 * np.sin(TAU * 4.3 * t + phase0 + strand)
            for h, amp in enumerate(harmonics, 1):
                sig += amp / 3 * np.sin(TAU * detuned * h * t + slow * h + vibrato + phase0 * strand)
        sig *= 0.88 + 0.12 * np.sin(TAU * 0.18 * t + phase0)
        sig *= envelope(t, gate, attack, release)
        if kind == "low_bow":
            sig *= 0.9
    elif kind in ("harp", "pizzicato"):
        decay = 1.05 if kind == "harp" else 0.31
        amps = (1, 0.34, 0.16, 0.065, 0.025, 0.011)
        for h, amp in enumerate(amps, 1):
            inh = 1 + 0.00013 * h * h
            sig += amp * np.sin(TAU * f * h * inh * t + phase0 * 0.08) * np.exp(-t * (1 + 0.16 * h) / decay)
        sig *= envelope(t, gate, attack, release)
    elif kind == "celesta":
        for ratio, amp, decay in ((1, 1, 1.6), (2.01, 0.14, 0.8), (3.99, 0.08, 0.46), (5.4, 0.026, 0.32)):
            sig += amp * np.sin(TAU * f * ratio * t) * np.exp(-t / decay)
        sig *= envelope(t, gate, attack, release)
    elif kind in ("alto_flute", "dusky_reed"):
        vibrato = 0.29 * np.sin(TAU * 4.6 * t + phase0) * np.minimum(t / 0.45, 1)
        phase = TAU * f * t + vibrato
        amps = (1, 0.105, 0.055, 0.017) if kind == "alto_flute" else (1, 0.23, 0.15, 0.06, 0.025)
        for h, amp in enumerate(amps, 1):
            sig += amp * np.sin(h * phase + phase0 * 0.12)
        # A very low, dark breath component; no bright white-noise layer.
        breath = rng.normal(0, 1, len(t))
        breath = np.convolve(breath, np.ones(24) / 24, mode="same")
        sig += 0.019 * breath
        sig *= (0.93 + 0.07 * np.sin(TAU * 2.1 * t + phase0)) * envelope(t, gate, attack, release)
    elif kind == "wood_pulse":
        # Finger-muted wooden body, deliberately not a sharp snare/drum.
        sig = np.sin(TAU * (f * t + 7 * (1 - np.exp(-t * 12)) / 12)) * np.exp(-t * 15)
        sig += 0.15 * np.sin(TAU * f * 2.3 * t) * np.exp(-t * 25)
        sig *= envelope(t, gate, attack, release)
    return sig.astype(np.float32)


def add_note(score, bar, beat, midi, duration, instrument, gain, pan=0):
    score["events"].append({
        "bar": bar + 1, "beat": beat + 1, "midi": midi,
        "pitch": pitch_name(midi), "duration_beats": duration,
        "instrument": instrument, "gain": round(gain, 5), "pan": round(pan, 3),
    })


def make_hall():
    s = {"id": "moonlit-hall", "title": "月下旅人", "bpm": 60,
         "meter": "4/4", "bars": 16, "duration_seconds": 64,
         "tonal_center": "D minor, suspended and added-ninth colours",
         "sections": ["A: bars 1–4, first lantern", "A2: bars 5–8, moonlit arcade",
                      "B: bars 9–12, distant bells", "A3: bars 13–16, homeward cadence"],
         "seed": 38301, "events": [], "chords": []}
    chords = [
        ("Dm(add9)", [50, 57, 62, 64, 65]),
        ("Bbmaj7", [46, 53, 57, 62, 65]),
        ("Gm9", [43, 50, 57, 58, 62]),
        ("A7sus4", [45, 52, 55, 62, 64]),
        ("Dm9", [50, 57, 60, 64, 65]),
        ("Fmaj7/C", [48, 53, 57, 60, 64]),
        ("Bbmaj7", [46, 53, 57, 62, 65]),
        ("C(add9)", [48, 55, 60, 62, 64]),
        ("Gm9", [43, 50, 57, 58, 62]),
        ("Dm/A", [45, 53, 57, 62, 65]),
        ("Bbmaj7", [46, 53, 57, 62, 65]),
        ("Am7", [45, 52, 55, 60, 64]),
        ("Dm9", [50, 57, 60, 64, 65]),
        ("Bbmaj7", [46, 53, 57, 62, 65]),
        ("A7sus4", [45, 52, 55, 62, 64]),
        ("Dm(add9)", [50, 57, 62, 64, 65]),
    ]
    for bar, (name, notes) in enumerate(chords):
        s["chords"].append({"bar": bar + 1, "symbol": name, "voicing": [pitch_name(n) for n in notes]})
        for i, n in enumerate(notes):
            add_note(s, bar, 0, n, 3.65, "silk_strings", 0.071 if i else 0.052, (i - 2) * 0.24)
        # Two quiet harp gestures per bar, with long space between each.
        add_note(s, bar, 0.5, notes[1] + 12, 0.3, "harp", 0.105, -0.33)
        add_note(s, bar, 2.75, notes[3] + 12, 0.25, "harp", 0.067, 0.4)
        if bar in (1, 5, 9, 13):
            add_note(s, bar, 3.25, notes[4] + 12, 0.24, "celesta", 0.038, 0.2)
    melody = [
        [(1.5, 69, 1), (3, 65, 0.8)], [(1, 64, 1.2), (2.75, 62, 0.9)],
        [(0.75, 67, 1.5), (2.75, 69, 0.7)], [(1.5, 64, 1.5)],
        [(0.75, 65, 1.25), (2.5, 69, 0.75), (3.5, 72, 0.4)],
        [(1, 67, 1.2), (2.75, 64, 1)], [(0.75, 65, 1.7), (3.1, 62, 0.7)],
        [(1.25, 64, 1), (2.75, 67, 0.8)], [(0.5, 70, 1.1), (2, 69, 0.7), (3, 67, 0.8)],
        [(1.2, 65, 1), (2.7, 69, 1)], [(0.75, 74, 1), (2.5, 72, 0.8), (3.5, 69, 0.4)],
        [(1.25, 67, 1), (3, 64, 0.8)], [(0.5, 69, 1.4), (2.75, 65, 0.8)],
        [(1.5, 62, 1.75), (3.5, 65, 0.4)], [(1, 64, 1.7), (3, 62, 0.7)],
        [(0.5, 65, 1.2), (2.2, 64, 0.7), (3.25, 62, 0.6)],
    ]
    for bar, phrase in enumerate(melody):
        for j, (beat, n, dur) in enumerate(phrase):
            add_note(s, bar, beat, n, dur, "alto_flute", 0.083 + (bar // 4 % 2) * 0.008, -0.06 + j * 0.065)
    return s


def make_journey():
    s = {"id": "realm-journey", "title": "秘境微光", "bpm": 64,
         "meter": "4/4", "bars": 16, "duration_seconds": 60,
         "tonal_center": "E minor, open fifths and suspended dominant",
         "sections": ["A: bars 1–4, quiet footsteps", "A2: bars 5–8, ruined cloister",
                      "B: bars 9–12, a hidden path", "A3: bars 13–16, watchful return"],
         "seed": 38302, "events": [], "chords": []}
    chords = [
        ("Em9", [40, 52, 59, 62, 66, 67]),
        ("Em7/D", [38, 50, 55, 59, 64, 67]),
        ("Cmaj7", [36, 48, 55, 59, 64, 67]),
        ("B7sus4", [35, 47, 54, 57, 64, 66]),
        ("Em9", [40, 52, 59, 62, 66, 67]),
        ("G/D", [38, 50, 55, 59, 62, 67]),
        ("Cmaj7", [36, 48, 55, 59, 64, 67]),
        ("Dsus2", [38, 50, 57, 62, 64, 69]),
        ("Am9", [45, 52, 57, 59, 60, 64]),
        ("Em/G", [43, 52, 55, 59, 64, 67]),
        ("Cmaj7", [36, 48, 55, 59, 64, 67]),
        ("Bm7", [35, 47, 54, 57, 62, 66]),
        ("Em9", [40, 52, 59, 62, 66, 67]),
        ("Cmaj7", [36, 48, 55, 59, 64, 67]),
        ("B7sus4", [35, 47, 54, 57, 64, 66]),
        ("Em(add9)", [40, 52, 59, 64, 66, 67]),
    ]
    for bar, (name, notes) in enumerate(chords):
        s["chords"].append({"bar": bar + 1, "symbol": name, "voicing": [pitch_name(n) for n in notes]})
        add_note(s, bar, 0, notes[0], 3.5, "low_bow", 0.05, -0.16)
        for i, n in enumerate(notes[1:]):
            add_note(s, bar, 0, n, 3.55, "silk_strings", 0.055, (i - 2) * 0.23)
        # A four-pulse, soft string ostinato. The last beat varies by phrase.
        pulse = [(0, notes[1], 0.089), (1.5, notes[2], 0.066),
                 (2.5, notes[1] + 12, 0.063), (3.25, notes[3], 0.048)]
        if bar % 4 == 3:
            pulse = pulse[:3]
        for j, (beat, n, gain) in enumerate(pulse):
            add_note(s, bar, beat, n, 0.2, "pizzicato", gain, (-1 if j % 2 == 0 else 1) * 0.22)
        if bar % 2 == 0:
            add_note(s, bar, 0, 43, 0.12, "wood_pulse", 0.033, -0.05)
        if bar in (2, 6, 10, 14):
            add_note(s, bar, 2, notes[4] + 12, 0.25, "harp", 0.052, 0.38)
    melody = [
        [(1, 64, 0.7), (2.5, 67, 0.8)], [(0.75, 69, 0.7), (2.25, 71, 1.1)],
        [(1.25, 67, 1.25), (3, 64, 0.65)], [(1, 66, 1.5)],
        [(0.75, 64, 0.8), (2.25, 67, 0.6), (3.25, 71, 0.5)],
        [(1, 69, 0.9), (2.75, 67, 0.85)], [(1.5, 64, 1.35)],
        [(0.75, 66, 0.9), (2.25, 69, 1.1)], [(0.5, 72, 1.1), (2.25, 71, 0.65), (3.25, 69, 0.5)],
        [(1, 67, 1.25), (2.75, 64, 0.8)], [(0.75, 67, 0.8), (2.25, 71, 1.05)],
        [(1.25, 69, 0.8), (2.75, 66, 0.8)], [(0.5, 67, 0.85), (2, 64, 1.2)],
        [(1.25, 62, 1.1), (3, 64, 0.65)], [(1, 66, 1.6)],
        [(0.75, 67, 0.85), (2.25, 66, 0.65), (3.25, 64, 0.55)],
    ]
    for bar, phrase in enumerate(melody):
        for j, (beat, n, dur) in enumerate(phrase):
            add_note(s, bar, beat, n, dur, "dusky_reed", 0.078 + (bar // 4 % 2) * 0.006, 0.04 - j * 0.05)
    return s


def circular_add(track, mono, start_sample, pan, gain):
    # Equal-power panning with exact wrap: note/reverb tails from the previous
    # loop are present at time zero. There is no encoded silence or fade gap.
    angle = (pan + 1) * np.pi / 4
    gains = np.array([np.cos(angle), np.sin(angle)], dtype=np.float32) * gain
    n = len(track)
    pos = start_sample % n
    for offset in range(0, len(mono), n):
        piece = mono[offset:offset + n]
        first = min(len(piece), n - pos)
        track[pos:pos + first] += piece[:first, None] * gains
        if first < len(piece):
            track[:len(piece) - first] += piece[first:, None] * gains


def room_reflections(dry, journey=False):
    # Circular stereo FIR: first reflections, softened diffuse long tails.
    taps = [(0.043, 0.14), (0.079, 0.11), (0.137, 0.09), (0.223, 0.071),
            (0.347, 0.055), (0.521, 0.043), (0.739, 0.033), (1.091, 0.025),
            (1.487, 0.018), (2.031, 0.012), (2.713, 0.008)]
    wet = np.zeros_like(dry)
    for i, (sec, gain) in enumerate(taps):
        a = int(sec * SR)
        b = int((sec + 0.007 + (i % 3) * 0.004) * SR)
        wet[:, 0] += gain * np.roll(dry[:, i % 2], a)
        wet[:, 1] += gain * np.roll(dry[:, 1 - i % 2], b)
    # Filter wet sound more than dry, preserving the foreground note attacks.
    wet = periodic_filter(wet, 100, 3400)
    return dry + wet * (0.73 if journey else 0.92)


def periodic_filter(track, highpass_hz, lowpass_hz):
    f = np.fft.rfftfreq(len(track), 1 / SR)
    hp = 1 / np.sqrt(1 + (highpass_hz / np.maximum(f, 1e-12)) ** 6)
    lp = 1 / np.sqrt(1 + (f / lowpass_hz) ** 8)
    response = hp * lp
    response[0] = 0
    out = np.empty_like(track)
    for c in range(2):
        out[:, c] = np.fft.irfft(np.fft.rfft(track[:, c]) * response, n=len(track)).astype(np.float32)
    return out


def render(score):
    length = round(score["duration_seconds"] * SR)
    track = np.zeros((length, 2), dtype=np.float32)
    beat_sec = 60 / score["bpm"]
    for i, e in enumerate(score["events"]):
        at = ((e["bar"] - 1) * 4 + e["beat"] - 1) * beat_sec
        sig = synth(e["instrument"], e["midi"], e["duration_beats"] * beat_sec, score["seed"] + i * 37)
        circular_add(track, sig, round(at * SR), e["pan"], e["gain"])
    track = room_reflections(track, score["id"] == "realm-journey")
    track = periodic_filter(track, 52, 6300)
    # Conservative in-file loudness, before the game's independent music fader.
    target_rms = 0.038 if score["id"] == "moonlit-hall" else 0.043
    current_rms = np.sqrt(np.mean(track.astype(np.float64) ** 2))
    gain = target_rms / max(current_rms, 1e-12)
    gain = min(gain, 0.235 / np.max(np.abs(track)))
    track *= gain
    # TPDF quantization dither (one 16-bit LSB), not an audible noise bed.
    rng = np.random.default_rng(score["seed"] + 888)
    dither = (rng.random(track.shape, dtype=np.float32) - rng.random(track.shape, dtype=np.float32)) / 65536
    pcm = np.clip(np.round((track + dither) * 32767), -32768, 32767).astype("<i2")
    path = HERE / f"{score['id']}.wav"
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return inspect_audio(path, score)


def db(value):
    return round(20 * np.log10(max(float(value), 1e-12)), 4)


def inspect_audio(path, score):
    with wave.open(str(path), "rb") as w:
        frames, channels, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        pcm = np.frombuffer(w.readframes(frames), dtype="<i2").reshape(-1, channels)
    x = pcm.astype(np.float64) / 32768
    peak = np.max(np.abs(x))
    rms = np.sqrt(np.mean(x * x))
    steps = np.diff(x, axis=0)
    seam = x[0] - x[-1]
    first_derivative_jump = (x[1] - x[0]) - (x[0] - x[-1])
    power = np.abs(np.fft.rfft(np.mean(x, axis=1))) ** 2
    freqs = np.fft.rfftfreq(len(x), 1 / rate)
    band = lambda lo, hi: round(float(power[(freqs >= lo) & (freqs < hi)].sum() / max(power.sum(), 1e-20)), 6)
    result = {
        "id": score["id"], "title": score["title"], "filename": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size,
        "duration_seconds": frames / rate, "frames": frames, "sample_rate": rate,
        "channels": channels, "bits_per_sample": 16, "format": "PCM WAV, signed little-endian",
        "bpm": score["bpm"], "bars": score["bars"], "meter": score["meter"],
        "note_events": len(score["events"]), "peak_dbfs": db(peak), "rms_dbfs": db(rms),
        "crest_factor_db": round(db(peak) - db(rms), 4),
        "dc_offset_by_channel": np.mean(x, axis=0).tolist(),
        "clipped_samples": int(np.count_nonzero(np.abs(pcm.astype(np.int32)) >= 32767)),
        "stereo_correlation": round(float(np.corrcoef(x.T)[0, 1]), 6),
        "spectral_energy_fraction": {"below_50hz": band(0, 50), "50_to_250hz": band(50, 250),
                                     "250_to_2000hz": band(250, 2000), "2000_to_6000hz": band(2000, 6000),
                                     "above_6000hz": band(6000, rate / 2 + 1)},
        "loop": {"start_frame": 0, "end_frame_exclusive": frames,
                 "implementation": "circular note tails, circular FIR reflections and periodic spectral filter",
                 "no_silence_padding": True, "crossfade_required": False,
                 "first_minus_last_sample_by_channel": seam.tolist(),
                 "max_absolute_seam_step": float(np.max(np.abs(seam))),
                 "seam_step_dbfs": db(np.max(np.abs(seam))),
                 "normal_adjacent_step_rms": float(np.sqrt(np.mean(steps * steps))),
                 "normal_adjacent_step_p99": float(np.quantile(np.abs(steps), 0.99)),
                 "first_derivative_seam_jump_by_channel": first_derivative_jump.tolist(),
                 "last_100ms_rms_dbfs": db(np.sqrt(np.mean(x[-round(rate * .1):] ** 2))),
                 "first_100ms_rms_dbfs": db(np.sqrt(np.mean(x[:round(rate * .1)] ** 2)))},
        "provenance": "Original notes authored for this delivery; generated only by compose_music.py with NumPy and Python wave; no samples, downloads, existing tune or external music model.",
        "quality_status": "Structural/signal checks performed. No claim of human or subjective listening approval.",
    }
    print(json.dumps({k: result[k] for k in ("filename", "duration_seconds", "note_events", "peak_dbfs", "rms_dbfs", "clipped_samples")}, ensure_ascii=False), flush=True)
    return result


def main():
    scores = [make_hall(), make_journey()]
    (HERE / "scores-v1.json").write_text(json.dumps({"version": 1, "scores": scores}, ensure_ascii=False, indent=2), encoding="utf-8")
    rendered = [render(s) for s in scores]
    manifest = {"delivery": "T38 original background music v1", "tracks": rendered,
                "recommended_runtime": {"loop_entire_file": True, "default_music_volume": 0.35,
                                        "pause_when_document_hidden": True,
                                        "decode_to_audio_buffer": True,
                                        "notes": "Use decoded AudioBufferSource loop (frame 0 to exact duration). Avoid timer-based play/restart. Distinct from master SFX volume."},
                "subjective_listening": "Not performed by this agent; waveform and musical-score inspection only."}
    (HERE / "music-manifest-v1.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    checksums = [f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}" for p in sorted(HERE.iterdir())
                 if p.is_file() and p.name != "SHA256SUMS.txt"]
    (HERE / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
