import { useEffect, useRef, useState } from 'react'
import { TUNINGS, type Tuning } from './lib/tunings'
import {
  type Note,
  noteToFreq,
  noteLabel,
  centsOff,
  nearestNote,
  shiftNote,
} from './lib/notes'
import { detectPitch } from './lib/pitch'

const A4 = 440
const IN_TUNE_CENTS = 5 // |cents| below this == "in tune"
const HOLD_MS = 700 // keep the last reading on screen this long after a note decays

type ActiveMode = 'auto' | number

function nearestStringIndex(freq: number, targetFreqs: number[]): number {
  let best = 0
  let bestAbs = Infinity
  for (let i = 0; i < targetFreqs.length; i++) {
    const c = Math.abs(centsOff(freq, targetFreqs[i]))
    if (c < bestAbs) {
      bestAbs = c
      best = i
    }
  }
  return best
}

export default function App() {
  // Default to standard tuning (E A D G B E).
  const [tuningId, setTuningId] = useState<string>('standard')
  const [strings, setStrings] = useState<Note[]>(TUNINGS[0].strings)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ActiveMode>('auto')

  // Live readings (driven by the rAF loop).
  const [freq, setFreq] = useState<number | null>(null)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [cents, setCents] = useState(0)
  const [level, setLevel] = useState(0) // input RMS, for the VU meter

  // PWA install
  const [installEvt, setInstallEvt] = useState<{
    prompt: () => Promise<void>
  } | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showHowInstall, setShowHowInstall] = useState(false)

  // Audio graph (mic).
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null)

  // Refs mirroring state for use inside the long-lived rAF closure.
  const smoothCents = useRef(0)
  const modeRef = useRef<ActiveMode>('auto')
  const stringsRef = useRef<Note[]>(strings)
  const prevIdxRef = useRef<number>(-1)
  const lastDetectRef = useRef<number>(0)

  // Separate context for reference tones (independent of the mic).
  const toneCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  useEffect(() => {
    stringsRef.current = strings
  }, [strings])

  // Stop everything when the component unmounts.
  useEffect(() => () => stopInternal(), [])

  // Capture the PWA install prompt (Android/desktop) and the installed state.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as unknown as { prompt: () => Promise<void> })
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallEvt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function stopInternal() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current = null
    bufRef.current = null
  }

  function stop() {
    stopInternal()
    setListening(false)
    setFreq(null)
    setLevel(0)
    setActiveIdx(typeof modeRef.current === 'number' ? modeRef.current : null)
  }

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      streamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      source.connect(analyser)
      analyserRef.current = analyser
      bufRef.current = new Float32Array(analyser.fftSize)
      setListening(true)

      const tick = () => {
        const an = analyserRef.current
        const c = audioCtxRef.current
        const buf = bufRef.current
        if (an && c && buf) {
          an.getFloatTimeDomainData(buf)
          const { freq: f, rms } = detectPitch(buf, c.sampleRate)
          setLevel(rms)
          if (f > 0 && f < 2000) {
            const tf = stringsRef.current.map((s) => noteToFreq(s, A4))
            const idx =
              modeRef.current === 'auto'
                ? nearestStringIndex(f, tf)
                : modeRef.current
            const cnt = centsOff(f, tf[idx])
            // Snap (don't smooth) when the target string changes, otherwise the
            // needle would sweep across the whole meter.
            if (idx !== prevIdxRef.current) {
              smoothCents.current = cnt
              prevIdxRef.current = idx
            } else {
              smoothCents.current += (cnt - smoothCents.current) * 0.25
            }
            lastDetectRef.current = performance.now()
            setFreq(f)
            setActiveIdx(idx)
            setCents(smoothCents.current)
          } else if (performance.now() - lastDetectRef.current > HOLD_MS) {
            // Note has decayed and the hold window elapsed — clear the readout.
            setFreq(null)
            if (modeRef.current === 'auto') setActiveIdx(null)
          }
          // else: within hold window — leave the last reading on screen.
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (e) {
      setError(humanError(e))
    }
  }

  function selectTuning(t: Tuning) {
    setTuningId(t.id)
    setStrings(t.strings)
    goAuto()
  }

  function adjustString(idx: number, delta: number) {
    setStrings((prev) => {
      const next = [...prev]
      next[idx] = shiftNote(next[idx], delta)
      return next
    })
    setTuningId('custom')
  }

  // Tap a string -> lock it as the target AND start listening if we aren't.
  function tuneString(idx: number) {
    modeRef.current = idx
    prevIdxRef.current = -1 // force a snap on the next reading
    lastDetectRef.current = 0 // drop any held reading from the previous string
    smoothCents.current = 0
    setMode(idx)
    setActiveIdx(idx) // move the highlight immediately — don't leave the old one lit
    setFreq(null)
    setCents(0)
    if (!listening) start()
  }

  function goAuto() {
    modeRef.current = 'auto'
    prevIdxRef.current = -1
    lastDetectRef.current = 0
    setMode('auto')
    setActiveIdx(null)
    setFreq(null)
  }

  function playTone(idx: number) {
    const ctx = toneCtxRef.current ?? (toneCtxRef.current = new AudioContext())
    if (ctx.state === 'suspended') ctx.resume()
    const f = noteToFreq(strings[idx], A4)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = f
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 1.9)
  }

  // --- derived display values ---
  const lockedIdx = typeof mode === 'number' ? mode : null
  const targetIdx = lockedIdx != null ? lockedIdx : activeIdx
  const targetNote = targetIdx != null ? strings[targetIdx] : null
  const targetFreq = targetNote ? noteToFreq(targetNote, A4) : null
  const detected = freq != null ? nearestNote(freq, A4) : null

  const inTune = freq != null && Math.abs(cents) < IN_TUNE_CENTS
  const clamped = Math.max(-50, Math.min(50, cents))
  const hasReading = freq != null && targetNote != null
  const signalPresent = listening && level > 0.006
  const levelPct = Math.min(100, level * 1000) // ~0.1 RMS fills the bar

  const nav = navigator as Navigator & { standalone?: boolean }
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  const showInstall = !installed && !isStandalone

  const status =
    freq == null
      ? 'wait'
      : inTune
        ? 'good'
        : Math.abs(cents) < 15
          ? 'near'
          : 'far'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="logo" src="/favicon.svg" alt="" width={24} height={24} />
          <div>
            <h1>OpenTuner</h1>
            <p className="tagline">tune to any tuning</p>
          </div>
        </div>
        <div className="tuning-picker">
          <label>Tuning</label>
          <select
            value={tuningId}
            onChange={(e) => {
              const t = TUNINGS.find((x) => x.id === e.target.value)
              if (t) selectTuning(t)
            }}
          >
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {tuningId === 'custom' && <option value="custom">Custom</option>}
          </select>
        </div>
      </header>

      {/* Big readout + meter */}
      <section className={`display ${status}`}>
        <div className="target-line">
          {targetNote ? (
            <>
              <span className="muted">tuning</span>
              <span className="target-note">{noteLabel(targetNote)}</span>
              <span className="muted small">{targetFreq!.toFixed(1)} Hz</span>
              {mode !== 'auto' && (
                <button className="auto-btn" onClick={goAuto}>
                  auto
                </button>
              )}
            </>
          ) : (
            <span className="muted">
              {listening ? 'tap the string you’re tuning' : 'tap a string to start'}
            </span>
          )}
        </div>

        {/* Hero: the delta */}
        <div className={`hero ${status}`}>
          {!hasReading ? (
            <span className="hero-idle">
              {!listening
                ? '—'
                : signalPresent
                  ? 'I hear sound, but no clear note…'
                  : 'play a string…'}
            </span>
          ) : inTune ? (
            <>
              <span className="hero-check">✓</span>
              <span className="hero-word">in tune</span>
            </>
          ) : (
            <>
              <span className="arrow">{cents < 0 ? '▲' : '▼'}</span>
              <span className="delta">
                {Math.abs(Math.round(cents))}
                <small>¢</small>
              </span>
              <span className="dir">
                {cents < 0 ? 'tune up (raise pitch)' : 'tune down (lower pitch)'}
              </span>
            </>
          )}
        </div>

        <div className="sub-line">
          {hasReading ? (
            <>
              now: {noteLabel(detected!.note)} · {freq!.toFixed(1)} Hz
            </>
          ) : (
            ' '
          )}
        </div>

        {/* Cents meter */}
        <div className="meter">
          <div className="meter-scale">
            {[-50, -25, 0, 25, 50].map((t) => (
              <span
                key={t}
                className={`tick ${t === 0 ? 'center' : ''}`}
                style={{ left: `${50 + t}%` }}
              />
            ))}
            <div className="meter-zone" />
            {hasReading && (
              <div className="needle" style={{ left: `${50 + clamped}%` }} />
            )}
          </div>
        </div>

        {listening && (
          <div className="vu" title="Microphone input level">
            <span className="vu-label">in</span>
            <div className="vu-track">
              <div
                className={`vu-fill ${signalPresent ? 'on' : ''}`}
                style={{ width: `${levelPct}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Strings */}
      <section className="strings">
        {strings.map((s, i) => {
          const isActive = activeIdx === i
          const isLocked = mode === i
          const tuned = isActive && inTune
          return (
            <div
              key={i}
              className={`string ${isActive ? 'active' : ''} ${
                tuned ? 'tuned' : ''
              } ${isLocked ? 'locked' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={isLocked}
              title="Tune this string (turns on the mic)"
              onClick={() => tuneString(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  tuneString(i)
                }
              }}
            >
              <div className="string-num">string {6 - i}</div>
              <div className="string-note">
                {noteLabel(s)}
                {tuned && <span className="check">✓</span>}
              </div>
              <div className="string-controls">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    adjustString(i, -1)
                  }}
                  title="semitone down"
                >
                  −
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    playTone(i)
                  }}
                  title="Play this note"
                >
                  🔊
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    adjustString(i, +1)
                  }}
                  title="semitone up"
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </section>

      <footer className="controls">
        {!listening ? (
          <button className="primary" onClick={start}>
            🎤 Listen (auto)
          </button>
        ) : (
          <button className="primary stop" onClick={stop}>
            ⏹ Stop
          </button>
        )}
        {error && <p className="error">{error}</p>}

        {showInstall && (
          <div className="install">
            <button
              className="install-btn"
              onClick={async () => {
                if (installEvt) {
                  await installEvt.prompt()
                  setInstallEvt(null)
                } else {
                  setShowHowInstall((v) => !v)
                }
              }}
            >
              📲 Install app
            </button>
            {showHowInstall && !installEvt && (
              <p className="install-hint">
                On iPhone open in <b>Safari</b>, then <b>Share → Add to Home
                Screen</b>. In Telegram tap <b>⋯ → Open in Browser</b> first.
              </p>
            )}
          </div>
        )}

        <details className="help">
          <summary>How it works</summary>
          <ol>
            <li>Pick your tuning (or tweak any string with − / +).</li>
            <li>Tap a string’s note — the mic turns on and locks that target.</li>
            <li>
              Play the open string and move the needle to the centre: <b>▲</b> =
              tighten (pitch too low), <b>▼</b> = loosen (pitch too high).
            </li>
            <li>Green ✓ means you’re within 5 cents. Mute the other strings.</li>
          </ol>
          <p className="muted small">
            🔊 plays a reference tone. “auto” lets the tuner pick the nearest
            string automatically.
          </p>
        </details>

        <p className="credit">
          Free, open-source guitar tuner for any tuning ·{' '}
          <a
            href="https://github.com/yuri-cherkasov90/opentuner"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}

function humanError(e: unknown): string {
  const err = e as { name?: string; message?: string }
  if (err?.name === 'NotAllowedError')
    return 'Microphone access was blocked. Allow it in your browser settings and try again.'
  if (err?.name === 'NotFoundError')
    return 'No microphone found. Connect an input device and try again.'
  return `Could not open the microphone: ${err?.message ?? 'unknown error'}`
}
