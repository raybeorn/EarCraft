/* audio.js — realistic piano engine using Tone.js Sampler + Salamander samples */

const Piano = (() => {
  let sampler = null;
  let reverb = null;
  let loadingPromise = null;
  let started = false;

  const SALAMANDER_URLS = {
    A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3",
    A1: "A1.mp3", C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
    A2: "A2.mp3", C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
    A3: "A3.mp3", C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
    A4: "A4.mp3", C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
    A5: "A5.mp3", C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
    A6: "A6.mp3", C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
    A7: "A7.mp3", C8: "C8.mp3",
  };

  function load() {
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise((resolve, reject) => {
      try {
        reverb = new Tone.Reverb({ decay: 1.6, wet: 0.18 }).toDestination();
        sampler = new Tone.Sampler({
          urls: SALAMANDER_URLS,
          baseUrl: "https://tonejs.github.io/audio/salamander/",
          release: 1.2,
          onload: () => resolve(),
          onerror: (e) => reject(e),
        }).connect(reverb);
      } catch (e) {
        reject(e);
      }
    });
    return loadingPromise;
  }

  // On iOS, route audio through the media/playback channel so the physical
  // silent/mute switch does not silence the app. Safari 16.4+ only; harmless elsewhere.
  function setPlaybackSession() {
    try {
      if (typeof navigator !== "undefined" && "audioSession" in navigator) {
        navigator.audioSession.type = "playback";
      }
    } catch (e) {
      /* ignore unsupported */
    }
  }

  // Must be called from a user gesture before any sound.
  async function ensureReady() {
    if (!started) {
      setPlaybackSession();
      await Tone.start();
      started = true;
    }
    await load();
  }

  // Unlock the AudioContext on the very first user interaction anywhere on the
  // page. This makes iOS reliably start audio even before the first Play tap.
  function attachUnlock() {
    const unlock = async () => {
      try {
        setPlaybackSession();
        await Tone.start();
        started = true;
      } catch (e) {
        /* ignore */
      }
      document.removeEventListener("touchend", unlock, true);
      document.removeEventListener("pointerdown", unlock, true);
    };
    document.addEventListener("touchend", unlock, true);
    document.addEventListener("pointerdown", unlock, true);
  }
  if (typeof document !== "undefined") attachUnlock();

  function isLoaded() {
    return sampler !== null && sampler.loaded;
  }

  // notes: array of midi numbers. Plays them all at `time`.
  function triggerMidis(midis, duration, time, velocity = 0.8) {
    const names = midis.map(midiToNoteName);
    sampler.triggerAttackRelease(names, duration, time, velocity);
  }

  function triggerMidi(midi, duration, time, velocity = 0.8) {
    sampler.triggerAttackRelease(midiToNoteName(midi), duration, time, velocity);
  }

  // Play two notes as an interval.
  // mode: "harmonic" | "ascending" | "descending"
  function playInterval(low, high, mode) {
    const now = Tone.now() + 0.05;
    const dur = 1.4;
    if (mode === "harmonic") {
      triggerMidis([low, high], dur, now);
    } else if (mode === "ascending") {
      triggerMidi(low, 0.9, now);
      triggerMidi(high, 1.4, now + 0.75);
    } else {
      triggerMidi(high, 0.9, now);
      triggerMidi(low, 1.4, now + 0.75);
    }
  }

  // Play a chord. style: "block" | "arpeggio"
  function playChord(midis, style) {
    const now = Tone.now() + 0.05;
    if (style === "arpeggio") {
      const step = 0.28;
      midis.forEach((m, i) => {
        const remaining = 1.8 - i * step;
        triggerMidi(m, Math.max(0.9, remaining), now + i * step);
      });
    } else {
      triggerMidis(midis, 2.0, now);
    }
  }

  // Play a melody (array of midi). tempoBpm controls speed.
  function playMelody(midis, tempoBpm) {
    const now = Tone.now() + 0.08;
    const beat = 60 / tempoBpm; // seconds per note
    midis.forEach((m, i) => {
      triggerMidi(m, beat * 0.92, now + i * beat, 0.8);
    });
    return midis.length * beat;
  }

  // Play a rhythmic melody. events: [{ midi:number|null, beats:number }]
  // beats are in quarter-note units; null midi = rest (silence).
  function playRhythmic(events, tempoBpm) {
    const now = Tone.now() + 0.1;
    const secPerBeat = 60 / tempoBpm;
    let t = now;
    events.forEach((ev) => {
      const dur = ev.beats * secPerBeat;
      if (ev.midi != null) {
        triggerMidi(ev.midi, Math.max(0.15, dur * 0.94), t, 0.8);
      }
      t += dur;
    });
    return t - now;
  }

  // Single note preview (for keyboard input feedback).
  function playSingle(midi) {
    const now = Tone.now() + 0.01;
    triggerMidi(midi, 0.9, now, 0.85);
  }

  function stopAll() {
    if (sampler) sampler.releaseAll();
  }

  return {
    ensureReady, isLoaded, playInterval, playChord, playMelody, playRhythmic, playSingle, stopAll,
  };
})();
