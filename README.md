# 🎸 OpenTuner

**Free, open-source online guitar tuner for _any_ tuning.**
Microphone pitch detection, custom tunings, installable PWA — right in your browser.

🔗 **Live:** https://opentuner.fly.dev

No signup, no ads, no download. Your microphone audio is processed locally in
the browser and never leaves your device.

## Features

- 🎤 **Microphone tuner** — real-time pitch detection (YIN algorithm), robust on
  low strings, with a cents meter and a clear "tune up / tune down" readout.
- 🎯 **Any tuning** — presets for Standard, Eb/D#, Drop D, Drop C#, D standard,
  Drop C, DADGAD and Open G, plus a fully **custom** per-string tuning (adjust
  each string by semitones).
- 👆 **Tap a string** to lock it as the target, or let **auto** pick the nearest
  string for you.
- 🔊 **Reference tones** — play any string's target note to tune by ear too.
- 📦 **PWA** — installable on phone/desktop and works **offline**.
- 📱 Mobile-first, accessible, dark UI.

## How it works

Audio comes in via the Web Audio API (`getUserMedia` → `AnalyserNode`). Each
frame, the time-domain buffer is run through a
[YIN](https://www.ircam.fr/) pitch-detection implementation
(`src/lib/pitch.ts`) restricted to the musical range, with a global-minimum
fallback so weak/decaying notes still register. The detected frequency is
converted to cents relative to the target string (`src/lib/notes.ts`).

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

Microphone access requires a secure context — `localhost` (dev) and HTTPS (prod)
both qualify.

## Build

```bash
npm run build    # outputs static site to dist/
npm run preview  # preview the production build
```

App icons are generated from `make_icons.py` (Pillow) into `public/`.

## Deploy

Ships as a tiny nginx container. Deployed to [Fly.io](https://fly.io):

```bash
fly deploy --remote-only
```

(see `Dockerfile`, `nginx.conf`, `fly.toml`)

## Tech

React + TypeScript + Vite · Web Audio API · vite-plugin-pwa · nginx · Fly.io

## License

[MIT](./LICENSE) © 2026 Yuri Cherkasov
