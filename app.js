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

  // ---------- mini staff (for note reveal) ----------
  const VEX_PC = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
  function midiToVexKey(m) {
    const pc = ((m % 12) + 12) % 12;
    const oct = Math.floor(m / 12) - 1;
    return VEX_PC[pc] + "/" + oct;
  }
  // groups: array of midi-arrays; each group renders as one whole-note (chords stack).
  function renderMiniStaff(container, groups) {
    const VF = window.VexFlow;
    container.innerHTML = "";
    const w = Math.max(150, 70 + groups.length * 58);
    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(w, 120);
    const ctx = renderer.getContext();
    const stave = new VF.Stave(6, 8, w - 12).addClef("treble");
    stave.setContext(ctx).draw();
    const notes = groups.map((midis) => {
      const sorted = [...midis].sort((a, b) => a - b);
      const n = new VF.StaveNote({ keys: sorted.map(midiToVexKey), duration: "w", clef: "treble" });
      sorted.forEach((m, i) => {
        if (midiToVexKey(m).includes("#")) n.addModifier(new VF.Accidental("#"), i);
      });
      return n;
    });
    const voice = new VF.Voice({ numBeats: groups.length * 4, beatValue: 4 });
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
    const defaultOn = new Set([2, 4, 5, 7, 9, 12]);
    INTERVALS.forEach((iv) => {
      const chip = document.createElement("div");
      chip.className = "chip" + (defaultOn.has(iv.semitones) ? " selected" : "");
      chip.dataset.value = iv.semitones;
      chip.textContent = iv.short;
      chip.title = iv.name;
      setRow.appendChild(chip);
    });
    initMultiChips(setRow);
    initSingleChips(dirRow);
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
      let d = chipRowValue(dirRow);
      if (d === "random") d = pick(["harmonic", "ascending", "descending"]);
      return d;
    }

    async function newQuestion() {
      await ensureAudio();
      const chosen = selectedIntervals();
      const st = pick(chosen);
      const iv = INTERVALS.find((x) => x.semitones === st);
      const low = randInt(55, 64); // G3..E4 comfortable range
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
    initSingleChips(styleRow);
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
      let s = chipRowValue(styleRow);
      if (s === "random") s = pick(["block", "arpeggio"]);
      return s;
    }

    async function newQuestion() {
      await ensureAudio();
      const id = pick(selectedChords());
      const chord = CHORDS.find((c) => c.id === id);
      const root = randInt(52, 60); // E3..C4
      // pick an inversion valid for this chord's size (triad: 0-2, 7th: 0-3)
      const maxInv = chord.intervals.length - 1;
      const invChoices = selectedInversions().filter((k) => k <= maxInv);
      const inversion = invChoices.length ? pick(invChoices) : 0;
      current = {
        chord,
        root,
        inversion,
        midis: applyInversion(chord.intervals.map((i) => root + i), inversion),
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
