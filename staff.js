/* staff.js — Staff-notation melodic dictation (VexFlow) */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const VF = window.VexFlow;

  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const NAT_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const BASE16 = { w: 16, h: 8, q: 4, "8": 2, "16": 1 };
  const DUR_LABEL = { w: "Whole", h: "Half", q: "Quarter", "8": "Eighth", "16": "16th" };

  // ---------- key signature ----------
  const MAJOR_ACC = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
  const N_TO_NAME = { "0": "C", "1": "G", "2": "D", "3": "A", "4": "E", "5": "B", "6": "F#", "-1": "F", "-2": "Bb", "-3": "Eb", "-4": "Ab", "-5": "Db" };
  const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
  const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

  function buildKeyInfo(tonicPc, mode) {
    const n = mode === "major" ? MAJOR_ACC[tonicPc] : MAJOR_ACC[(tonicPc + 3) % 12];
    const altered = {};
    if (n > 0) SHARP_ORDER.slice(0, n).forEach((l) => (altered[l] = "#"));
    if (n < 0) FLAT_ORDER.slice(0, -n).forEach((l) => (altered[l] = "b"));
    return { n, altered, vexKey: N_TO_NAME[String(n)] };
  }

  function letterIndexOfPc(pc) {
    // tonic is always a natural letter
    for (const l of LETTERS) if (NAT_SEMI[l] === pc) return LETTERS.indexOf(l);
    return 0;
  }

  function durationBeats(code, dots) {
    const base = BASE16[code] / 4; // quarter units
    return dots ? base * 1.5 : base;
  }

  // ---------- state ----------
  const stats = { correct: 0, total: 0, notesRight: 0, notesTotal: 0, streak: 0 };
  let cfg = null;      // current puzzle config
  let target = [];     // generated melody events
  let userEvents = []; // includes locked first note
  let checked = false;
  let currentDur = "q";
  let dotArmed = false;
  let accArmed = "";   // '', '#', 'b', 'n'
  let staffGeom = null;
  let selIndex = 0;        // index of the selected event (0 = given note)
  let notePositions = [];  // x position per event index (input staff)

  // ---------- pitch helpers ----------
  function noteToIdx(letter, octave) {
    return octave * 7 + LETTERS.indexOf(letter);
  }
  function idxToNote(idx) {
    return { letter: LETTERS[((idx % 7) + 7) % 7], octave: Math.floor(idx / 7) };
  }
  function pitchMidi(letter, octave, acc) {
    const off = acc === "#" ? 1 : acc === "b" ? -1 : 0;
    return (octave + 1) * 12 + NAT_SEMI[letter] + off;
  }
  // Build a note event. explicitAcc "" means "use the key signature" (no drawn accidental).
  function makeNoteEvent(letter, octave, explicitAcc, duration, dots) {
    const keyAcc = cfg.keyInfo.altered[letter] || "";
    const acc = explicitAcc || "";
    const midi = pitchMidi(letter, octave, acc || keyAcc);
    return { type: "note", letter, octave, midi, acc, duration, dots, beats: durationBeats(duration, dots) };
  }
  const editable = (i) => i > 0 && i < userEvents.length && !checked;

  // ============================================================
  //  chip helpers
  // ============================================================
  function initSingle(container) {
    container.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      container.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
    });
  }
  function initMulti(container, onChange) {
    container.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      const sel = container.querySelectorAll(".chip.selected");
      if (chip.classList.contains("selected") && sel.length === 1) return;
      chip.classList.toggle("selected");
      if (onChange) onChange();
    });
  }
  // like initMulti but allows zero selected (for optional toggles / rest values)
  function initToggle(container, onChange) {
    container.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      chip.classList.toggle("selected");
      if (onChange) onChange();
    });
  }
  const selVals = (c) => [...c.querySelectorAll(".chip.selected")].map((x) => x.dataset.value);
  const hasOpt = (v) => selVals($("st-opts")).includes(v);

  // ============================================================
  //  generation
  // ============================================================
  function makeMeasureRhythm(measure16, notePool, restPool, std) {
    const res = [];
    let rem = measure16;
    while (rem > 0) {
      const wantRest = restPool.length && Math.random() < 0.22;
      let poolToUse = wantRest ? restPool : notePool;
      let fit = poolToUse.filter((d) => d.u16 <= rem);
      if (!fit.length) {
        const other = wantRest ? notePool : restPool;
        const otherFit = other.filter((d) => d.u16 <= rem);
        if (otherFit.length) { poolToUse = other; fit = otherFit; }
      }
      let ch;
      if (fit.length) ch = pick(fit);
      else ch = std.filter((d) => d.u16 <= rem).sort((a, b) => b.u16 - a.u16)[0];
      res.push({ code: ch.code, dots: ch.dots, rest: !!ch.rest });
      rem -= ch.u16;
    }
    return res;
  }

  // Which accidental (if any) a note needs, given its letter/octave/pitch and the key.
  // Returns "" when the key signature already spells the pitch (so no accidental is drawn).
  const ACC_SYMBOL = { "-2": "bb", "-1": "b", "0": "n", "1": "#", "2": "##" };
  function accForLetter(letter, octave, midi, keyInfo) {
    const naturalMidi = (octave + 1) * 12 + NAT_SEMI[letter];
    const accOffset = midi - naturalMidi;
    const keySig = keyInfo.altered[letter] || "";
    const keyOffset = keySig === "#" ? 1 : keySig === "b" ? -1 : 0;
    if (accOffset === keyOffset) return "";
    return ACC_SYMBOL[String(accOffset)] || "";
  }

  function scaleDegreeToNote(deg) {
    const steps = SCALES[cfg.scaleKey].steps;
    const idx = ((deg % 7) + 7) % 7;
    const octShift = Math.floor(deg / 7);
    const letterPos = cfg.tonicLetterIndex + idx;
    const extraOct = Math.floor(letterPos / 7);
    const letter = LETTERS[letterPos % 7];
    const octave = cfg.tonicOctave + octShift + extraOct;
    const midi = cfg.tonicMidi + steps[idx] + 12 * octShift;
    // Raised 6th/7th of harmonic & melodic minor need an explicit accidental.
    const acc = accForLetter(letter, octave, midi, cfg.keyInfo);
    return { letter, octave, midi, acc };
  }

  // Shift a note a semitone out of key, keeping the same letter and re-spelling it.
  function chromaticAlter(note) {
    const naturalMidi = (note.octave + 1) * 12 + NAT_SEMI[note.letter];
    for (const dir of pick([[1, -1], [-1, 1]])) {
      const newMidi = note.midi + dir;
      const off = newMidi - naturalMidi;
      if (off >= -2 && off <= 2) {
        note.midi = newMidi;
        note.acc = accForLetter(note.letter, note.octave, newMidi, cfg.keyInfo);
        return note;
      }
    }
    return note;
  }

  function generate() {
    const [num, den] = $("st-time").value.split("/").map(Number);
    const beatsPerMeasure = num * (4 / den); // quarter units
    const measure16 = beatsPerMeasure * 4;
    const bars = Number($("st-bars").value);
    const tonicMidi = Number($("st-key").value);
    const scaleKey = $("st-scale").value;
    const enabled = selVals($("st-durations"));
    const restVals = selVals($("st-rests"));
    const dotted = hasOpt("dotted");
    const outkey = hasOpt("outkey");
    const startOnTonic = hasOpt("tonic");
    const motion = selVals($("st-motion"));
    const steps = motion.includes("steps");
    const leaps = motion.includes("leaps");
    const tonicPc = tonicMidi % 12;

    cfg = {
      num, den, beatsPerMeasure, bars, tonicMidi, scaleKey,
      tonicLetterIndex: letterIndexOfPc(tonicPc),
      tonicOctave: Math.floor(tonicMidi / 12) - 1,
      keyInfo: buildKeyInfo(tonicPc, scaleKey),
      numBeats: num, beatValue: den, timeSig: `${num}/${den}`,
      outkey,
    };

    // rhythm pools (notes and rests are independent)
    function buildPool(codes, isRest) {
      const p = codes.map((c) => ({ code: c, u16: BASE16[c], dots: 0, rest: isRest }));
      if (dotted) {
        codes.forEach((c) => {
          const u = BASE16[c] * 1.5;
          if (Number.isInteger(u) && c !== "16") p.push({ code: c, u16: u, dots: 1, rest: isRest });
        });
      }
      return p;
    }
    const notePool = buildPool(enabled, false);
    const restPool = buildPool(restVals, true);
    const std = [
      { code: "w", u16: 16, dots: 0 }, { code: "h", u16: 8, dots: 0 },
      { code: "q", u16: 4, dots: 0 }, { code: "8", u16: 2, dots: 0 },
      { code: "16", u16: 1, dots: 0 },
    ];

    // build full rhythm
    let rhythm = [];
    for (let b = 0; b < bars; b++) rhythm = rhythm.concat(makeMeasureRhythm(measure16, notePool, restPool, std));
    if (rhythm[0] && rhythm[0].rest) rhythm[0].rest = false; // first event is the given note

    // assign pitches / rests
    const events = [];
    let deg = startOnTonic ? 0 : pick([0, 1, 2, 3, 4, 5, 6]);
    let isFirstNote = true;
    rhythm.forEach((r) => {
      const beats = durationBeats(r.code, r.dots);
      if (r.rest) {
        events.push({ type: "rest", duration: r.code, dots: r.dots, beats });
        return;
      }
      if (!isFirstNote) {
        let move;
        const useLeap = leaps && (!steps || Math.random() > 0.7);
        if (useLeap) move = pick([2, 3, 4]) * pick([1, -1]);
        else move = pick([1, -1]);
        deg = Math.max(-3, Math.min(9, deg + move));
      }
      const note = scaleDegreeToNote(deg);
      if (outkey && !isFirstNote && Math.random() < 0.16) chromaticAlter(note);
      events.push({
        type: "note", letter: note.letter, octave: note.octave, midi: note.midi,
        acc: note.acc, duration: r.code, dots: r.dots, beats,
      });
      isFirstNote = false;
    });
    return events;
  }

  // ============================================================
  //  rendering (VexFlow)
  // ============================================================
  function makeVexNote(ev) {
    let n;
    if (ev.type === "rest") {
      n = new VF.StaveNote({ keys: ["b/4"], duration: ev.duration + "r" });
    } else {
      n = new VF.StaveNote({
        keys: [ev.letter.toLowerCase() + "/" + ev.octave],
        duration: ev.duration, clef: "treble", autoStem: true,
      });
      if (ev.acc) n.addModifier(new VF.Accidental(ev.acc), 0);
    }
    if (ev.dots) VF.Dot.buildAndAttach([n], { all: true });
    if (ev.color) n.setStyle({ fillStyle: ev.color, strokeStyle: ev.color });
    return n;
  }

  function renderStaff(container, events, captureGeom) {
    container.innerHTML = "";
    const bpm = cfg.beatsPerMeasure;

    // split into measures by cumulative beats
    const measures = [];
    let cur = [], acc = 0;
    events.forEach((ev) => {
      cur.push(ev);
      acc += ev.beats;
      if (acc >= bpm - 1e-6) { measures.push(cur); cur = []; acc = 0; }
    });
    if (cur.length) measures.push(cur);
    if (measures.length === 0) measures.push([]);

    const firstExtra = 90, measW = 200, staveY = 18, height = 150;
    const widths = measures.map((m, i) => (i === 0 ? measW + firstExtra : measW));
    const totalW = widths.reduce((a, b) => a + b, 0) + 20;

    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(Math.max(totalW, 340), height + 20);
    const ctx = renderer.getContext();

    let x = 10, firstStave = null, evCursor = 0;
    const positions = [];
    measures.forEach((mEvents, i) => {
      const stave = new VF.Stave(x, staveY, widths[i]);
      if (i === 0) {
        stave.addClef("treble").addKeySignature(cfg.keyInfo.vexKey).addTimeSignature(cfg.timeSig);
      }
      stave.setContext(ctx).draw();
      if (i === 0) firstStave = stave;

      if (mEvents.length) {
        const notes = mEvents.map(makeVexNote);
        let beams = [];
        try { beams = VF.Beam.generateBeams(notes); } catch (e) { beams = []; }
        const voice = new VF.Voice({ numBeats: cfg.numBeats, beatValue: cfg.beatValue });
        if (VF.Voice.Mode) voice.setMode(VF.Voice.Mode.SOFT);
        else voice.setStrict(false);
        voice.addTickables(notes);
        const avail = stave.getX() + stave.getWidth() - stave.getNoteStartX() - 14;
        new VF.Formatter().joinVoices([voice]).format([voice], Math.max(60, avail));
        voice.draw(ctx, stave);
        beams.forEach((b) => b.setContext(ctx).draw());
        notes.forEach((n, k) => {
          try { positions[evCursor + k] = n.getAbsoluteX(); } catch (e) { /* ignore */ }
        });
      }
      evCursor += mEvents.length;
      x += widths[i];
    });

    if (captureGeom && firstStave) {
      staffGeom = {
        yLine0: firstStave.getYForLine(0),
        spacing: firstStave.getSpacingBetweenLines(),
      };
      notePositions = positions;
    }
  }

  // ============================================================
  //  click -> pitch
  // ============================================================
  function yToNote(clientY) {
    const svg = $("st-staff").querySelector("svg");
    if (!svg || !staffGeom) return null;
    const rect = svg.getBoundingClientRect();
    const y = clientY - rect.top;
    const half = staffGeom.spacing / 2;
    const stepsFromTop = Math.round((staffGeom.yLine0 - y) / half); // + = above F5
    let idx = 38 + stepsFromTop; // F5 diatonic index = 5*7+3
    idx = Math.max(21, Math.min(46, idx)); // clamp ~C3..E6
    const octave = Math.floor(idx / 7);
    const letter = LETTERS[((idx % 7) + 7) % 7];
    return { letter, octave };
  }

  // A staff tap either re-pitches the nearest note (by x column) or adds a new note.
  function onStaffTap(clientX, clientY) {
    if (checked) return;
    const svg = $("st-staff").querySelector("svg");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left;

    // nearest existing note by horizontal position
    let nearest = -1, best = Infinity;
    notePositions.forEach((nx, i) => {
      if (nx == null) return;
      const d = Math.abs(nx - x);
      if (d < best) { best = d; nearest = i; }
    });

    const pos = yToNote(clientY);
    if (!pos) return;

    if (nearest > 0 && best <= 18) {
      // re-pitch (or convert a rest into) the tapped note
      const ev = userEvents[nearest];
      userEvents[nearest] = makeNoteEvent(pos.letter, pos.octave, "", ev.duration, ev.dots);
      selIndex = nearest;
    } else {
      // add a new note after the current selection
      const dots = dotArmed && currentDur !== "16" ? 1 : 0;
      const ev = makeNoteEvent(pos.letter, pos.octave, accArmed, currentDur, dots);
      const at = Math.min(userEvents.length, (selIndex ?? userEvents.length - 1) + 1);
      userEvents.splice(at, 0, ev);
      selIndex = at;
      accArmed = "";
    }
    updateAccButtons();
    Piano.playSingle(userEvents[selIndex].midi);
    refreshInputStaff();
  }

  function selectByTapX(clientX) {
    const svg = $("st-staff").querySelector("svg");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left;
    let nearest = -1, best = Infinity;
    notePositions.forEach((nx, i) => {
      if (nx == null) return;
      const d = Math.abs(nx - x);
      if (d < best) { best = d; nearest = i; }
    });
    if (nearest >= 0) { selIndex = nearest; refreshInputStaff(); }
  }

  function nudgePitch(delta) {
    if (!editable(selIndex)) return;
    const ev = userEvents[selIndex];
    if (ev.type !== "note") return;
    let idx = noteToIdx(ev.letter, ev.octave) + delta;
    idx = Math.max(21, Math.min(46, idx));
    const p = idxToNote(idx);
    userEvents[selIndex] = makeNoteEvent(p.letter, p.octave, ev.acc, ev.duration, ev.dots);
    Piano.playSingle(userEvents[selIndex].midi);
    refreshInputStaff();
  }

  function setDuration(code) {
    currentDur = code;
    if (editable(selIndex)) {
      const ev = userEvents[selIndex];
      const dots = ev.dots && code !== "16" ? ev.dots : 0;
      ev.duration = code; ev.dots = dots; ev.beats = durationBeats(code, dots);
    }
    refreshInputStaff();
  }

  function toggleDot() {
    dotArmed = !dotArmed;
    if (editable(selIndex) && userEvents[selIndex].duration !== "16") {
      const ev = userEvents[selIndex];
      ev.dots = ev.dots ? 0 : 1;
      ev.beats = durationBeats(ev.duration, ev.dots);
    }
    refreshInputStaff();
  }

  function setAccidental(acc) {
    if (editable(selIndex) && userEvents[selIndex].type === "note") {
      const ev = userEvents[selIndex];
      const newAcc = ev.acc === acc ? "" : acc;
      userEvents[selIndex] = makeNoteEvent(ev.letter, ev.octave, newAcc, ev.duration, ev.dots);
      accArmed = "";
      Piano.playSingle(userEvents[selIndex].midi);
    } else {
      accArmed = accArmed === acc ? "" : acc;
    }
    updateAccButtons();
    refreshInputStaff();
  }

  function addRest() {
    if (checked) return;
    const dots = dotArmed && currentDur !== "16" ? 1 : 0;
    const ev = { type: "rest", duration: currentDur, dots, beats: durationBeats(currentDur, dots) };
    const at = Math.min(userEvents.length, (selIndex ?? userEvents.length - 1) + 1);
    userEvents.splice(at, 0, ev);
    selIndex = at;
    refreshInputStaff();
  }

  function deleteSelected() {
    if (!editable(selIndex)) return;
    userEvents.splice(selIndex, 1);
    selIndex = Math.max(0, selIndex - 1);
    refreshInputStaff();
  }

  function moveSel(delta) {
    if (!userEvents.length) return;
    selIndex = Math.max(0, Math.min(userEvents.length - 1, (selIndex ?? 0) + delta));
    if (editable(selIndex)) Piano.playSingle(userEvents[selIndex].midi);
    refreshInputStaff();
  }

  function refreshInputStaff() {
    userEvents.forEach((ev, i) => {
      ev.color = i === 0 ? "#2b6cb0" : i === selIndex && !checked ? "#d98a1e" : undefined;
    });
    renderStaff($("st-staff"), userEvents, true);
    updateDurButtons();
    $("st-check").disabled = checked || userEvents.length < 2;
  }

  // ============================================================
  //  check
  // ============================================================
  function eventsMatch(u, t) {
    if (!u || !t) return false;
    if (u.type !== t.type) return false;
    if (u.duration !== t.duration || (u.dots || 0) !== (t.dots || 0)) return false;
    if (u.type === "rest") return true;
    return u.midi === t.midi;
  }

  function check() {
    if (checked || !cfg) return;
    checked = true;
    stats.total++;
    const len = Math.max(userEvents.length, target.length);
    let right = 0;
    for (let i = 0; i < len; i++) {
      const ok = eventsMatch(userEvents[i], target[i]);
      if (ok) right++;
      if (userEvents[i]) userEvents[i].color = i === 0 ? "#2b6cb0" : ok ? "#188a4c" : "#d23b3b";
    }
    stats.notesRight += right;
    stats.notesTotal += len;
    const perfect = right === len && userEvents.length === target.length;
    if (perfect) {
      stats.correct++;
      stats.streak++;
      $("st-feedback").textContent = "✓ Perfect transcription!";
      $("st-feedback").className = "feedback good";
    } else {
      stats.streak = 0;
      $("st-feedback").textContent = `${right}/${len} events correct — compare with the correct answer below.`;
      $("st-feedback").className = "feedback bad";
    }
    renderStaff($("st-staff"), userEvents, true);
    // show answer
    target.forEach((ev, i) => (ev.color = i === 0 ? "#2b6cb0" : "#188a4c"));
    $("st-answer-block").classList.remove("hidden");
    renderStaff($("st-answer-staff"), target, false);
    $("st-check").disabled = true;
    updateStats();
  }

  function updateStats() {
    $("st-correct").textContent = stats.correct;
    $("st-total").textContent = stats.total;
    $("st-acc").textContent = stats.notesTotal ? Math.round((stats.notesRight / stats.notesTotal) * 100) + "%" : "—";
    $("st-streak").textContent = stats.streak;
  }

  // ============================================================
  //  palette
  // ============================================================
  function buildPalette() {
    // palette offers every duration usable for a note OR a rest
    const order = ["w", "h", "q", "8", "16"];
    const noteVals = selVals($("st-durations"));
    const restVals = selVals($("st-rests"));
    const union = order.filter((c) => noteVals.includes(c) || restVals.includes(c));
    if (!union.includes(currentDur)) currentDur = union.includes("q") ? "q" : union[0];
    const pal = $("st-dur-palette");
    pal.innerHTML = "";
    union.forEach((code) => {
      const b = document.createElement("button");
      b.className = "pal-btn";
      b.dataset.dur = code;
      b.textContent = DUR_LABEL[code];
      b.addEventListener("click", () => setDuration(code));
      pal.appendChild(b);
    });
    // dot toggle
    const dot = document.createElement("button");
    dot.className = "pal-btn";
    dot.dataset.dot = "1";
    dot.textContent = "Dotted •";
    dot.addEventListener("click", toggleDot);
    pal.appendChild(dot);
    updateDurButtons();
  }

  // Reflect the current duration / dot state (and the selected note's duration) on the buttons.
  function updateDurButtons() {
    const pal = $("st-dur-palette");
    if (!pal) return;
    const sel = editable(selIndex) ? userEvents[selIndex] : null;
    const shownDur = sel ? sel.duration : currentDur;
    const shownDot = sel ? !!sel.dots : dotArmed;
    pal.querySelectorAll(".pal-btn").forEach((b) => {
      if (b.dataset.dur) b.classList.toggle("selected", b.dataset.dur === shownDur);
      if (b.dataset.dot) b.classList.toggle("armed", shownDot);
    });
  }

  function updateAccButtons() {
    const sel = editable(selIndex) && userEvents[selIndex].type === "note" ? userEvents[selIndex] : null;
    const shown = sel ? sel.acc : accArmed;
    $("st-acc-group").querySelectorAll(".pal-btn").forEach((b) =>
      b.classList.toggle("armed", b.dataset.acc === shown)
    );
  }

  function syncAccVisibility() {
    // Accidentals are needed for out-of-key notes and for the raised degrees
    // of harmonic/melodic minor.
    const scale = $("st-scale").value;
    const needed = hasOpt("outkey") || scale === "harmonicMinor" || scale === "melodicMinor";
    $("st-acc-group").classList.toggle("hidden", !needed);
  }

  // ============================================================
  //  wiring
  // ============================================================
  function newMelody() {
    ensureAudioThen(() => {
      buildPalette();
      syncAccVisibility();
      target = generate();
      userEvents = [Object.assign({}, target[0])]; // given first note (pitch + duration)
      selIndex = 0;
      checked = false;
      accArmed = "";
      dotArmed = false;
      $("st-hint").classList.add("hidden");
      $("st-io").classList.remove("hidden");
      $("st-answer-block").classList.add("hidden");
      $("st-feedback").textContent = "";
      $("st-feedback").className = "feedback";
      $("st-replay").disabled = false;
      refreshInputStaff();
      playTarget();
    });
  }

  function toPlay(events) {
    return events.map((e) => ({ midi: e.type === "rest" ? null : e.midi, beats: e.beats }));
  }
  function playTarget() { Piano.playRhythmic(toPlay(target), Number($("st-tempo").value)); }

  // ensure audio helper (mirrors app.js loader)
  async function ensureAudioThen(fn) {
    const loader = $("audio-loader");
    loader.classList.remove("hidden");
    try {
      await Piano.ensureReady();
    } catch (e) {
      loader.textContent = "⚠ Could not load piano samples. Check your connection and reload.";
      return;
    } finally {
      if (Piano.isLoaded()) loader.classList.add("hidden");
    }
    fn();
  }

  // sub-mode toggle
  $("dc-submode").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    $("dc-submode").querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    const staff = btn.dataset.sub === "staff";
    $("dc-staff-mode").classList.toggle("hidden", !staff);
    $("dc-kb-mode").classList.toggle("hidden", staff);
    Piano.stopAll();
  });

  initMulti($("st-durations"), buildPalette);
  initToggle($("st-rests"), buildPalette);
  initMulti($("st-motion"));
  initToggle($("st-opts"), syncAccVisibility);
  $("st-scale").addEventListener("change", syncAccVisibility);
  $("st-bars").addEventListener("input", () => ($("st-bars-val").textContent = $("st-bars").value));
  $("st-tempo").addEventListener("input", () => ($("st-tempo-val").textContent = $("st-tempo").value));

  $("st-play").addEventListener("click", newMelody);
  $("st-replay").addEventListener("click", () => { if (cfg) ensureAudioThen(playTarget); });
  $("st-hear").addEventListener("click", () => {
    if (cfg) ensureAudioThen(() => Piano.playRhythmic(toPlay(userEvents), Number($("st-tempo").value)));
  });
  $("st-clear").addEventListener("click", () => {
    if (checked) return;
    userEvents = userEvents.slice(0, 1);
    selIndex = 0;
    refreshInputStaff();
  });
  $("st-check").addEventListener("click", check);
  $("st-lower").addEventListener("click", () => nudgePitch(-1));
  $("st-higher").addEventListener("click", () => nudgePitch(1));
  $("st-prev").addEventListener("click", () => moveSel(-1));
  $("st-next").addEventListener("click", () => moveSel(1));
  $("st-rest").addEventListener("click", addRest);
  $("st-del").addEventListener("click", deleteSelected);
  $("st-acc-group").addEventListener("click", (e) => {
    const b = e.target.closest(".pal-btn");
    if (!b) return;
    setAccidental(b.dataset.acc);
  });
  $("st-staff").addEventListener("click", (e) => onStaffTap(e.clientX, e.clientY));

  buildPalette();
});
