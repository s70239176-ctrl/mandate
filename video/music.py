"""
Original soundtrack for the Mandate demo, synthesized from scratch with numpy (no samples, no third-party audio).
Mood: restrained, cinematic, slightly mysterious: slow minor-key pads, a sub bass, a soft plucked arpeggio and a
glassy lead that arrives as the film builds, all through a long reverb. ~100 s, stereo, 44.1 kHz.

    python music.py            -> audio/soundtrack.wav
"""
import os
import wave

import numpy as np

SR = 44100
BPM = 72
BEAT = 60.0 / BPM
BAR = 4 * BEAT
DURATION = 100.0
N = int(SR * DURATION)
rng = np.random.default_rng(7)

# D minor family: Dm - Bb - F - C, one chord per bar
CHORDS = [
    (38, [50, 57, 62, 65]),  # Dm  (bass D2; D3 A3 D4 F4)
    (34, [46, 53, 58, 62]),  # Bb  (bass Bb1)
    (41, [53, 57, 60, 65]),  # F
    (36, [48, 55, 60, 64]),  # C
]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n, a, d, s, r):
    t = np.arange(n) / SR
    e = np.ones(n)
    ai, di, ri = int(a * SR), int(d * SR), int(r * SR)
    if ai > 0:
        e[:ai] = np.linspace(0, 1, ai)
    if di > 0 and ai + di < n:
        e[ai : ai + di] = np.linspace(1, s, di)
        e[ai + di :] = s
    if ri > 0 and ri < n:
        e[-ri:] *= np.linspace(1, 0, ri)
    return e


def lowpass(x, cutoff):
    """One-pole low pass, vectorised via cumulative recurrence on blocks (cheap and smooth enough for pads)."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    from scipy.signal import lfilter  # noqa: PLC0415

    return lfilter([1 - a], [1, -a], x)


try:
    import scipy  # noqa: F401

    HAVE_SCIPY = True
except Exception:
    HAVE_SCIPY = False


def lp(x, cutoff):
    if HAVE_SCIPY:
        return lowpass(x, cutoff)
    # fallback: moving-average smoothing
    k = max(1, int(SR / cutoff / 2))
    c = np.cumsum(np.insert(x, 0, 0))
    y = (c[k:] - c[:-k]) / k
    return np.concatenate([np.zeros(k - 1), y])


def pad_tone(freq, n, detune=0.0045, bright=1.0):
    t = np.arange(n) / SR
    x = np.zeros(n)
    for d, amp in ((-detune, 0.5), (0.0, 0.7), (detune, 0.5)):
        f = freq * (1 + d)
        for h, ha in ((1, 1.0), (2, 0.5 * bright), (3, 0.3 * bright), (4, 0.16 * bright), (5, 0.08 * bright)):
            x += amp * ha * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6.28))
    return x / 4.0


def pluck(freq, n):
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2 * t) + 0.12 * np.sin(2 * np.pi * freq * 3 * t)
    return x * np.exp(-t * 4.2)


def bell(freq, n):
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 3) + 0.25 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 5)
    return x * np.exp(-t * 1.6)


L = np.zeros(N)
R = np.zeros(N)


def add(buf, x, start, gain=1.0):
    s = int(start * SR)
    if s >= N:
        return
    e = min(N, s + len(x))
    buf[s:e] += x[: e - s] * gain


# --- section loudness plan (0..1) over time: sparse intro, build, full, gentle outro
def level(t):
    pts = [(0, 0.0), (3, 0.35), (10, 0.55), (28, 0.75), (60, 0.95), (88, 0.8), (96, 0.25), (100, 0)]
    xs, ys = zip(*pts)
    return float(np.interp(t, xs, ys))


bars = int(DURATION / BAR) + 1
for b in range(bars):
    t0 = b * BAR
    bass, chord = CHORDS[b % 4]
    lv = level(t0 + BAR / 2)

    # pads: one long swell per bar, overlapping into the next
    n = int((BAR + 1.6) * SR)
    env = env_adsr(n, 1.1, 0.8, 0.8, 1.4)
    for i, m in enumerate(chord):
        tone = lp(pad_tone(hz(m), n, bright=0.8 + 0.5 * lv), 1100 + 1600 * lv) * env
        pan = 0.35 + 0.3 * (i / 3)
        add(L, tone, t0, 0.17 * lv * (1 - pan + 0.35))
        add(R, tone, t0, 0.17 * lv * (pan + 0.35))

    # sub bass: a slow note per bar
    nb = int((BAR * 0.98) * SR)
    sub = np.sin(2 * np.pi * hz(bass) * np.arange(nb) / SR) * env_adsr(nb, 0.08, 0.4, 0.7, 0.5)
    sub += 0.25 * np.sin(2 * np.pi * hz(bass + 12) * np.arange(nb) / SR) * env_adsr(nb, 0.08, 0.4, 0.5, 0.5)
    g = 0.34 * min(1.0, lv * 1.3)
    add(L, sub, t0, g)
    add(R, sub, t0, g)

    # arpeggio: 8th notes, enters after ~8 s, ping-pongs left/right
    if t0 >= 8:
        pattern = [0, 2, 1, 3, 2, 1, 3, 2]
        for k, idx in enumerate(pattern):
            m = chord[idx] + 12
            tn = t0 + k * (BEAT / 2)
            pl = pluck(hz(m), int(1.4 * SR))
            amp = (0.09 + 0.07 * lv) * (1.0 if k % 2 == 0 else 0.7)
            if k % 2 == 0:
                add(L, pl, tn, amp)
                add(R, pl, tn, amp * 0.35)
            else:
                add(R, pl, tn, amp)
                add(L, pl, tn, amp * 0.35)

    # glassy lead notes, sparse, from ~30 s
    if t0 >= 30 and b % 2 == 0:
        scale = [chord[1] + 24, chord[2] + 24, chord[3] + 24, chord[0] + 36]
        for k, m in enumerate(scale[:3]):
            tn = t0 + (k * 1.5 + 0.5) * BEAT
            bl = bell(hz(m), int(3.5 * SR))
            add(L, bl, tn, 0.05 * lv)
            add(R, bl, tn + 0.012, 0.05 * lv)

# soft air: filtered noise swells at section changes
for t_sw, dur in ((26.0, 4.0), (58.0, 4.0), (86.0, 5.0)):
    n = int(dur * SR)
    noise = lp(rng.standard_normal(n), 2400) * np.sin(np.linspace(0, np.pi, n)) ** 2
    add(L, noise, t_sw, 0.045)
    add(R, noise[::-1], t_sw, 0.045)

# --- reverb: long synthetic impulse response (exponentially decaying filtered noise, stereo-decorrelated)
def impulse(seed, secs=3.2):
    r = np.random.default_rng(seed)
    n = int(secs * SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR * 2.1)
    ir = lp(ir, 5200)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir**2))


def conv(x, ir):
    n = len(x) + len(ir) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]


wetL = conv(L, impulse(11))
wetR = conv(R, impulse(23))
mixL = 0.62 * L + 0.55 * wetL
mixR = 0.62 * R + 0.55 * wetR

# --- master: gentle fade in/out, soft clip, normalise to -3 dBFS peak
fade_in = np.clip(np.arange(N) / (2.0 * SR), 0, 1)
fade_out = np.clip((N - np.arange(N)) / (4.0 * SR), 0, 1)
for ch in (mixL, mixR):
    ch *= fade_in * fade_out
out = np.stack([mixL, mixR], axis=1)
out = np.tanh(out * 1.4) / 1.4
out *= 0.708 / np.max(np.abs(out))

os.makedirs("audio", exist_ok=True)
pcm = (out * 32767).astype("<i2")
with wave.open("audio/soundtrack.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote audio/soundtrack.wav  {DURATION:.0f}s  peak {20*np.log10(np.max(np.abs(out))):.1f} dBFS  scipy={HAVE_SCIPY}")
