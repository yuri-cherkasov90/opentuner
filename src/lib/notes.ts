// Note math: names, frequencies, cents, conversions.
// Uses scientific pitch notation (C4 = middle C, A4 = 440 Hz reference).

export const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const

export interface Note {
  name: string // e.g. 'D#'
  octave: number // e.g. 2
}

/** MIDI note number for a note (A4 = 69). */
export function noteToMidi(note: Note): number {
  const idx = NOTE_NAMES.indexOf(note.name as (typeof NOTE_NAMES)[number])
  return (note.octave + 1) * 12 + idx
}

/** Note object for a MIDI number. */
export function midiToNote(midi: number): Note {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return { name, octave }
}

/** Frequency in Hz of a MIDI note for a given A4 reference. */
export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12)
}

export function noteToFreq(note: Note, a4 = 440): number {
  return midiToFreq(noteToMidi(note), a4)
}

/** Fractional MIDI number for an arbitrary frequency. */
export function freqToMidiFloat(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4)
}

/** Cents that `freq` sits above (+) or below (-) `targetFreq`. */
export function centsOff(freq: number, targetFreq: number): number {
  return 1200 * Math.log2(freq / targetFreq)
}

/** Nearest chromatic note to a frequency, plus how many cents off it is. */
export function nearestNote(freq: number, a4 = 440): { note: Note; cents: number } {
  const midiFloat = freqToMidiFloat(freq, a4)
  const midi = Math.round(midiFloat)
  return { note: midiToNote(midi), cents: (midiFloat - midi) * 100 }
}

/** Shift a note by a number of semitones. */
export function shiftNote(note: Note, semitones: number): Note {
  return midiToNote(noteToMidi(note) + semitones)
}

/** Human-readable label, e.g. 'D#2'. */
export function noteLabel(note: Note): string {
  return `${note.name}${note.octave}`
}
