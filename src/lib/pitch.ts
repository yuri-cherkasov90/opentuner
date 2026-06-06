// YIN pitch detection (de Cheveigné & Kawahara, 2002), with a global-minimum
// fallback so weak/decaying guitar notes still register. Search is restricted to
// a musical fundamental range (~60-2000 Hz) to avoid noise / sub-harmonic picks.
// Returns frequency in Hz (-1 if none) plus the signal RMS for a UI level meter.

export interface PitchResult {
  freq: number
  rms: number
}

export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  threshold = 0.15,
): PitchResult {
  const size = buf.length
  const half = Math.floor(size / 2)

  // Signal level (always reported, even when we bail out).
  let rms = 0
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / size)
  if (rms < 0.005) return { freq: -1, rms }

  const tauMin = Math.max(2, Math.floor(sampleRate / 2000))
  const tauMax = Math.min(half - 1, Math.floor(sampleRate / 60))

  const yin = new Float32Array(tauMax + 1)

  // Step 1 — difference function (only up to tauMax).
  for (let tau = 0; tau <= tauMax; tau++) {
    let sum = 0
    for (let i = 0; i < half; i++) {
      const delta = buf[i] - buf[i + tau]
      sum += delta * delta
    }
    yin[tau] = sum
  }

  // Step 2 — cumulative mean normalized difference.
  yin[0] = 1
  let running = 0
  for (let tau = 1; tau <= tauMax; tau++) {
    running += yin[tau]
    yin[tau] = running === 0 ? 1 : (yin[tau] * tau) / running
  }

  // Step 3 — first dip below threshold, descend to its local minimum.
  let tauEstimate = -1
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (yin[tau] < threshold) {
      while (tau + 1 <= tauMax && yin[tau + 1] < yin[tau]) tau++
      tauEstimate = tau
      break
    }
  }

  // Fallback — no clean dip: take the best (lowest) minimum in range.
  if (tauEstimate === -1) {
    let minVal = Infinity
    let minTau = -1
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (yin[tau] < minVal) {
        minVal = yin[tau]
        minTau = tau
      }
    }
    if (minTau !== -1 && minVal < 0.5) tauEstimate = minTau
    else return { freq: -1, rms }
  }

  // Step 4 — parabolic interpolation for sub-sample accuracy.
  const x0 = tauEstimate > tauMin ? tauEstimate - 1 : tauEstimate
  const x2 = tauEstimate + 1 <= tauMax ? tauEstimate + 1 : tauEstimate
  let betterTau = tauEstimate
  if (x0 !== tauEstimate && x2 !== tauEstimate) {
    const s0 = yin[x0]
    const s1 = yin[tauEstimate]
    const s2 = yin[x2]
    const denom = 2 * (2 * s1 - s2 - s0)
    if (denom !== 0) betterTau = tauEstimate + (s2 - s0) / denom
  }

  return { freq: sampleRate / betterTau, rms }
}
