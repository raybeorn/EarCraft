/* theory.js — music theory constants and helpers (global, no modules) */

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// MIDI 60 = C4 (middle C)
function midiToNoteName(midi) {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return name + octave;
}

function midiToPretty(midi, useFlats) {
  const arr = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES;
  const name = arr[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return name + octave;
}

function isBlackKey(midi) {
  const pc = ((midi % 12) + 12) % 12;
  return [1, 3, 6, 8, 10].includes(pc);
}

// ---- Intervals ----
// semitones -> {short, name}
const INTERVALS = [
  { semitones: 1, short: "m2", name: "Minor 2nd" },
  { semitones: 2, short: "M2", name: "Major 2nd" },
  { semitones: 3, short: "m3", name: "Minor 3rd" },
  { semitones: 4, short: "M3", name: "Major 3rd" },
  { semitones: 5, short: "P4", name: "Perfect 4th" },
  { semitones: 6, short: "TT", name: "Tritone" },
  { semitones: 7, short: "P5", name: "Perfect 5th" },
  { semitones: 8, short: "m6", name: "Minor 6th" },
  { semitones: 9, short: "M6", name: "Major 6th" },
  { semitones: 10, short: "m7", name: "Minor 7th" },
  { semitones: 11, short: "M7", name: "Major 7th" },
  { semitones: 12, short: "P8", name: "Octave" },
];

// ---- Chords ---- (semitone offsets from root)
const CHORDS = [
  { id: "maj", short: "Major", name: "Major", intervals: [0, 4, 7] },
  { id: "min", short: "Minor", name: "Minor", intervals: [0, 3, 7] },
  { id: "dim", short: "Dim", name: "Diminished", intervals: [0, 3, 6] },
  { id: "aug", short: "Aug", name: "Augmented", intervals: [0, 4, 8] },
  { id: "dom7", short: "Dom 7", name: "Dominant 7th", intervals: [0, 4, 7, 10] },
  { id: "maj7", short: "Maj 7", name: "Major 7th", intervals: [0, 4, 7, 11] },
  { id: "min7", short: "Min 7", name: "Minor 7th", intervals: [0, 3, 7, 10] },
  { id: "m7b5", short: "m7♭5", name: "Half-diminished 7th", intervals: [0, 3, 6, 10] },
  { id: "dim7", short: "Dim 7", name: "Diminished 7th", intervals: [0, 3, 6, 9] },
];

// ---- Scales ---- (semitone offsets from tonic)
const SCALES = {
  major: { name: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: "Natural Minor", steps: [0, 2, 3, 5, 7, 8, 10] },
  harmonicMinor: { name: "Harmonic Minor", steps: [0, 2, 3, 5, 7, 8, 11] },
  melodicMinor: { name: "Melodic Minor", steps: [0, 2, 3, 5, 7, 9, 11] },
};

// Solfege for major scale degrees
const SOLFEGE_MAJOR = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Ti"];
const SOLFEGE_MINOR = ["La", "Ti", "Do", "Re", "Mi", "Fa", "Sol"];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
