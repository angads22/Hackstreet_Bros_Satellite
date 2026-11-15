/*
 * js/audio.js: the game's music and sound effects, all made in the browser with the Web Audio API.
 *
 * No recording, sample, library or file is used: every sound is an oscillator or filtered noise that this file shapes,
 * so there is nothing to license (SOURCES.md says so). Plain script, no import. It touches the page only to add two small
 * buttons to the footer (MUSIC and SOUNDS) and to read the era look (body[data-era]). The game works without this file, or
 * with sound off, or in a browser with no Web Audio: every call is guarded and silent.
 *
 *   GravAudio.sfx(name, arg)   a short effect: click, add, remove, deny, tick, liftoff, orbit, star (arg: 0, 1, 2),
 *                              stamp, win, fail, event, pay, hold
 *   GravAudio.duck(on)         lower the music (the launch show uses it)
 *   GravAudio.setEra(era)      "1958" (a warm, slow, tape-worn bed) or anything else (clean and modern); the page's own
 *                              data-era is followed automatically
 *   GravAudio.state()          { music, sfx, running } for the footer and the tests
 *
 * Browsers only allow sound after a click or key press, so nothing starts before the player's first gesture. Music and
 * sounds are on by default, are kept in localStorage ("gravitron-audio-v1"), and pause when the tab is hidden.
 */
(function () {
  "use strict";

  var KEY = "gravitron-audio-v1";
  var AC = window.AudioContext || window.webkitAudioContext;
  var prefs = { music: true, sfx: true };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && typeof saved === "object") { prefs.music = saved.music !== false; prefs.sfx = saved.sfx !== false; }
  } catch (e) { /* private window: the defaults */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* not kept */ } }

  var ctx = null, master = null, musicBus = null, sfxBus = null, reverb = null, echo = null;
  var era = "today", ducked = false, timer = null;
  var nextChord = 0, chordIndex = 0, nextBell = 0, nextCrack = 0, lastBell = -1;
  var MUSIC_LEVEL = 0.2, SFX_LEVEL = 0.42;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // ---------------------------------------------------------------- the two moods
  // Chords are MIDI notes: bass (one note) and pad (a few). Each lasts `bar` seconds and the next one fades in over it.
  var MOODS = {
    today: {
      bar: 8, cutoff: 1500, wave: "triangle", bell: "sine", bellEvery: [1.4, 3.2], wobble: 0, crackle: false,
      chords: [
        { bass: 45, pad: [57, 60, 64, 67, 71] },   // Am9
        { bass: 41, pad: [57, 60, 64, 65, 69] },   // Fmaj7
        { bass: 36, pad: [55, 59, 64, 67, 71] },   // Cmaj7
        { bass: 43, pad: [55, 59, 62, 64, 69] }    // G6/9
      ],
      scale: [69, 72, 74, 76, 79, 81, 84]          // A minor pentatonic, up high
    },
    "1958": {
      bar: 10, cutoff: 650, wave: "triangle", bell: "triangle", bellEvery: [2.2, 4.6], wobble: 14, crackle: true,
      chords: [
        { bass: 38, pad: [53, 57, 60, 64] },       // Dm9
        { bass: 34, pad: [53, 57, 62, 65] },       // Bbmaj7
        { bass: 43, pad: [55, 58, 62, 65] },       // Gm7
        { bass: 45, pad: [55, 57, 61, 64] }        // A7
      ],
      scale: [62, 65, 67, 69, 72, 74, 77]          // D minor pentatonic
    }
  };
  function mood() { return era === "1958" ? MOODS["1958"] : MOODS.today; }

  // ---------------------------------------------------------------- the audio graph
  function build() {
    if (ctx || !AC) return !!ctx;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.3;
    master = ctx.createGain(); master.gain.value = 0.8;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0;
    sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_LEVEL;
    sfxBus.connect(master);
    // A soft room: a short generated noise tail, and a quiet echo, both fed by the music.
    reverb = ctx.createConvolver();
    var len = Math.floor(ctx.sampleRate * 2.6), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    reverb.buffer = buf;
    var wet = ctx.createGain(); wet.gain.value = 0.55;
    reverb.connect(wet); wet.connect(musicBus);
    echo = ctx.createDelay(1.0); echo.delayTime.value = 0.42;
    var fb = ctx.createGain(); fb.gain.value = 0.38;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
    echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(reverb);
    musicBus.connect(master);
    return true;
  }

  function noiseBuffer(sec) {
    var len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  var noiseCache = null;
  function noise() { return noiseCache || (noiseCache = noiseBuffer(2)); }

  // One oscillator with an attack and a release, wired to `dest`.
  function voice(freq, t, attack, hold, release, level, type, dest, detuneLfo) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.setValueAtTime(level, t + attack + hold);
    g.gain.linearRampToValueAtTime(0, t + attack + hold + release);
    if (detuneLfo) detuneLfo.connect(o.detune);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + attack + hold + release + 0.05);
    return o;
  }

  // ---------------------------------------------------------------- the music
  function playChord(t) {
    var m = mood(), c = m.chords[chordIndex % m.chords.length];
    chordIndex++;
    var bar = m.bar, attack = bar * 0.3, release = bar * 0.4, hold = bar - attack;
    var filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = m.cutoff; filt.Q.value = 0.4;
    var padBus = ctx.createGain(); padBus.gain.value = 1;
    filt.connect(padBus); padBus.connect(musicBus); padBus.connect(reverb);
    var lfo = null, lfoGain = null;
    if (m.wobble) {   // the tape wobbles a few cents, slowly
      lfo = ctx.createOscillator(); lfo.frequency.value = rnd(0.18, 0.4);
      lfoGain = ctx.createGain(); lfoGain.gain.value = m.wobble;
      lfo.connect(lfoGain); lfo.start(t); lfo.stop(t + attack + hold + release + 0.1);
    }
    c.pad.forEach(function (n) {
      [-5, 5].forEach(function (cents) {
        var o = voice(mtof(n), t, attack, hold, release, 0.07, m.wave, filt, lfoGain);
        o.detune.value = cents;
      });
    });
    voice(mtof(c.bass), t, attack * 0.5, hold, release, 0.22, "sine", musicBus);
    // A very slow sweep of the filter keeps the pad alive.
    filt.frequency.setValueAtTime(m.cutoff * 0.7, t);
    filt.frequency.linearRampToValueAtTime(m.cutoff * 1.15, t + bar);
  }

  function playBell(t) {
    var m = mood(), s = m.scale, i;
    do { i = Math.floor(Math.random() * s.length); } while (i === lastBell && s.length > 1);
    lastBell = i;
    var f = mtof(s[i]), g = ctx.createGain();
    var o = ctx.createOscillator(); o.type = m.bell; o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 2.6);
    o.connect(g); g.connect(musicBus); g.connect(echo);
    o.start(t); o.stop(t + 2.7);
  }

  function playCrackle(t) {   // a tiny click from an old recording
    var src = ctx.createBufferSource(), g = ctx.createGain(), hp = ctx.createBiquadFilter();
    src.buffer = noise(); hp.type = "highpass"; hp.frequency.value = 2500;
    g.gain.setValueAtTime(rnd(0.01, 0.03), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    src.connect(hp); hp.connect(g); g.connect(musicBus);
    src.start(t, rnd(0, 1.5), 0.02);
  }

  function schedule() {
    if (!ctx || ctx.state !== "running" || !prefs.music) return;
    var horizon = ctx.currentTime + 1.6, m = mood();
    while (nextChord < horizon) { playChord(Math.max(nextChord, ctx.currentTime + 0.05)); nextChord += m.bar; }
    while (nextBell < horizon) { playBell(Math.max(nextBell, ctx.currentTime + 0.05)); nextBell += rnd(m.bellEvery[0], m.bellEvery[1]); }
    if (m.crackle) while (nextCrack < horizon) { playCrackle(Math.max(nextCrack, ctx.currentTime + 0.05)); nextCrack += rnd(0.12, 0.7); }
  }

  function musicLevel() { return prefs.music ? (ducked ? MUSIC_LEVEL * 0.3 : MUSIC_LEVEL) : 0; }
  function applyLevels() {
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, prefs.music ? 0.5 : 0.15);
    sfxBus.gain.setTargetAtTime(prefs.sfx ? SFX_LEVEL : 0, ctx.currentTime, 0.05);
  }

  function startMusic() {
    if (!ctx || timer) return;
    var t = ctx.currentTime;
    nextChord = t + 0.1; nextBell = t + 2; nextCrack = t + 0.5; chordIndex = 0;
    schedule();
    timer = setInterval(schedule, 400);
  }
  function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }

  // ---------------------------------------------------------------- the effects
  function tone(freq, t, dur, type, level, slideTo, attack) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function whoosh(t, dur, f0, f1, level, type) {
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise(); src.loop = true;
    f.type = type || "lowpass"; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + Math.min(0.08, dur / 4));
    g.gain.setValueAtTime(level, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t); src.stop(t + dur + 0.05);
  }
  var C5 = 72, E5 = 76, G5 = 79, C6 = 84;
  var EFFECTS = {
    click: function (t) { tone(1500, t, 0.05, "sine", 0.3); },
    add: function (t) { tone(190, t, 0.12, "sine", 0.5, 90); tone(mtof(79), t + 0.04, 0.09, "triangle", 0.28); tone(mtof(84), t + 0.1, 0.12, "triangle", 0.24); },
    remove: function (t) { tone(mtof(79), t, 0.08, "triangle", 0.26); tone(mtof(72), t + 0.07, 0.12, "triangle", 0.26, mtof(64)); },
    deny: function (t) { tone(130, t, 0.16, "square", 0.16, 100); },
    tick: function (t) { tone(880, t, 0.07, "sine", 0.36); },
    hold: function (t) { tone(330, t, 0.1, "square", 0.12); tone(330, t + 0.16, 0.1, "square", 0.12); },
    liftoff: function (t) { whoosh(t, 4.2, 140, 1400, 0.5, "lowpass"); tone(52, t, 4, "sine", 0.55, 80, 0.4); whoosh(t + 0.1, 3, 600, 2600, 0.12, "bandpass"); },
    orbit: function (t) { [C5 - 12, G5 - 12, E5, C6].forEach(function (n, i) { tone(mtof(n), t + i * 0.18, 2.4, "sine", 0.22, null, 0.2); }); },
    star: function (t, i) { var n = [C5, E5, G5][i % 3]; tone(mtof(n), t, 0.35, "triangle", 0.34); tone(mtof(n + 12), t + 0.02, 0.5, "sine", 0.16); },
    stamp: function (t) { tone(110, t, 0.22, "sine", 0.6, 55); whoosh(t, 0.12, 3000, 500, 0.3, "bandpass"); },
    win: function (t) { [C5, E5, G5, C6, E5 + 12].forEach(function (n, k) { tone(mtof(n), t + k * 0.09, 0.7, "triangle", 0.26); }); },
    fail: function (t) { tone(mtof(64), t, 0.5, "sawtooth", 0.14, mtof(52)); tone(mtof(60), t + 0.18, 0.7, "sawtooth", 0.14, mtof(46)); },
    event: function (t) { tone(mtof(76), t, 0.9, "sine", 0.3); tone(mtof(71), t + 0.22, 1.2, "sine", 0.3); tone(mtof(76 + 12), t, 0.5, "sine", 0.08); },
    pay: function (t) { tone(mtof(83), t, 0.12, "triangle", 0.28); tone(mtof(88), t + 0.08, 0.22, "triangle", 0.28); }
  };

  // ---------------------------------------------------------------- control
  function unlock() {
    if (!AC) return;
    if (!ctx && !build()) return;
    var go = function () { applyLevels(); if (prefs.music) startMusic(); refreshButtons(); };
    if (ctx.state === "running") go();
    else ctx.resume().then(go, function () { /* stays silent */ });
  }

  function sfx(name, arg) {
    try {
      if (!prefs.sfx || !ctx || ctx.state !== "running" || !EFFECTS[name]) return;
      EFFECTS[name](ctx.currentTime + 0.01, arg || 0);
    } catch (e) { /* a sound must never break the game */ }
  }

  function setEra(next) {
    var e = next === "1958" ? "1958" : "today";
    if (e === era) return;
    era = e; chordIndex = 0;   // the next chord comes from the new mood; the old pad fades out under it
    if (ctx && timer) nextChord = Math.min(nextChord, ctx.currentTime + 0.5);
  }

  function setMusic(on) {
    prefs.music = !!on; save();
    if (ctx) { applyLevels(); if (prefs.music && ctx.state === "running") startMusic(); else if (!prefs.music) stopMusic(); }
    else if (prefs.music) unlock();
    refreshButtons();
  }
  function setSfx(on) { prefs.sfx = !!on; save(); applyLevels(); refreshButtons(); if (on) sfx("click"); }

  // ---------------------------------------------------------------- the page: two footer buttons, the era, the first gesture
  var btnMusic = null, btnSfx = null;
  function label(b, name, on) { if (b) { b.textContent = name + ": " + (on ? "ON" : "OFF"); b.setAttribute("aria-pressed", on ? "true" : "false"); } }
  function refreshButtons() { label(btnMusic, "MUSIC", prefs.music); label(btnSfx, "SOUNDS", prefs.sfx); }
  function addButtons() {
    var foot = document.querySelector(".foot");
    if (!foot || foot.querySelector(".snd")) return;
    function make(cls, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn quiet snd " + cls; b.addEventListener("click", fn);
      return b;
    }
    btnMusic = make("snd-music", function () { setMusic(!prefs.music); });
    btnSfx = make("snd-sfx", function () { setSfx(!prefs.sfx); });
    foot.insertBefore(btnSfx, foot.firstChild); foot.insertBefore(btnMusic, foot.firstChild);
    refreshButtons();
  }

  function readEra() {
    var e = document.body && document.body.getAttribute("data-era");
    setEra(e === "1958" ? "1958" : "today");
  }

  function wire() {
    addButtons();
    readEra();
    try { new MutationObserver(readEra).observe(document.body, { attributes: true, attributeFilter: ["data-era"] }); } catch (e) { /* era stays */ }
    var first = function () { document.removeEventListener("pointerdown", first, true); document.removeEventListener("keydown", first, true); unlock(); };
    document.addEventListener("pointerdown", first, true);
    document.addEventListener("keydown", first, true);
    // A click on a button makes a small tick; the part cards make their own sounds (add, remove).
    document.addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("button, .btn, .blip");
      if (!b || b.disabled || b.classList.contains("snd") || b.closest(".part")) return;
      window.GravAudio.sfx("click");
    }, true);
    document.addEventListener("visibilitychange", function () {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (prefs.music || prefs.sfx) ctx.resume();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();

  window.GravAudio = {
    sfx: sfx,
    setEra: setEra,
    duck: function (on) { ducked = !!on; applyLevels(); },
    state: function () { return { music: prefs.music, sfx: prefs.sfx, running: !!ctx && ctx.state === "running", era: era, supported: !!AC }; },
    toggleMusic: function () { setMusic(!prefs.music); },
    toggleSounds: function () { setSfx(!prefs.sfx); }
  };
})();
