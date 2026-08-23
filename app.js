/* app.js — UI logic and exercise controllers */

document.addEventListener("DOMContentLoaded", () => {
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const loaderEl = $("audio-loader");
  let audioReadyOnce = false;

  async function ensureAudio() {
    if (audioReadyOnce && Piano.isLoaded()) return;
    loaderEl.classList.remove("hidden");
    try {
      await Piano.ensureReady();
      audioReadyOnce = true;
    } catch (e) {
      loaderEl.textContent = "⚠ Could not load piano samples. Check your internet connection and reload.";
      throw e;
    } finally {
      if (Piano.isLoaded()) loaderEl.classList.add("hidden");
    }
  }

  function chipRowValue(container) {
    const el = container.querySelector(".chip.selected");
    return el ? el.dataset.value : null;
  }
  function chipRowValues(container) {
    return [...container.querySelectorAll(".chip.selected")].map((c) => c.dataset.value);
  }
  // single-select chip row
  function initSingleChips(container) {
    container.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      container.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
    });
  }
  // multi-select chip row (keeps at least one selected)
  function initMultiChips(container) {
    container.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      const selected = container.querySelectorAll(".chip.selected");
      if (chip.classList.contains("selected") && selected.length === 1) return;
      chip.classList.toggle("selected");
    });
  }

  function pct(correct, total) {
    if (!total) return "—";
    return Math.round((correct / total) * 100) + "%";
  }

  // ---------- clef / staff range (shared by every staff) ----------
  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const NAT_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  // Diatonic index of each clef's top staff line (bottom line = top - 8).
  const CLEF_TOP_IDX = { treble: 38, bass: 26, alto: 32, tenor: 30 };
  const CLEF_REST_KEY = { treble: "b/4", bass: "d/3", alto: "c/4", tenor: "a/3" };
  const clefMode = () => {
    const el = document.querySelector(".clef-select");
    return el ? el.value : "grand";
  };
  // The Staff selector appears in each mode's options. Keep the copies in sync
  // so the choice is shared across every staff in the app.
  document.querySelectorAll(".clef-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      document.querySelectorAll(".clef-select").forEach((s) => {
        if (s !== sel) s.value = sel.value;
      });
    });
  });
  function idxToMidi(idx) {
    const octave = Math.floor(idx / 7);
    const letter = LETTERS[((idx % 7) + 7) % 7];
    return (octave + 1) * 12 + NAT_SEMI[letter];
  }
  // MIDI window that keeps notes within 4 diatonic steps of the selected staff.
  function clefMidiRange() {
    const mode = clefMode();
    let lo, hi;
    if (mode === "grand") { lo = CLEF_TOP_IDX.bass - 8 - 4; hi = CLEF_TOP_IDX.treble + 4; }
    else { const t = CLEF_TOP_IDX[mode]; lo = t - 8 - 4; hi = t + 4; }
    return { mode, midiLo: idxToMidi(lo), midiHi: idxToMidi(hi) };
  }

  // ---------- mini staff (for note reveal) ----------
  const VEX_PC = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
  function midiToVexKey(m) {
    const pc = ((m % 12) + 12) % 12;
    const oct = Math.floor(m / 12) - 1;
    return VEX_PC[pc] + "/" + oct;
  }
  function miniNote(VF, keys, clef) {
    const n = new VF.StaveNote({ keys, duration: "w", clef });
    keys.forEach((k, i) => { if (k.includes("#")) n.addModifier(new VF.Accidental("#"), i); });
    return n;
  }
  function miniRest(VF, clef) {
    const n = new VF.StaveNote({ keys: [CLEF_REST_KEY[clef] || "b/4"], duration: "wr", clef });
    n.setStyle({ fillStyle: "rgba(0,0,0,0)", strokeStyle: "rgba(0,0,0,0)" });
    return n;
  }
  // groups: array of midi-arrays; each group renders as one whole-note (chords stack).
  // Honors the app-wide clef selector, drawing a grand staff when "grand" is chosen.
  function renderMiniStaff(container, groups) {
    const VF = window.VexFlow;
    container.innerHTML = "";
    const grand = clefMode() === "grand";
    const w = Math.max(160, 90 + groups.length * 58);
    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(w, grand ? 200 : 130);
    const ctx = renderer.getContext();
    const numBeats = groups.length * 4;

    if (grand) {
      const tStave = new VF.Stave(6, 16, w - 12).addClef("treble");
      const bStave = new VF.Stave(6, 96, w - 12).addClef("bass");
      tStave.setContext(ctx).draw();
      bStave.setContext(ctx).draw();
      new VF.StaveConnector(tStave, bStave).setType("brace").setContext(ctx).draw();
      new VF.StaveConnector(tStave, bStave).setType("singleLeft").setContext(ctx).draw();
      new VF.StaveConnector(tStave, bStave).setType("singleRight").setContext(ctx).draw();
      const tTokens = [], bTokens = [];
      groups.forEach((midis) => {
        const sorted = [...midis].sort((a, b) => a - b);
        const tk = sorted.filter((m) => m >= 60).map(midiToVexKey);
        const bk = sorted.filter((m) => m < 60).map(midiToVexKey);
        tTokens.push(tk.length ? miniNote(VF, tk, "treble") : miniRest(VF, "treble"));
        bTokens.push(bk.length ? miniNote(VF, bk, "bass") : miniRest(VF, "bass"));
      });
      const tVoice = new VF.Voice({ numBeats, beatValue: 4 });
      const bVoice = new VF.Voice({ numBeats, beatValue: 4 });
      [tVoice, bVoice].forEach((v) => { if (VF.Voice.Mode) v.setMode(VF.Voice.Mode.SOFT); else v.setStrict(false); });
      tVoice.addTickables(tTokens);
      bVoice.addTickables(bTokens);
      new VF.Formatter().joinVoices([tVoice]).joinVoices([bVoice]).format([tVoice, bVoice], w - 70);
      tVoice.draw(ctx, tStave);
      bVoice.draw(ctx, bStave);
      return;
    }

    const mode = clefMode();
    const stave = new VF.Stave(6, 30, w - 12).addClef(mode);
    stave.setContext(ctx).draw();
    const notes = groups.map((midis) => {
      const sorted = [...midis].sort((a, b) => a - b);
      return miniNote(VF, sorted.map(midiToVexKey), mode);
    });
    const voice = new VF.Voice({ numBeats, beatValue: 4 });
    if (VF.Voice.Mode) voice.setMode(VF.Voice.Mode.SOFT);
    else voice.setStrict(false);
    voice.addTickables(notes);
    new VF.Formatter().joinVoices([voice]).format([voice], w - 60);
    voice.draw(ctx, stave);
  }

  // ============================================================
  //  TABS
  // ============================================================
  document.querySelectorAll("nav.tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("nav.tabs .tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
      tab.classList.add("active");
      $(tab.dataset.screen).classList.add("active");
      Piano.stopAll();
    });
  });

  // ============================================================
  //  INTERVALS
  // ============================================================
  (function IntervalTrainer() {
    const setRow = $("iv-set");
    const dirRow = $("iv-dir");
    const answersEl = $("iv-answers");
    const feedbackEl = $("iv-feedback");
    const playBtn = $("iv-play");
    const replayBtn = $("iv-replay");
    const nextBtn = $("iv-next");

    const stats = { correct: 0, total: 0, streak: 0 };
    let current = null; // { intervalObj, low, high, direction }
    let answered = false;

    // default selected intervals: the common ones
    const defaultOn = new Set([2, 4, 5, 7, 9, 11, 12]); // M2 M3 P4 P5 M6 M7 P8
    INTERVALS.forEach((iv) => {
      const chip = document.createElement("div");
      chip.className = "chip" + (defaultOn.has(iv.semitones) ? " selected" : "");
      chip.dataset.value = iv.semitones;
      chip.textContent = iv.short;
      chip.title = iv.name;
      setRow.appendChild(chip);
    });
    initMultiChips(setRow);
    initMultiChips(dirRow);
    setRow.addEventListener("click", buildAnswers);

    function selectedIntervals() {
      return chipRowValues(setRow).map(Number);
    }

    function buildAnswers() {
      answersEl.innerHTML = "";
      selectedIntervals().sort((a, b) => a - b).forEach((st) => {
        const iv = INTERVALS.find((x) => x.semitones === st);
        const btn = document.createElement("button");
        btn.className = "answer-btn";
        btn.dataset.value = st;
        btn.innerHTML = `${iv.short}<br><span style="font-size:11px;opacity:.7">${iv.name}</span>`;
        btn.addEventListener("click", () => answer(st, btn));
        answersEl.appendChild(btn);
      });
    }

    function resolveDirection() {
      // pick randomly among the directions the user selected
      const chosen = chipRowValues(dirRow);
      return pick(chosen.length ? chosen : ["ascending"]);
    }

    async function newQuestion() {
      await ensureAudio();
      const chosen = selectedIntervals();
      const st = pick(chosen);
      const iv = INTERVALS.find((x) => x.semitones === st);
      // keep both notes within the selected staff's range
      const { midiLo, midiHi } = clefMidiRange();
      const low = randInt(midiLo, Math.max(midiLo, midiHi - st));
      current = { intervalObj: iv, low, high: low + st, direction: resolveDirection() };
      answered = false;
      feedbackEl.textContent = "";
      feedbackEl.className = "feedback";
      nextBtn.classList.add("hidden");
      $("iv-reveal").classList.add("hidden");
      [...answersEl.children].forEach((b) => {
        b.disabled = false;
        b.classList.remove("correct", "wrong");
      });
      replayBtn.disabled = false;
      playCurrent();
    }

    function playCurrent() {
      Piano.playInterval(current.low, current.high, current.direction);
    }

    function showNotes() {
      const { low, high, direction } = current;
      let groups, text;
      if (direction === "harmonic") {
        groups = [[low, high]];
        text = `${midiToNoteName(low)} + ${midiToNoteName(high)}`;
      } else if (direction === "ascending") {
        groups = [[low], [high]];
        text = `${midiToNoteName(low)} → ${midiToNoteName(high)}`;
      } else {
        groups = [[high], [low]];
        text = `${midiToNoteName(high)} → ${midiToNoteName(low)}`;
      }
      $("iv-notes").innerHTML = `<span class="lead">Notes played:</span>${text}`;
      renderMiniStaff($("iv-staff"), groups);
      $("iv-reveal").classList.remove("hidden");
    }

    function answer(st, btn) {
      if (answered || !current) return;
      answered = true;
      stats.total++;
      const correct = st === current.intervalObj.semitones;
      if (correct) {
        stats.correct++;
        stats.streak++;
        btn.classList.add("correct");
        feedbackEl.textContent = `✓ Correct — ${current.intervalObj.name}`;
        feedbackEl.className = "feedback good";
      } else {
        stats.streak = 0;
        btn.classList.add("wrong");
        const right = [...answersEl.children].find(
          (b) => Number(b.dataset.value) === current.intervalObj.semitones
        );
        if (right) right.classList.add("correct");
        feedbackEl.textContent = `✗ Answer: ${current.intervalObj.name}`;
        feedbackEl.className = "feedback bad";
      }
      [...answersEl.children].forEach((b) => (b.disabled = true));
      showNotes();
      nextBtn.classList.remove("hidden");
      updateStats();
    }

    function updateStats() {
      $("iv-correct").textContent = stats.correct;
      $("iv-total").textContent = stats.total;
      $("iv-acc").textContent = pct(stats.correct, stats.total);
      $("iv-streak").textContent = stats.streak;
    }

    playBtn.addEventListener("click", newQuestion);
    nextBtn.addEventListener("click", newQuestion);
    replayBtn.addEventListener("click", async () => {
      if (!current) return;
      await ensureAudio();
      playCurrent();
    });

    buildAnswers();
  })();

  // ============================================================
  //  CHORDS
  // ============================================================
  (function ChordTrainer() {
    const setRow = $("ch-set");
    const styleRow = $("ch-style");
    const invRow = $("ch-inv");
    const answersEl = $("ch-answers");
    const feedbackEl = $("ch-feedback");
    const playBtn = $("ch-play");
    const replayBtn = $("ch-replay");
    const nextBtn = $("ch-next");

    const INV_NAMES = ["root position", "1st inversion", "2nd inversion", "3rd inversion"];
    const stats = { correct: 0, total: 0, streak: 0 };
    let current = null; // { chord, root, midis, style, inversion }
    let answered = false;

    const defaultOn = new Set(["maj", "min", "dim", "aug"]);
    CHORDS.forEach((c) => {
      const chip = document.createElement("div");
      chip.className = "chip" + (defaultOn.has(c.id) ? " selected" : "");
      chip.dataset.value = c.id;
      chip.textContent = c.short;
      chip.title = c.name;
      setRow.appendChild(chip);
    });
    initMultiChips(setRow);
    initMultiChips(styleRow);
    initMultiChips(invRow);
    setRow.addEventListener("click", buildAnswers);

    function selectedChords() {
      return chipRowValues(setRow);
    }
    function selectedInversions() {
      return chipRowValues(invRow).map(Number);
    }
    // Move the lowest `inv` notes up an octave to produce an inversion.
    function applyInversion(midis, inv) {
      return midis.slice(inv).concat(midis.slice(0, inv).map((m) => m + 12));
    }

    function buildAnswers() {
      answersEl.innerHTML = "";
      const ids = selectedChords();
      CHORDS.filter((c) => ids.includes(c.id)).forEach((c) => {
        const btn = document.createElement("button");
        btn.className = "answer-btn";
        btn.dataset.value = c.id;
        btn.innerHTML = `${c.short}<br><span style="font-size:11px;opacity:.7">${c.name}</span>`;
        btn.addEventListener("click", () => answer(c.id, btn));
        answersEl.appendChild(btn);
      });
    }

    function resolveStyle() {
      // pick randomly among the voicings the user selected
      const chosen = chipRowValues(styleRow);
      return pick(chosen.length ? chosen : ["block"]);
    }

    async function newQuestion() {
      await ensureAudio();
      const id = pick(selectedChords());
      const chord = CHORDS.find((c) => c.id === id);
      // pick an inversion valid for this chord's size (triad: 0-2, 7th: 0-3)
      const maxInv = chord.intervals.length - 1;
      const invChoices = selectedInversions().filter((k) => k <= maxInv);
      const inversion = invChoices.length ? pick(invChoices) : 0;
      // voicing as offsets from the root, then place the root so the whole
      // chord fits within the selected staff's range
      const rel = applyInversion(chord.intervals.slice(), inversion);
      const offMin = Math.min(...rel), offMax = Math.max(...rel);
      const { midiLo, midiHi } = clefMidiRange();
      const loB = midiLo - offMin;
      const root = randInt(loB, Math.max(loB, midiHi - offMax));
      current = {
        chord,
        root,
        inversion,
        midis: rel.map((o) => root + o),
        style: resolveStyle(),
      };
      answered = false;
      feedbackEl.textContent = "";
      feedbackEl.className = "feedback";
      nextBtn.classList.add("hidden");
      $("ch-reveal").classList.add("hidden");
      [...answersEl.children].forEach((b) => {
        b.disabled = false;
        b.classList.remove("correct", "wrong");
      });
      replayBtn.disabled = false;
      playCurrent();
    }

    function playCurrent() {
      Piano.playChord(current.midis, current.style);
    }

    function showNotes() {
      const names = current.midis.map(midiToNoteName).join(" · ");
      const invLabel = INV_NAMES[current.inversion] || "";
      $("ch-notes").innerHTML =
        `<span class="lead">Notes played:</span>${names}` +
        `<span class="lead" style="margin-left:8px">(${invLabel})</span>`;
      renderMiniStaff($("ch-staff"), [current.midis]);
      $("ch-reveal").classList.remove("hidden");
    }

    function answer(id, btn) {
      if (answered || !current) return;
      answered = true;
      stats.total++;
      const correct = id === current.chord.id;
      if (correct) {
        stats.correct++;
        stats.streak++;
        btn.classList.add("correct");
        feedbackEl.textContent = `✓ Correct — ${current.chord.name}`;
        feedbackEl.className = "feedback good";
      } else {
        stats.streak = 0;
        btn.classList.add("wrong");
        const right = [...answersEl.children].find((b) => b.dataset.value === current.chord.id);
        if (right) right.classList.add("correct");
        feedbackEl.textContent = `✗ That was ${current.chord.name}`;
        feedbackEl.className = "feedback bad";
      }
      [...answersEl.children].forEach((b) => (b.disabled = true));
      showNotes();
      nextBtn.classList.remove("hidden");
      updateStats();
    }

    function updateStats() {
      $("ch-correct").textContent = stats.correct;
      $("ch-total").textContent = stats.total;
      $("ch-acc").textContent = pct(stats.correct, stats.total);
      $("ch-streak").textContent = stats.streak;
    }

    playBtn.addEventListener("click", newQuestion);
    nextBtn.addEventListener("click", newQuestion);
    replayBtn.addEventListener("click", async () => {
      if (!current) return;
      await ensureAudio();
      playCurrent();
    });

    buildAnswers();
  })();

  // ============================================================
  //  MELODIC DICTATION
  // ============================================================
  (function DictationTrainer() {
    const keySel = $("dc-key");
    const scaleSel = $("dc-scale");
    const lenSlider = $("dc-len");
    const tempoSlider = $("dc-tempo");
    const labelRow = $("dc-label");
    const playBtn = $("dc-play");
    const replayBtn = $("dc-replay");
    const backBtn = $("dc-back");
    const clearBtn = $("dc-clear");
    const checkBtn = $("dc-check");
    const ioEl = $("dc-io");
    const tokensEl = $("dc-tokens");
    const pianoEl = $("dc-piano");
    const feedbackEl = $("dc-feedback");
    const hintEl = $("dc-hint");

    const stats = { correct: 0, total: 0, notesRight: 0, notesTotal: 0, streak: 0 };
    let current = null; // { tonic, scaleKey, notes:[midi], input:[midi], checked }

    initSingleChips(labelRow);
    lenSlider.addEventListener("input", () => ($("dc-len-val").textContent = lenSlider.value));
    tempoSlider.addEventListener("input", () => ($("dc-tempo-val").textContent = tempoSlider.value));
    labelRow.addEventListener("click", () => {
      if (current) renderPiano();
    });

    function pickTonic() {
      const v = keySel.value;
      if (v === "random") return Number(pick(["60", "62", "64", "65", "67", "69", "71"]));
      return Number(v);
    }

    // Build a melodic, mostly-stepwise diatonic line.
    function generateMelody(tonic, scaleKey, length) {
      const steps = SCALES[scaleKey].steps; // 7 degrees
      // available scale degrees across one octave + tonic on top => indices 0..7
      const maxIndex = 7; // tonic..tonic(+octave)
      let idx = 0; // start on tonic
      const seq = [degreeToMidi(tonic, steps, idx)];
      for (let n = 1; n < length; n++) {
        // weighted move: mostly steps of ±1, sometimes ±2, rarely a leap
        const roll = Math.random();
        let move;
        if (roll < 0.6) move = pick([-1, 1]);
        else if (roll < 0.85) move = pick([-2, 2]);
        else move = pick([-3, 3, 4]);
        idx += move;
        if (idx < 0) idx = Math.abs(idx);
        if (idx > maxIndex) idx = maxIndex - (idx - maxIndex);
        idx = Math.max(0, Math.min(maxIndex, idx));
        seq.push(degreeToMidi(tonic, steps, idx));
      }
      return seq;
    }

    function degreeToMidi(tonic, steps, index) {
      const octaveShift = Math.floor(index / 7) * 12;
      return tonic + steps[index % 7] + octaveShift;
    }

    function noteLabel(midi) {
      const mode = chipRowValue(labelRow);
      if (mode === "note") return midiToNoteName(midi);
      // solfege relative to current tonic
      const steps = SCALES[current.scaleKey].steps;
      const table = current.scaleKey === "major" ? SOLFEGE_MAJOR : SOLFEGE_MINOR;
      const rel = ((midi - current.tonic) % 12 + 12) % 12;
      const degree = steps.indexOf(rel);
      const oct = midi >= current.tonic + 12 ? "▲" : "";
      return degree >= 0 ? table[degree] + oct : midiToNoteName(midi);
    }

    async function newMelody() {
      await ensureAudio();
      const tonic = pickTonic();
      const scaleKey = scaleSel.value;
      const length = Number(lenSlider.value);
      current = {
        tonic, scaleKey,
        notes: generateMelody(tonic, scaleKey, length),
        input: [],
        checked: false,
      };
      hintEl.classList.add("hidden");
      ioEl.classList.remove("hidden");
      feedbackEl.textContent = "";
      feedbackEl.className = "feedback";
      replayBtn.disabled = false;
      renderPiano();
      renderTokens();
      playCurrent();
    }

    function playCurrent() {
      Piano.playMelody(current.notes, Number(tempoSlider.value));
    }

    // Render an interactive keyboard spanning tonic..tonic+octave (scale keys active).
    function renderPiano() {
      pianoEl.innerHTML = "";
      const low = current.tonic;
      const high = current.tonic + 12;
      const scalePCs = new Set(SCALES[current.scaleKey].steps);
      const answerSet = current.checked ? new Set(current.notes) : null;

      for (let m = low; m <= high; m++) {
        const key = document.createElement("div");
        const black = isBlackKey(m);
        key.className = "key " + (black ? "black" : "white");
        key.dataset.midi = m;
        const rel = ((m - current.tonic) % 12 + 12) % 12;
        const inScale = scalePCs.has(rel);

        if (answerSet && answerSet.has(m)) key.classList.add("highlight");

        if (inScale) {
          const label = document.createElement("span");
          label.className = "label";
          label.textContent = noteLabel(m);
          key.appendChild(label);
          key.addEventListener("click", () => onKeyPress(m, key));
        } else {
          key.style.opacity = "0.4";
          key.style.cursor = "default";
        }
        pianoEl.appendChild(key);
      }
    }

    function onKeyPress(midi, keyEl) {
      if (current.checked) return;
      Piano.playSingle(midi);
      keyEl.classList.add("pressed");
      setTimeout(() => keyEl.classList.remove("pressed"), 160);
      if (current.input.length >= current.notes.length) return;
      current.input.push(midi);
      renderTokens();
    }

    function renderTokens() {
      tokensEl.innerHTML = "";
      if (current.input.length === 0 && !current.checked) {
        const ph = document.createElement("span");
        ph.className = "token-placeholder";
        ph.textContent = `Click keys to enter ${current.notes.length} notes…`;
        tokensEl.appendChild(ph);
      }
      current.input.forEach((midi, i) => {
        const t = document.createElement("span");
        t.className = "token";
        if (current.checked) {
          t.classList.add(midi === current.notes[i] ? "correct" : "wrong");
        }
        t.textContent = noteLabel(midi);
        tokensEl.appendChild(t);
      });
      // when checked, show any missing expected notes
      if (current.checked && current.input.length < current.notes.length) {
        for (let i = current.input.length; i < current.notes.length; i++) {
          const t = document.createElement("span");
          t.className = "token wrong";
          t.textContent = "(" + noteLabel(current.notes[i]) + ")";
          tokensEl.appendChild(t);
        }
      }
      checkBtn.disabled = current.checked || current.input.length !== current.notes.length;
    }

    function check() {
      if (!current || current.checked) return;
      current.checked = true;
      stats.total++;
      stats.notesTotal += current.notes.length;
      let right = 0;
      current.notes.forEach((m, i) => {
        if (current.input[i] === m) right++;
      });
      stats.notesRight += right;
      const perfect = right === current.notes.length;
      if (perfect) {
        stats.correct++;
        stats.streak++;
        feedbackEl.textContent = `✓ Perfect! All ${current.notes.length} notes correct.`;
        feedbackEl.className = "feedback good";
      } else {
        stats.streak = 0;
        feedbackEl.textContent = `${right}/${current.notes.length} notes correct — correct answer highlighted below.`;
        feedbackEl.className = "feedback bad";
      }
      renderPiano();
      renderTokens();
      updateStats();
      Piano.playMelody(current.notes, Number(tempoSlider.value));
    }

    function updateStats() {
      $("dc-correct").textContent = stats.correct;
      $("dc-total").textContent = stats.total;
      $("dc-acc").textContent = pct(stats.notesRight, stats.notesTotal);
      $("dc-streak").textContent = stats.streak;
    }

    playBtn.addEventListener("click", newMelody);
    replayBtn.addEventListener("click", async () => {
      if (!current) return;
      await ensureAudio();
      playCurrent();
    });
    backBtn.addEventListener("click", () => {
      if (!current || current.checked) return;
      current.input.pop();
      renderTokens();
    });
    clearBtn.addEventListener("click", () => {
      if (!current || current.checked) return;
      current.input = [];
      renderTokens();
    });
    checkBtn.addEventListener("click", check);
  })();
});
