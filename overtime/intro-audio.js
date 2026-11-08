/* Intro music for the boot loader: original stadium-style loops, synthesised live with Web Audio (no audio files, nothing
   licensed). index.html creates/resumes the AudioContext inside the user's first tap or key (browsers refuse sound before
   that) and hands it to OTAudio.start(ctx, n). Each loop is a 2-bar build into an 8-bar drop, repeating; enter() lands a hit
   and fades out as the loader leaves. */
(function () {
  var ctx, out, rev, dly, sb, noise, timer = null, step = 0, nextT = 0, TR = null, vol = 0.5, muted = false, live = false;
  var mf = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  function setup(c) {
    ctx = c;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 8; comp.knee.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
    out = ctx.createGain(); out.gain.value = 0; out.connect(comp); comp.connect(ctx.destination);
    // arena reverb: generated decaying-noise impulse
    var len = Math.round(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
    rev = ctx.createConvolver(); rev.buffer = ir; var rg = ctx.createGain(); rg.gain.value = 0.32; rev.connect(rg); rg.connect(out);
    // dotted-eighth style delay for plucks/leads
    dly = ctx.createDelay(1); var fb = ctx.createGain(), dl = ctx.createGain(); fb.gain.value = 0.38; dl.gain.value = 0.28;
    dly.connect(fb); fb.connect(dly); dly.connect(dl); dl.connect(out);
    // synth bus with a sweepable low-pass (builds open it up)
    sb = ctx.createBiquadFilter(); sb.type = 'lowpass'; sb.frequency.value = 800; sb.Q.value = 0.8; sb.connect(out);
    var sbr = ctx.createGain(); sbr.gain.value = 0.25; sb.connect(sbr); sbr.connect(rev);
    var nl = ctx.sampleRate * 2; noise = ctx.createBuffer(1, nl, ctx.sampleRate); var nd = noise.getChannelData(0);
    for (i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
  }

  // ---- building blocks ----
  function env(t, a, peak, dec, dest, hold) { var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (hold) g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + (hold || 0) + dec); g.connect(dest); return g; }
  function wet(node, amt, to) { var g = ctx.createGain(); g.gain.value = amt; node.connect(g); g.connect(to || rev); }
  function nz(t, dur) { var s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s; }
  function osc(type, f, t, dur) { var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.05); return o; }
  function filt(type, f, q) { var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; }
  var curve = (function () { var c = new Float32Array(1024); for (var i = 0; i < 1024; i++) { var x = i / 511.5 - 1; c[i] = Math.tanh(3 * x); } return c; })();
  function drive() { var w = ctx.createWaveShaper(); w.curve = curve; w.oversample = '2x'; return w; }

  function kick(t, v, deep) { var o = osc('sine', deep ? 120 : 160, t, 0.6); o.frequency.exponentialRampToValueAtTime(deep ? 38 : 46, t + 0.13);
    o.connect(env(t, 0.002, v, deep ? 0.55 : 0.32, out)); var c = nz(t, 0.02), hp = filt('highpass', 3000); c.connect(hp); hp.connect(env(t, 0.001, v * 0.25, 0.015, out)); }
  function clap(t, v, w) { var s = nz(t, 0.3), bp = filt('bandpass', 1400, 1.2); s.connect(bp); var g = ctx.createGain(); bp.connect(g); g.connect(out); wet(g, w == null ? 0.7 : w);
    g.gain.setValueAtTime(0.0001, t); [0, 0.011, 0.022].forEach(function (d) { g.gain.setValueAtTime(v, t + d); g.gain.exponentialRampToValueAtTime(v * 0.2, t + d + 0.009); });
    g.gain.setValueAtTime(v * 0.9, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); }
  function snare(t, v) { var s = nz(t, 0.25), bp = filt('highpass', 1200); s.connect(bp); var g = env(t, 0.001, v, 0.16, out); bp.connect(g); wet(g, 0.5);
    var o = osc('triangle', 210, t, 0.12); o.frequency.exponentialRampToValueAtTime(150, t + 0.08); o.connect(env(t, 0.001, v * 0.6, 0.08, out)); }
  function hat(t, v, open) { var s = nz(t, open ? 0.3 : 0.06), hp = filt('highpass', 8500); s.connect(hp); hp.connect(env(t, 0.001, v, open ? 0.22 : 0.035, out)); }
  function crash(t, v) { var s = nz(t, 2.2), hp = filt('highpass', 5000); s.connect(hp); var g = env(t, 0.002, v, 2, out); hp.connect(g); wet(g, 0.6); }
  function tom(t, f, v) { var o = osc('sine', f * 1.7, t, 0.7); o.frequency.exponentialRampToValueAtTime(f, t + 0.09); var g = env(t, 0.003, v, 0.6, out); o.connect(g); wet(g, 0.55);
    var s = nz(t, 0.08), lp = filt('lowpass', 900); s.connect(lp); lp.connect(env(t, 0.001, v * 0.5, 0.06, out)); }
  function bass(t, m, dur, v, cut, dist) { var o = osc('sawtooth', mf(m), t, dur), o2 = osc('square', mf(m - 12), t, dur), lp = filt('lowpass', cut || 600, 4);
    lp.frequency.setValueAtTime((cut || 600) * 2.5, t); lp.frequency.exponentialRampToValueAtTime(cut || 600, t + Math.min(0.12, dur));
    var g2 = ctx.createGain(); g2.gain.value = 0.5; o.connect(lp); o2.connect(g2); g2.connect(lp);
    var g = env(t, 0.004, v, Math.max(0.05, dur - 0.004), out, 0); if (dist) { var w = drive(); lp.connect(w); w.connect(g); } else lp.connect(g); }
  function saws(t, m, dur, v, n, spread, dest, a) { var g = env(t, a || 0.005, v, dur, dest || sb);
    for (var i = 0; i < n; i++) { var o = osc('sawtooth', mf(m), t, dur + (a || 0.005)); o.detune.value = n > 1 ? (i / (n - 1) - 0.5) * 2 * spread : 0; o.connect(g); } return g; }
  function pluck(t, m, v) { var o = osc('square', mf(m), t, 0.3), lp = filt('lowpass', 4000, 6); lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.18);
    o.connect(lp); var g = env(t, 0.002, v, 0.22, out); lp.connect(g); g.connect(dly); }
  function brass(t, ms, dur, v) { ms.forEach(function (m) { var lp = filt('lowpass', 400, 2); lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.05);
    lp.frequency.exponentialRampToValueAtTime(1300, t + 0.05 + dur); var g = env(t, 0.025, v, dur, out); lp.connect(g); wet(g, 0.45);
    [-9, 9].forEach(function (dt) { var o = osc('sawtooth', mf(m) * 0.98, t, dur + 0.05); o.frequency.exponentialRampToValueAtTime(mf(m), t + 0.06); o.detune.value = dt; o.connect(lp); }); }); }
  function riser(t, dur, v) { var s = nz(t, dur), bp = filt('bandpass', 300, 3); bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    s.connect(bp); var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.04);
    bp.connect(g); g.connect(out); wet(g, 0.4); }
  function roar(t, dur, v) { var s = nz(t, dur), bp = filt('bandpass', 900, 0.7), lp = filt('lowpass', 2600); s.connect(bp); bp.connect(lp);
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(v * 0.6, t + dur); lp.connect(g); g.connect(out); wet(g, 0.8); }
  function hey(t, v) { var o = osc('sawtooth', 190, t, 0.3), s = nz(t, 0.3); o.frequency.linearRampToValueAtTime(160, t + 0.22); var g = env(t, 0.015, v, 0.2, out); wet(g, 1.2);
    [[730, 6], [1150, 7], [2400, 8]].forEach(function (f) { var b = filt('bandpass', f[0], f[1]); o.connect(b); s.connect(b); b.connect(g); }); }
  function open(t, f, dur) { sb.frequency.cancelScheduledValues(t); sb.frequency.setValueAtTime(sb.frequency.value || 400, t); sb.frequency.exponentialRampToValueAtTime(f, t + dur); }

  // ---- the loops: s = 16th of the bar, bar = bar in the 10-bar cycle (0-1 build, 2-9 drop), t = start time, d = 16th length ----
  var TRACKS = [
    { name: 'Chant', bpm: 128, play: function (bar, s, t, d) {
      var B = bar < 2, A = [[40, 0], [40, 3], [43, 6], [40, 8], [45, 10], [43, 12], [40, 14]], Bb = [[38, 0], [38, 3], [40, 6], [35, 8], [38, 12], [40, 14]];
      if (B) { if (s % 4 === 0) kick(t, 0.7 + bar * 0.15); if (bar === 1 && s >= 8 && s % 2 === 0) clap(t, 0.25 + s * 0.03, 0.4); if (s % 4 === 0) clap(t, 0.3, 0.3);
        if (s % 2 === 0) bass(t, 28, d * 1.6, 0.35, 220 + bar * 200 + s * 20, true); if (bar === 0 && s === 0) { riser(t, d * 32, 0.35); roar(t, d * 32, 0.12); }
        if (bar === 1 && s === 14) hey(t, 0.55); return; }
      var odd = bar % 2; if (s % 4 === 0) kick(t, 0.95); if (s === 4 || s === 12) clap(t, 0.65); if (s % 4 === 2) hat(t, 0.18, true);
      if (bar === 2 && s === 0) { crash(t, 0.35); roar(t, d * 64, 0.08); }
      (odd ? Bb : A).forEach(function (n) { if (n[1] === s) { bass(t, n[0], d * 1.8, 0.5, 700, true); if (bar >= 6) saws(t, n[0] + 24, d * 1.6, 0.1, 3, 14); } });
      if (odd && s === 12) hey(t, 0.6); if (bar === 9 && s >= 12) clap(t, 0.4 + (s - 12) * 0.1, 0.5); } },
    { name: 'Trance build', bpm: 138, play: function (bar, s, t, d) {
      var CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], c = CH[bar % 4], P = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2];
      var nt = P[s] === 3 ? c[0] + 12 : c[P[s]]; saws(t, nt + 12, d * 0.9, 0.09, 3, 18);
      if (bar < 2) { if (bar === 0 && s === 0) { open(t, 6000, d * 32); riser(t, d * 32, 0.3); kick(t, 0.8); }
        var roll = bar === 0 ? s % 4 === 0 : (s < 8 ? s % 2 === 0 : true); if (roll) snare(t, 0.12 + (bar * 16 + s) * 0.012); return; }
      if (bar === 2 && s === 0) { crash(t, 0.4); sb.frequency.cancelScheduledValues(t); sb.frequency.setValueAtTime(7000, t); }
      if (s % 4 === 0) kick(t, 1); if (s % 4 === 2) bass(t, c[0] - 24, d * 1.5, 0.55, 500); if (s === 4 || s === 12) clap(t, 0.5); hat(t, s % 4 === 2 ? 0.2 : 0.07, s % 4 === 2);
      if (s === 0) saws(t, c[0] - 12, d * 15, 0.035, 5, 25, sb, 0.08); if (bar === 9 && s >= 8) snare(t, 0.15 + (s - 8) * 0.04); } },
    { name: 'Horns', bpm: 120, play: function (bar, s, t, d) {
      var CH = [[50, 53, 57], [50, 53, 57], [46, 50, 53], [48, 52, 55]], c = CH[Math.floor((bar - 2) / 2) % 4] || CH[0], ST = [0, 3, 6, 10, 12];
      if (bar < 2) { if (s % 2 === 0) tom(t, 70 + (s % 8 === 0 ? 0 : 20), 0.2 + (bar * 16 + s) * 0.018); if (s === 0) brass(t, [38, 50], d * 15, 0.08 + bar * 0.06);
        if (bar === 0 && s === 0) riser(t, d * 32, 0.25); if (bar === 1 && s === 12) brass(t, [50, 53, 57, 62], d * 3, 0.16); return; }
      if (bar === 2 && s === 0) crash(t, 0.4); if (s === 0 || s === 10) kick(t, 1, true); if (s === 4 || s === 12) { snare(t, 0.45); clap(t, 0.3, 0.9); }
      if (ST.indexOf(s) >= 0) { brass(t, c.concat([c[0] + 12]), d * (s === 12 ? 3 : 1.6), 0.13); bass(t, c[0] - 24, d * 1.6, 0.5, 400, true); }
      if (s >= 14) tom(t, s === 14 ? 110 : 85, 0.45); hat(t, s % 2 ? 0.05 : 0.11); } },
    { name: 'Pulse', bpm: 124, play: function (bar, s, t, d) {
      var M = [66, 0, 73, 0, 69, 0, 66, 64, 66, 0, 73, 76, 73, 0, 69, 0], CH = [[54, 57, 61], [50, 54, 57], [57, 61, 64], [52, 56, 59]], c = CH[(bar - 2 + 4) % 4];
      if (bar < 2) { if (s === 0 || s === 3) kick(t, 0.75, true); if (s % 2 === 0) bass(t, 30, d * 1.6, 0.3 + bar * 0.1, 160 + (bar * 16 + s) * 18);
        if (M[s] && bar === 1) pluck(t, M[s], 0.12); if (bar === 0 && s === 0) { riser(t, d * 32, 0.3); var o = osc('sawtooth', 110, t, d * 32); o.frequency.exponentialRampToValueAtTime(880, t + d * 32);
          var lp = filt('lowpass', 1200); o.connect(lp); var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + d * 32); g.gain.linearRampToValueAtTime(0, t + d * 32 + 0.03); lp.connect(g); g.connect(out); }
        return; }
      if (bar === 2 && s === 0) crash(t, 0.35); if (s % 4 === 0) kick(t, 1); else bass(t, c[0] - 24, d * 0.9, 0.42, 380 + (s % 4) * 120);
      if (s % 4 === 2) hat(t, 0.17, true); if (s === 4 || s === 12) clap(t, 0.45); if (M[s]) pluck(t, M[s] + (bar >= 6 ? 12 : 0), 0.13);
      if (s === 0) saws(t, c[0], d * 3, 0.05, 3, 16, out, 0.01); } }
  ];

  function tick() { var d = 60 / TR.bpm / 4; while (nextT < ctx.currentTime + 0.12) { var bar = Math.floor(step / 16) % 10;
      TR.play(bar, step % 16, nextT, d); nextT += d; step++; } }
  function stop() { clearInterval(timer); timer = null; live = false; }
  function level(t, to, ramp) { out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(to, t + ramp); }

  window.OTAudio = {
    tracks: TRACKS.map(function (x) { return x.name; }),
    start: function (c, n) { if (!c) return; if (!ctx) setup(c); if (live) stop(); TR = TRACKS[(n || 0) % TRACKS.length] || TRACKS[0]; step = 0; nextT = ctx.currentTime + 0.06;
      sb.frequency.cancelScheduledValues(0); sb.frequency.value = 800; live = true; level(ctx.currentTime, muted ? 0 : vol, 0.05); tick(); timer = setInterval(tick, 25); },
    mute: function (m) { muted = !!m; if (ctx) level(ctx.currentTime, muted ? 0 : vol, 0.15); },
    // the loader is leaving: one big hit on the next 16th, then the music fades out under the app
    enter: function () { if (!ctx || !live) return; var t = Math.max(nextT, ctx.currentTime + 0.02); stop();
      if (!muted) { kick(t, 1.2, true); crash(t, 0.5); roar(t, 1.4, 0.16); level(t, vol, 0.01); out.gain.setValueAtTime(vol, t + 0.3); out.gain.linearRampToValueAtTime(0, t + 2.6); } },
    stop: stop
  };
  if (window.OTAudioReady) window.OTAudioReady();
})();
