# EarCraft

EarCraft is a browser ear training app.

## Modes

### Intervals

Identify harmonic and melodic intervals from the minor 2nd to the octave.
After you answer, the app shows the notes as names and on a small staff.

### Chords

Identify the chord quality. The app supports major, minor, diminished, augmented,
and 7th chords. You can play chords as a block or as an arpeggio.
You can select which inversions to use: root, 1st, 2nd, and 3rd.
The app uses the 3rd inversion only for 7th chords.
After you answer, the app shows the notes and the inversion.

### Melodic Dictation

This mode has two sub-modes.

Keyboard sub-mode: Listen to a short melody. Enter the melody on the on-screen piano keyboard.

Staff sub-mode: The app gives you the key signature and the first note on a staff.
Listen to the melody. Enter the rhythm and the pitch. To enter a note, select a note value.
Then click a pitch on the staff. You can set these options:

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
