# EarCraft

EarCraft is a browser ear training app.

Try it out @ https://raybeorn.github.io/EarCraft/

## Staff selector

Each mode has a Staff control in its Options section. The control sets the staff
for every mode. All copies show the same value. The choices are Treble, Bass,
Alto, Tenor, and Grand. The default is Grand. You can collapse each Options
section. It starts open.

The Staff control also limits the notes the app generates. Notes stay within
four diatonic steps above the top line or below the bottom line of the staff.
On a Grand staff, the range covers both staves. The Intervals staff, the Chords
staff, and the Staff dictation mode use this setting. A change takes effect on
the next interval, chord, or melody.

## Modes

### Intervals

Identify harmonic and melodic intervals from the minor 2nd to the octave.
Choose one or more directions: ascending, descending, or harmonic.
For each interval, the app uses one of the directions you selected.
After you answer, the app shows the notes as names and on a small staff.

### Chords

Identify the chord quality. The app supports major, minor, diminished, augmented,
and 7th chords. Choose one or more voicings: block or arpeggio.
For each chord, the app uses one of the voicings you selected.
You can select which inversions to use: root, 1st, 2nd, and 3rd.
The app uses the 3rd inversion only for 7th chords.
After you answer, the app shows the notes and the inversion.

### Melodic Dictation

This mode has two sub-modes.

Keyboard sub-mode: Listen to a short melody. Enter the melody on the on-screen piano keyboard.
This sub-mode has no staff. The Staff control does not affect it.

Staff sub-mode: The app shows the key signature and the first note on the selected staff.
Listen to the melody. Enter the rhythm and the pitch. To enter a note, select a note value.
Then click a pitch on the staff. On a Grand staff, click the upper staff for treble pitches.
Click the lower staff for bass pitches. You can set these options:

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

The app needs an internet connection on the first visit. On that visit it downloads
the piano samples and the two CDN scripts. After the first visit the app works
offline. See [Offline support](#offline-support).

## Offline support

The app registers a service worker, `sw.js`. On the first online visit the service
worker stores the app files, the two CDN scripts, and the piano samples in the
browser cache. After that visit the app works offline.

The app files use a network-first rule. When online, the app loads the latest
code. When offline, the app uses the cache. The CDN scripts and the samples use a
cache-first rule.

Once a day the service worker checks the samples in the background. It compares the
`Last-Modified` header of each file. It downloads only the files that changed.

To replace the cached app files and CDN scripts, raise `CACHE_VERSION` in `sw.js`.

## Build

- The app uses plain HTML, CSS, and JavaScript. It has no build step.
- Piano sound: Tone.js version 15.1.22 with the Salamander Grand Piano samples.
- Music notation: VexFlow version 5.0.0.

### Subresource Integrity

The `index.html` file loads two scripts from a CDN: Tone.js and VexFlow.
Each script tag has a SHA-384 Subresource Integrity hash. The browser blocks a
script when the downloaded bytes do not match its `integrity` hash. This protects
the app against a changed or unsafe CDN file. Each script tag also sets
`crossorigin="anonymous"` and `referrerpolicy="no-referrer"`. The check needs the
`crossorigin` attribute.

If you change either version, generate a new hash. Otherwise the browser blocks
the script. Run this command:

```bash
curl -sL <script-url> | openssl dgst -sha384 -binary | openssl base64 -A
```

Add the prefix `sha384-` to the output. Put the result in the `integrity`
attribute for that script.

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
| `sw.js`      | Service worker for offline use |
| `server.js`  | Static file server for local use |
