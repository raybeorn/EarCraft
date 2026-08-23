# EarCraft

EarCraft is a browser ear training app.

Try it out @ https://raybeorn.github.io/EarCraft/

## Staff selector

A single **Staff** control at the top of the app sets which staff every mode uses
to display notes: Treble, Bass, Alto, Tenor, or Grand. The default is Grand.

The selection also limits which notes the app generates: notes stay within four
diatonic steps above the top line or below the bottom line of the selected staff.
For Grand, that range spans from just below the bass staff to just above the
treble staff. The Intervals and Chords reveal staves and the Staff dictation mode
all follow this setting. A change takes effect on the next item you generate
(the next interval, chord, or melody).

## Modes

### Intervals

Identify harmonic and melodic intervals from the minor 2nd to the octave.
Choose one or more directions to practice: ascending, descending, or harmonic.
The app picks randomly among the directions you selected.
After you answer, the app shows the notes as names and on a small staff.

### Chords

Identify the chord quality. The app supports major, minor, diminished, augmented,
and 7th chords. Choose one or more voicings: block, arpeggio, or both. The app
picks randomly among the voicings you selected.
You can select which inversions to use: root, 1st, 2nd, and 3rd.
The app uses the 3rd inversion only for 7th chords.
After you answer, the app shows the notes and the inversion.

### Melodic Dictation

This mode has two sub-modes.

Keyboard sub-mode: Listen to a short melody. Enter the melody on the on-screen piano keyboard.
This sub-mode has no staff, so the Staff selector does not affect it.

Staff sub-mode: The app gives you the key signature and the first note on the staff you
selected with the Staff control. Listen to the melody. Enter the rhythm and the pitch.
To enter a note, select a note value. Then click a pitch on the staff. On a Grand staff,
click the upper staff for treble pitches or the lower staff for bass pitches.
You can set these options:

- Key and scale.
- Time signature: 2/4, 3/4, 4/4, or 6/8.
- Number of bars: 1 to 8.
- Note values: whole to 16th.
- Rest values: whole to 16th. You select rest values separately from note values.
- Dotted notes.
- Melodic motion: steps, leaps, or both.
- Start on the tonic.
- Allow notes outside the key. This shows sharp, flat, and natural buttons.

Each mode records your correct answers, your accuracy, and your current streak.

## Run the app locally

The app needs a local web server. A browser does not load the piano samples from a `file://` page.
You need Node.js.

Run this command in the app folder:

```bash
node server.js
```

Open <http://localhost:8123> in a browser.

The app downloads the piano samples from a CDN the first time you press a play button.
An internet connection is necessary for this download. The browser then caches the samples.

## Build

- The app uses plain HTML, CSS, and JavaScript. It has no build step.
- Piano sound: Tone.js version 15.1.22 with the Salamander Grand Piano samples.
- Music notation: VexFlow version 5.0.0.

### Subresource Integrity

The two CDN scripts in `index.html` (Tone.js and VexFlow) carry SHA-384
[Subresource Integrity](https://developer.mozilla.org/docs/Web/Security/Subresource_Integrity)
hashes. The browser refuses to run a script whose delivered bytes do not match its
`integrity` hash, which protects against a tampered or compromised CDN. Each script
also uses `crossorigin="anonymous"` (required for the check) and
`referrerpolicy="no-referrer"`.

If you bump either version, regenerate its hash or the browser will block the script:

```bash
curl -sL <script-url> | openssl dgst -sha384 -binary | openssl base64 -A
```

Prefix the output with `sha384-` and put it in the matching `integrity=""` attribute.

## Credits

This app uses these third party works. Keep these credits if you distribute the app.

- Tone.js. MIT License. Copyright Yotam Mann and the Tone.js contributors.
- VexFlow. MIT License. Copyright Mohit Muthanna Cheppudira and the VexFlow contributors.
- Salamander Grand Piano V3. Creative Commons Attribution 3.0 (CC-BY 3.0). Created by Alexander Holm.

The app loads all three from a CDN. It does not include their files in this repository.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Layout and screens |
| `styles.css` | Styles |
| `theory.js`  | Notes, intervals, chords, and scales |
| `audio.js`   | Piano sample engine |
| `app.js`     | Intervals, chords, and keyboard dictation logic |
| `staff.js`   | Staff notation dictation logic |
| `server.js`  | Static file server for local use |
