/* Image treatments, 3D scenes, home rotation and sliders for the portfolio.
   Markup declares what it wants with data attributes; this file wires it up. */
(function () {
  'use strict';

  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = function () { return Math.min(window.devicePixelRatio || 1, 2); };
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  };

  /* ---------- Processed / raw switch (one setting for the whole site) ---------- */
  var explicit = false;
  /* Footage with data-fx="plain" is shown as is; nothing is stored in the browser. */
  var raw = false;
  var rawListeners = [];
  function syncRawButtons() {
    var bs = document.querySelectorAll('[data-raw]');
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', ((bs[i].getAttribute('data-raw') === '1') === raw) ? 'true' : 'false');
  }
  function setRaw(v, src) {
    raw = !!v; explicit = true; syncRawButtons();
    rawListeners.forEach(function (f) { f(raw, src); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-raw]') : null;
    if (b) setRaw(b.getAttribute('data-raw') === '1', 'user');
  });

  /* ---------- Shared render loop ---------- */
  var live = [];
  function loop(t) {
    if (!document.hidden) for (var i = 0; i < live.length; i++) { var r = live[i]; if (r.visible && r.enabled) r.frame(t); }
    window.requestAnimationFrame(loop);
  }
  window.requestAnimationFrame(loop);
  function watch(el, r) {
    if (!('IntersectionObserver' in window)) { r.visible = true; return; }
    new IntersectionObserver(function (es) { es.forEach(function (e) { r.visible = e.isIntersecting; if (r.onVis) r.onVis(r.visible); }); }, { rootMargin: '120px' }).observe(el);
  }
  function fit(canvas, scale) {
    var b = canvas.getBoundingClientRect();
    if (!b.width || !b.height) return null;
    var W = Math.max(1, Math.round(b.width * scale)), H = Math.max(1, Math.round(b.height * scale));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    return { w: b.width, h: b.height, W: W, H: H };
  }
  function pointer(box, r) {
    box.addEventListener('pointermove', function (e) { var b = box.getBoundingClientRect(); r.mouse = { x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }; });
    box.addEventListener('pointerleave', function () { r.mouse = null; });
  }
  var B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var B8 = [0, 48, 12, 60, 3, 51, 15, 63, 32, 16, 44, 28, 35, 19, 47, 31, 8, 56, 4, 52, 11, 59, 7, 55, 40, 24, 36, 20, 43, 27, 39, 23, 2, 50, 14, 62, 1, 49, 13, 61, 34, 18, 46, 30, 33, 17, 45, 29, 10, 58, 6, 54, 9, 57, 5, 53, 42, 26, 38, 22, 41, 25, 37, 21];
  var CHAR = [[10, 10, 11], [43, 42, 40], [115, 110, 102], [224, 219, 207]];
  var INK = [[25, 27, 25], [130, 131, 126], [236, 234, 227]];

  /* ---------- Footage: dither, ink or ASCII over a looping video ---------- */
  function footage(box) {
    var canvas = box.querySelector('canvas'), video = box.querySelector('video');
    if (!canvas || !video) return null;
    var mode = box.getAttribute('data-fx') || 'charcoal';
    var target = box.getAttribute('data-target') || '';
    var autoAt = box.hasAttribute('data-auto-raw') ? parseFloat(box.getAttribute('data-auto-raw')) : null;
    var ctx = canvas.getContext('2d');
    var off = document.createElement('canvas'), octx = off.getContext('2d', { willReadFrequently: true });
    var r = { visible: false, enabled: true, mouse: null, last: 0, lo: null, hi: null, mix: raw ? 1 : 0, auto: autoAt !== null, video: video };
    video.muted = true; video.loop = true; video.playsInline = true; video.setAttribute('playsinline', '');
    if (!video.getAttribute('src') && video.getAttribute('data-src')) { video.preload = 'auto'; }
    function load() { if (!video.getAttribute('src') && video.getAttribute('data-src')) video.setAttribute('src', video.getAttribute('data-src')); }
    function play() { load(); if (RM) return; var p = video.play(); if (p && p.catch) p.catch(function () {}); }
    r.play = play;
    r.warm = function () { video.preload = 'auto'; load(); };
    r.onVis = function (v) { if (v && r.enabled) play(); else video.pause(); };
    r.setEnabled = function (v) { r.enabled = v; if (v && r.visible) play(); else video.pause(); };
    if (RM) {
      load();
      video.addEventListener('loadeddata', function () { try { video.currentTime = Math.min(5, (video.duration || 10) / 2); } catch (e) {} });
      video.addEventListener('seeked', function () { draw(); });
      box.addEventListener('click', function () { if (video.paused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); } else video.pause(); });
    }
    rawListeners.push(function (v, src) { if (src === 'user') r.auto = false; if (!r.auto) r.mix = v ? 1 : 0; draw(); });
    pointer(box, r);

    function levels(d, N, step) {
      var lo = 1, hi = 0;
      for (var p = 0; p < N; p += step) { var q = p * 4, l = (0.299 * d[q] + 0.587 * d[q + 1] + 0.114 * d[q + 2]) / 255; if (l < lo) lo = l; if (l > hi) hi = l; }
      if (r.lo === null) { r.lo = lo; r.hi = hi; } else { r.lo += (lo - r.lo) * 0.1; r.hi += (hi - r.hi) * 0.1; }
      return Math.max(0.2, r.hi - r.lo);
    }
    function crop(f) {
      var vw = video.videoWidth || 16, vh = video.videoHeight || 9;
      var s = Math.max(f.w / vw, f.h / vh), sw = f.w / s, sh = f.h / s;
      return [(vw - sw) / 2, (vh - sh) / 2, sw, sh];
    }
    function dither(f, c, palette, bayer, bits) {
      var px = mode === 'ink' ? 2 : 2, ow = Math.max(8, Math.round(f.w / px)), oh = Math.max(8, Math.round(f.h / px));
      if (off.width !== ow || off.height !== oh) { off.width = ow; off.height = oh; }
      octx.drawImage(video, c[0], c[1], c[2], c[3], 0, 0, ow, oh);
      var img; try { img = octx.getImageData(0, 0, ow, oh); } catch (e) { ctx.drawImage(video, c[0], c[1], c[2], c[3], 0, 0, f.W, f.H); return; }
      var d = img.data, N = ow * oh, span = levels(d, N, 11), n = palette.length - 1;
      for (var y = 0; y < oh; y++) for (var x = 0; x < ow; x++) {
        var q = (y * ow + x) * 4;
        var l = ((0.299 * d[q] + 0.587 * d[q + 1] + 0.114 * d[q + 2]) / 255 - r.lo) / span;
        l = (l < 0 ? 0 : l > 1 ? 1 : l) * n;
        var b = Math.floor(l), th = bits === 8 ? (bayer[((y & 7) << 3) | (x & 7)] + 0.5) / 64 : (bayer[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
        var P = palette[Math.min(n, b + ((l - b) > th ? 1 : 0))];
        d[q] = P[0]; d[q + 1] = P[1]; d[q + 2] = P[2]; d[q + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, f.W, f.H);
    }
    function ascii(f, c, soft) {
      var cw = f.w < 600 ? 5 : 6, chh = Math.round(cw * 1.7), cols = Math.floor(f.w / cw), rows = Math.floor(f.h / chh), dpr = f.W / f.w;
      if (off.width !== cols || off.height !== rows) { off.width = cols; off.height = rows; }
      octx.drawImage(video, c[0], c[1], c[2], c[3], 0, 0, cols, rows);
      var d; try { d = octx.getImageData(0, 0, cols, rows).data; } catch (e) { ctx.drawImage(video, c[0], c[1], c[2], c[3], 0, 0, f.W, f.H); return; }
      var ramp = ' .,:;=+*#%@', n = ramp.length - 1, N = cols * rows, lv = new Uint8Array(N), span = levels(d, N, 5);
      for (var p = 0; p < N; p++) { var q = p * 4, l = ((0.299 * d[q] + 0.587 * d[q + 1] + 0.114 * d[q + 2]) / 255 - r.lo) / span; l = l < 0 ? 0 : l > 1 ? 1 : l; lv[p] = Math.round(Math.pow(l, 0.85) * n); }
      if (soft) { ctx.globalAlpha = 0.42; ctx.drawImage(video, c[0], c[1], c[2], c[3], 0, 0, f.W, f.H); ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(10,10,11,0.35)'; ctx.fillRect(0, 0, f.W, f.H); }
      ctx.font = (cw * 1.62 * dpr) + 'px "IBM Plex Mono", ui-monospace, monospace'; ctx.textBaseline = 'top';
      for (var k = 1; k <= n; k++) {
        var t = k / n;
        ctx.fillStyle = 'rgb(' + Math.round(44 + 192 * t) + ',' + Math.round(44 + 187 * t) + ',' + Math.round(42 + 178 * t) + ')';
        for (var yy = 0; yy < rows; yy++) {
          var line = '', any = false;
          for (var xx = 0; xx < cols; xx++) { if (lv[yy * cols + xx] === k) { line += ramp[k]; any = true; } else line += ' '; }
          if (any) ctx.fillText(line, 0, yy * chh * dpr);
        }
      }
    }
    function overlay(f, c) {
      var m = r.mouse; if (!m || !target) return;
      var dpr = f.W / f.w, accent = mode === 'ink' ? '#9A4A0C' : '#E8A13A';
      ctx.save();
      if (target === 'loupe') {
        var R = Math.min(110, f.w * 0.16) * dpr;
        ctx.beginPath(); ctx.arc(m.x * dpr, m.y * dpr, R, 0, Math.PI * 2); ctx.clip();
        ctx.imageSmoothingEnabled = true; ctx.drawImage(video, c[0], c[1], c[2], c[3], 0, 0, f.W, f.H); ctx.restore();
        ctx.strokeStyle = accent; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.arc(m.x * dpr, m.y * dpr, R, 0, Math.PI * 2); ctx.stroke();
      } else {
        var tw = Math.min(300, f.w * 0.36), th = tw * 0.63;
        var x0 = Math.min(f.w - tw - 6, Math.max(6, m.x - tw / 2)), y0 = Math.min(f.h - th - 6, Math.max(6, m.y - th / 2));
        var X = x0 * dpr, Y = y0 * dpr, Wt = tw * dpr, Ht = th * dpr, L = 16 * dpr;
        ctx.beginPath(); ctx.rect(X, Y, Wt, Ht); ctx.clip();
        ctx.imageSmoothingEnabled = true; ctx.drawImage(video, c[0], c[1], c[2], c[3], 0, 0, f.W, f.H); ctx.restore();
        ctx.strokeStyle = accent; ctx.lineWidth = 1.5 * dpr; ctx.beginPath();
        ctx.moveTo(X, Y + L); ctx.lineTo(X, Y); ctx.lineTo(X + L, Y); ctx.moveTo(X + Wt - L, Y); ctx.lineTo(X + Wt, Y); ctx.lineTo(X + Wt, Y + L);
        ctx.moveTo(X + Wt, Y + Ht - L); ctx.lineTo(X + Wt, Y + Ht); ctx.lineTo(X + Wt - L, Y + Ht); ctx.moveTo(X + L, Y + Ht); ctx.lineTo(X, Y + Ht); ctx.lineTo(X, Y + Ht - L);
        ctx.stroke();
      }
    }
    function draw() {
      var f = fit(canvas, DPR()); if (!f) return;
      var bg = mode === 'ink' ? '#ECEAE3' : '#0B0C0B';
      if (video.readyState < 2) { ctx.fillStyle = bg; ctx.fillRect(0, 0, f.W, f.H); return; }
      var c = crop(f);
      if (r.auto && !raw) {
        var want = (video.currentTime >= autoAt && video.currentTime < (video.duration || 99) - 0.15) ? 1 : 0;
        r.mix += (want - r.mix) * (want ? 0.09 : 0.25);
        if (Math.abs(want - r.mix) < 0.01) r.mix = want;
      } else r.mix = (raw || mode === 'plain') ? 1 : 0;
      if (r.mix < 1) {
        if (mode === 'ascii' || mode === 'ascii-soft') { ctx.fillStyle = bg; ctx.fillRect(0, 0, f.W, f.H); ascii(f, c, mode === 'ascii-soft'); }
        else if (mode === 'ink') dither(f, c, INK, B8, 8);
        else dither(f, c, CHAR, B4, 4);
      }
      if (r.mix > 0) { ctx.globalAlpha = r.mix; ctx.imageSmoothingEnabled = true; ctx.drawImage(video, c[0], c[1], c[2], c[3], 0, 0, f.W, f.H); ctx.globalAlpha = 1; }
      if (r.mix < 1) overlay(f, c);
    }
    r.frame = function (t) { var gap = (mode === 'ascii' || mode === 'ascii-soft') ? 40 : 30; if (t - r.last < gap) return; r.last = t; draw(); };
    watch(box, r);
    live.push(r);
    return r;
  }

  /* ---------- Still image through the same treatments ---------- */
  function still(box) {
    var canvas = box.querySelector('canvas'), img = box.querySelector('img.src');
    if (!canvas || !img) return null;
    var ctx = canvas.getContext('2d'), off = document.createElement('canvas'), octx = off.getContext('2d', { willReadFrequently: true });
    function draw() {
      var f = fit(canvas, DPR()); if (!f || !img.complete || !img.naturalWidth) return;
      var s = Math.max(f.w / img.naturalWidth, f.h / img.naturalHeight), sw = f.w / s, sh = f.h / s, cx = (img.naturalWidth - sw) / 2, cy = (img.naturalHeight - sh) / 2;
      if (raw && explicit) { ctx.imageSmoothingEnabled = true; ctx.drawImage(img, cx, cy, sw, sh, 0, 0, f.W, f.H); return; }
      var ow = Math.round(f.w / 2), oh = Math.round(f.h / 2);
      off.width = ow; off.height = oh; octx.drawImage(img, cx, cy, sw, sh, 0, 0, ow, oh);
      var im; try { im = octx.getImageData(0, 0, ow, oh); } catch (e) { ctx.drawImage(img, cx, cy, sw, sh, 0, 0, f.W, f.H); return; }
      var d = im.data, N = ow * oh, lo = 1, hi = 0;
      for (var p = 0; p < N; p += 7) { var q = p * 4, l = (0.299 * d[q] + 0.587 * d[q + 1] + 0.114 * d[q + 2]) / 255; if (l < lo) lo = l; if (l > hi) hi = l; }
      var span = Math.max(0.2, hi - lo), invert = box.getAttribute('data-invert') === '1';
      for (var y = 0; y < oh; y++) for (var x = 0; x < ow; x++) {
        var k = (y * ow + x) * 4, v = ((0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]) / 255 - lo) / span;
        v = v < 0 ? 0 : v > 1 ? 1 : v; if (invert) v = 1 - v; v *= 3;
        var b = Math.floor(v), P = CHAR[Math.min(3, b + ((v - b) > (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16 ? 1 : 0))];
        d[k] = P[0]; d[k + 1] = P[1]; d[k + 2] = P[2]; d[k + 3] = 255;
      }
      octx.putImageData(im, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, f.W, f.H);
    }
    if (img.complete) draw(); else img.addEventListener('load', draw);
    rawListeners.push(draw);
    window.addEventListener('resize', draw);
    return { visible: true, enabled: true, setEnabled: function () {}, frame: function () {} };
  }

  /* ---------- WebGL scenes: the cochlea and the arm ---------- */
  function program(gl, fs) {
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var v = sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return pr;
  }
  var cache = {};
  function getText(url) { return cache[url] || (cache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.text(); })); }
  function getJSON(url) { return cache[url] || (cache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); })); }

  function scene(box) {
    var kind = box.getAttribute('data-scene'), canvas = box.querySelector('canvas');
    var r = { visible: false, enabled: true, mouse: null, sm: [0.6, 0.55], t0: performance.now(), ready: false, kind: kind };
    r.setEnabled = function (v) { r.enabled = v; };
    r.time = function () { return (performance.now() - r.t0) / 1000; };
    var gl = canvas && canvas.getContext('webgl', { antialias: false });
    if (!gl) { box.classList.add('no-gl'); return r; }
    pointer(box, r);
    var base = box.getAttribute('data-base') || '';
    var shotsAttr = (box.getAttribute('data-shots') || '0').split(',').map(Number);
    var shift = parseFloat(box.getAttribute('data-shift') || '0');
    var px = parseFloat(box.getAttribute('data-pixel') || '2');
    var u = {}, arm = null;
    var shaderUrl = base + 'Assets/site/shaders/' + kind + '.glsl';
    var need = [getText(shaderUrl)];
    if (kind === 'arm') need.push(getJSON(base + 'Assets/site/data/arm-paths.json'));
    Promise.all(need).then(function (res) {
      var pr = program(gl, res[0]); if (!pr) { box.classList.add('no-gl'); return; }
      ['uRes', 'uT', 'uM', 'uFog', 'uShot', 'uShift', 'uRaw', 'uK', 'uJ[0]', 'uA[0]', 'uTex'].forEach(function (n) { u[n] = gl.getUniformLocation(pr, n); });
      if (kind === 'arm') {
        arm = { paths: res[1].paths, k: 0, cur: 0, f: 0, K: 18, H0: 0.9 };
        arm.base = document.createElement('canvas'); arm.base.width = arm.base.height = 1024;
        arm.tex2d = document.createElement('canvas'); arm.tex2d.width = arm.tex2d.height = 1024;
        drawArmBase(arm);
        arm.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, arm.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        var cap = box.parentNode && box.parentNode.querySelector('[data-arm-path]');
        arm.label = cap;
      }
      r.ready = true;
      if (RM) { r.frame(performance.now()); r.enabled = false; }
    }).catch(function () { box.classList.add('no-gl'); });
    r.frame = function () {
      if (!r.ready) return;
      var f = fit(canvas, 1 / px); if (!f) return;
      var t = r.time();
      var tgt = r.mouse ? [r.mouse.x / r.mouse.w, 1 - r.mouse.y / r.mouse.h] : [0.6 + 0.12 * Math.sin(t / 4), 0.55];
      r.sm[0] += (tgt[0] - r.sm[0]) * 0.08; r.sm[1] += (tgt[1] - r.sm[1]) * 0.08;
      gl.viewport(0, 0, f.W, f.H);
      gl.uniform2f(u.uRes, f.W, f.H); gl.uniform1f(u.uT, t); gl.uniform2f(u.uM, r.sm[0], r.sm[1]); gl.uniform1f(u.uFog, 1);
      gl.uniform1f(u.uRaw, raw && explicit ? 1 : 0);
      var narrow = f.w < 700;
      if (kind === 'arm') armFrame(gl, u, arm);
      else {
        var shot = shotsAttr[Math.floor(t / 10) % shotsAttr.length];
        gl.uniform1f(u.uShot, shot); gl.uniform1f(u.uShift, narrow ? 0 : (shot === 1 ? shift * 0.6 : shift));
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    watch(box, r);
    live.push(r);
    return r;
  }
  function uv(x, y) { return [(x + 0.55) / 1.1 * 1024, (y + 0.55) / 1.1 * 1024]; }
  function drawArmBase(A) {
    var g = A.base.getContext('2d'), N = 1024, s = N / 1.1, o = uv(0, 0);
    g.fillStyle = 'rgb(46,0,0)'; g.fillRect(0, 0, N, N);
    g.beginPath(); g.moveTo(o[0], o[1]); g.arc(o[0], o[1], 0.46 * s, -110 * Math.PI / 180, 110 * Math.PI / 180); g.closePath();
    g.arc(o[0], o[1], 0.147 * s, 110 * Math.PI / 180, -110 * Math.PI / 180, true); g.fillStyle = 'rgb(92,0,0)'; g.fill('evenodd');
    g.strokeStyle = 'rgb(150,0,0)'; g.lineWidth = 3;
    for (var rr = 0.1; rr <= 0.41; rr += 0.1) { g.beginPath(); g.arc(o[0], o[1], rr * s, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgb(200,0,0)'; g.font = '600 26px "IBM Plex Mono", monospace';
    for (var k = 1; k <= 4; k++) g.fillText(k * 100 + ' mm', o[0] + k * 0.1 * s + 6, o[1] - 8);
    g.lineWidth = 3; g.strokeStyle = 'rgb(120,0,0)';
    A.paths.forEach(function (p) { g.beginPath(); p.path.forEach(function (q, i) { var w = uv(q[0], q[1]); if (i) g.lineTo(w[0], w[1]); else g.moveTo(w[0], w[1]); }); g.stroke(); });
  }
  function armFrame(gl, u, A) {
    var P = A.paths[A.cur], n = P.frames.length;
    A.k += RM ? 0 : 0.55;
    if (RM) A.k = n - 1;
    if (A.k > n + 50) { A.k = 0; A.cur = (A.cur + 1) % A.paths.length; }
    var k = Math.min(n - 1, Math.floor(A.k));
    if (A.label) A.label.textContent = P.name.length === 1 ? 'Held-out letter ' + P.name : 'Held-out ' + P.name.toLowerCase();
    if ((A.f++ % 2) === 0) {
      var g = A.tex2d.getContext('2d'); g.drawImage(A.base, 0, 0);
      g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = 'rgb(255,0,0)'; g.setLineDash([12, 12]);
      g.beginPath(); P.path.forEach(function (q, j) { var w = uv(q[0], q[1]); if (j) g.lineTo(w[0], w[1]); else g.moveTo(w[0], w[1]); }); g.stroke(); g.setLineDash([]);
      g.strokeStyle = 'rgb(240,255,0)'; g.lineWidth = 9; g.beginPath();
      for (var j = 40; j <= k; j++) { var tp = P.frames[j][6], w = uv(tp[0], tp[1]); if (j > 40) g.lineTo(w[0], w[1]); else g.moveTo(w[0], w[1]); }
      g.stroke();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, A.tex2d); gl.generateMipmap(gl.TEXTURE_2D);
    }
    var J = [], AX = [];
    P.frames[k].forEach(function (q) { J.push(q[0] * A.K, q[2] * A.K + A.H0, -q[1] * A.K); });
    P.axes[k].forEach(function (a) { AX.push(a[0], a[2], -a[1]); });
    gl.uniform1f(u.uK, A.K); gl.uniform3fv(u['uJ[0]'], new Float32Array(J)); gl.uniform3fv(u['uA[0]'], new Float32Array(AX)); gl.uniform1i(u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.tex);
  }

  /* ---------- Home: rotating hero ---------- */
  function rotator(root) {
    var layers = [].slice.call(root.querySelectorAll('.layer'));
    var caps = [].slice.call(root.querySelectorAll('[data-cap]'));
    var dots = [].slice.call(root.querySelectorAll('[data-go]'));
    var pauseBtn = root.querySelector('[data-pause]');
    var rs = layers.map(function (l) { return l._fx; });
    var i = 0, timer = null, paused = RM;
    function show(n) {
      i = (n + layers.length) % layers.length;
      layers.forEach(function (l, k) { l.classList.toggle('on', k === i); l.setAttribute('aria-hidden', k === i ? 'false' : 'true'); if (rs[k]) rs[k].setEnabled(k === i); });
      caps.forEach(function (c, k) { c.hidden = k !== i; });
      var nx = rs[(i + 1) % layers.length]; if (nx && nx.warm) nx.warm();
      dots.forEach(function (d, k) { d.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    }
    function arm() { clearInterval(timer); if (!paused) timer = setInterval(function () { show(i + 1); }, 11000); }
    dots.forEach(function (d) { d.addEventListener('click', function () { show(parseInt(d.getAttribute('data-go'), 10)); arm(); }); });
    if (pauseBtn) {
      pauseBtn.textContent = paused ? 'Play' : 'Pause';
      pauseBtn.addEventListener('click', function () { paused = !paused; pauseBtn.textContent = paused ? 'Play' : 'Pause'; arm(); });
    }
    show(0); arm();
  }

  /* ---------- Projects and research: one scene per slide ---------- */
  function slider(root) {
    var slides = [].slice.call(root.querySelectorAll('.slide'));
    var dots = [].slice.call(root.querySelectorAll('[data-slide]'));
    var live2 = root.querySelector('[data-live]');
    var sheet = document.querySelector('[data-sheet]');
    var i = 0, lastWheel = 0, startX = null;
    function rs(k) { var f = slides[k].querySelector('.fx'); return f ? f._fx : null; }
    function show(n, fromHash) {
      var prev = i; i = Math.max(0, Math.min(slides.length - 1, n));
      slides.forEach(function (s, k) {
        s.style.transform = 'translateX(' + ((k - i) * 100) + '%)';
        s.classList.toggle('on', k === i);
        s.setAttribute('aria-hidden', k === i ? 'false' : 'true');
        if ('inert' in s) s.inert = k !== i;
        var r = rs(k); if (r) r.setEnabled(k === i || k === prev);
      });
      setTimeout(function () { var r = rs(prev); if (r && prev !== i) r.setEnabled(false); }, 900);
      dots.forEach(function (d, k) { d.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      var s = slides[i];
      if (sheet && s.getAttribute('data-sheet')) sheet.textContent = 'Sheet ' + s.getAttribute('data-sheet');
      if (live2) live2.textContent = (i + 1) + ' of ' + slides.length + ': ' + (s.getAttribute('data-name') || '');
      if (!fromHash && s.id) { try { history.replaceState(null, '', '#' + s.id); } catch (e) {} }
    }
    root.querySelector('[data-prev]').addEventListener('click', function () { show(i - 1); });
    root.querySelector('[data-next]').addEventListener('click', function () { show(i + 1 < slides.length ? i + 1 : 0); });
    dots.forEach(function (d) { d.addEventListener('click', function () { show(parseInt(d.getAttribute('data-slide'), 10)); }); });
    root.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('input,textarea')) return;
      if (e.key === 'ArrowRight') { show(i + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { show(i - 1); e.preventDefault(); }
    });
    var stage = root.querySelector('.slides');
    stage.addEventListener('wheel', function (e) {
      if (window.innerWidth < 861) return;
      var dd = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (Math.abs(dd) < 20) return;
      e.preventDefault();
      var now = performance.now(); if (now - lastWheel < 900) return; lastWheel = now; show(i + (dd > 0 ? 1 : -1));
    }, { passive: false });
    stage.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') startX = e.clientX; });
    stage.addEventListener('pointerup', function (e) { if (startX === null) return; var dx = e.clientX - startX; startX = null; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); });
    var h = (location.hash || '').slice(1), start = 0;
    slides.forEach(function (s, k) { if (s.id && s.id === h) start = k; });
    show(start, true);
  }

  /* ---------- Research: impedance monitor (illustrative) ---------- */
  function monitor(el) {
    var sceneBox = document.querySelector(el.getAttribute('data-sync'));
    var c = el.querySelector('canvas'), depth = el.querySelector('[data-depth]'), phase = el.querySelector('[data-phase]');
    var buf = [[], [], [], []], last = 0, prev = 0;
    var r = { visible: false, enabled: true, setEnabled: function () {} };
    r.frame = function (t) {
      if (t - last < 50) return; last = t;
      var sr = sceneBox && sceneBox._fx; var tt = sr ? sr.time() : t / 1000;
      var ins = (0.5 + 0.5 * Math.sin(tt * 0.22 - 1.2)) * 9.4, deg = ins * 180 / Math.PI;
      for (var k = 0; k < 4; k++) {
        var th = 30 + k * 80, v = null;
        if (deg > th) { var prox = 0.5 + 0.5 * Math.sin(deg * 0.031 + k * 1.7); v = 3.0 + 0.35 * k + 1.6 * Math.pow(prox, 3) + 0.12 * Math.sin(tt * 9 + k) + (Math.random() - 0.5) * 0.12; }
        buf[k].push(v); if (buf[k].length > 240) buf[k].shift();
      }
      if (depth) depth.textContent = Math.round(deg) + '°';
      if (phase) phase.textContent = deg > prev + 0.3 ? 'Advancing' : (deg < prev - 0.3 ? 'Retracting' : 'Holding');
      prev = deg;
      var f = fit(c, DPR()); if (!f) return;
      var g = c.getContext('2d'), dpr = f.W / f.w; g.clearRect(0, 0, f.W, f.H);
      var pad = 12 * dpr, lane = (f.H - pad * 2) / 4, names = ['E1–E2', 'E3–E4', 'E5–E6', 'E7–E8'];
      g.font = (10 * dpr) + 'px "IBM Plex Mono", monospace';
      for (var j = 0; j < 4; j++) {
        var y0 = pad + j * lane, yb = y0 + lane - 6 * dpr, b = buf[j], nb = b.length, lastV = b[nb - 1];
        g.strokeStyle = '#2A2927'; g.lineWidth = dpr; g.beginPath(); g.moveTo(pad, yb); g.lineTo(f.W - pad, yb); g.stroke();
        g.fillStyle = '#A7A39A'; g.fillText(names[j], pad, y0 + 11 * dpr);
        var txt = lastV == null ? 'not inserted' : lastV.toFixed(2) + ' kΩ';
        g.fillStyle = lastV == null ? '#6E6B66' : '#E8E3D8'; g.fillText(txt, f.W - pad - g.measureText(txt).width, y0 + 11 * dpr);
        g.strokeStyle = j === 0 ? '#E8A13A' : '#D8D3C8'; g.lineWidth = 1.4 * dpr; g.beginPath();
        var pen = false;
        for (var i2 = 0; i2 < nb; i2++) { var vv = b[i2], x = pad + (f.W - 2 * pad) * (i2 / 239); if (vv == null) { pen = false; continue; } var y = yb - ((vv - 2.6) / 3.2) * (lane - 22 * dpr); if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; } }
        g.stroke();
      }
    };
    watch(el, r); live.push(r);
  }

  /* ---------- Mech: home-return accuracy drawing (static) ---------- */
  function accuracy(el) {
    var c = el.querySelector('canvas');
    function draw() {
      var f = fit(c, DPR()); if (!f) return;
      var g = c.getContext('2d'), s = f.W / f.w, W = f.w, H = f.h;
      g.setTransform(s, 0, 0, s, 0, 0); g.clearRect(0, 0, W, H);
      var ink = '#191B19', dim = '#565A54', acc = '#9A4A0C';
      var cx = W / 2, R = Math.min(H * 1.25, W * 0.62), cy = H * 0.16 + R, span = 2 * Math.asin(Math.min(0.92, (W * 0.42) / R)), lim = 40;
      var ang = function (v) { return -Math.PI / 2 + (v / lim) * (span / 2); };
      var P = function (v, rr) { var a = ang(v); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; };
      g.lineWidth = 1; g.strokeStyle = ink;
      g.beginPath(); g.arc(cx, cy, R, ang(-lim), ang(lim)); g.stroke();
      g.font = '11px "IBM Plex Mono", monospace'; g.fillStyle = dim; g.textAlign = 'center';
      for (var v = -lim; v <= lim; v++) {
        var L = v % 10 === 0 ? 16 : (v % 5 === 0 ? 10 : 5), a = P(v, R), b = P(v, R - L);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        if (v % 10 === 0) { var tl = P(v, R + 16); g.fillText((v > 0 ? '+' : '') + v + '″', tl[0], tl[1]); }
      }
      function band(half, rr, w, col, label) {
        g.lineWidth = w; g.strokeStyle = col; g.beginPath(); g.arc(cx, cy, rr, ang(-half), ang(half)); g.stroke();
        g.lineWidth = 1; g.strokeStyle = col;
        [-half, half].forEach(function (hv) { var a1 = P(hv, rr - 14), a2 = P(hv, rr + 14); g.beginPath(); g.moveTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]); g.stroke(); });
        var tp = P(0, rr - 22); g.fillStyle = col; g.font = '500 12px "IBM Plex Mono", monospace'; g.fillText(label, tp[0], tp[1]);
      }
      band(32.5, R - 46, 7, '#8E8F8A', 'BEFORE: 65″');
      band(3, R - 92, 7, acc, 'AFTER: 6″');
      var r1 = P(-1.8, R - 128), r2 = P(1.8, R - 128);
      g.strokeStyle = ink; g.lineWidth = 1; g.beginPath(); g.moveTo(r1[0], r1[1]); g.lineTo(r2[0], r2[1]); g.stroke();
      var rl = P(0, R - 146); g.fillStyle = ink; g.font = '11px "IBM Plex Mono", monospace'; g.fillText('0.001° = 3.6″ RESOLUTION', rl[0], rl[1]);
      g.textAlign = 'left'; g.fillStyle = dim; g.fillText('HOME-RETURN SPREAD, ARCSECONDS. SCALE NOT TO ANGLE.', 14, H - 14);
    }
    draw(); window.addEventListener('resize', draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  }

  /* ---------- Film dialog (raw video, always) ---------- */
  function film() {
    document.querySelectorAll('[data-film]').forEach(function (btn) {
      var dlg = document.getElementById(btn.getAttribute('data-film')); if (!dlg) return;
      var v = dlg.querySelector('video');
      btn.addEventListener('click', function () {
        if (!v.getAttribute('src')) v.setAttribute('src', v.getAttribute('data-src'));
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      });
      dlg.querySelectorAll('[data-close]').forEach(function (c) { c.addEventListener('click', function () { v.pause(); if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }); });
      dlg.addEventListener('close', function () { v.pause(); });
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    syncRawButtons();
    document.querySelectorAll('.fx[data-fx]').forEach(function (b) { b._fx = footage(b); });
    document.querySelectorAll('.fx[data-still]').forEach(function (b) { b._fx = still(b); });
    document.querySelectorAll('.fx[data-scene]').forEach(function (b) { b._fx = scene(b); });
    document.querySelectorAll('.hero .layer').forEach(function (l) { var f = l.querySelector('.fx'); l._fx = f ? f._fx : null; });
    document.querySelectorAll('[data-rotator]').forEach(rotator);
    document.querySelectorAll('[data-slider]').forEach(slider);
    document.querySelectorAll('[data-monitor]').forEach(monitor);
    document.querySelectorAll('[data-accuracy]').forEach(accuracy);
    film();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
