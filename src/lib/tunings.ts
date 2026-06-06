import type { Note } from './notes'

export interface Tuning {
  id: string
  name: string
  /** Strings ordered low (6th / thickest) -> high (1st / thinnest). */
  strings: Note[]
}

const n = (name: string, octave: number): Note => ({ name, octave })

export const TUNINGS: Tuning[] = [
  {
    id: 'standard',
    name: 'Standard  ·  E A D G B E',
    strings: [n('E', 2), n('A', 2), n('D', 3), n('G', 3), n('B', 3), n('E', 4)],
  },
  {
    id: 'eb',
    name: 'Eb / D# standard  ·  ½ step down',
    strings: [n('D#', 2), n('G#', 2), n('C#', 3), n('F#', 3), n('A#', 3), n('D#', 4)],
  },
  {
    id: 'dropd',
    name: 'Drop D  ·  D A D G B E',
    strings: [n('D', 2), n('A', 2), n('D', 3), n('G', 3), n('B', 3), n('E', 4)],
  },
  {
    id: 'dropcs',
    name: 'Drop C#  ·  C# G# C# F# A# D#',
    strings: [n('C#', 2), n('G#', 2), n('C#', 3), n('F#', 3), n('A#', 3), n('D#', 4)],
  },
  {
    id: 'dstandard',
    name: 'D standard  ·  whole step down',
    strings: [n('D', 2), n('G', 2), n('C', 3), n('F', 3), n('A', 3), n('D', 4)],
  },
  {
    id: 'dropc',
    name: 'Drop C  ·  C G C F A D',
    strings: [n('C', 2), n('G', 2), n('C', 3), n('F', 3), n('A', 3), n('D', 4)],
  },
  {
    id: 'dadgad',
    name: 'DADGAD',
    strings: [n('D', 2), n('A', 2), n('D', 3), n('G', 3), n('A', 3), n('D', 4)],
  },
  {
    id: 'openg',
    name: 'Open G  ·  D G D G B D',
    strings: [n('D', 2), n('G', 2), n('D', 3), n('G', 3), n('B', 3), n('D', 4)],
  },
]
