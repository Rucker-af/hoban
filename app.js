
// ================================================================
//  アプリ設定（名前を変えるときはここだけ直せばよい）
// ================================================================
const APP = {
  title: '崩盤',
  ruby: 'COLLAPSE',
  tag: '覇王を討て、盤が崩れ落ちる前に',
  version: 'β 0.8',
};
// 駒の画像を差し替えるとき：キーは「駒_陣営」。例 'K_w': 'assets/K_w.png'
// 駒: K 覇王 / A 光翼 / F 影翼 / I 槍兵 / D 蒼龍 / S 暴嵐 / R 死鎌 / N 天馬 / P 兵卒 / P1 猛兵 / P2 獣兵 / P3 覇獣
// 陣営: w 白 / b 黒
const PIECE_IMAGES = {};

(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const SIDE = ['白', '黒'];
  const LV = { 1: '初級', 2: '中級', 3: '上級' };
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------- 保存 ----------------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('apoc.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('apoc.' + k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem('apoc.' + k); } catch (e) { } },
  };
  const settings = Object.assign({ timer: false, assist: true, sound: true, piece: 'both', targets: true, fx: 'full', flip: false, level: 2, side: 0 }, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);

  // ---------------- 効果音 ----------------
  const Sfx = (() => {
    let ctx = null, master = null;
    function init() {
      if (ctx) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination);
      } catch (e) { ctx = null; }
    }
    function tone(freq, dur, type = 'sine', vol = .3, when = 0, slideTo = null) {
      if (!ctx || !settings.sound) return;
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
    }
    function noise(dur, vol = .3, freq = 800, when = 0, sweepTo = null) {
      if (!ctx || !settings.sound) return;
      const t = ctx.currentTime + when;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
    }
    return {
      init,
      tap() { tone(880, .06, 'sine', .08); },
      tick() { tone(1200, .05, 'square', .06); },
      select() { tone(520, .08, 'triangle', .12); tone(780, .08, 'sine', .06, .02); },
      move() { noise(.07, .35, 1400); tone(170, .12, 'sine', .25); },
      capture() { noise(.12, .45, 900); tone(110, .3, 'sine', .35); tone(1320, .4, 'sine', .07, .02); tone(1980, .3, 'sine', .04, .04); },
      savior() { [440, 523.25, 659.25, 880, 987.77, 1318.5].forEach((f, i) => { tone(f, 1.6, 'sine', .1, i * .07); tone(f * 2, 1.2, 'triangle', .02, i * .07 + .02); }); noise(1.2, .08, 6000, 0, 1500); },
      shrink() { noise(1.3, .55, 300, 0, 60); tone(70, 1.2, 'sawtooth', .12, 0, 35); },
      win() { [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, .9, 'triangle', .14, i * .14)); tone(1046.5, 1.6, 'sine', .1, .6); },
      lose() { [392, 349.23, 311.13, 261.63].forEach((f, i) => tone(f, .9, 'triangle', .12, i * .22)); },
    };
  })();
  document.addEventListener('pointerdown', () => Sfx.init(), { once: false, passive: true });

  // ---------------- 背景 ----------------
  const bg = (() => {
    const cv = $('bg'), cx = cv.getContext('2d');
    let w, h, dpr, parts = [], dim = 0;
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.width = innerWidth * dpr; h = cv.height = innerHeight * dpr;
      cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    }
    function spawn(y) {
      return { x: Math.random() * w, y: y ?? h + Math.random() * h * .2, r: (Math.random() * 1.6 + .4) * dpr, vy: (Math.random() * .35 + .12) * dpr, vx: (Math.random() - .5) * .15 * dpr, a: Math.random() * .6 + .2, hue: Math.random() < .2 ? 'r' : 'g', ph: Math.random() * 6.28 };
    }
    resize(); addEventListener('resize', resize);
    for (let i = 0; i < 70; i++) parts.push(spawn(Math.random() * h));
    let last = 0;
    function frame(t) {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      if (t - last < 33) return; last = t;
      const grd = cx.createRadialGradient(w / 2, h * .38, 0, w / 2, h * .38, Math.max(w, h) * .8);
      grd.addColorStop(0, dim ? '#0a1224' : '#16203e'); grd.addColorStop(.55, '#0a0f1d'); grd.addColorStop(1, '#04060b');
      cx.fillStyle = grd; cx.fillRect(0, 0, w, h);
      const calm = settings.fx === 'calm' || reduceMotion;
      const n = calm ? 18 : dim ? 34 : parts.length;
      for (let i = 0; i < n; i++) {
        const p = parts[i];
        if (!calm) { p.y -= p.vy; p.x += p.vx + Math.sin(t / 1400 + p.ph) * .12 * dpr; }
        if (p.y < -10) parts[i] = spawn();
        const fl = .6 + .4 * Math.sin(t / 500 + p.ph);
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283);
        cx.fillStyle = p.hue === 'r' ? `rgba(255,110,90,${p.a * fl})` : `rgba(240,200,120,${p.a * fl})`;
        cx.shadowBlur = 8 * dpr; cx.shadowColor = p.hue === 'r' ? '#ff5a4a' : '#f0c878';
        cx.fill();
      }
      cx.shadowBlur = 0;
    }
    requestAnimationFrame(frame);
    return { dim(v) { dim = v ? 1 : 0; } };
  })();

  // ---------------- 画面遷移 ----------------
  let current = 'scr-title';
  const backTo = { 'scr-menu': 'scr-title', 'scr-setup': 'scr-menu', 'scr-rules': 'scr-menu', 'scr-settings': 'scr-menu' };
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    current = id;
    bg.dim(id === 'scr-game');
    if (id === 'scr-menu') refreshContinue();
    const el = $(id); el.scrollTop = 0;
  }
  document.querySelectorAll('.back').forEach(b => b.addEventListener('click', () => { Sfx.tap(); show(backTo[current] || 'scr-menu'); }));

  // ---------------- 駒の描画 ----------------
  function kindOf(state, p) { if (p.t !== 'P') return p.t; const f = pForm(state, p.s); return f ? 'P' + f : 'P'; }
  const KIND_CH = { K: '王', A: '光', F: '影', I: '槍', D: '龍', S: '嵐', R: '鎌', N: '馬', P: '兵', P1: '猛', P2: '獣', P3: '覇' };
  const KIND_NAME = { K: '覇王', A: '光翼', F: '影翼', I: '槍兵', D: '蒼龍', S: '暴嵐', R: '死鎌', N: '天馬', P: '兵卒', P1: '猛兵', P2: '獣兵', P3: '覇獣' };
  function pieceHTML(kind, side, cls = '') {
    const sc = side === WHITE ? 'w' : 'b';
    const img = PIECE_IMAGES[kind + '_' + sc];
    if (img) return `<span class="pc-wrap"><span class="pc ${sc} ${cls}"><img src="${img}" alt=""></span></span>`;
    const ink = sc === 'w' ? '#132744' : '#e9c47c';
    const cut = sc === 'w' ? '#dfe8f4' : '#1d150c';
    return `<span class="pc-wrap"><span class="pc ${sc} ${cls}"><svg viewBox="0 0 100 100" aria-hidden="true">` +
      `<circle cx="50" cy="50" r="47" fill="url(#m${sc})"/>` +
      `<circle cx="50" cy="50" r="46" fill="none" stroke="url(#r${sc})" stroke-width="4"/>` +
      `<circle cx="50" cy="50" r="39" fill="none" stroke="${ink}" stroke-width="1" opacity=".35"/>` +
      `<g class="emb" style="color:${ink};--cut:${cut}"><use href="#e-${kind}" x="12" y="12" width="76" height="76"/></g>` +
      `</svg><span class="kj">${KIND_CH[kind]}</span></span></span>`;
  }
  function applyPieceMode() {
    document.body.classList.remove('mode-both', 'mode-kanji', 'mode-icon');
    document.body.classList.add('mode-' + settings.piece);
  }

  // ================================================================
  //  遊び方
  // ================================================================
  const PIECE_INFO = {
    K: { n: 1, v: '—', d: '8方向に1マス。取られたら負け。崩落で盤外に落ちても負け。' },
    A: { n: 2, v: 3, d: '斜め4方向にどこまでも進める。覚醒の強化は受けない。' },
    F: { n: 1, v: 3, d: '8方向に最大4マス。覚醒中は最大6マス。' },
    I: { n: 2, v: 2, d: '縦横に最大6マス。覚醒中は最大9マス。' },
    D: { n: 1, v: 4, d: '自分を中心にした縦3列の範囲を、縦方向に最大4マス。覚醒中は6マス。' },
    S: { n: 2, v: 4, d: '自分を中心にした横3行の範囲を、横方向に最大4マス。覚醒中は6マス。' },
    R: { n: 2, v: 3, d: '斜め4方向に最大2マス。間の駒を飛び越えられる。覚醒中は3マス。' },
    N: { n: 2, v: 2, d: 'L字（縦2・横1）に跳ぶ。間の駒を飛び越えられる。覚醒中は縦3・横1。' },
    P: { n: 15, v: 1, d: '前に最大2マス進み、斜め前1マスの駒を取る。覚醒で進化する。' },
    P1: { n: '—', v: 2, d: 'どちらかの覚醒が発動すると進化（合計1回目）。前に最大2マス。正面1マスと斜め前1マスの駒を取れる。' },
    P2: { n: '—', v: 2, d: '覚醒の合計2回目で進化。前2・後ろ1・左右1マスに動ける。移動先すべてと斜め前1マスの駒を取れる。' },
    P3: { n: '—', v: 2, d: '覚醒の合計3回目以降。前後2・左右2マスに動ける。移動先すべてと斜め前1マスの駒を取れる。' },
  };

  function demoState(kind, boosted) {
    const s = initialState();
    s.board = new Array(N * N).fill(null);
    const t = kind.startsWith('P') ? 'P' : kind;
    s.board[idx(8, 8)] = { t, s: WHITE };
    s.summons = [kind === 'P1' ? 1 : kind === 'P2' ? 2 : kind === 'P3' ? 3 : 0, 0];
    s.active = [boosted ? 3 : 0, 0];
    return s;
  }
  function reachable(kind, boosted) {
    const s = demoState(kind, boosted);
    const mv = new Set(pieceMoves(s, 8, 8));
    const cap = new Set();
    for (let r = 2; r <= 14; r++) for (let c = 2; c <= 14; c++) {
      if (r === 8 && c === 8) continue;
      const i = idx(r, c);
      s.board[i] = { t: 'P', s: BLACK };
      if (pieceMoves(s, 8, 8).includes(i)) cap.add(i);
      s.board[i] = null;
    }
    return { mv, cap };
  }
  function renderDemo(el, kind, showBoost) {
    const base = reachable(kind, false);
    const boost = showBoost ? reachable(kind, true) : null;
    const W = 13;
    el.style.gridTemplateColumns = `repeat(${W}, 1fr)`;
    let html = '';
    for (let r = 2; r <= 14; r++) for (let c = 2; c <= 14; c++) {
      const i = idx(r, c);
      let cls = 'dc';
      if (base.mv.has(i)) cls += ' m';
      else if (boost && boost.mv.has(i)) cls += ' m2';
      if (!base.mv.has(i) && base.cap.has(i)) cls += ' x';
      const inner = r === 8 && c === 8 ? pieceHTML(kind, WHITE) : '';
      html += `<div class="${cls}">${inner}</div>`;
    }
    el.innerHTML = html;
  }
  function renderSetupBoard(el) {
    const s = initialState();
    el.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    let html = '';
    for (let i = 0; i < N * N; i++) {
      const p = s.board[i];
      html += `<div class="dc">${p ? pieceHTML(kindOf(s, p), p.s) : ''}</div>`;
    }
    el.innerHTML = html;
  }

  const PAGES = [
    {
      k: 'RULE I', h: '覇王を詰ませた方の勝ち', body: `
      <p>17×17の盤で、白と黒が1手ずつ交互に駒を動かします。将棋やチェスと同じく、動かした先に相手の駒があれば取れます。</p>
      <div class="card"><ul>
        <li>相手の<b>覇王</b>を取れば勝ち。</li>
        <li><b>崩落</b>で覇王が盤の外に落ちても負け。両方同時に落ちたら引き分け。</li>
        <li>動かせる駒がなくなった側も負け。</li>
      </ul></div>` },
    {
      k: 'RULE II', h: '盤と初期配置', body: `
      <p>手前が白（先手）、奥が黒（後手）。覇王は最後列の中央にいます。</p>
      <div class="demo-board" id="demo-setup"></div>
      <p class="note">先手の白が少し有利なので、後手の黒は最初から魂ポイントを2持っています。</p>` },
    {
      k: 'RULE III', h: '駒の動き', body: `
      <div class="piece-pick" id="pick"></div>
      <div class="demo"><div class="demo-info" id="demo-info"></div><div class="demo-board" id="demo-board"></div>
      <div class="legend"><span class="l1">移動できる</span><span class="l2">覚醒中に増える</span><span class="l3">駒を取れる</span></div>
      <div class="row" style="padding:10px 14px"><span class="lbl"><b>覚醒中の動きを見る</b></span><button class="toggle" id="demo-boost" type="button" aria-label="覚醒中の動き"></button></div></div>` },
    {
      k: 'RULE IV', h: '魂ポイント', body: `
      <p>相手の駒を取るたびに、駒ごとの魂ポイントが手に入ります。</p>
      <div class="card"><table class="pts-table"><tbody>
        <tr><td>蒼龍・暴嵐</td><td>4</td></tr>
        <tr><td>光翼・影翼・死鎌</td><td>3</td></tr>
        <tr><td>槍兵・天馬</td><td>2</td></tr>
        <tr><td>兵卒</td><td>1</td></tr>
        <tr><td>猛兵以降に進化した兵卒</td><td>2</td></tr>
        <tr><td>覇王（取った時点で勝ち）</td><td>—</td></tr>
      </tbody></table></div>` },
    {
      k: 'RULE V', h: '20ポイントで覚醒', body: `
      <div class="card"><ul>
        <li>魂ポイントが20に達すると、その手で自動的に覚醒が発動します。ポイントは0に戻ります。</li>
        <li>覚醒した側の<b>影翼・槍兵・蒼龍・暴嵐・死鎌・天馬</b>の移動距離が1.5倍になります。</li>
        <li>効果は覚醒した側の手番3回分。覇王・光翼・兵卒は強化されません。</li>
        <li>相手が覚醒している間でも、自分も覚醒します。</li>
      </ul></div>` },
    {
      k: 'RULE VI', h: '崩落 — 盤が崩れる', body: `
      <svg class="shrink-fig" viewBox="0 0 360 120" aria-label="崩落で盤が小さくなる図">
        ${[0, 1, 2, 3].map(i => {
          const x = 10 + i * 88, s = 76, k = i * 4.5;
          return `<rect x="${x}" y="10" width="${s}" height="${s}" fill="#0f1b31" stroke="#8a6b3a" stroke-width="1"/>` +
            (i ? `<rect x="${x + k / 2}" y="${10 + k / 2}" width="${s - k}" height="${s - k}" fill="none" stroke="#e0313f" stroke-width="${k}" opacity=".8"/>` : '') +
            `<text x="${x + s / 2}" y="108" fill="#9aa1b2" font-size="11" text-anchor="middle" font-family="sans-serif">${i ? i + '回目 ' : ''}${17 - i * 2}×${17 - i * 2}</text>`;
        }).join('')}
      </svg>
      <div class="card"><ul>
        <li>覚醒が終わった次の瞬間、盤の外周1周が消えます。</li>
        <li>猛兵以降の兵卒が、どちらかの陣営で2体取られるたびにも崩落します（崩落で落ちた分は数えません）。</li>
        <li>消えたマスにいた駒は消滅。<b>覇王でも即死</b>です。</li>
      </ul></div>` },
    {
      k: 'RULE VII', h: '兵卒の進化', body: `
      <p>白と黒のどちらの覚醒が発動しても、<b>両陣営の兵卒すべて</b>が進化します。段階は、両陣営の覚醒回数の合計で決まります。</p>
      <div class="forms" id="forms"></div>
      <div class="demo"><div class="demo-info" id="form-info"></div><div class="demo-board" id="form-board"></div>
      <div class="legend"><span class="l1">移動できる（駒があれば取れる）</span><span class="l3">取るときだけ行ける</span></div></div>
      <button class="cta" type="button" id="rules-tut">チュートリアルで試す</button>` },
  ];
  let page = 0, demoKind = 'K', demoBoost = false, formKind = 'P';
  function buildRules() {
    $('pages').innerHTML = PAGES.map((p, i) => `<div class="page" data-i="${i}"><span class="kicker">${p.k}</span><h3>${p.h}</h3>${p.body}</div>`).join('');
    $('pg-dots').innerHTML = PAGES.map(() => '<i></i>').join('');
    renderSetupBoard($('demo-setup'));
    $('pick').innerHTML = ['K', 'A', 'F', 'I', 'D', 'S', 'R', 'N', 'P'].map(k => `<button type="button" data-k="${k}">${pieceHTML(k, WHITE)}<span>${KIND_NAME[k]}</span></button>`).join('');
    $('pick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Sfx.tap(); demoKind = b.dataset.k; drawDemo(); });
    $('demo-boost').addEventListener('click', () => { demoBoost = !demoBoost; Sfx.tap(); drawDemo(); });
    $('forms').innerHTML = ['P', 'P1', 'P2', 'P3'].map((k, i) => `<button type="button" data-k="${k}">${pieceHTML(k, WHITE)}<span>${KIND_NAME[k]}<br><small style="color:var(--muted)">${i === 0 ? '覚醒前' : i === 3 ? '合計3回〜' : '合計' + i + '回'}</small></span></button>`).join('');
    $('forms').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Sfx.tap(); formKind = b.dataset.k; drawForm(); });
    $('rules-tut').onclick = () => { Sfx.select(); startTutorial(0); };
    drawDemo(); drawForm(); goPage(0);
  }
  function drawDemo() {
    $('pick').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === demoKind));
    $('demo-boost').setAttribute('aria-pressed', demoBoost);
    const info = PIECE_INFO[demoKind];
    $('demo-info').innerHTML = `<b>${KIND_NAME[demoKind]}</b><span class="note">各陣営 ${info.n}枚・魂 ${info.v}</span><p>${info.d}</p>`;
    renderDemo($('demo-board'), demoKind, demoBoost);
  }
  function drawForm() {
    $('forms').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === formKind));
    $('form-info').innerHTML = `<b>${KIND_NAME[formKind]}</b><p>${PIECE_INFO[formKind].d}</p>`;
    renderDemo($('form-board'), formKind, false);
  }
  function goPage(i) {
    page = Math.max(0, Math.min(PAGES.length - 1, i));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', +p.dataset.i === page));
    document.querySelectorAll('#pg-dots i').forEach((d, j) => d.classList.toggle('on', j === page));
    $('pg-prev').disabled = page === 0;
    $('pg-next').textContent = page === PAGES.length - 1 ? '閉じる' : '次へ';
    $('scr-rules').scrollTop = 0;
  }
  $('pg-prev').onclick = () => { Sfx.tap(); goPage(page - 1); };
  $('pg-next').onclick = () => { Sfx.tap(); if (page === PAGES.length - 1) show(rulesReturn); else goPage(page + 1); };
  let rulesReturn = 'scr-menu';
  // スワイプでページ送り
  (() => { let x0 = null; const el = $('pages');
    el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 60 && !e.target.closest('.demo-board')) goPage(page + (dx < 0 ? 1 : -1)); x0 = null; }); })();

  // ================================================================
  //  設定画面
  // ================================================================
  function drawSettings() {
    $('set-sound').setAttribute('aria-pressed', settings.sound);
    $('set-targets').setAttribute('aria-pressed', settings.targets);
    $('set-flip').setAttribute('aria-pressed', settings.flip);
    $('set-assist').setAttribute('aria-pressed', settings.assist);
    $('set-piece').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === settings.piece));
    $('set-fx').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === settings.fx));
    document.body.classList.toggle('calm', settings.fx === 'calm');
    document.body.classList.toggle('hide-targets', !settings.targets);
    applyPieceMode();
  }
  $('set-sound').onclick = () => { settings.sound = !settings.sound; saveSettings(); drawSettings(); Sfx.tap(); };
  $('set-targets').onclick = () => { settings.targets = !settings.targets; saveSettings(); drawSettings(); Sfx.tap(); };
  $('set-assist').onclick = () => { settings.assist = !settings.assist; saveSettings(); drawSettings(); Sfx.tap(); if (G) render(); };
  $('set-flip').onclick = () => { settings.flip = !settings.flip; saveSettings(); drawSettings(); Sfx.tap(); if (G) render(); };
  $('set-piece').onclick = e => { const b = e.target.closest('button'); if (!b) return; settings.piece = b.dataset.v; saveSettings(); drawSettings(); Sfx.tap(); };
  $('set-fx').onclick = e => { const b = e.target.closest('button'); if (!b) return; settings.fx = b.dataset.v; saveSettings(); drawSettings(); Sfx.tap(); };

  // ================================================================
  //  対戦設定
  // ================================================================
  let setupMode = 'cpu';
  function drawSetup(mode) {
    if (mode) setupMode = mode;
    $('setup-title').textContent = setupMode === 'cpu' ? 'CPU対戦' : '2人対戦';
    $('grp-lv').hidden = $('grp-side').hidden = setupMode !== 'cpu';
    $('timer-choices').querySelectorAll('.choice').forEach(b => b.setAttribute('aria-pressed', (b.dataset.t === '1') === settings.timer));
    $('lv-choices').querySelectorAll('.choice').forEach(b => b.setAttribute('aria-pressed', +b.dataset.lv === settings.level));
    $('side-choices').querySelectorAll('.choice').forEach(b => b.setAttribute('aria-pressed', b.dataset.side === String(settings.side)));
  }
  $('lv-choices').onclick = e => { const b = e.target.closest('.choice'); if (!b) return; settings.level = +b.dataset.lv; saveSettings(); drawSetup(); Sfx.select(); };
  $('side-choices').onclick = e => { const b = e.target.closest('.choice'); if (!b) return; settings.side = b.dataset.side === 'r' ? 'r' : +b.dataset.side; saveSettings(); drawSetup(); Sfx.select(); };
  $('timer-choices').onclick = e => { const b = e.target.closest('.choice'); if (!b) return; settings.timer = b.dataset.t === '1'; saveSettings(); drawSetup(); Sfx.select(); };
  $('btn-start-cpu').onclick = () => {
    Sfx.select();
    if (setupMode === 'pvp') { startGame({ mode: 'pvp', human: WHITE, level: 2, timer: settings.timer }); return; }
    const human = settings.side === 'r' ? (Math.random() < .5 ? WHITE : BLACK) : settings.side;
    startGame({ mode: 'cpu', human, level: settings.level, timer: settings.timer });
  };

  // ================================================================
  //  メニュー
  // ================================================================
  function refreshContinue() {
    const sv = store.get('save', null);
    const b = $('btn-continue');
    b.hidden = !sv;
    if (sv) $('continue-desc').textContent = (sv.cfg.mode === 'cpu' ? `CPU${LV[sv.cfg.level]}・あなたは${SIDE[sv.cfg.human]}` : '2人対戦') + `${sv.cfg.timer ? '・10秒切れ' : ''}・${sv.G.moveNo}手目`;
  }
  $('scr-title').addEventListener('click', () => { Sfx.init(); Sfx.select(); show('scr-menu'); });
  $('btn-continue').onclick = () => { Sfx.select(); resumeGame(); };
  $('btn-cpu').onclick = () => { Sfx.tap(); drawSetup('cpu'); show('scr-setup'); };
  $('btn-pvp').onclick = () => { Sfx.tap(); drawSetup('pvp'); show('scr-setup'); };
  $('btn-rules').onclick = () => { Sfx.tap(); rulesReturn = 'scr-menu'; goPage(0); show('scr-rules'); };
  $('btn-settings').onclick = () => { Sfx.tap(); drawSettings(); show('scr-settings'); };

  // ================================================================
  //  対局
  // ================================================================
  let G = null, cfg = null, history = [], stats = null, logItems = [], selected = null, targets = [], busy = false, cpuTimer = null, ended = false;
  const boardEl = $('board');
  const cells = [];
  for (let d = 0; d < N * N; d++) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cell';
    if (d % N === N - 1) b.classList.add('cr');
    if (d >= N * (N - 1)) b.classList.add('cb');
    b.addEventListener('click', () => onCell(toBoard(d)));
    boardEl.appendChild(b); cells.push(b);
  }
  const COLS = 'ABCDEFGHIJKLMNOPQ';
  const sq = i => COLS[i % N] + (N - ((i / N) | 0));
  function flipped() {
    if (!cfg) return false;
    if (cfg.mode === 'cpu') return cfg.human === BLACK;
    return settings.flip && G && G.turn === BLACK;
  }
  const toBoard = d => flipped() ? N * N - 1 - d : d;
  const toView = i => flipped() ? N * N - 1 - i : i;
  function cellOf(i) { return cells[toView(i)]; }

  function newStats() { return { caps: [0, 0], soul: [0, 0] }; }
  function startGame(c) {
    cfg = c; G = initialState(); history = []; tutHide(); stats = newStats(); logItems = []; ended = false;
    selected = null; targets = []; busy = false; clearTimeout(cpuTimer);
    $('ov-result').classList.remove('on');
    $('fx-layer').innerHTML = '';
    show('scr-game');
    render(); save();
    toast(cfg.mode === 'cpu' ? `あなたは${SIDE[cfg.human]}（${cfg.human === WHITE ? '先手' : '後手'}）` : '2人対戦・白から', `${cfg.mode === 'cpu' ? 'CPU ' + LV[cfg.level] : '交互に操作してください'}${cfg.timer ? '・1手10秒' : ''}`);
    maybeCpu(900);
  }
  function resumeGame() {
    const sv = store.get('save', null);
    if (!sv) return;
    tutHide(); cfg = sv.cfg; G = sv.G; G.events = []; stats = sv.stats || newStats(); logItems = sv.log || []; history = []; ended = false;
    selected = null; targets = []; busy = false;
    $('ov-result').classList.remove('on');
    show('scr-game'); render(); maybeCpu(700);
  }
  function save() {
    if (cfg && cfg.mode === 'tut') return;
    if (!G || G.winner !== null) { store.del('save'); return; }
    const g = Object.assign({}, G, { events: [] });
    store.set('save', { cfg, G: g, stats, log: logItems.slice(-400) });
  }
  function isHumanTurn() { return G && G.winner === null && !busy && (cfg.mode === 'pvp' || G.turn === cfg.human) && !(cfg.mode === 'tut' && tut.done); }

  function onCell(i) {
    if (!isHumanTurn()) return;
    const p = G.board[i];
    if (selected !== null && targets.includes(i)) { play(selected, i); return; }
    if (p && p.s === G.turn) {
      if (selected === i) { selected = null; targets = []; Sfx.tap(); }
      else { selected = i; targets = pieceMoves(G, (i / N) | 0, i % N); Sfx.select(); }
    } else { selected = null; targets = []; }
    render();
  }

  function play(from, to) {
    const prev = G;
    history.push({ G: prev, stats: JSON.parse(JSON.stringify(stats)), logLen: logItems.length });
    if (history.length > 200) history.shift();
    G = applyMove(prev, from, to);
    selected = null; targets = [];
    for (const ev of G.events) {
      if (ev.type === 'points') { stats.soul[ev.side] += ev.gain; }
      if (ev.type === 'move' && ev.capture) stats.caps[ev.side]++;
    }
    pushLog(G);
    const wasFlipped = cfg.mode === 'pvp' && settings.flip;
    render();
    if (!wasFlipped) animateMove(from, to);
    effects(prev, G, from, to);
    save();
  }

  function maybeCpu(delay = 450) {
    clearTimeout(cpuTimer);
    if (!G || cfg.mode !== 'cpu' || G.winner !== null || G.turn === cfg.human) return;
    busy = true; renderHint();
    cpuTimer = setTimeout(() => {
      if (current !== 'scr-game') { busy = false; return; }
      const m = cpuMove(G, cfg.level, 1800);
      busy = false;
      if (m) play(m[0], m[1]);
    }, delay);
  }

  function undo() {
    if (!history.length) return;
    clearTimeout(cpuTimer); busy = false;
    let h;
    do { h = history.pop(); } while (cfg.mode === 'cpu' && h && h.G.turn !== cfg.human && history.length);
    if (!h) return;
    if (cfg.mode === 'cpu' && h.G.turn !== cfg.human) { history.push(h); return; }
    G = h.G; stats = h.stats; logItems = logItems.slice(0, h.logLen); ended = false;
    selected = null; targets = [];
    $('fx-layer').innerHTML = '';
    render(); save();
  }

  // ---------------- 描画 ----------------
  function render() {
    if (!G) return;
    const k = G.shrink;
    const doom = G.active[0] > 0 || G.active[1] > 0;
    const pre = (totalSummons(G) >= 1 && (G.pLost[0] === 1 || G.pLost[1] === 1));
    computeAssist();
    boardEl.classList.toggle('bside', G.turn === BLACK);
    for (let d = 0; d < N * N; d++) {
      const i = toBoard(d), el = cells[d];
      const r = (i / N) | 0, c = i % N;
      const alive = inBoard(G, r, c);
      const ring = alive && Math.min(r - k, N - 1 - k - r, c - k, N - 1 - k - c) === 0;
      el.classList.toggle('gone', !alive);
      el.classList.toggle('star', i === idx(8, 8));
      el.classList.toggle('doom', ring && (doom || pre));
      el.classList.toggle('sel', selected === i);
      el.classList.toggle('last', !!G.lastMove && G.lastMove.includes(i));
      const tgt = targets.includes(i);
      el.classList.toggle('can', tgt && !G.board[i]);
      el.classList.toggle('cap', tgt && !!G.board[i]);
      el.classList.toggle('risky', tgt && assist.risky.has(i));
      const p = G.board[i];
      let label = sq(i);
      if (p) {
        const kind = kindOf(G, p);
        const cls = [];
        if (p.t === 'K') cls.push('king');
        if (G.active[p.s] > 0 && TYPES[p.t].boost) cls.push('boost');
        if (assist.threatened.has(i)) cls.push('threat');
        const key = kind + p.s + cls.join('');
        if (el.dataset.key !== key) { el.innerHTML = pieceHTML(kind, p.s, cls.join(' ')); el.dataset.key = key; }
        label += ` ${SIDE[p.s]}の${KIND_NAME[kind]}`;
      } else if (el.dataset.key) { el.innerHTML = ''; el.dataset.key = ''; }
      el.setAttribute('aria-label', label);
      el.disabled = !alive;
    }
    renderPlayers(); renderTurn(); renderHint(); renderRibbons(); timerSync();
    fitBoard();
  }

  // ---------------- 10秒切れ ----------------
  const TURN_MS = 10000;
  let tLeft = TURN_MS, tKey = null, tLast = 0, tSecShown = -1;
  function timerOn() { return !!(cfg && cfg.timer && G && G.winner === null && cfg.mode !== 'tut' && (cfg.mode === 'pvp' || G.turn === cfg.human)); }
  function timerSync() {
    const el = $('clock');
    if (!cfg || !cfg.timer || cfg.mode === 'tut') { el.hidden = true; return; }
    el.hidden = false;
    const key = G.moveNo + ':' + G.turn;
    if (key !== tKey) { tKey = key; tLeft = TURN_MS; tSecShown = -1; }
    drawClock();
  }
  function timerPaused() {
    return busy || current !== 'scr-game' || document.hidden || $('ov-pause').classList.contains('on') || $('fx-savior').classList.contains('on');
  }
  function drawClock() {
    const el = $('clock');
    const on = timerOn();
    el.classList.toggle('idle', !on);
    el.classList.toggle('b', G.turn === BLACK);
    const sec = Math.max(0, tLeft / 1000);
    el.classList.toggle('low', on && sec <= 3);
    $('clock-n').textContent = on ? Math.ceil(sec) : '–';
    $('clock-ring').style.strokeDashoffset = on ? (100 - sec * 10).toFixed(1) : 0;
  }
  function timerTick(t) {
    requestAnimationFrame(timerTick);
    const dt = tLast ? Math.min(250, t - tLast) : 0; tLast = t;
    if (!timerOn()) return;
    if (timerPaused()) return;
    tLeft -= dt;
    const s = Math.ceil(tLeft / 1000);
    if (s !== tSecShown) { tSecShown = s; if (s <= 3 && s > 0) Sfx.tick(); }
    drawClock();
    if (tLeft <= 0) timeUp();
  }
  requestAnimationFrame(timerTick);
  function timeUp() {
    clearTimeout(cpuTimer); busy = false;
    const loser = G.turn;
    G = Object.assign({}, G, { winner: 1 - loser, events: [] });
    endReason = 'timeout';
    logItems.push({ c: 'sh', t: `${SIDE[loser]}が時間切れ` });
    selected = null; targets = [];
    Sfx.lose(); toast('時間切れ', `${SIDE[loser]}の負け`, 'sh');
    render(); setTimeout(showResult, 900);
  }

  // 覚醒の残り手番を盤の上に大きく出す
  function renderRibbons() {
    const el = $('sv-ribbons');
    const sides = [WHITE, BLACK].filter(s => G.active[s] > 0 && G.winner === null);
    const html = sides.map(s => {
      const n = G.active[s], last = n === 1;
      const pips = [0, 1, 2].map(k => `<i class="${k < n ? 'on' : ''}"></i>`).join('');
      return `<span class="sv-rib ${s === WHITE ? 'w' : 'b'}${last ? ' last' : ''}"><span class="lbl">${SIDE[s]}<span class="lng">の覚醒</span></span><span class="pips">${pips}</span>` +
        `<span class="n">${n}</span><span class="u">手${last ? `<span class="lng">・${SIDE[s]}が次に指すと崩落</span>` : ''}</span></span>`;
    }).join('');
    el.classList.toggle('two', sides.length === 2);
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  }

  // 盤の大きさを、空いている場所に合わせて決める（狭いときは画面をスクロールさせる）
  function fitBoard() {
    if (current !== 'scr-game') return;
    const mid = document.querySelector('.g-mid'), frame = $('frame');
    mid.style.minHeight = '0px';
    frame.style.width = frame.style.height = '0px';
    const r = mid.getBoundingClientRect();
    const floor = Math.min(r.width, 360);
    const size = Math.floor(Math.min(760, Math.max(floor, Math.min(r.width, r.height))));
    frame.style.width = frame.style.height = size + 'px';
    mid.style.minHeight = size + 'px';
  }

  function renderPlayers() {
    const bottom = flipped() ? BLACK : WHITE;
    drawPlayer($('p-bot'), bottom);
    drawPlayer($('p-top'), 1 - bottom);
  }
  function drawPlayer(el, s) {
    const sc = s === WHITE ? 'w' : 'b';
    const who = cfg.mode === 'tut' ? (s === WHITE ? 'あなた' : '練習相手') : cfg.mode === 'cpu' ? (s === cfg.human ? 'あなた' : `CPU（${LV[cfg.level]}）`) : `プレイヤー${s + 1}`;
    let cnt = 0; for (const p of G.board) if (p && p.s === s) cnt++;
    const tags = [];
    tags.push(`<span class="tag form">兵卒：${P_FORMS[pForm(G, s)].name}</span>`);
    
    if (G.summons[s] > 0) tags.push(`<span class="tag">覚醒 ${G.summons[s]}回</span>`);
    if (totalSummons(G) >= 1) tags.push(`<span class="tag ${G.pLost[s] === 1 ? 'warn' : ''}">兵卒の損失 ${G.pLost[s]}/2</span>`);
    tags.push(`<span class="tag">駒 ${cnt}</span>`);
    el.className = `player ${sc}${G.turn === s && G.winner === null ? ' active' : ''}`;
    el.innerHTML = `<span class="medal">${pieceHTML('K', s)}</span>
      <span class="who"><b>${SIDE[s]}陣営</b><small>${who}${s === WHITE ? '・先手' : '・後手'}</small></span>
      <span class="soul"><span class="num">${G.pts[s]}<small>/20 魂</small></span><span class="bar20"><i style="width:${Math.min(100, G.pts[s] * 5)}%"></i></span></span>
      <span class="tags">${tags.join('')}</span>`;
  }
  function renderTurn() {
    const el = $('turn-pill');
    if (G.winner !== null) { el.className = 'turn-pill'; el.innerHTML = `終局<small>${G.moveNo}手</small>`; return; }
    el.className = 'turn-pill ' + (G.turn === WHITE ? 'w' : 'b');
    const who = cfg.mode === 'tut' ? 'チュートリアル' : cfg.mode === 'cpu' ? (G.turn === cfg.human ? 'あなたの番' : 'CPUの番') : `${SIDE[G.turn]}の番`;
    el.innerHTML = `${who}<small>${G.moveNo + 1}手目・盤 ${N - G.shrink * 2}×${N - G.shrink * 2}</small>`;
  }
  function renderHint() {
    const h = $('hint');
    if (!G) return;
    h.classList.remove('warn');
    if (G.winner !== null) { h.textContent = ''; return; }
    if (busy && cfg.mode === 'cpu' && G.turn !== cfg.human) { h.innerHTML = '<b>CPUが考えています…</b>'; return; }
    if (cfg.mode === 'tut' && tut.done) { h.textContent = ''; return; }
    const mine = G.turn === mySide();
    if (selected !== null) {
      const kind = kindOf(G, G.board[selected]);
      h.innerHTML = `<b>${KIND_NAME[kind]}</b>：${MOVE_SHORT[kind]}` + (settings.assist && assist.risky.size ? '<br><span class="risk-note">赤い点のマスは、動かすと取られる危険があります</span>' : '');
      return;
    }
    if (settings.assist && mine) {
      if (assist.kingAttacked) { h.classList.add('warn'); h.innerHTML = '<b>覇王が狙われています</b>。逃げるか、狙っている駒を取ろう'; return; }
      if (assist.kingOnRing && assist.shrinkSoon) { h.classList.add('warn'); h.innerHTML = '<b>崩落が近い</b>。外周にいる覇王を内側へ逃がそう'; return; }
      if (assist.threatened.size) { h.innerHTML = `赤く脈打つ駒（${assist.threatened.size}体）が狙われています`; return; }
      if (assist.kingOnRing && cfg.mode !== 'tut') { h.textContent = '覇王は外周にいます。崩落が起きる前に内側へ動かしておこう'; return; }
    }
    const doom = G.active[0] > 0 || G.active[1] > 0;
    h.textContent = doom ? '赤く光る外周は、覚醒が終わると崩れ落ちます' : '動かす駒をタップ';
  }

  // ---------------- 補助表示 ----------------
  const MOVE_SHORT = {
    K: '8方向に1マス', A: '斜めにどこまでも', F: '8方向に最大4マス（覚醒中6）', I: '縦横に最大6マス（覚醒中9）',
    D: '縦3列の範囲を縦に最大4マス（覚醒中6）', S: '横3行の範囲を横に最大4マス（覚醒中6）',
    R: '斜めに最大2マス・飛び越え可（覚醒中3）', N: 'L字に跳ぶ・飛び越え可（覚醒中は縦3横1）',
    P: '前に最大2マス・斜め前の駒を取る', P1: '前に最大2マス・正面と斜め前の駒を取る',
    P2: '前2・後1・左右1マス、斜め前の駒も取る', P3: '前後左右2マス、斜め前の駒も取る',
  };
  let assist = { threatened: new Set(), risky: new Set(), kingAttacked: false, kingOnRing: false, shrinkSoon: false };
  function mySide() { return cfg.mode === 'pvp' ? G.turn : cfg.human; }
  function computeAssist() {
    assist = { threatened: new Set(), risky: new Set(), kingAttacked: false, kingOnRing: false, shrinkSoon: false };
    if (!settings.assist || !G || G.winner !== null || (cfg.mode === 'tut' && tut.done)) return;
    const me = mySide(), op = 1 - me;
    for (const m of allMoves(G, op)) { const q = G.board[m[1]]; if (q && q.s === me) assist.threatened.add(m[1]); }
    const ki = G.board.findIndex(p => p && p.t === 'K' && p.s === me);
    if (ki >= 0) {
      assist.kingAttacked = assist.threatened.has(ki);
      const r = (ki / N) | 0, c = ki % N, k = G.shrink;
      assist.kingOnRing = Math.min(r - k, N - 1 - k - r, c - k, N - 1 - k - c) === 0;
    }
    assist.shrinkSoon = G.active[0] > 0 || G.active[1] > 0 || (totalSummons(G) >= 1 && (G.pLost[0] === 1 || G.pLost[1] === 1)) || Math.max(G.pts[0], G.pts[1]) >= 14;
    if (selected !== null && G.turn === me) {
      for (const t of targets) {
        const ns = applyMove(G, selected, t);
        if (ns.winner === me) continue;
        if (ns.winner !== null) { assist.risky.add(t); continue; }
        const kk = ns.board.findIndex(p => p && p.t === 'K' && p.s === me);
        if (allMoves(ns, op).some(m => m[1] === t || m[1] === kk)) assist.risky.add(t);
      }
    }
  }

  // ---------------- 演出 ----------------
  function animateMove(from, to) {
    if (settings.fx === 'calm' || reduceMotion) return;
    const a = cellOf(from).getBoundingClientRect(), b = cellOf(to).getBoundingClientRect();
    const pc = cellOf(to).querySelector('.pc-wrap');
    if (!pc) return;
    pc.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px)`;
    pc.classList.add('moving'); pc.style.transition = 'none';
    void pc.offsetWidth;
    pc.style.transition = '';
    pc.style.transform = '';
    setTimeout(() => pc.classList.remove('moving'), 300);
  }

  const sparks = (() => {
    const cv = $('sparks'), cx = cv.getContext('2d');
    let parts = [], running = false;
    function size() { const r = cv.getBoundingClientRect(); const d = Math.min(2, devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d; cx.setTransform(d, 0, 0, d, 0, 0); }
    function burst(cell, color, n = 26) {
      if (settings.fx === 'calm' || reduceMotion) return;
      size();
      const fr = $('frame').getBoundingClientRect(), r = cell.getBoundingClientRect();
      const x = r.left - fr.left + r.width / 2, y = r.top - fr.top + r.height / 2;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, v = Math.random() * 3 + 1;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 1, c: Math.random() < .5 ? color : '#f6e2ae', s: Math.random() * 2 + 1 });
      }
      if (!running) { running = true; requestAnimationFrame(tick); }
    }
    function tick() {
      cx.clearRect(0, 0, cv.width, cv.height);
      parts = parts.filter(p => p.life > 0);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += .08; p.vx *= .97; p.life -= .025;
        cx.globalAlpha = Math.max(0, p.life); cx.fillStyle = p.c; cx.shadowBlur = 8; cx.shadowColor = p.c;
        cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.283); cx.fill();
      }
      cx.globalAlpha = 1; cx.shadowBlur = 0;
      if (parts.length) requestAnimationFrame(tick); else { running = false; cx.clearRect(0, 0, cv.width, cv.height); }
    }
    return { burst };
  })();

  function shrinkAnim(prevBoard, fromLevel, toLevel) {
    if (settings.fx === 'calm' || reduceMotion) return;
    const layer = $('fx-layer');
    const fr = $('frame').getBoundingClientRect(), br = boardEl.getBoundingClientRect();
    const cw = br.width / N, ch = br.height / N, ox = br.left - fr.left, oy = br.top - fr.top;
    for (let lv = fromLevel; lv < toLevel; lv++) {
      for (let i = 0; i < N * N; i++) {
        const r = (i / N) | 0, c = i % N;
        if (Math.min(r, N - 1 - r, c, N - 1 - c) !== lv) continue;
        const d = toView(i), vr = (d / N) | 0, vc = d % N;
        const el = document.createElement('div');
        el.className = 'fall tile';
        el.style.left = (ox + vc * cw) + 'px'; el.style.top = (oy + vr * ch) + 'px';
        el.style.width = cw + 'px'; el.style.height = ch + 'px';
        el.style.setProperty('--r1', (Math.random() * 10 - 5) + 'deg');
        el.style.setProperty('--r2', (Math.random() * 120 - 60) + 'deg');
        // 外周を一周する順に崩れる
        const perim = vr === lv ? vc : vc === N - 1 - lv ? (N + vr) : vr === N - 1 - lv ? (2 * N + (N - vc)) : (3 * N + (N - vr));
        el.style.animationDelay = (perim * 9 + (lv - fromLevel) * 300) + 'ms';
        const p = prevBoard[i];
        if (p) el.innerHTML = pieceHTML(kindOf(G, p), p.s);
        layer.appendChild(el);
        setTimeout(() => el.remove(), 2200 + perim * 9);
      }
    }
    const frame = $('frame');
    frame.classList.remove('shake'); void frame.offsetWidth; frame.classList.add('shake');
  }

  let svSkip = null, svHide = null;
  function saviorFx(side, ev, prev, s) {
    const el = $('fx-savior');
    const sc = side === WHITE ? 'w' : 'b';
    el.style.setProperty('--rc', side === WHITE ? '#79d4ff' : '#ff6b5c');
    $('sv-sub').textContent = `${SIDE[side]}陣営${ev.count > 1 ? `・${ev.count}回目` : ''}`;
    if (reduceMotion) { toast(`${SIDE[side]}の覚醒`, `3手の間、移動距離1.5倍`); return; }
    // 何が変わったかのカード
    const cards = [];
    const boosted = ['F', 'I', 'D', 'S', 'R', 'N'].map(k => `<span class="svc-pc">${pieceHTML(k, side, 'boost')}</span>`).join('');
    cards.push(`<div class="svc ${sc}"><em>${SIDE[side]}の陣営</em><b>3ターン　移動距離 1.5倍</b><div class="svc-pcs">${boosted}</div></div>`);
    const evo = [WHITE, BLACK].filter(x => pForm(prev, x) !== pForm(s, x));
    const groups = evo.length === 2 && pForm(prev, 0) === pForm(prev, 1) && pForm(s, 0) === pForm(s, 1) ? [[evo, '両陣営']] : evo.map(x => [[x], `${SIDE[x]}陣営`]);
    for (const [xs, label] of groups) {
      const x = xs[0], f0 = pForm(prev, x), f1 = pForm(s, x);
      const k0 = f0 ? 'P' + f0 : 'P', k1 = 'P' + f1;
      const medal = (k, t) => xs.map(y => `<span class="svc-pc">${pieceHTML(k, y, t)}</span>`).join('');
      cards.push(`<div class="svc ${xs.length === 2 ? 'both' : x === WHITE ? 'w' : 'b'}"><em>${label}の兵卒 進化</em>` +
        `<div class="evo"><span class="evo-side">${medal(k0, '')}<small>${KIND_NAME[k0]}</small></span><span class="arrow">→</span><span class="evo-side">${medal(k1, 'boost')}<small>${KIND_NAME[k1]}</small></span></div>` +
        `<small class="svc-note">${MOVE_SHORT[k1]}${f0 === 0 ? '・取られたときの魂は2' : ''}</small></div>`);
    }
    cards.push(`<div class="svc mini ${sc}"><em>${SIDE[side]}の魂ポイント</em><b>0 から貯め直し</b></div>`);
    $('sv-cards').innerHTML = cards.map((c, i) => c.replace('class="svc', `style="--d:${(0.85 + i * 0.55).toFixed(2)}s" class="svc`)).join('');
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(svHide); svHide = setTimeout(() => el.classList.remove('on'), SV_MS);
  }
  const SV_MS = 4600;
  $('fx-savior').addEventListener('click', () => { if (svSkip) svSkip(); });

  let toastTimer;
  function toast(main, sub, cls = '') {
    const t = $('toast');
    t.className = cls; t.innerHTML = `${main}${sub ? `<small>${sub}</small>` : ''}`;
    void t.offsetWidth; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  }

  function effects(prev, s, from, to) {
    const evs = s.events;
    const mv = evs.find(e => e.type === 'move');
    let wait = 0;
    if (mv && mv.capture) {
      Sfx.capture();
      setTimeout(() => sparks.burst(cellOf(to), mv.side === WHITE ? '#79d4ff' : '#ff6b5c'), 120);
    } else Sfx.move();

    const sv = evs.find(e => e.type === 'savior');
    const shr = evs.filter(e => e.type === 'shrink');
    if (shr.length) {
      // 崩落前の配置（移動後）を作って崩れ落ちる駒を描く
      const pb = prev.board.slice(); pb[to] = pb[from]; pb[from] = null;
      setTimeout(() => {
        Sfx.shrink();
        shrinkAnim(pb, prev.shrink, s.shrink);
        const fallen = shr.reduce((a, e) => a + e.fallen, 0);
        toast('崩落', `盤は${N - s.shrink * 2}×${N - s.shrink * 2}に${fallen ? `・${fallen}体が落下` : ''}`, 'sh');
      }, 250);
      wait = Math.max(wait, 1100);
    }
    if (sv) {
      const at = wait ? wait + 100 : 150;
      setTimeout(() => { Sfx.savior(); saviorFx(sv.side, sv, prev, s); }, at);
      wait = at + (reduceMotion ? 500 : SV_MS - 300);
    }
    let cont, extra = 0;
    if (cfg.mode === 'tut') { cont = () => tutAfter(prev); extra = s.winner !== null ? 700 : 450; }
    else if (s.winner !== null) { cont = () => showResult(); extra = 900; }
    else if (wait) cont = () => { render(); maybeCpu(250); };
    else { maybeCpu(); return; }
    busy = true; renderHint();
    let done = false;
    const run = () => { if (done) return; done = true; svSkip = null; busy = false; cont(); };
    const tid = setTimeout(run, wait + extra);
    if (sv) svSkip = () => { clearTimeout(tid); clearTimeout(svHide); $('fx-savior').classList.remove('on'); run(); };
  }

  // ---------------- 棋譜 ----------------
  function pushLog(s) {
    for (const ev of s.events) {
      if (ev.type === 'move') logItems.push({ n: s.moveNo, t: `${SIDE[ev.side]} ${ev.piece} ${sq(ev.from)}→${sq(ev.to)}${ev.capture ? ` ×${ev.capture}` : ''}` });
      else if (ev.type === 'points') logItems.push({ c: 'pt', t: `魂 +${ev.gain}（${ev.total}）` });
      else if (ev.type === 'savior') logItems.push({ c: 'sv', t: `${SIDE[ev.side]}が覚醒（${ev.count}回目）・兵卒は${ev.form}へ` });
      else if (ev.type === 'saviorEnd') logItems.push({ c: 'sv', t: `${SIDE[ev.side]}の覚醒が終了` });
      else if (ev.type === 'shrink') logItems.push({ c: 'sh', t: `崩落・外周が消滅${ev.fallen ? `（${ev.fallen}体が落下）` : ''}${ev.reason === 'pawns' ? '・兵卒の損失による' : ''}` });
      else if (ev.type === 'kingCaptured') logItems.push({ c: 'pt', t: `覇王を詰ませた・${SIDE[ev.winner]}の勝ち` });
      else if (ev.type === 'kingFall') logItems.push({ c: 'sh', t: ev.winner === 'draw' ? '両方の覇王が落下・引き分け' : `覇王が落下・${SIDE[ev.winner]}の勝ち` });
      else if (ev.type === 'noMoves') logItems.push({ c: 'pt', t: `動かせる駒がない・${SIDE[ev.winner]}の勝ち` });
    }
  }
  function openLog() {
    const ol = $('log');
    ol.innerHTML = logItems.length ? logItems.map(l => l.n ? `<li><span class="n">${l.n}</span><span>${l.t}</span></li>` : `<li class="ev ${l.c}">${l.t}</li>`).join('') : '<li class="log-empty">まだ手が指されていません</li>';
    $('ov-log').classList.add('on');
    requestAnimationFrame(() => { ol.scrollTop = ol.scrollHeight; });
  }
  $('btn-log').onclick = () => { Sfx.tap(); openLog(); };
  $('log-close').onclick = () => { Sfx.tap(); $('ov-log').classList.remove('on'); };

  // ---------------- 結果 ----------------
  let endReason = null;
  function showResult() {
    store.del('save');
    const w = G.winner;
    const ev = G.events.find(e => ['kingCaptured', 'kingFall', 'noMoves'].includes(e.type));
    const why = endReason === 'resign' ? '投了' : endReason === 'timeout' ? '時間切れ' : !ev ? '' : ev.type === 'kingFall' ? '崩落で覇王が盤外へ落下' : ev.type === 'noMoves' ? '動かせる駒がなくなった' : '覇王を詰ませた';
    endReason = null;
    let big, lose = false;
    if (w === 'draw') big = '引き分け';
    else if (cfg.mode === 'cpu') { big = w === cfg.human ? '勝利' : '敗北'; lose = w !== cfg.human; }
    else big = `${SIDE[w]}の勝利`;
    $('result-sheet').className = 'sheet result' + (lose ? ' lose' : '');
    $('r-big').textContent = big;
    $('r-why').textContent = `${why}・${G.moveNo}手`;
    $('r-stats').innerHTML = `<span class="h"></span><span class="h">白</span><span class="h">黒</span>
      <span>取った駒</span><span class="v">${stats.caps[0]}</span><span class="v">${stats.caps[1]}</span>
      <span>獲得した魂</span><span class="v">${stats.soul[0]}</span><span class="v">${stats.soul[1]}</span>
      <span>覚醒</span><span class="v">${G.summons[0]}</span><span class="v">${G.summons[1]}</span>
      <span>崩落</span><span class="v" style="grid-column:2/4;text-align:center">${G.shrink}回</span>`;
    if (lose) Sfx.lose(); else Sfx.win();
    $('ov-result').classList.add('on');
    render();
  }
  $('r-again').onclick = () => { Sfx.select(); $('ov-result').classList.remove('on'); startGame(Object.assign({}, cfg)); };
  $('r-view').onclick = () => { Sfx.tap(); $('ov-result').classList.remove('on'); };
  $('r-menu').onclick = () => { Sfx.tap(); $('ov-result').classList.remove('on'); show('scr-menu'); };

  // ---------------- 中断メニュー ----------------
  function closePause() { $('ov-pause').classList.remove('on'); $('pa-resign-confirm').hidden = true; $('pa-resign').hidden = !!(cfg && cfg.mode === 'tut'); }
  $('btn-pause').onclick = () => {
    Sfx.tap();
    if (G && G.winner !== null) { $('ov-result').classList.add('on'); return; }
    $('pa-undo').disabled = !history.length;
    const t = cfg && cfg.mode === 'tut';
    $('pa-undo').hidden = t; $('pa-resign').hidden = t;
    $('ov-pause').classList.add('on');
  };
  $('pa-resume').onclick = () => { Sfx.tap(); closePause(); };
  $('pa-undo').onclick = () => { Sfx.tap(); closePause(); undo(); };
  $('pa-rules').onclick = () => { Sfx.tap(); closePause(); clearTimeout(cpuTimer); busy = false; rulesReturn = 'scr-game'; backTo['scr-rules'] = 'scr-game'; goPage(2); show('scr-rules'); };
  $('pa-settings').onclick = () => { Sfx.tap(); closePause(); clearTimeout(cpuTimer); busy = false; drawSettings(); backTo['scr-settings'] = 'scr-game'; show('scr-settings'); };
  $('pa-resign').onclick = () => { Sfx.tap(); $('pa-resign').hidden = true; $('pa-resign-confirm').hidden = false; };
  $('pa-resign-no').onclick = () => { Sfx.tap(); $('pa-resign-confirm').hidden = true; $('pa-resign').hidden = false; };
  $('pa-resign-yes').onclick = () => {
    closePause(); clearTimeout(cpuTimer); busy = false;
    const loser = cfg.mode === 'cpu' ? cfg.human : G.turn;
    G = Object.assign({}, G, { winner: 1 - loser, events: [] });
    endReason = 'resign';
    logItems.push({ c: 'pt', t: `${SIDE[loser]}が投了` });
    render(); showResult();
  };
  $('pa-title').onclick = () => { Sfx.tap(); closePause(); clearTimeout(cpuTimer); busy = false; save(); show('scr-menu'); };
  // 遊び方・設定から対局へ戻ったら CPU を再開
  const _show = show;
  show = function (id) {
    _show(id);
    if (id === 'scr-game' && G && G.winner === null) { render(); maybeCpu(600); }
    if (id === 'scr-game') requestAnimationFrame(fitBoard);
    if (id !== 'scr-settings') backTo['scr-settings'] = 'scr-menu';
    if (id !== 'scr-rules') { backTo['scr-rules'] = 'scr-menu'; if (id !== 'scr-game') rulesReturn = 'scr-menu'; }
  };

  // ================================================================
  //  チュートリアル
  // ================================================================
  function mk(pieces, extra = {}) {
    const s = initialState();
    s.board = new Array(N * N).fill(null);
    for (const [r, c, t, side] of pieces) s.board[idx(r, c)] = { t, s: side };
    return Object.assign(s, { pts: [0, 0] }, extra);
  }
  const KINGS = [[16, 8, 'K', WHITE], [3, 8, 'K', BLACK]];
  const LESSONS = [
    { h: '駒を動かす', p: '天馬はL字に跳ぶ駒です。<b>白の天馬</b>をタップして、光ったマスのどれかへ動かしてみよう。',
      ok: '駒を選ぶと、動けるマスが光ります。駒ごとに動きが違うので、迷ったら「ルール早見表」を見よう。',
      setup: () => mk([...KINGS, [12, 8, 'N', WHITE], [13, 3, 'P', WHITE], [13, 13, 'P', WHITE]]),
      goal: (s, prev) => { const e = s.events.find(e => e.type === 'move'); return e && prev.board[e.from].t === 'N'; },
      fail: '動かすのは天馬です。' },
    { h: '駒を取る', p: '動かした先に相手の駒があれば取れます。槍兵は縦横に最大6マス。<b>真上の黒の蒼龍</b>を取ろう。',
      ok: '駒を取ると魂ポイントが入ります。蒼龍は4点。強い駒ほど点が高い。',
      setup: () => mk([...KINGS, [14, 4, 'I', WHITE], [9, 4, 'D', BLACK], [8, 12, 'P', BLACK]]),
      goal: s => !!s.events.find(e => e.type === 'move' && e.capture === '蒼龍'),
      fail: '槍兵で、まっすぐ上にいる蒼龍を取ろう。' },
    { h: '覇王を詰ませる', p: '相手の<b>覇王</b>を取れば勝ち。光翼は斜めにどこまでも進めます。<b>白の光翼</b>で黒の覇王を取ろう。',
      ok: '覇王を取った瞬間に勝ちです。逆に、自分の覇王が狙われたら必ず逃がそう。',
      setup: () => mk([[16, 8, 'K', WHITE], [6, 10, 'K', BLACK], [14, 2, 'A', WHITE], [5, 4, 'P', BLACK], [5, 12, 'P', BLACK]]),
      goal: s => s.winner === WHITE,
      fail: '光翼を右上の斜めへ進めると、黒の覇王に届きます。' },
    { h: '崩落から逃げる', p: '白の覚醒はあと1手で終わり、その瞬間に<b>盤の外周が崩れます</b>。外周にいる白の覇王を、1マス内側へ逃がそう。',
      ok: '外周にいた黒の兵卒は落ちて消えました。覇王が落ちたら負けなので、崩落が近いときは覇王の位置に気をつけよう。',
      setup: () => mk([[16, 8, 'K', WHITE], [8, 8, 'K', BLACK], [13, 4, 'P', WHITE], [13, 12, 'P', WHITE], [0, 3, 'P', BLACK], [0, 13, 'P', BLACK], [6, 0, 'S', BLACK]],
        { active: [1, 0], summons: [1, 0], pts: [6, 0] }),
      goal: s => s.winner === null,
      fail: '覇王が外周に残ったまま崩落が起き、落ちてしまいました。覇王を上へ動かそう。' },
    { h: '覚醒する', p: '魂ポイントが<b>20</b>になると覚醒が発動します。いま19点。<b>天馬</b>で黒の兵卒を取って、あと1点を稼ごう。',
      ok: '覚醒中の3手は、強い駒の移動距離が1.5倍。両陣営の兵卒も進化します。ただし覚醒が終わると崩落が起きるので注意。',
      setup: () => mk([...KINGS, [12, 6, 'N', WHITE], [10, 7, 'P', BLACK], [14, 10, 'I', WHITE], [10, 12, 'P', BLACK]], { pts: [19, 2] }),
      goal: s => !!s.events.find(e => e.type === 'savior'),
      fail: '天馬のL字の先にいる兵卒を取ろう。' },
  ];
  const tut = { i: 0, done: false };
  function tutHide() { $('tut').hidden = true; $('p-top').hidden = false; }
  function startTutorial(i = 0) {
    tut.i = i; tut.done = false;
    cfg = { mode: 'tut', human: WHITE, level: 1 };
    G = LESSONS[i].setup(); history = []; stats = newStats(); logItems = []; selected = null; targets = []; busy = false;
    clearTimeout(cpuTimer); $('fx-layer').innerHTML = ''; $('ov-result').classList.remove('on');
    $('tut').hidden = false; $('p-top').hidden = true;
    drawTut();
    show('scr-game'); render();
  }
  function drawTut(state = 'todo') {
    const L = LESSONS[tut.i];
    $('tut-k').textContent = `LESSON ${tut.i + 1} / ${LESSONS.length}`;
    $('tut-h').textContent = state === 'ok' ? 'できた！' : L.h;
    $('tut-p').innerHTML = state === 'ok' ? L.ok : state === 'fail' ? `<span class="risk-note">${L.fail}</span>` : L.p;
    $('tut').classList.toggle('ok', state === 'ok');
    $('tut-next').hidden = state !== 'ok';
    $('tut-next').textContent = tut.i === LESSONS.length - 1 ? '仕上げに CPU 初級と対戦' : '次のレッスンへ';
    $('tut-retry').hidden = state === 'ok';
    $('tut-skip').textContent = tut.i === LESSONS.length - 1 ? 'メニューへ' : 'スキップ';
    requestAnimationFrame(fitBoard);
  }
  function tutAfter(prev) {
    const L = LESSONS[tut.i];
    if (L.goal(G, prev)) {
      tut.done = true; Sfx.win(); drawTut('ok');
      if (tut.i === LESSONS.length - 1) store.set('tutDone', true);
      render();
    } else {
      Sfx.lose(); drawTut('fail');
      G = prev; selected = null; targets = []; $('fx-layer').innerHTML = ''; render();
    }
  }
  $('tut-next').onclick = () => {
    Sfx.select();
    if (tut.i === LESSONS.length - 1) { tutHide(); startGame({ mode: 'cpu', human: WHITE, level: 1 }); }
    else startTutorial(tut.i + 1);
  };
  $('tut-retry').onclick = () => { Sfx.tap(); startTutorial(tut.i); };
  $('tut-skip').onclick = () => {
    Sfx.tap();
    if (tut.i === LESSONS.length - 1) { tutHide(); show('scr-menu'); } else startTutorial(tut.i + 1);
  };
  $('btn-tut').onclick = () => { Sfx.select(); startTutorial(0); };

  // ================================================================
  //  ルール早見表
  // ================================================================
  function buildRef() {
    const rows = ['K', 'A', 'F', 'I', 'D', 'S', 'R', 'N', 'P'].map(k =>
      `<li><span class="rm">${pieceHTML(k, WHITE)}</span><span><b>${KIND_NAME[k]}</b><small>${MOVE_SHORT[k]}</small></span><span class="rv">${PIECE_INFO[k].v}</span></li>`).join('');
    const forms = ['P1', 'P2', 'P3'].map((k, i) =>
      `<li><span class="rm">${pieceHTML(k, WHITE)}</span><span><b>${KIND_NAME[k]}</b><small>覚醒 合計${i + 1}回${i === 2 ? '以上' : ''}・${MOVE_SHORT[k]}</small></span><span class="rv">2</span></li>`).join('');
    // (覚醒回数は両陣営の合計)
    $('ref-body').innerHTML = `
      <section><h4>勝ち方</h4><p>相手の覇王を取る。崩落で相手の覇王が盤外に落ちても勝ち。</p></section>
      <section><h4>駒の動き<span>魂</span></h4><ul class="ref-list">${rows}</ul></section>
      <section><h4>覚醒</h4><p>魂ポイント20で自動で覚醒し、ポイントは0に。覚醒した側の手番3回、影翼・槍兵・蒼龍・暴嵐・死鎌・天馬の移動距離が1.5倍。</p></section>
      <section><h4>崩落</h4><p>覚醒が終わったとき、または進化後の兵卒がどちらかの陣営で2体取られるたびに、外周1周が消える。上の駒は消滅し、覇王なら負け。</p></section>
      <section><h4>兵卒の進化（どちらの覚醒でも両陣営）<span>魂</span></h4><ul class="ref-list">${forms}</ul></section>
      <section><h4>先手と後手</h4><p>白が先手。黒は魂ポイント2から始まる。</p></section>`;
  }
  $('btn-ref').onclick = () => { Sfx.tap(); $('ov-ref').classList.add('on'); };
  $('ref-close').onclick = () => { Sfx.tap(); $('ov-ref').classList.remove('on'); };
  $('ref-more').onclick = () => { Sfx.tap(); $('ov-ref').classList.remove('on'); $('pa-rules').click(); };
  $('ov-ref').addEventListener('click', e => { if (e.target.id === 'ov-ref') $('ov-ref').classList.remove('on'); });

  // テスト用の入口（ブラウザのコンソールから使える）
  window.__apoc = { state: () => G, set: s => { G = s; render(); }, play: (f, t) => play(f, t) };

  // ---------------- 初期化 ----------------
  $('t-title').textContent = APP.title; $('t-ruby').textContent = APP.ruby; $('t-tag').textContent = APP.tag;
  $('m-title').textContent = APP.title; $('m-ruby').textContent = APP.ruby;
  $('t-ver').textContent = APP.version;
  document.title = APP.title;
  buildRules(); buildRef(); drawSettings(); drawSetup();
  $('tut-badge').hidden = !!store.get('tutDone', false);
  addEventListener('resize', () => { if (current === 'scr-game') render(); });
  if (window.ResizeObserver) new ResizeObserver(() => fitBoard()).observe($('scr-game'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('ov-ref').classList.contains('on')) $('ov-ref').classList.remove('on');
      else if ($('ov-log').classList.contains('on')) $('ov-log').classList.remove('on');
      else if ($('ov-pause').classList.contains('on')) closePause();
      else if (current === 'scr-game') $('btn-pause').click();
      else if (backTo[current]) show(backTo[current]);
    }
  });
})();
