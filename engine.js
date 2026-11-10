// ===== 崩盤（コラプス） ルールエンジン =====
const N = 17;
const WHITE = 0, BLACK = 1;
const TYPES = {
  K: { name: '覇王',   ch: '王', val: 0, boost: false },
  A: { name: '光翼',   ch: '光', val: 3, boost: false },
  F: { name: '影翼', ch: '影', val: 3, boost: true },
  I: { name: '槍兵', ch: '槍', val: 2, boost: true },
  D: { name: '蒼龍',   ch: '龍', val: 4, boost: true },
  S: { name: '暴嵐', ch: '嵐', val: 4, boost: true },
  R: { name: '死鎌',   ch: '鎌', val: 3, boost: true },
  N: { name: '天馬',   ch: '馬', val: 2, boost: true },
  P: { name: '兵卒',   ch: '信', val: 1, boost: false },
};
const P_FORMS = [
  { name: '兵卒', ch: '兵' },
  { name: '猛兵', ch: '猛' },
  { name: '獣兵', ch: '獣' },
  { name: '覇獣', ch: '覇' },
];
const SAVIOR_POINTS = 20;
const SAVIOR_TURNS = 3;
const BLACK_START_POINTS = 2;

const idx = (r, c) => r * N + c;

// 兵卒の進化は、両陣営の覚醒の回数の合計で決まる（どちらが覚醒しても両陣営が進化）
function totalSummons(state) { return state.summons[0] + state.summons[1]; }
function pForm(state, side) { return Math.min(totalSummons(state), 3); }
function pieceName(state, p) { return p.t === 'P' ? P_FORMS[pForm(state, p.s)].name : TYPES[p.t].name; }
function pieceChar(state, p) { return p.t === 'P' ? P_FORMS[pForm(state, p.s)].ch : TYPES[p.t].ch; }
function pieceValue(state, p) {
  if (p.t === 'P') return totalSummons(state) >= 1 ? 2 : 1;
  return TYPES[p.t].val;
}

function initialState() {
  const board = new Array(N * N).fill(null);
  const put = (r, c, t, s) => { board[idx(r, c)] = { t, s }; };
  // 黒（上側）の配置。白は点対称。
  const blackSetup = [];
  [['A', 6], ['D', 7], ['K', 8], ['F', 9], ['A', 10]].forEach(([t, c]) => blackSetup.push([0, c, t]));
  [['I', 2], ['N', 4], ['R', 6], ['R', 10], ['N', 12], ['I', 14]].forEach(([t, c]) => blackSetup.push([1, c, t]));
  for (const c of [0, 1, 2, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16]) blackSetup.push([2, c, 'P']);
  blackSetup.push([2, 3, 'S'], [2, 13, 'S'], [3, 4, 'P'], [3, 12, 'P']);
  for (const [r, c, t] of blackSetup) {
    put(r, c, t, BLACK);
    put(N - 1 - r, N - 1 - c, t, WHITE);
  }
  return {
    board,
    turn: WHITE,
    pts: [0, BLACK_START_POINTS],
    summons: [0, 0],
    active: [0, 0],      // 覚醒の残り手番
    shrink: 0,           // 崩落回数（外周から何周消えたか）
    pLost: [0, 0],       // 猛兵以降に取られた兵卒の数（2体ごとに崩落）
    winner: null,        // 0 / 1 / 'draw'
    moveNo: 0,
    lastMove: null,
    events: [],
  };
}

function cloneState(s) {
  return {
    board: s.board.slice(),
    turn: s.turn,
    pts: s.pts.slice(),
    summons: s.summons.slice(),
    active: s.active.slice(),
    shrink: s.shrink,
    pLost: s.pLost.slice(),
    winner: s.winner,
    moveNo: s.moveNo,
    lastMove: s.lastMove,
    events: [],
  };
}

function inBoard(s, r, c) {
  const k = s.shrink;
  return r >= k && r <= N - 1 - k && c >= k && c <= N - 1 - k;
}

// 駒1つの合法手を列挙（[toIndex, ...]）
function pieceMoves(s, r, c) {
  const p = s.board[idx(r, c)];
  if (!p) return [];
  const side = p.s;
  const boosted = s.active[side] > 0 && TYPES[p.t].boost;
  const out = [];
  const at = (rr, cc) => s.board[idx(rr, cc)];
  // 移動または捕獲（自駒以外なら行ける）。戻り値: 先に進めるか
  const tryStep = (rr, cc, mode = 'both') => {
    if (!inBoard(s, rr, cc)) return false;
    const q = at(rr, cc);
    if (!q) { if (mode !== 'capture') out.push(idx(rr, cc)); return true; }
    if (q.s !== side && mode !== 'move') out.push(idx(rr, cc));
    return false;
  };
  const slide = (dr, dc, max, mode = 'both') => {
    for (let i = 1; i <= max; i++) if (!tryStep(r + dr * i, c + dc * i, mode)) break;
  };
  const jump = (rr, cc) => tryStep(rr, cc);
  const fw = side === WHITE ? -1 : 1;
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  switch (p.t) {
    case 'K': for (const [dr, dc] of D8) slide(dr, dc, 1); break;
    case 'A': for (const [dr, dc] of D8.slice(4)) slide(dr, dc, N); break;
    case 'F': for (const [dr, dc] of D8) slide(dr, dc, boosted ? 6 : 4); break;
    case 'I': for (const [dr, dc] of D8.slice(0, 4)) slide(dr, dc, boosted ? 9 : 6); break;
    case 'D': { // 縦3列・最大4（6）マス
      const m = boosted ? 6 : 4;
      slide(1, 0, m); slide(-1, 0, m);
      tryStep(r, c + 1); tryStep(r, c - 1);
      for (const dc of [1, -1]) for (const dr of [1, -1]) {
        if (!tryStep(r + dr, c + dc)) continue;
        for (let i = 2; i <= m; i++) if (!tryStep(r + dr * i, c + dc)) break;
      }
      break;
    }
    case 'S': { // 横3列・最大4（6）マス
      const m = boosted ? 6 : 4;
      slide(0, 1, m); slide(0, -1, m);
      tryStep(r + 1, c); tryStep(r - 1, c);
      for (const dr of [1, -1]) for (const dc of [1, -1]) {
        if (!tryStep(r + dr, c + dc)) continue;
        for (let i = 2; i <= m; i++) if (!tryStep(r + dr, c + dc * i)) break;
      }
      break;
    }
    case 'R': { // 斜め最大2（3）マス、飛び越え可
      const m = boosted ? 3 : 2;
      for (const [dr, dc] of D8.slice(4)) for (let i = 1; i <= m; i++) jump(r + dr * i, c + dc * i);
      break;
    }
    case 'N': { // L字、覚醒中は縦3横1
      const a = boosted ? 3 : 2;
      for (const [dr, dc] of [[a, 1], [a, -1], [-a, 1], [-a, -1], [1, a], [-1, a], [1, -a], [-1, -a]]) jump(r + dr, c + dc);
      break;
    }
    case 'P': {
      const f = pForm(s, side);
      if (f === 0) {
        slide(fw, 0, 2, 'move');
      } else if (f === 1) {
        slide(fw, 0, 2, 'move');
        tryStep(r + fw, c, 'capture');
      } else if (f === 2) {
        slide(fw, 0, 2); slide(-fw, 0, 1); slide(0, 1, 1); slide(0, -1, 1);
      } else {
        slide(fw, 0, 2); slide(-fw, 0, 2); slide(0, 1, 2); slide(0, -1, 2);
      }
      tryStep(r + fw, c + 1, 'capture');
      tryStep(r + fw, c - 1, 'capture');
      break;
    }
  }
  return out;
}

function allMoves(s, side = s.turn) {
  const moves = [];
  for (let i = 0; i < N * N; i++) {
    const p = s.board[i];
    if (!p || p.s !== side) continue;
    const r = (i / N) | 0, c = i % N;
    for (const to of pieceMoves(s, r, c)) moves.push([i, to]);
  }
  return moves;
}

// 崩落：外周1周を消す
function doShrink(s, reason) {
  if (s.shrink >= (N - 1) / 2) return;
  s.shrink++;
  const kingLost = [false, false];
  const fallen = [];
  for (let i = 0; i < N * N; i++) {
    const p = s.board[i];
    if (!p) continue;
    const r = (i / N) | 0, c = i % N;
    if (!inBoard(s, r, c)) {
      fallen.push(p);
      if (p.t === 'K') kingLost[p.s] = true;
      s.board[i] = null;
    }
  }
  s.events.push({ type: 'shrink', reason, level: s.shrink, fallen: fallen.length });
  if (s.winner === null) {
    if (kingLost[0] && kingLost[1]) s.winner = 'draw';
    else if (kingLost[0]) s.winner = BLACK;
    else if (kingLost[1]) s.winner = WHITE;
    if (s.winner !== null) s.events.push({ type: 'kingFall', winner: s.winner });
  }
}

function applyMove(state, from, to) {
  const s = cloneState(state);
  const me = s.turn, op = 1 - me;
  const piece = s.board[from];
  const captured = s.board[to];
  const wasBoosted = s.active[me] > 0;
  s.events.push({ type: 'move', side: me, piece: pieceName(s, piece), from, to, capture: captured ? pieceName(s, captured) : null });
  s.board[to] = piece;
  s.board[from] = null;
  s.lastMove = [from, to];
  s.moveNo++;

  if (captured) {
    if (captured.t === 'K') {
      s.winner = me;
      s.events.push({ type: 'kingCaptured', winner: me });
      return s;
    }
    const v = pieceValue(s, captured);
    s.pts[me] += v;
    s.events.push({ type: 'points', side: me, gain: v, total: s.pts[me] });
    if (captured.t === 'P' && totalSummons(s) >= 1) s.pLost[captured.s]++;
  }

  // 覚醒の残り手番を消費
  if (wasBoosted) {
    s.active[me]--;
    if (s.active[me] === 0) {
      s.events.push({ type: 'saviorEnd', side: me });
      doShrink(s, 'savior');
      if (s.winner !== null) return s;
    }
  }

  // 20ポイントで覚醒（自動）
  if (s.pts[me] >= SAVIOR_POINTS) {
    if (s.active[me] > 0) { // 発動中にもう一度覚醒した場合、前の覚醒は終わる
      s.events.push({ type: 'saviorEnd', side: me });
      doShrink(s, 'savior');
      if (s.winner !== null) return s;
    }
    s.pts[me] = 0;
    s.summons[me]++;
    s.active[me] = SAVIOR_TURNS;
    s.events.push({ type: 'savior', side: me, count: s.summons[me], form: P_FORMS[pForm(s, me)].name });
  }

  // 猛兵以降の兵卒が2体取られるごとに崩落
  for (const side of [op, me]) {
    while (s.pLost[side] >= 2 && s.winner === null) {
      s.pLost[side] -= 2;
      doShrink(s, 'pawns');
    }
  }
  if (s.winner !== null) return s;

  s.turn = op;
  if (allMoves(s, op).length === 0) {
    s.winner = me;
    s.events.push({ type: 'noMoves', winner: me });
  }
  return s;
}

// ===== CPU =====
function evaluate(s, side) {
  if (s.winner !== null) {
    if (s.winner === 'draw') return 0;
    return s.winner === side ? 1e6 : -1e6;
  }
  let score = 0;
  const k = s.shrink;
  for (let i = 0; i < N * N; i++) {
    const p = s.board[i];
    if (!p) continue;
    const sign = p.s === side ? 1 : -1;
    const r = (i / N) | 0, c = i % N;
    let v;
    if (p.t === 'K') {
      // 崩落で落ちそうな外周にいる覇王は危険
      const edge = Math.min(r - k, N - 1 - k - r, c - k, N - 1 - k - c);
      const danger = s.active[0] > 0 || s.active[1] > 0 || s.pLost[0] === 1 || s.pLost[1] === 1 || Math.max(...s.pts) >= 14;
      v = edge === 0 ? (danger ? -60 : -2) : (edge === 1 && danger ? -6 : 0);
      const home = p.s === WHITE ? (N - 1 - r) : r;
      v -= home * 3 + Math.abs(c - 8) * 1.5; // 覇王はむやみに動かさない
    } else {
      v = (TYPES[p.t].val + 1) * 10;
      if (p.t === 'P') {
        v = (pieceValue(s, p) + 1) * 8 + pForm(s, p.s) * 6;
        const adv = p.s === WHITE ? (N - 1 - r) : r;
        v += adv * 0.4;
      }
      if (p.t !== 'P') { const adv = p.s === WHITE ? (N - 1 - r) : r; v += Math.min(adv, 7) * 0.5; }
      const edge = Math.min(r - k, N - 1 - k - r, c - k, N - 1 - k - c);
      if (edge === 0) v *= 0.8;
    }
    score += sign * v;
  }
  score += (s.pts[side] - s.pts[1 - side]) * 3;
  score += (s.active[side] - s.active[1 - side]) * 4;
  return score;
}

function orderMoves(s, moves) {
  return moves.map(m => {
    const q = s.board[m[1]];
    const pr = q ? (q.t === 'K' ? 1000 : pieceValue(s, q) * 10 + 5) : 0;
    return [pr + Math.random(), m];
  }).sort((a, b) => b[0] - a[0]).map(x => x[1]);
}

// persp = この局面で手番の側。その側から見た評価値を返す
let _deadline = Infinity, _nodes = 0;
function negamax(s, depth, alpha, beta, persp) {
  if (depth === 0 || s.winner !== null) return evaluate(s, persp);
  if ((++_nodes & 255) === 0 && Date.now() > _deadline) throw 'timeout';
  const moves = orderMoves(s, allMoves(s));
  let best = -Infinity;
  for (const [f, t] of moves) {
    const ns = applyMove(s, f, t);
    const v = -negamax(ns, depth - 1, -beta, -alpha, 1 - persp);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function searchRoot(s, moves, depth, noise) {
  const side = s.turn;
  let best = null, bestV = -Infinity;
  const scored = [];
  for (const [f, t] of moves) {
    const ns = applyMove(s, f, t);
    let v;
    if (ns.winner !== null || depth === 1) v = evaluate(ns, side);
    else v = -negamax(ns, depth - 1, -Infinity, -(bestV - noise), 1 - side);
    v += Math.random() * noise;
    scored.push([v, [f, t]]);
    if (v > bestV) { bestV = v; best = [f, t]; }
  }
  scored.sort((a, b) => b[0] - a[0]);
  return { best, order: scored.map(x => x[1]) };
}

// level 1: 初級（1手読み＋ゆらぎ） 2: 中級（2手読み） 3: 上級（時間内で3手読み）
function cpuMove(s, level = 2, budgetMs = 2500) {
  let moves = orderMoves(s, allMoves(s));
  if (moves.length === 0) return null;
  if (level <= 1) return searchRoot(s, moves, 1, 30).best;
  _deadline = Infinity;
  const r2 = searchRoot(s, moves, 2, level === 2 ? 2 : 0);
  if (level === 2) return r2.best;
  _deadline = Date.now() + budgetMs; _nodes = 0;
  try {
    const r3 = searchRoot(s, r2.order, 3, 0);
    return r3.best;
  } catch (e) {
    if (e !== 'timeout') throw e;
    return r2.best;
  } finally { _deadline = Infinity; }
}

if (typeof module !== 'undefined') module.exports = { N, WHITE, BLACK, TYPES, P_FORMS, initialState, pieceMoves, allMoves, applyMove, cpuMove, pieceName, pieceChar, pieceValue, inBoard, pForm, totalSummons, idx, evaluate };
